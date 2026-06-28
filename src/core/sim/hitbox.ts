import type { Hitbox, Vec2 } from './types';

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

/** Construtor de hitbox polígono (convexa; pontos relativos ao centro; copia os pontos). */
export function polygon(points: readonly Vec2[]): Hitbox {
  return { kind: 'polygon', points: points.map((p) => ({ x: p.x, y: p.y })) };
}

/** Extents de uma hitbox relativos ao centro do transform. */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Calcula os extents (AABB envolvente) de qualquer hitbox, relativos ao centro. */
export function boundsOf(h: Hitbox): Bounds {
  switch (h.kind) {
    case 'aabb':
      return { minX: -h.halfW, maxX: h.halfW, minY: -h.halfH, maxY: h.halfH };
    case 'circle':
      return { minX: -h.radius, maxX: h.radius, minY: -h.radius, maxY: h.radius };
    case 'polygon': {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of h.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, maxX, minY, maxY };
    }
  }
}
