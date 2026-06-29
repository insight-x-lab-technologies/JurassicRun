# Spec — Item 1.7: Dificuldade (curva pura distância → velocidade, gaps, nível)

> Fase 1 (núcleo determinístico headless). Esta feature dá ao jogo a sua **progressão**:
> quanto mais longe o pterodáctilo voa, mais rápido o mundo rola e mais apertado fica o
> campo de obstáculos. Tudo derivado puramente da distância ⇒ **reinicia a cada partida**
> automaticamente (cada partida começa em `distance = 0`). Determinístico e alocação-zero
> no hot path.

## Objetivo

1. **Função pura de dificuldade** `difficultyAt(distance) → DifficultyParams`, sem RNG, sem
   tempo, monotônica e limitada (caps/floors).
2. **Velocidade** do scroll cresce com a distância (até um teto).
3. **Gaps/densidade** dos obstáculos diminuem com a distância (até um piso) ⇒ campo mais
   denso.
4. **Nível** inteiro derivado da distância (para HUD/Game Over na Fase 2), que **reinicia a
   cada partida**.
5. Integração no `step` (velocidade) e no `SpawnGenerator` de obstáculos (gaps), preservando
   determinismo e independência de fps/batching.
6. Testes: unidade (curva), integração (`step`/spawn) e determinismo.

## Não-objetivos (fora de escopo, itens futuros)

- Economia/multiplicadores/score (1.8), golden master/replay (1.9).
- **Distribuição ponderada de tipos de obstáculo** (variedade ficando mais difícil com o
  nível) — adiado: exige metadados de dificuldade por tipo no catálogo; é tuning, não
  correção de núcleo. Ver "Adiados".
- **Densidade de coletáveis** variando com a dificuldade — coletáveis mantêm espaçamento
  constante por ora.
- Mexer em gravidade/flap (o *feel* do controle do jogador fica constante).
- Tuning fino das constantes (placeholders; afinados na Fase 2).

## Modelo conceitual: por que "gaps" e "densidade" são o mesmo eixo aqui

No modelo atual, um obstáculo é **uma** hitbox ancorada (chão/teto/flutuante) — não há par
de "canos" estilo Flappy com uma abertura vertical. Logo, o eixo espacial de dificuldade é o
**espaçamento horizontal entre obstáculos consecutivos** (`gapMin`/`gapMax` do
`SpawnGenerator`). "Densidade" (obstáculos por distância) é exatamente o **inverso** desse
espaçamento. Portanto a curva expõe **um** lever espacial (escala de gap) que cobre tanto
"gaps" quanto "densidade" do roadmap. O segundo eixo, independente, é a **velocidade**. Um
eventual terceiro eixo real (variedade ponderada de tipos) fica adiado (acima).

## Arquitetura

### Novo módulo: `src/core/difficulty/`

Pasta já existente (só `.gitkeep`). Matemática pura, sem estado, sem IO, sem RNG, sem tempo.

```
src/core/difficulty/
  constants.ts   # constantes de tuning da curva (placeholders Fase 2)
  curve.ts       # difficultyAt(distance), levelForDistance(distance), DifficultyParams
  index.ts       # barrel
```

#### Tipo e funções

```ts
export interface DifficultyParams {
  level: number;       // 1-based, para HUD; cresce em degraus com a distância
  speedScale: number;  // ≥ 1, cresce de 1 (em d=0) até SPEED_SCALE_MAX
  gapScale: number;    // ≤ 1, cai de 1 (em d=0) até GAP_SCALE_MIN
}

export function difficultyAt(distance: number): DifficultyParams;
export function levelForDistance(distance: number): number;
```

**Curva = escalas adimensionais ancoradas em 1.0 na distância 0.** Escolha deliberada: a
dificuldade é uma curva *dimensionless*; os valores-base (velocidade, gaps) continuam morando
em `sim/constants` e `spawn/constants` (fonte única de verdade) e são apenas **multiplicados**
pelas escalas. Em `distance = 0` ⇒ `speedScale = 1`, `gapScale = 1`, `level = 1` ⇒
comportamento idêntico ao de hoje no início da partida.

**Forma da curva (suave, assintótica, aritmética pura — determinística):**

- `speedScale(d) = 1 + (SPEED_SCALE_MAX − 1) · d / (d + SPEED_HALF_DISTANCE)`
- `gapScale(d)   = 1 − (1 − GAP_SCALE_MIN) · d / (d + GAP_HALF_DISTANCE)`
- `level(d)      = 1 + floor(d / DISTANCE_PER_LEVEL)`

Razão de usar a forma hiperbólica `d/(d+H)` em vez de rampa linear com clamp: cresce sempre
(bom para Endless), mas **assintótica** ao cap (nunca fica injogável), com `H` = distância em
que a escala atinge a metade do caminho até o cap. Usa só `+`, `−`, `·`, `/`, `floor` —
todas operações IE-754 corretamente arredondadas e portáveis (DETERMINISM.md §5); **sem**
`Math.pow`/`exp`/`log`/`hypot`. `d ≥ 0` sempre (distância é monotônica não-negativa) ⇒ sem
divisão por zero (`d + H > 0`).

### Constantes (`src/core/difficulty/constants.ts`) — placeholders Fase 2

- `SPEED_SCALE_MAX = 2` (velocidade-teto = 2× base).
- `SPEED_HALF_DISTANCE = 3000`.
- `GAP_SCALE_MIN = 0.6` (gaps encolhem até 60%).
- `GAP_HALF_DISTANCE = 3000`.
- `DISTANCE_PER_LEVEL = 500`.

### Integração no `step` (`src/core/sim/step.ts`) — velocidade + nível

`WorldState` ganha:
- `baseScrollSpeed: number` — velocidade-base imutável (vem de `config.scrollSpeed`).
- `level: number` — nível atual (HUD/Game Over).
- `difficultyEnabled: boolean` — seam de configuração (default `true`). Permite mundos de
  teste de física pura com velocidade/gaps constantes.
- `scrollSpeed` passa a ser o **valor efetivo vivo** (cache do passo atual; já é lido para
  `dx` e near-miss, e o HUD/render leem na Fase 2).

No `step`, **no topo** (após `tick += 1`, antes da física), quando `difficultyEnabled`:
```
const d = difficultyAt(world.distance);
world.scrollSpeed = world.baseScrollSpeed * d.speedScale;
world.level = d.level;
```
A dificuldade é amostrada na `distance` **no início** do step (progresso até agora); depois
`dx = scrollSpeed · FIXED_DT` e `distance += dx` usam a velocidade já atualizada. Quando
`difficultyEnabled === false`, `scrollSpeed` permanece `baseScrollSpeed` e `level` fica 1
(constantes). Sem alocação por frame (`difficultyAt` retorna um literal pequeno; ver nota de
performance abaixo).

### Integração no `SpawnGenerator` (`src/core/spawn/generator.ts`) — gaps

O gerador de **obstáculos** passa a escalar o gap pela dificuldade **na posição x do spawn**,
mantendo o campo como função pura de (seed, x):

- Novo parâmetro **opcional** de construtor `gapScale?: (x: number) => number` (default
  `() => 1`). Mantém `SpawnConfig` como dados puros (sem misturar comportamento).
- No laço, o avanço do cursor vira:
  ```
  const s = this.gapScale(this.nextSpawnX);
  this.nextSpawnX += this.rng.range(this.config.gapMin * s, this.config.gapMax * s);
  ```
- `clone()` propaga a mesma referência de função.

**Determinismo preservado:** `gapScale` é função pura de x; a **contagem e a ordem dos saques
de RNG não mudam** (continua: `pick` tipo → `makeHitbox` → `placeY` [1 saque] → `range` [1
saque]). O gap entre o obstáculo em `x` e o próximo é avaliado em `x = nextSpawnX` (o obstáculo
recém-posto) ⇒ o campo permanece função pura de (seed, x) ⇒ **independente de batching/fps**
(o cursor avança por obstáculo emitido, como hoje).

No `world.ts`, `buildSpawner` (obstáculos) passa `(x) => difficultyAt(x).gapScale` quando
`difficultyEnabled`; o gerador de **coletáveis** segue com `gapScale` default (espaçamento
constante — fora de escopo).

### `SpawnConfig` agora `readonly` (pendência adiada de 1.4)

Marcar os campos de `SpawnConfig` como `readonly` e `Object.freeze` nos defaults
(`DEFAULT_SPAWN_CONFIG`/`DEFAULT_COLLECTIBLE_CONFIG`). Endereça o minor adiado em
[[deferred-core-spawn-1-4]] sem mudar comportamento (o merge por spread cria novos objetos).

### `createWorld` / `cloneWorld`

- `createWorld`: define `baseScrollSpeed = c.scrollSpeed`, `scrollSpeed = c.scrollSpeed`
  (efetivo inicial = base, pois `speedScale(0) = 1`), `level = 1`,
  `difficultyEnabled = config.difficulty ?? true`. Quando habilitado e há seed, o spawner de
  obstáculos recebe o `gapScale` da dificuldade.
- `cloneWorld`: copia os novos campos (`baseScrollSpeed`, `level`, `difficultyEnabled`).
- `WorldConfig` ganha `difficulty?: boolean`.

## Decisões de design (firmadas)

- **Dificuldade = função pura de `distance`**, não estado acumulado. Como cada partida começa
  em `distance = 0`, o nível e as escalas **reiniciam automaticamente** — sem código de reset,
  sem persistência. Atende "nível aumenta com a distância; reinicia a cada partida".
- **Escalas adimensionais (multiplicadores), não valores absolutos.** Mantém os valores-base
  numa fonte única (`sim/constants`, `spawn/constants`); a dificuldade é desacoplada do tuning
  de base. `WorldConfig.scrollSpeed` continua sendo a velocidade-base (multiplicada pela
  escala).
- **Amostragem de velocidade no início do step** (na `distance` corrente), de gap na **x do
  spawn**. Ambas puras e estáveis sob batching.
- **`difficultyEnabled` é um seam legítimo** (default `true`, ligado em jogo real), não só
  para teste: isola física pura de progressão e espelha o gate de spawn por `seed`.
- **Curva hiperbólica assintótica** (`d/(d+H)`): cresce sempre (Endless), limitada (jogável),
  aritmética pura (determinística). Sem transcendentais.
- **Gaps e densidade são um lever** neste modelo (espaçamento ↔ 1/densidade); exposto como
  `gapScale`. Documentado acima.

## Adiados (conscientemente, não são bugs)

- **Distribuição ponderada de tipos de obstáculo** (variedade mais difícil com o nível):
  exige metadados de dificuldade/peso por tipo no `OBSTACLE_CATALOG` e seleção ponderada no
  `SpawnGenerator` (hoje `rng.pick` uniforme). É tuning de Fase 2 / item dedicado. Anotado em
  [[deferred-core-spawn-1-4]] e [[deferred-core-collision-1-6]].
- **Densidade de coletáveis** variando com a dificuldade — coletáveis seguem constantes.
- **Footgun `halfH=0` p/ dino não-AABB** (de [[deferred-core-sim-1-3]]/[[deferred-core-collision-1-6]]):
  intacto; o dino continua AABB. Sem impacto.
- **Curva por `nível` (degraus) em vez de `distância` (contínua)** para velocidade/gaps:
  optei por contínua (mais suave). O `nível` discreto existe só para exibição. Pode ser
  revisitado no tuning se o jogo pedir "saltos" perceptíveis de dificuldade.

## Nota de performance (REGRA 3)

`difficultyAt` retorna um objeto literal por chamada (1× por step para velocidade; 1× por
obstáculo emitido para gap). Isso é alocação pontual, **não** alocação por entidade-por-frame
no laço de colisão/cull. Para a velocidade, é 1 objeto/step (desprezível e coletável). Se um
profiling da Fase 2 acusar pressão de GC, dá para expor `speedScaleAt(d)`/`gapScaleAt(d)`
escalares e usar no hot path — mas **não** antecipo isso agora (YAGNI; o laço quente real
— colisão/cull por entidade — continua alocação-zero).

## Plano de testes

- **`tests/core/difficulty/curve.test.ts`** — unidade:
  - Ancoragem: `difficultyAt(0)` ⇒ `speedScale === 1`, `gapScale === 1`, `level === 1`.
  - Monotonicidade: `speedScale` estritamente crescente, `gapScale` estritamente decrescente
    em distâncias crescentes (amostras).
  - Limites: `speedScale < SPEED_SCALE_MAX` e `gapScale > GAP_SCALE_MIN` para todo `d` finito;
    tendem aos limites em `d` grande (ex.: `d = 1e7` dentro de tolerância).
  - `level`: degraus corretos em múltiplos de `DISTANCE_PER_LEVEL` (bordas: `d` logo abaixo /
    igual / acima).
  - Determinismo da função: mesma `d` ⇒ mesmo resultado (idempotência/pureza).
- **`tests/core/sim/difficulty-step.test.ts`** — integração:
  - Mundo com `difficultyEnabled` (default): `scrollSpeed` aumenta ao longo de muitos steps;
    `level` sobe ao cruzar `DISTANCE_PER_LEVEL`; mundo recém-criado tem `level === 1` e
    `scrollSpeed === baseScrollSpeed` (**reset por partida**).
  - Mundo com `difficulty: false`: `scrollSpeed` constante (= base) e `level === 1` sempre.
  - Obstáculos: com dificuldade, espaçamentos médios encolhem em x grande vs. x pequeno
    (campo mais denso) — comparar gaps entre obstáculos gerados perto de x=0 e em x grande.
- **`tests/determinism/difficulty.determinism.test.ts`**:
  - Reprodutibilidade: mesma seed+timeline ⇒ `distance`/`level`/`scrollSpeed`/sequência de
    obstáculos idênticos (hash do estado).
  - Independência de fps: 1/2/5 steps por "frame" ⇒ estado idêntico (velocidade variável
    incluída).
  - Duas partidas frescas atingem dificuldade idêntica na mesma `distance` (confirma reset).

## Definição de pronto

- `npm run check` limpo, `npm test` verde, bateria de determinismo verde
  (`npm run test:determinism`), `verify-determinism` ok; `determinism-guardian` "contrato
  intacto".
- `difficultyAt`/`levelForDistance` puras e cobertas; velocidade e gaps integrados; `level`
  no `WorldState` reiniciando a cada partida.
- Sem alocação por-entidade-por-frame no hot path (cull/colisão continuam alocação-zero).
- `SpawnConfig` `readonly` + defaults congelados (pendência de 1.4).
- Item 1.7 marcado `[x]` em `PHASE-01`; "Estado atual" do `CLAUDE.md` atualizado.
