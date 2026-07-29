/**
 * Representação visual de um tipo lógico (REGRA 2). Agora na fase de sprites, `kind:'sprite'`
 * renderiza um frame do atlas; `kind:'primitive'` é fallback para ids desconhecidos.
 * Para trocar entre sprites = editar a entrada aqui (atlas/frame).
 */
import { ARCH_LEG_TAG, ARCH_SPAN_TAG } from '@core/spawn';
/** Animação idle cosmética (9.4). Puramente visual: não toca hitbox nem simulação.
 *  `sway.anchor` = extremidade PRESA (a livre é a que balança); `amp` em unidades de mundo. */
export type IdleSpec =
  | { readonly kind: 'sway'; readonly anchor: 'top' | 'bottom'; readonly amp: number }
  | { readonly kind: 'drip' };

export type Renderable =
  | { readonly kind: 'primitive'; readonly color: number; readonly shape?: 'hitbox' | 'triangle' }
  | {
      readonly kind: 'sprite';
      readonly atlas: string;
      readonly frame?: string;
      readonly animation?: string;
      readonly segmented?: boolean;
      readonly idle?: IdleSpec;
    };

/** Chave do pterodáctilo do jogador (não é um Entity com tags). */
export const DINO_TYPE_ID = 'dino.default';

/** Visível quando um id não tem entrada (não deveria acontecer — há guarda de completude). */
const FALLBACK: Renderable = { kind: 'primitive', color: 0xff00ff };

/** Mapa id lógico → visual. Todos os sprites vêm do atlas 'entities'. */
export const ASSET_MANIFEST: Readonly<Record<string, Renderable>> = {
  [DINO_TYPE_ID]: { kind: 'sprite', atlas: 'entities', frame: 'dino.default' },
  // segmentados: a composição usa `<id>.cap/.body/.base`; `frame` aponta p/ a parte body como
  // fallback representativo (frame que existe no atlas), nunca `<id>` bare (não empacotado).
  'obstacle.tree': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.tree.body', segmented: true, idle: { kind: 'sway', anchor: 'bottom', amp: 0.6 } },
  'obstacle.vine': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.vine.body', segmented: true, idle: { kind: 'sway', anchor: 'top', amp: 0.8 } },
  'obstacle.boulder': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.boulder' },
  'obstacle.stalactite': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.stalactite', idle: { kind: 'drip' } },
  // 9.8: entram contra placeholder primitivo (desenha a hitbox exata ⇒ cobertura perfeita).
  // A arte real dropa depois trocando estas entradas por sprites do atlas (asset-specs em
  // docs/assets/specs/obstacle.{spire,gate,rock_arch}.md).
  'obstacle.spire': { kind: 'primitive', color: 0x8a8f98 },
  'obstacle.gate': { kind: 'primitive', color: 0x6b5a44 },
  [ARCH_LEG_TAG]: { kind: 'primitive', color: 0x7a6a55 },
  [ARCH_SPAN_TAG]: { kind: 'primitive', color: 0x7a6a55 },
  'bird.coin': { kind: 'sprite', atlas: 'entities', frame: 'bird.coin' },
  'powerup.shield': { kind: 'sprite', atlas: 'entities', frame: 'powerup.shield' },
  'powerup.extraLife': { kind: 'sprite', atlas: 'entities', frame: 'powerup.extraLife' },
  'powerup.magnet': { kind: 'sprite', atlas: 'entities', frame: 'powerup.magnet' },
  'powerup.doubleCoin': { kind: 'sprite', atlas: 'entities', frame: 'powerup.doubleCoin' },
  'powerup.slowMo': { kind: 'sprite', atlas: 'entities', frame: 'powerup.slowMo' },
};

/** Visual de um tipo lógico; fallback primitivo para ids desconhecidos. */
export function renderableFor(typeId: string): Renderable {
  return ASSET_MANIFEST[typeId] ?? FALLBACK;
}
