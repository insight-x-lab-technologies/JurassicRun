/**
 * Representação visual de um tipo lógico (REGRA 2). Agora na fase de sprites, `kind:'sprite'`
 * renderiza um frame do atlas; `kind:'primitive'` é fallback para ids desconhecidos.
 * Para trocar entre sprites = editar a entrada aqui (atlas/frame).
 */
export type Renderable =
  | { readonly kind: 'primitive'; readonly color: number; readonly shape?: 'hitbox' | 'triangle' }
  | { readonly kind: 'sprite'; readonly atlas: string; readonly frame?: string; readonly animation?: string };

/** Chave do pterodáctilo do jogador (não é um Entity com tags). */
export const DINO_TYPE_ID = 'dino.default';

/** Visível quando um id não tem entrada (não deveria acontecer — há guarda de completude). */
const FALLBACK: Renderable = { kind: 'primitive', color: 0xff00ff };

/** Mapa id lógico → visual. Todos os sprites vêm do atlas 'entities'. */
export const ASSET_MANIFEST: Readonly<Record<string, Renderable>> = {
  [DINO_TYPE_ID]: { kind: 'sprite', atlas: 'entities', frame: 'dino.default' },
  'obstacle.tree': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.tree' },
  'obstacle.vine': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.vine' },
  'obstacle.boulder': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.boulder' },
  'obstacle.stalactite': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.stalactite' },
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
