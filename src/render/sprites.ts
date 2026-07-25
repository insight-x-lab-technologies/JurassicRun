import type { Hitbox } from '@core/sim';
import { renderableFor } from './manifest';

export type AtlasRef = { readonly key: string; readonly png: string; readonly json: string };

/** Atlas de entidades default (tema classic). Paths relativos ao BASE_URL. */
export const DEFAULT_ATLAS: AtlasRef = { key: 'entities', png: 'atlas/entities.png', json: 'atlas/entities.json' };

/** Atlas ativo = o do pack, senão o default. Seam para sets de arte por tema. */
export function atlasRefFor(pack: { readonly atlas?: AtlasRef }): AtlasRef {
  return pack.atlas ?? DEFAULT_ATLAS;
}

export const ATLAS_KEY = DEFAULT_ATLAS.key;
export const ATLAS_PNG = DEFAULT_ATLAS.png;
export const ATLAS_JSON = DEFAULT_ATLAS.json;

/** Tamanho do sprite = bounding box da hitbox (hitboxes são aleatórias por instância; o
 *  sprite cobre a hitbox). Escalares apenas — sem alocação intermediária além do retorno. */
export function spriteSizeFor(hitbox: Hitbox): { w: number; h: number } {
  switch (hitbox.kind) {
    case 'aabb':
      return { w: hitbox.halfW * 2, h: hitbox.halfH * 2 };
    case 'circle':
      return { w: hitbox.radius * 2, h: hitbox.radius * 2 };
    case 'polygon': {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of hitbox.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { w: maxX - minX, h: maxY - minY };
    }
    default: {
      const _exhaustive: never = hitbox;
      return _exhaustive;
    }
  }
}

/** Nome de frame do atlas para um tipo lógico; null se não for sprite (fallback primitivo). */
export function frameFor(typeId: string): string | null {
  const r = renderableFor(typeId);
  return r.kind === 'sprite' ? (r.frame ?? typeId) : null;
}

/** Partes de um obstáculo segmentado (aabb): empilhadas cap(topo)→body(repete)→base(fundo). */
export interface SegmentFrames { readonly cap: string; readonly body: string; readonly base: string; }

/** Cache por typeId ⇒ o objeto (e as strings de frame) é estável entre chamadas: `segmentFramesFor`
 *  roda 1×/obstáculo/frame no hot path, então não pode alocar por frame (REGRA 3). */
const segFramesCache = new Map<string, SegmentFrames | null>();

/** Frames das partes se o typeId for segmentado no manifesto, senão null. Convenção de nome:
 *  `<id>.cap` / `<id>.body` / `<id>.base` (o gen-atlas empacota com esses sufixos). Memoizado ⇒
 *  identidade estável, zero alocação após o 1º acesso (REGRA 3). */
export function segmentFramesFor(typeId: string): SegmentFrames | null {
  let f = segFramesCache.get(typeId);
  if (f === undefined) {
    const r = renderableFor(typeId);
    f = r.kind === 'sprite' && r.segmented === true
      ? { cap: `${typeId}.cap`, body: `${typeId}.body`, base: `${typeId}.base` }
      : null;
    segFramesCache.set(typeId, f);
  }
  return f;
}

/** Layout vertical dos segmentos para cobrir uma hitbox aabb de altura `height` (unidades de
 *  mundo). `*UnitH` = altura de exibição de cada parte já escalada pela largura da hitbox.
 *  Alocação-zero: muta e devolve `out` (scratch reusável no hot path — REGRA 3). */
export interface SegmentLayout { capH: number; baseH: number; bodyH: number; bodyN: number; }

export function layoutSegments(
  height: number,
  capUnitH: number,
  bodyUnitH: number,
  baseUnitH: number,
  out: SegmentLayout,
): SegmentLayout {
  if (height <= 0) {
    out.capH = 0; out.baseH = 0; out.bodyH = 0; out.bodyN = 0;
    return out;
  }
  const fixed = capUnitH + baseUnitH;
  if (fixed >= height) {
    // Obstáculo curtíssimo: encolhe cap/base proporcionalmente; sem corpo.
    const k = height / fixed;
    out.capH = capUnitH * k; out.baseH = baseUnitH * k; out.bodyH = 0; out.bodyN = 0;
    return out;
  }
  const bodySpace = height - fixed;
  const bodyN = Math.max(1, Math.ceil(bodySpace / bodyUnitH));
  out.capH = capUnitH; out.baseH = baseUnitH;
  out.bodyN = bodyN;
  out.bodyH = bodySpace / bodyN; // preenchimento exato (sem vão nem sobreposição)
  return out;
}
