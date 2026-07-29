import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde a entidade se ancora verticalmente. */
export type Anchor = 'floor' | 'ceiling' | 'floating';

/** Campo lógico visto por um compositor de peças (subconjunto de SpawnConfig). */
export interface SpawnField {
  readonly worldHeight: number;
  readonly yMargin: number;
}

/** Peça de um obstáculo composto: hitbox convexa própria, `dx` relativo ao x do spawn e `y`
 *  CENTRO absoluto (o compositor já ancorou). `tag` default = id do tipo. */
export interface SpawnPiece {
  readonly hitbox: Hitbox;
  readonly dx: number;
  readonly y: number;
  readonly tag?: string;
}

/** Tipo simples: 1 entidade, ancorada por `placeY`. */
export interface SimpleSpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
  readonly makePieces?: undefined;
}

/** Tipo composto: N entidades convexas emitidas no mesmo evento de spawn. Resolve formas
 *  não-convexas (arco com buraco) sem tocar em `collision/` (SAT continua convexo-a-convexo). */
export interface CompositeSpawnType {
  readonly id: string;
  readonly anchor?: undefined;
  readonly makeHitbox?: undefined;
  makePieces(rng: Rng, field: SpawnField): readonly SpawnPiece[];
}

/**
 * Tipo lógico de algo colocável (obstáculo ou coletável): dado puro. `id` = chave do
 * asset-registry e tag da entidade. Tamanhos podem variar via Rng (a arte nunca muda a hitbox).
 */
export type SpawnType = SimpleSpawnType | CompositeSpawnType;

// --- Tuning dos obstáculos compostos (9.8). Números escolhidos p/ manter toda passagem ≥ 30
// unidades (≈1,9× a altura do dino) no campo lógico 320×180. Ver os testes de justiça. ---
const GATE_HALF_W = 5;
const GATE_GAP_MIN = 38;
const GATE_GAP_MAX = 52;
const GATE_ARM_MIN = 12; // braço mínimo p/ o par não degenerar num obstáculo só
const ARCH_LEG_HALF_W = 5;
const ARCH_LEG_DX = 18;
const ARCH_LEG_MIN = 34; // altura da perna = altura do buraco
const ARCH_LEG_MAX = 50;
const ARCH_SPAN_HALF_H = 4;
const ARCH_SPAN_HALF_W = ARCH_LEG_DX + ARCH_LEG_HALF_W; // a trave cobre as duas pernas

/** Tags das peças do arco (a arte real pode diferenciá-las sem tocar no core). */
export const ARCH_LEG_TAG = 'obstacle.rock_arch.leg';
export const ARCH_SPAN_TAG = 'obstacle.rock_arch.span';

/** Catálogo de obstáculos. Cobre aabb, circle e polygon (formatos variados). */
export const OBSTACLE_CATALOG: readonly SpawnType[] = [
  // Tronco subindo do chão.
  { id: 'obstacle.tree', anchor: 'floor', makeHitbox: (rng) => aabb(6, rng.range(24, 40)) },
  // Cipó pendendo do teto.
  { id: 'obstacle.vine', anchor: 'ceiling', makeHitbox: (rng) => aabb(4, rng.range(20, 34)) },
  // Pedregulho flutuante.
  { id: 'obstacle.boulder', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(10, 18)) },
  // Estalactite: triângulo convexo apontando para baixo (ápice embaixo).
  {
    id: 'obstacle.stalactite',
    anchor: 'ceiling',
    makeHitbox: (rng) => {
      const halfW = rng.range(8, 14);
      const halfH = rng.range(11, 18);
      return polygon([
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: 0, y: halfH },
      ]);
    },
  },
  // Agulha rochosa flutuante: estreita e alta ⇒ decide-se passar por cima ou por baixo.
  { id: 'obstacle.spire', anchor: 'floating', makeHitbox: (rng) => aabb(rng.range(4, 6), rng.range(24, 34)) },
  // Par chão+teto no mesmo x, com fresta no meio (composto de 2 peças). ATENÇÃO: a fresta
  // (GATE_GAP_*) e os braços mínimos (GATE_ARM_MIN) são ABSOLUTOS, calibrados para o campo
  // lógico fixo de worldHeight=180 — os invariantes de justiça (testados em catalog.test.ts)
  // só valem nesse campo. Em campos bem maiores o par passa a ocupar quase toda a coluna
  // vertical fora da fresta (ver nota em weather.determinism.test.ts, que usa worldHeight=600).
  {
    id: 'obstacle.gate',
    makePieces: (rng, field) => {
      const gap = rng.range(GATE_GAP_MIN, GATE_GAP_MAX);
      const top = field.yMargin;
      const bottom = field.worldHeight - field.yMargin;
      const tMin = top + GATE_ARM_MIN;
      const tMax = bottom - gap - GATE_ARM_MIN;
      // Sempre consome exatamente 1 saque (estabilidade do stream), como placeY faz no floating.
      const u = rng.next();
      const t = tMax > tMin ? tMin + u * (tMax - tMin) : (tMin + tMax) / 2;
      // Campo degenerado (worldHeight pequeno, ex.: < 68 com yMargin=8): `t` pode cair fora de
      // [top, bottom-gap] e ceilH/floorH ficariam negativos, gerando hitbox invertida (atravessa
      // boundsOf/SAT/culling sem erro). Clampa em 0 — nesse caso a peça vira uma faixa de altura
      // zero, não uma caixa inválida; não é mais "justo", mas nunca corrompe o estado.
      const ceilH = Math.max(0, t - top);
      const floorH = Math.max(0, bottom - (t + gap));
      return [
        { hitbox: aabb(GATE_HALF_W, ceilH / 2), dx: 0, y: top + ceilH / 2 },
        { hitbox: aabb(GATE_HALF_W, floorH / 2), dx: 0, y: bottom - floorH / 2 },
      ];
    },
  },
  // Arco de pedra: 2 pernas no chão + trave. O "buraco" (não-convexo) sai de 3 peças convexas —
  // é o obstacle.rock_arch adiado no item 1.4.
  {
    id: 'obstacle.rock_arch',
    makePieces: (rng, field) => {
      const bottom = field.worldHeight - field.yMargin;
      const legH = rng.range(ARCH_LEG_MIN, ARCH_LEG_MAX);
      const legHalfH = legH / 2;
      const legY = bottom - legHalfH;
      // Ordem das peças por dx crescente (-perna, trave, +perna): mantém o x das entidades
      // emitidas não-decrescente dentro do próprio evento — SPAWN_GAP_MIN (120) é bem maior
      // que o espalhamento de dx aqui (±18), então isso preserva x global não-decrescente
      // no stream do SpawnGenerator (ver generator.test.ts). Não muda tags/hitboxes/valores.
      return [
        { hitbox: aabb(ARCH_LEG_HALF_W, legHalfH), dx: -ARCH_LEG_DX, y: legY, tag: ARCH_LEG_TAG },
        {
          hitbox: aabb(ARCH_SPAN_HALF_W, ARCH_SPAN_HALF_H),
          dx: 0,
          y: bottom - legH - ARCH_SPAN_HALF_H,
          tag: ARCH_SPAN_TAG,
        },
        { hitbox: aabb(ARCH_LEG_HALF_W, legHalfH), dx: ARCH_LEG_DX, y: legY, tag: ARCH_LEG_TAG },
      ];
    },
  },
];

/** Catálogo de coletáveis (pássaros-moeda). 1.5: um único tipo basta. */
export const COLLECTIBLE_CATALOG: readonly SpawnType[] = [
  // Pássaro-moeda flutuante (comida). Corpo compacto ⇒ hitbox circular.
  { id: 'bird.coin', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
];
