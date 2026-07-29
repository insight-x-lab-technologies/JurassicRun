# Design — 9.8 Novos tipos de obstáculo

> Item 9.8 da Fase 9 (`docs/roadmap/PHASE-09-structural-improvements.md`, Frente D).
> **Toca `src/core/`** ⇒ contrato de determinismo obrigatório.

## Problema

O `OBSTACLE_CATALOG` tem 4 tipos desde a Fase 1 (tree/vine/boulder/stalactite). Todos são
**uma entidade, uma hitbox convexa**, e todos ocupam uma faixa vertical contínua a partir de uma
borda (ou flutuam soltos). Falta variedade de *decisão* para o jogador: não existe passagem
"por dentro" nem par que estreita o corredor. Além disso, `obstacle.rock_arch` ficou adiado no item
1.4 justamente porque um arco "com buraco" exige hitbox **não-convexa**.

## Objetivo

Adicionar **3 tipos novos** ao catálogo, com lógica determinística, hitbox desacoplada da arte,
justiça garantida por teste, e o mínimo de mecanismo novo no core.

## Decisões

### 1. Composição por múltiplas entidades (não hitbox não-convexa)

`Hitbox` continua **uma forma convexa por entidade**. Um obstáculo "composto" (arco, par) é emitido
como **N entidades no mesmo evento de spawn**, cada uma com sua hitbox convexa. Isso:

- resolve o adiamento do 1.4 sem tocar `collision/` (SAT continua convexo-a-convexo);
- reaproveita culling, near-miss e render existentes sem caso especial;
- mantém a hitbox pequena e barata (REGRA 3).

Mecanismo: `SpawnType` ganha um membro **opcional** `makePieces`. Tipos simples seguem exatamente
como hoje (`makeHitbox` + `anchor` + `placeY`), byte-idênticos no consumo de RNG.

```ts
/** Uma peça de um obstáculo composto. `y` é o CENTRO absoluto (já ancorado) e `dx` o
 *  deslocamento em x relativo ao x do spawn. `tag` default = id do tipo. */
export interface SpawnPiece {
  readonly hitbox: Hitbox;
  readonly dx: number;
  readonly y: number;
  readonly tag?: string;
}

/** Campo lógico visto pelo compositor (o que placeY usaria). */
export interface SpawnField {
  readonly worldHeight: number;
  readonly yMargin: number;
}

export interface SpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
  /** Presente ⇒ tipo COMPOSTO: o gerador ignora makeHitbox/anchor e emite estas peças. */
  makePieces?(rng: Rng, field: SpawnField): readonly SpawnPiece[];
}
```

**Por que `y` absoluto em vez de âncora + offset:** o arco precisa de uma trave posicionada
*exatamente* no topo das pernas. `anchor:'floating'` sortearia y (e consumiria RNG); um `dy` sobre
âncora exigiria o compositor recalcular o que `placeY` já fez. Calcular y dentro de `makePieces`
(que recebe `worldHeight`/`yMargin`) é a forma direta e mantém `placeY` intocado.

**Determinismo:** `makePieces` é função pura de `(rng, field)`, consome um número **fixo** de saques
por tipo (como `placeY` já garante 1 saque sempre). O gerador continua avançando `nextSpawnX` uma
vez por *evento* de spawn, e `nextId` uma vez por *entidade* emitida.

### 2. Os três tipos

Campo lógico: `worldHeight = 180`, `yMargin = 8` ⇒ faixa útil y ∈ [8, 172]. Dino: `aabb(10, 8)`
(20 × 16). Margem de justiça adotada: **toda passagem ≥ 30 unidades** (≈1,9× a altura do dino).

| id | Forma | Âncora | Decisão que cria |
|----|-------|--------|------------------|
| `obstacle.spire` | AABB estreita e alta, flutuante | floating | passar **por cima ou por baixo** |
| `obstacle.gate` | par chão + teto no mesmo x, com fresta | composto (2 peças) | **enfiar pela fresta** (pipes) |
| `obstacle.rock_arch` | 2 pernas no chão + trave | composto (3 peças) | **pelo buraco** ou por cima |

**`obstacle.spire`** — simples, sem mecanismo novo:
`aabb(rng.range(4, 6), rng.range(24, 34))` ⇒ 8–12 de largura, 48–68 de altura, `anchor:'floating'`.
`placeY` já garante que fica dentro das margens. Como a altura máxima (68) é bem menor que a faixa
útil (164), sempre sobra ≥ 96 divididos entre topo e base — a passagem menor pode ficar estreita de
um lado, mas o outro lado é sempre largo (invariante testada: `max(gapCima, gapBaixo) ≥ 30`).

**`obstacle.gate`** — 2 peças AABB de largura `halfW = 5`, mesmo x (`dx = 0`):
1. sorteia a fresta `G = rng.range(38, 52)`;
2. sorteia o topo da fresta `T` uniformemente no intervalo que mantém **ambos** os braços com
   comprimento ≥ 12 (senão o "par" degenera num obstáculo só);
3. peça de teto: altura `T - yMargin`, centro `y = yMargin + (T - yMargin)/2`;
   peça de chão: altura `(worldHeight - yMargin) - (T + G)`, centro no meio dela.

Consome exatamente 2 saques. Invariante testada: `G ≥ 30` e ambos os braços ≥ 12.

**`obstacle.rock_arch`** — 3 peças:
- pernas: `aabb(5, Hleg/2)` em `dx = ±18`, apoiadas no chão (`y = 172 - Hleg/2`), com
  `Hleg = rng.range(34, 50)`;
- trave: `aabb(23, 4)` (cobre de ponta a ponta das pernas), `dx = 0`, centro
  `y = 172 - Hleg - 4`.

Passagens: o **buraco** (altura `Hleg` ≥ 34, entre as pernas) e o **vão superior** (do topo da
trave até `yMargin`, ≥ 100 com estes números). Consome exatamente 1 saque. Invariantes testadas:
buraco ≥ 30 e vão superior ≥ 30; as duas pernas e a trave nunca se sobrepõem em y de forma a
fechar o buraco.

**Rejeitado:** hitbox não-convexa / multi-hitbox por entidade (obrigaria mexer no SAT, no
`boundsOf`, no culling e no hash — custo alto para ganho zero frente à composição por peças).

### 3. Distribuição de spawn

`rng.pick(catalog)` uniforme continua (o 1.7 já registrou "distribuição ponderada" como trabalho
futuro; não é escopo aqui). Catálogo passa de 4 → 7 tipos ⇒ **a sequência de spawn muda** ⇒
**re-pin dos goldens de replay** e regeneração do `_verify.bundle.js`.

Efeito colateral aceito e documentado: um `gate` ou `arch` ultrapassado pode contar **mais de um
near-miss** (um por entidade). É coerente — são de fato 2–3 corpos — e não quebra nenhum
invariante de score.

### 4. Arte: entra contra placeholder primitivo

Padrão do projeto ("pipeline contra PLACEHOLDER"): os 3 ids entram no `ASSET_MANIFEST` como
`kind: 'primitive'`, que desenha **exatamente a hitbox** (cobertura perfeita, REGRA 2 satisfeita).
As peças do `rock_arch` recebem tags próprias (`obstacle.rock_arch.leg`, `obstacle.rock_arch.span`)
para que a arte real possa diferenciá-las depois sem tocar no core; `gate` usa a tag do próprio tipo
nas duas peças.

A arte AAA real dropa depois, trocando os PNG-fonte + entradas de manifesto (precedente: atlas 8.2,
parallax 9.1, obstáculos 9.2). Este item entrega os **asset-specs** e os prompts no
`docs/assets/PHASE-09-ART-BRIEF.md`. Nenhum id novo vai para o atlas agora (a guarda de completude
do atlas só cobre `kind:'sprite'`).

### 5. Guardas de completude

- `tests/render/manifest.test.ts`: estender a lista de ids para incluir as **tags de peça** dos
  tipos compostos (senão um composto poderia ficar sem entrada de manifesto sem ninguém notar).
  Para isso o catálogo exporta `obstaclePieceTags()` (função pura, test-only na prática).
- `tests/core/spawn/catalog.test.ts`: ids únicos, prefixo `obstacle.`, âncoras válidas (mantidos).

## Testes (o que prova cada coisa)

1. **Composição** (`tests/core/spawn/generator.test.ts`): tipo composto emite N entidades no mesmo
   `spawnX + dx`, com ids sequenciais; tipos simples continuam emitindo 1.
2. **Justiça** (`tests/core/spawn/catalog.test.ts`): 500 amostras por tipo composto ⇒ toda passagem
   ≥ 30; peças dentro de `[yMargin, worldHeight - yMargin]`; `spire` sempre com um lado ≥ 30.
3. **Determinismo** (`tests/determinism/spawn.determinism.test.ts`): mesma seed ⇒ mesma sequência
   (já existe; passa a exercitar compostos); independência de batching (idem).
4. **Golden master** (`tests/determinism/replay.determinism.test.ts`): re-pin dos 3 cenários com
   seed; o cenário sem seed **não muda** (não gera obstáculo).
5. **Regressão de RNG**: teste novo garantindo que um catálogo só de tipos simples consome o mesmo
   stream de antes (o mecanismo de peças não vazou saques no caminho simples).

## Fora de escopo

- Distribuição ponderada por tipo / dificuldade escolhendo tipos (1.7 futuro).
- Arte real dos 3 tipos (asset-specs entregues; PNGs vêm depois).
- Qualquer mudança em `collision/`, `hashState` ou `WorldState` (nenhuma chave nova).

## Critério de pronto

`npm test` verde, `npm run check` limpo, `npm run test:determinism` verde com goldens re-pinados,
`_verify.bundle.js` regenerado, item 9.8 marcado `[x]` na fase e `CLAUDE.md` atualizado.
