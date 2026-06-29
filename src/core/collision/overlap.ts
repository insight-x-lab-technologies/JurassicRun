import type { Hitbox, Vec2 } from '@core/sim/types';

/**
 * Predicado de colisão entre duas hitboxes lógicas posicionadas no mundo (REGRA 2: nunca
 * pixels). Simétrico e geral (cobre aabb/circle/polygon). Alocação-zero (REGRA 3): casos
 * diretos para aabb/circle; pares com polígono via SAT por projeção escalar. Encostar conta
 * como sobreposição (comparações não-estritas).
 */
export function overlaps(ha: Hitbox, pa: Vec2, hb: Hitbox, pb: Vec2): boolean {
  if (ha.kind === 'aabb' && hb.kind === 'aabb') {
    return Math.abs(pa.x - pb.x) <= ha.halfW + hb.halfW && Math.abs(pa.y - pb.y) <= ha.halfH + hb.halfH;
  }
  if (ha.kind === 'circle' && hb.kind === 'circle') {
    const dx = pa.x - pb.x;
    const dy = pa.y - pb.y;
    const r = ha.radius + hb.radius;
    return dx * dx + dy * dy <= r * r;
  }
  if (ha.kind === 'aabb' && hb.kind === 'circle') return aabbCircle(ha, pa, hb, pb);
  if (ha.kind === 'circle' && hb.kind === 'aabb') return aabbCircle(hb, pb, ha, pa);
  // Pelo menos um é polígono.
  return satOverlap(ha, pa, hb, pb);
}

type AabbBox = Extract<Hitbox, { kind: 'aabb' }>;
type CircleShape = Extract<Hitbox, { kind: 'circle' }>;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** aabb (em pBox) × círculo (em pCirc): distância do centro ao ponto mais próximo do aabb. */
function aabbCircle(box: AabbBox, pBox: Vec2, circ: CircleShape, pCirc: Vec2): boolean {
  const nx = clamp(pCirc.x, pBox.x - box.halfW, pBox.x + box.halfW);
  const ny = clamp(pCirc.y, pBox.y - box.halfH, pBox.y + box.halfH);
  const dx = pCirc.x - nx;
  const dy = pCirc.y - ny;
  return dx * dx + dy * dy <= circ.radius * circ.radius;
}

/** SAT para convexos (pares que envolvem polígono). Eixos não-normalizados (basta p/ separação). */
function satOverlap(ha: Hitbox, pa: Vec2, hb: Hitbox, pb: Vec2): boolean {
  if (edgeAxesSeparate(ha, pa, hb, pb)) return false;
  if (edgeAxesSeparate(hb, pb, ha, pa)) return false;
  if (ha.kind === 'circle' && circleVertexAxisSeparates(ha, pa, hb, pb)) return false;
  if (hb.kind === 'circle' && circleVertexAxisSeparates(hb, pb, ha, pa)) return false;
  return true;
}

/** Testa os eixos das arestas de `host` como separadores entre `host` e `other`. */
function edgeAxesSeparate(host: Hitbox, pHost: Vec2, other: Hitbox, pOther: Vec2): boolean {
  switch (host.kind) {
    case 'circle':
      return false; // sem arestas
    case 'aabb':
      return (
        axisSeparates(1, 0, host, pHost, other, pOther) || axisSeparates(0, 1, host, pHost, other, pOther)
      );
    case 'polygon': {
      const pts = host.points;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % n]!;
        // Normal da aresta (a→b): (-dy, dx). Não-normalizada.
        if (axisSeparates(-(b.y - a.y), b.x - a.x, host, pHost, other, pOther)) return true;
      }
      return false;
    }
  }
}

/** Eixo extra para círculo × polígono: do centro do círculo ao vértice mais próximo do polígono. */
function circleVertexAxisSeparates(circ: Hitbox, pCirc: Vec2, other: Hitbox, pOther: Vec2): boolean {
  if (other.kind !== 'polygon') return false;
  let best = Infinity;
  let nx = 0;
  let ny = 0;
  for (const pt of other.points) {
    const wx = pOther.x + pt.x;
    const wy = pOther.y + pt.y;
    const dx = wx - pCirc.x;
    const dy = wy - pCirc.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      nx = pCirc.x - wx;
      ny = pCirc.y - wy;
    }
  }
  if (nx === 0 && ny === 0) return false; // centro coincide com um vértice ⇒ sobrepõe
  return axisSeparates(nx, ny, circ, pCirc, other, pOther);
}

/** Verdadeiro se as projeções das duas hitboxes no eixo (ax,ay) não se sobrepõem. */
function axisSeparates(ax: number, ay: number, ha: Hitbox, pa: Vec2, hb: Hitbox, pb: Vec2): boolean {
  const aMin = projectMin(ha, pa, ax, ay);
  const aMax = projectMax(ha, pa, ax, ay);
  const bMin = projectMin(hb, pb, ax, ay);
  const bMax = projectMax(hb, pb, ax, ay);
  return aMax < bMin || bMax < aMin;
}

function projectMin(h: Hitbox, p: Vec2, ax: number, ay: number): number {
  const c = p.x * ax + p.y * ay;
  switch (h.kind) {
    case 'aabb':
      return c - (Math.abs(ax) * h.halfW + Math.abs(ay) * h.halfH);
    case 'circle':
      return c - h.radius * Math.hypot(ax, ay);
    case 'polygon': {
      let min = Infinity;
      for (const pt of h.points) {
        const proj = (p.x + pt.x) * ax + (p.y + pt.y) * ay;
        if (proj < min) min = proj;
      }
      return min;
    }
  }
}

function projectMax(h: Hitbox, p: Vec2, ax: number, ay: number): number {
  const c = p.x * ax + p.y * ay;
  switch (h.kind) {
    case 'aabb':
      return c + (Math.abs(ax) * h.halfW + Math.abs(ay) * h.halfH);
    case 'circle':
      return c + h.radius * Math.hypot(ax, ay);
    case 'polygon': {
      let max = -Infinity;
      for (const pt of h.points) {
        const proj = (p.x + pt.x) * ax + (p.y + pt.y) * ay;
        if (proj > max) max = proj;
      }
      return max;
    }
  }
}
