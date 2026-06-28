# Spec — Geração de obstáculos (formatos variados) — Item 1.4

> Fase 1 (núcleo determinístico headless). Implementa o item 1.4 do
> `docs/roadmap/PHASE-01-deterministic-core.md`. Tudo vive em `src/core/`, sem render,
> sem DOM, respeitando o contrato de `docs/architecture/DETERMINISM.md`.

## Objetivo

Produzir, de forma **determinística e keyed por distância**, uma sequência de obstáculos de
**formatos variados** (não só retângulos) à frente do pterodáctilo. Mesma seed ⇒ mesma
sequência de obstáculos, independente do agrupamento de steps por frame (fps-independência).

Fora de escopo (itens posteriores): colisão e near-miss (1.6), coletáveis (1.5), curva de
dificuldade que modula gaps/densidade/velocidade (1.7), score/economia (1.8), serialização
de replay/golden-master (1.9). Os parâmetros de spawn aqui são **placeholders** que 1.7/Fase 2
afinarão.

## Contrato de determinismo (como este item o cumpre)

- Conteúdo = `f(seed, distância)`. O gerador é amostrado por **posição x do mundo**, nunca por
  tempo de parede (regra 4 do `DETERMINISM.md`).
- A aleatoriedade vem **exclusivamente** de um `Rng` semeado (item 1.1), via um stream dedicado
  `fork('obstacles')` — isola o consumo de RNG de spawn de futuros sistemas (coletáveis, clima).
- Sem `Math.random`/`Date`/`performance.now` (guarda dupla já existente cobre `src/core/`).
- **Independência de batching:** o gerador avança um cursor (`nextSpawnX`) por obstáculo
  emitido, não por chamada. Emitir "até x" em uma chamada grande ou em várias chamadas
  incrementais produz a sequência idêntica.

## Estrutura de módulos

```
src/core/spawn/
  catalog.ts     — ObstacleType + OBSTACLE_CATALOG (cobre aabb, circle, polygon)
  generator.ts   — class SpawnGenerator (+ tipo SpawnConfig)
  constants.ts   — placeholders de tuning + DEFAULT_SPAWN_CONFIG
  index.ts       — barrel
```

Adições em `src/core/sim/`:
- `hitbox.ts`: construtor `polygon(points)` e helper `boundsOf(h): {minX,maxX,minY,maxY}`
  (extents relativos ao centro; reusável por colisão 1.6 e por placement vertical aqui).
- `types.ts`: `WorldConfig.seed?: string`, `WorldConfig.spawn?: Partial<SpawnConfig>`,
  `WorldState.spawner: SpawnGenerator | null`.
- `world.ts`: `createWorld` constrói o spawner quando há seed; `cloneWorld` clona o spawner.
- `step.ts`: gera obstáculos até `distance + SPAWN_LOOKAHEAD` e culla os já ultrapassados.
- `constants.ts` (sim): `SPAWN_LOOKAHEAD`, `CULL_MARGIN`.

Sem ciclos de import: `spawn/*` importa de `sim/types`, `sim/hitbox` e `@core/rng`; `sim/world`
e `sim/step` importam de `spawn`. `sim/hitbox` e `sim/types` não importam de `spawn`.

## Catálogo de obstáculos

Cada tipo é dado puro: id lógico (= chave do manifesto/asset-registry e tag da entidade),
âncora vertical e uma fábrica de hitbox que pode variar o tamanho via `Rng`.

```ts
interface ObstacleType {
  readonly id: string;                 // ex.: 'obstacle.tree'
  readonly anchor: 'floor' | 'ceiling' | 'floating';
  makeHitbox(rng: Rng): Hitbox;
}
```

| id | hitbox | âncora | descrição |
|----|--------|--------|-----------|
| `obstacle.tree` | aabb (alto/estreito, halfH variável) | floor | tronco subindo do chão |
| `obstacle.vine` | aabb (estreito, halfH variável) | ceiling | cipó pendendo do teto |
| `obstacle.boulder` | circle (raio variável) | floating | pedregulho flutuante |
| `obstacle.stalactite` | polygon (triângulo convexo p/ baixo) | ceiling | estalactite do teto |

Cobre os três tipos de hitbox (aabb, circle, polygon) → satisfaz "não só retângulos".
Seleção de tipo: `rng.pick(OBSTACLE_CATALOG)` (uniforme; distribuição ponderada fica para 1.7).
Nota: um `rock_arch` "com buraco" exige hitbox **não-convexa** (ou multi-hitbox por entidade) —
adiado; `Hitbox` polygon é convexo e a entidade tem uma única hitbox.

### Placement vertical

A partir de `boundsOf(hitbox)` (extents acima/abaixo do centro) e de `worldHeight`/margem:
- **floor:** base encosta no chão → `y = worldHeight - margin - bounds.maxY`.
- **ceiling:** topo encosta no teto → `y = margin - bounds.minY`.
- **floating:** `y = rng.range(margin - bounds.minY, worldHeight - margin - bounds.maxY)`.

Garante que a hitbox fica dentro de `[margin, worldHeight - margin]`.

## SpawnGenerator

```ts
interface SpawnConfig {
  worldHeight: number;
  yMargin: number;
  startX: number;     // x do primeiro obstáculo
  gapMin: number;     // distância x mínima entre spawns consecutivos
  gapMax: number;     // distância x máxima
}

class SpawnGenerator {
  constructor(rng: Rng, config: SpawnConfig);
  // emite, em ordem de x crescente, todo obstáculo com spawnX <= upToX,
  // empurrando direto no sink (sem alocar array temporário no hot path).
  generateUpTo(upToX: number, sink: Entity[]): void;
  clone(): SpawnGenerator; // rng.clone() + cópia do cursor (para cloneWorld)
}
```

Estado interno (cursor): `nextSpawnX` (inicia em `startX`) e `nextId` (monotônico).

Algoritmo de cada emissão (ordem de saques do RNG fixa ⇒ determinístico):
1. `type = rng.pick(OBSTACLE_CATALOG)`
2. `hitbox = type.makeHitbox(rng)`
3. `y = placeY(type.anchor, hitbox, config, rng)`
4. push `Entity { id: nextId, type: 'obstacle', tags: [type.id], transform:{position:{x: nextSpawnX, y}}, kinematics:{velocity:{x:0,y:0}}, hitbox }`
5. `nextId += 1`; `nextSpawnX += rng.range(gapMin, gapMax)`

Obstáculos são **estáticos em coordenadas de mundo**; o pterodáctilo avança em +x (já é o
modelo atual). Não recebem velocidade própria; a colisão (1.6) compara em coordenadas de mundo.

## Integração na simulação

- `WorldConfig.seed?`: quando presente, `createWorld` cria
  `new SpawnGenerator(createRng(seed).fork('obstacles'), spawnConfig)` e `spawner` no estado.
  Sem seed ⇒ `spawner = null` (mundo "sandbox" de física pura — preserva os testes existentes).
- `cloneWorld`: clona o spawner (`spawner ? spawner.clone() : null`).
- `step` (após o scroll, somente se `spawner`):
  1. `spawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.obstacles)`
  2. Cull dos ultrapassados pela esquerda (obstáculos estão em ordem de x crescente):
     `while (obstacles.length && rightEdge(obstacles[0]) < birdX - CULL_MARGIN) obstacles.shift()`
- Performance (REGRA 3): a maioria dos steps não emite nada e não culla nada ⇒ sem alocação por
  frame; `generateUpTo` empurra no array do mundo; o cull ocorre ~1 vez por intervalo de spawn.

## Testes

- `tests/core/spawn/catalog.test.ts`
  - ids únicos; cada `makeHitbox` retorna hitbox válida; âncoras válidas.
  - o catálogo contém pelo menos um `aabb`, um `circle` e um `polygon` (prova "não só retângulos").
- `tests/core/spawn/generator.test.ts`
  - `generateUpTo` emite x estritamente crescente; vazio quando `upToX < startX`.
  - ids monotônicos a partir de 0.
  - placement: a hitbox de cada obstáculo (via `boundsOf` + posição) fica dentro de
    `[margin, worldHeight - margin]` para cada âncora.
- `tests/determinism/spawn.determinism.test.ts` (foco do item)
  - **mesma seed ⇒ mesma sequência** (deep equal de todos os obstáculos).
  - **seeds diferentes ⇒ sequências diferentes** (não idênticas).
  - **independência de batching:** emitir até X numa chamada == emitir em N chamadas
    incrementais (deep equal).
  - **integração fps-independente:** mundo semeado rodado com 1/2/5 steps por "frame" ⇒
    `world.obstacles` idêntico (deep equal), espelhando o teste de 1.3.

A guarda anti-API-proibida (`tests/determinism/no-forbidden-apis...`) já varre `src/core/` e
cobre os novos arquivos automaticamente. `verify-determinism` deve passar.

## Pipeline de assets (REGRA 5)

Cada obstáculo é imagem trocável ⇒ precisa de asset-spec. Criar:
`docs/assets/specs/obstacle.tree.md`, `obstacle.vine.md`, `obstacle.boulder.md`,
`obstacle.stalactite.md` (template `docs/assets/asset-spec-template.md`). Atualizar
`docs/assets/asset-registry.md`: `tree`/`vine`/`stalactite` → status `spec`; adicionar linha
`obstacle.boulder` (`spec`). Os `id` do catálogo são as chaves do futuro manifesto de render
(Fase 2) — nenhum código de manifesto/render é criado agora.

## Decisões firmadas

- Spawner integrado ao `step` já em 1.4 (não só módulo solto), com `seed` opcional para manter
  compat com os testes de física existentes.
- Stream de RNG dedicado `fork('obstacles')` reserva outros streams para 1.5/1.7.
- `generateUpTo(upToX, sink)` (caminho único, empurra no array) em vez de retornar array novo,
  por hot-path e pela preferência do projeto por "caminho único".
- Sem `rock_arch` convexo enganoso; arch real fica para entidade multi-hitbox futura.
- Tuning (gaps, startX, lookahead, margens, faixas de tamanho) são placeholders desta fase.
</content>
</invoke>
