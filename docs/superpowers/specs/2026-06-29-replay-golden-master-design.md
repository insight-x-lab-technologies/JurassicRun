# Spec — Item 1.9: Replay / Golden Master

> Fase 1 (núcleo determinístico headless). Fecha a Fase 1.
> Data: 2026-06-29. Modo autônomo (SDD).

## Objetivo

Dar duas capacidades ao núcleo determinístico:

1. **Replay headless.** Uma função pura que roda a simulação inteira a partir de uma seed +
   `WorldConfig` + uma timeline de inputs, sem render, devolvendo o estado final.
2. **Golden master.** Um hash canônico e portável do `WorldState`, e um teste de regressão
   que fixa o hash de cenários `(seed, timeline)` conhecidos. Se qualquer mudança quebrar o
   determinismo bit-a-bit da simulação, o hash muda e o teste falha.

Isto transforma "a simulação é determinística" de uma propriedade testada por igualdade
estrutural (`toEqual`) em um **pino de regressão durável**: um valor commitado que detecta
drift mesmo entre versões do código, refactors e upgrades de engine/JS.

## Não-objetivos (YAGNI)

- Persistência/serialização de replays em disco ou rede (Fase 5/6, "compartilhar run").
- Formato compacto de timeline (RLE/codec). Timelines são `InputFrame[]` em memória.
- Gravar snapshots completos do estado em arquivo. O golden master é o **hash**; o snapshot
  canônico existe só em memória, para alimentar o hash (e ajudar debug em falha).
- Hashear estado interno privado do `SpawnGenerator` (cursor/rng) — ver "Decisão de escopo".

## Decisão de escopo: o que entra no hash

O hash cobre o **estado visível do `WorldState`**: escalares (tick, distance, food,
nearMisses, score, scoreMultiplier, alive, lastFlap, scrollSpeed, baseScrollSpeed, level,
difficultyEnabled, gravity, flapSpeed, worldHeight), o `pterodactyl` (transform/kinematics/
hitbox) e os arrays `obstacles`/`collectibles` (cada `Entity`: id, type, tags, transform,
hitbox, kinematics).

Os geradores (`spawner`/`collectibleSpawner`) **não** têm seu estado interno (cursor
`nextSpawnX`, `nextId`, estado do `Rng`) lido pelo hash. Justificativa:

- Esse estado interno é mantido `private` no `SpawnGenerator`; lê-lo exigiria alargar a API
  pública só para o hash.
- Numa timeline **fixa**, todo saque de RNG do gerador se manifesta nas entidades produzidas
  (posições/sequência/ids) ao longo da run. Duas execuções que divergem em qualquer draw
  divergem no estado visível antes do fim. Logo, hashear o visível já é um sinal de regressão
  forte e suficiente — sem custo de API.
- O hash registra apenas presença/ausência do gerador (cobertura do caminho com/sem seed).

## Arquitetura

Novo módulo-folha puro `src/core/replay/` (TS puro, zero DOM/IO, zero APIs proibidas —
REGRA 1). Composto por funções existentes; não altera `sim`/`spawn`/`rng`.

```
src/core/replay/
  timeline.ts   # tipo InputTimeline + helper(s) mínimos de construção
  simulate.ts   # simulate(config, timeline) → WorldState (roda createWorld + step)
  hash.ts       # hashState(world) → string (digest canônico 128-bit, hex)
  index.ts      # re-exports
```

### `timeline.ts`

```ts
export type InputTimeline = readonly InputFrame[];

/** Constrói uma timeline de `length` frames com flap quando pattern(i) é true. */
export function buildTimeline(length: number, pattern: (i: number) => boolean): InputTimeline;
```

`buildTimeline` é açúcar determinístico para cenários golden e testes (sem ele cada teste
reconstrói o loop). Nada de aleatório.

### `simulate.ts`

```ts
export function simulate(config: WorldConfig, timeline: InputTimeline): WorldState;
```

- `const w = createWorld(config); for (const frame of timeline) step(w, frame); return w;`
- Sem batching especial: a fps-independência já é garantida por `step` (testes de 1.3+).
- Se o dino morre no meio, `step` congela o estado (comportamento existente) — determinístico.
- Pura: não toca relógio nem RNG fora do core; toda aleatoriedade vem de `config.seed`.

### `hash.ts` — digest canônico

`hashState(world: WorldState): string` produz um hash hexadecimal estável e portável.

**Canonicalização (ordem fixa de campos).** Um "encoder" percorre o estado numa ordem
determinística e empurra valores num acumulador:

- **Números** são codificados pelos **bits IEEE-754 do float64** (via um `Float64Array(1)` +
  view `Uint32Array` de módulo, escopo de módulo, sem alocação por chamada). Isso captura
  drift bit-a-bit em floats (distance/score/posições). `-0` é normalizado para `+0`
  (`n === 0 ? 0 : n`) para evitar goldens surpreendentes; o estado válido nunca tem `NaN`.
- **Booleans** → `0`/`1`.
- **Strings** (tags, `hitbox.kind`, etc.) → comprimento seguido de cada `charCodeAt`.
- **Arrays** → comprimento seguido dos elementos em ordem.
- **Discriminantes** (`hitbox.kind`, `entity.type`) entram como string ⇒ mudança de forma
  muda o hash.

**Mistura (portável, REGRA 1).** Acumulador de 128 bits em 4 lanes uint32, atualizado por
palavra com `Math.imul` + XOR + rotação + `>>> 0` (mesma família de `xmur3`/`scramble` já no
repo). Finalização com avalanche por lane. Saída = 4 lanes × 8 hex = **32 chars hex**.
128 bits torna colisão acidental irrelevante para regressão.

> Reuso: o estilo de mistura segue `scramble`/`xmur3Hash` em `src/core/rng/mulberry32.ts`.
> Não reusamos `xmur3Hash` diretamente porque ele hasheia uma string; aqui absorvemos um
> **stream de palavras uint32** (bits de float incluídos), então é uma rotina nova no módulo.

Opcional interno (não exportado como API estável, mas útil): a percorrida do estado fica numa
função `encodeState(world, push)` para testar/depurar separada da mistura.

### `index.ts`

Re-exporta `InputTimeline`, `buildTimeline`, `simulate`, `hashState`.

## Fluxo de dados

```
WorldConfig (com seed) ─┐
                        ├─ simulate() ─→ WorldState final ─→ hashState() ─→ "deadbeef…" (32 hex)
InputTimeline ──────────┘
```

O golden master compara essa string contra um valor commitado.

## Testes

### Unit (`tests/core/replay/`)

`simulate.test.ts`:
- `simulate` equivale a `createWorld` + N `step` manuais (mesmo `WorldState` via `toEqual`).
- Timeline vazia ⇒ estado inicial.
- Reprodutibilidade: duas chamadas iguais ⇒ `toEqual`.

`hash.test.ts`:
- **Determinismo:** mesmo estado ⇒ mesmo hash (rodar 2×).
- **Sensibilidade:** mudar um único campo (ex.: `food += 1`, `distance += 1e-9`, mexer numa
  posição, trocar `hitbox.kind`, adicionar uma tag, virar `alive`) ⇒ hash diferente.
- **Formato:** 32 chars, `[0-9a-f]`.
- `-0` e `+0` produzem o mesmo hash (normalização).
- Mundos com e sem seed produzem hashes diferentes quando o conteúdo difere.

### Golden master / determinismo (`tests/determinism/replay.determinism.test.ts`)

- Tabela de cenários fixos: várias `(WorldConfig, InputTimeline)` cobrindo:
  - sem seed (só física até a morte),
  - com seed, dino sobrevivendo bastante (flap regular ⇒ acumula obstáculos/coletáveis/
    food/nearMisses/score),
  - com seed, `difficulty:false`,
  - seeds diferentes ⇒ hashes diferentes.
- Cada cenário: `expect(hashState(simulate(cfg, tl))).toBe('<golden>')`.
- Os `<golden>` são **gerados na 1ª implementação** (rodar, ler o valor real, fixar no teste)
  e commitados. Mudança futura de determinismo ⇒ falha que aponta o cenário.
- `worldHeight` realista nos cenários (pegadinha de 1.8: alturas pequenas matam o dino antes
  de exercitar economia/coletáveis).

A bateria já roda no CI via `npm run test:determinism` (Fase 0).

## Conformidade com as REGRAS

- **REGRA 1 (determinismo):** módulo puro em `src/core/`, sem `Math.random`/`Date`/
  `performance`; só `Math.imul`/`>>>`/`Float64Array`/`Uint32Array`. Guarda anti-API proibida
  e o teste ESLint cobrem o diretório.
- **REGRA 2 (arte desacoplada):** hash usa hitbox lógica; nenhum dado de pixel.
- **REGRA 3 (performance):** hash não está no hot path do jogo (ferramenta de teste/replay);
  ainda assim o encoder usa buffers de módulo e evita alocação por palavra. `simulate` só
  chama `step`.
- **REGRA 4 (i18n) / REGRA 5 (asset-spec):** não se aplicam (sem strings de UI, sem imagens).

## Definição de pronto

- `npm test` e `npm run check` verdes; `npm run test:determinism` verde incluindo o novo
  golden master.
- `determinism-guardian` confirma contrato intacto.
- Item 1.9 marcado `[x]`; `CLAUDE.md` "Estado atual" atualizado; Fase 1 concluída.
