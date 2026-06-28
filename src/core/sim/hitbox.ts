import type { Hitbox } from './types';

/** Construtor de hitbox AABB (half-extents relativos ao centro do transform). */
export function aabb(halfW: number, halfH: number): Hitbox {
  return { kind: 'aabb', halfW, halfH };
}

/** Construtor de hitbox circular. */
export function circle(radius: number): Hitbox {
  return { kind: 'circle', radius };
}

/** Cópia profunda de uma hitbox (não compartilha arrays/objetos com a original). */
export function cloneHitbox(h: Hitbox): Hitbox {
  switch (h.kind) {
    case 'aabb':
      return { kind: 'aabb', halfW: h.halfW, halfH: h.halfH };
    case 'circle':
      return { kind: 'circle', radius: h.radius };
    case 'polygon':
      return { kind: 'polygon', points: h.points.map((p) => ({ x: p.x, y: p.y })) };
  }
}
