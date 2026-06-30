/**
 * Representação visual de um tipo lógico (REGRA 2). Na fase geométrica, `primitive` desenha a
 * geometria da HITBOX do entity na cor dada; `shape:'triangle'` é exceção cosmética (dino),
 * inscrita nos bounds da hitbox. Trocar para arte = mudar a entrada para `kind:'sprite'`.
 */
export type Renderable =
  | { readonly kind: 'primitive'; readonly color: number; readonly shape?: 'hitbox' | 'triangle' }
  | { readonly kind: 'sprite'; readonly atlas: string; readonly frame?: string; readonly animation?: string };

/** Chave do pterodáctilo do jogador (não é um Entity com tags). */
export const DINO_TYPE_ID = 'dino.default';

/** Visível quando um id não tem entrada (não deveria acontecer — há guarda de completude). */
const FALLBACK: Renderable = { kind: 'primitive', color: 0xff00ff };

/** Mapa id lógico → visual. Cores dos asset-specs / RENDERING-AND-ASSETS.md. */
export const ASSET_MANIFEST: Readonly<Record<string, Renderable>> = {
  [DINO_TYPE_ID]: { kind: 'primitive', color: 0xcc5544, shape: 'triangle' },
  'obstacle.tree': { kind: 'primitive', color: 0x6b4a2f },
  'obstacle.vine': { kind: 'primitive', color: 0x2f6b2f },
  'obstacle.boulder': { kind: 'primitive', color: 0x808896 },
  'obstacle.stalactite': { kind: 'primitive', color: 0x9aa3b2 },
  'bird.coin': { kind: 'primitive', color: 0xffd54a },
};

/** Visual de um tipo lógico; fallback primitivo para ids desconhecidos. */
export function renderableFor(typeId: string): Renderable {
  return ASSET_MANIFEST[typeId] ?? FALLBACK;
}
