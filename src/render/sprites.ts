import type { Hitbox } from '@core/sim';
import { renderableFor } from './manifest';

export const ATLAS_KEY = 'entities';
export const ATLAS_PNG = 'atlas/entities.png';
export const ATLAS_JSON = 'atlas/entities.json';

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
