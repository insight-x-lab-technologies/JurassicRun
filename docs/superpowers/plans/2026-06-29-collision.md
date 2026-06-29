# Colisão (item 1.6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detecção de colisão geométrica entre hitboxes lógicas (aabb/circle/polygon) e sua integração ao `step`: dino×obstáculo ⇒ morte, dino×coletável ⇒ coleta, e contagem de near-miss.

**Architecture:** Novo módulo puro `src/core/collision/` com `overlaps(ha,pa,hb,pb)` (casos diretos para aabb/circle; SAT alocação-zero para polígonos). O `step` ganha uma passada de colisão que dispara morte/coleta/near-miss. `WorldState.nearMisses` registra os quase-acertos.

**Tech Stack:** TypeScript estrito, Vitest. `src/core/` é TS puro (sem DOM/Phaser, sem `Math.random`/`Date`/`performance`).

## Global Constraints

- **Determinismo (REGRA 1):** nada de `Math.random`/`Date.now`/`performance.now` em `src/core/`. `FIXED_DT = 1/60`. Mesma seed+inputs ⇒ estado idêntico.
- **Arte desacoplada (REGRA 2):** colisão usa `Hitbox` lógica, nunca pixels.
- **Performance (REGRA 3):** sem alocação por frame no hot path. `overlaps` é alocação-zero (SAT por projeção escalar). `boundsOf` só pode ser chamado no step pontual do cruzamento do near-miss, nunca incondicionalmente por frame.
- **`src/core/` é folha:** `collision` só importa **tipos** de `@core/sim` (via `import type`) — sem ciclo de runtime.
- Comando de teste: `npm test`. Typecheck/lint: `npm run check`. Determinismo: `npm run test:determinism`.
- Touching (encostar na borda) **conta como sobreposição** (consistente com o `>=` da morte no chão).

---

### Task 1: Módulo de colisão `overlaps` (geometria pura)

**Files:**
- Create: `src/core/collision/overlap.ts`
- Create: `src/core/collision/index.ts`
- Test: `tests/core/collision/overlap.test.ts`

**Interfaces:**
- Consumes: `Hitbox`, `Vec2` de `@core/sim/types` (somente tipo).
- Produces: `overlaps(ha: Hitbox, pa: Vec2, hb: Hitbox, pb: Vec2): boolean` — predicado de colisão simétrico e geral, alocação-zero.

- [ ] **Step 1: Escrever os testes que falham**

`tests/core/collision/overlap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { overlaps } from '@core/collision';
import { aabb, circle, polygon } from '@core/sim/hitbox';
import type { Vec2 } from '@core/sim/types';

const O: Vec2 = { x: 0, y: 0 };

describe('overlaps — aabb × aabb', () => {
  it('sobrepostos', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 12, y: 0 })).toBe(true);
  });
  it('separados em x', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 16, y: 0 })).toBe(false);
  });
  it('separados em y', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 0, y: 20 })).toBe(false);
  });
  it('encostando na borda conta como sobreposição', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 15, y: 0 })).toBe(true);
  });
});

describe('overlaps — circle × circle', () => {
  it('sobrepostos', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 8, y: 0 })).toBe(true);
  });
  it('separados', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 11, y: 0 })).toBe(false);
  });
  it('tangentes contam como sobreposição', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 10, y: 0 })).toBe(true);
  });
});

describe('overlaps — aabb × circle (qualquer ordem)', () => {
  it('círculo dentro do aabb', () => {
    expect(overlaps(aabb(10, 8), O, circle(3), { x: 2, y: 1 })).toBe(true);
  });
  it('círculo encostando num canto', () => {
    // canto do aabb em (10,8); círculo raio 5 centrado a 3-4-5 do canto
    expect(overlaps(aabb(10, 8), O, circle(5), { x: 13, y: 12 })).toBe(true);
  });
  it('círculo fora, perto do canto mas sem tocar', () => {
    expect(overlaps(circle(2), { x: 14, y: 12 }, aabb(10, 8), O)).toBe(false);
  });
  it('ordem invertida dá o mesmo resultado', () => {
    expect(overlaps(circle(3), { x: 2, y: 1 }, aabb(10, 8), O)).toBe(true);
  });
});

describe('overlaps — polígono (SAT)', () => {
  // triângulo apontando para baixo (estalactite), ápice em y=+halfH
  const tri = polygon([
    { x: -10, y: -12 },
    { x: 10, y: -12 },
    { x: 0, y: 12 },
  ]);
  it('polígono × aabb sobrepostos', () => {
    expect(overlaps(tri, O, aabb(6, 6), { x: 0, y: 14 })).toBe(true);
  });
  it('polígono × aabb separados (ao lado do ápice)', () => {
    expect(overlaps(tri, O, aabb(2, 2), { x: 9, y: 14 })).toBe(false);
  });
  it('polígono × círculo sobrepostos (perto do ápice)', () => {
    expect(overlaps(tri, O, circle(4), { x: 0, y: 15 })).toBe(true);
  });
  it('polígono × círculo separados', () => {
    expect(overlaps(tri, O, circle(3), { x: 20, y: 0 })).toBe(false);
  });
  it('polígono × polígono sobrepostos', () => {
    expect(overlaps(tri, O, tri, { x: 4, y: 0 })).toBe(true);
  });
  it('polígono × polígono separados', () => {
    expect(overlaps(tri, O, tri, { x: 40, y: 0 })).toBe(false);
  });
  it('simétrico: inverter os argumentos não muda o resultado', () => {
    const a = overlaps(tri, O, aabb(6, 6), { x: 0, y: 14 });
    const b = overlaps(aabb(6, 6), { x: 0, y: 14 }, tri, O);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/collision/overlap.test.ts`
Expected: FAIL (`overlaps`/`@core/collision` não existe).

- [ ] **Step 3: Implementar `overlap.ts`**

`src/core/collision/overlap.ts`:

```ts
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
```

`src/core/collision/index.ts`:

```ts
export * from './overlap';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/core/collision/overlap.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck/lint e commit**

Run: `npm run check`
Expected: limpo.

```bash
git add src/core/collision/overlap.ts src/core/collision/index.ts tests/core/collision/overlap.test.ts
git commit -m "feat(core/collision): overlaps() para aabb/circle/polygon (SAT alocação-zero)"
```

---

### Task 2: `WorldState.nearMisses` + constante `NEAR_MISS_MARGIN`

**Files:**
- Modify: `src/core/sim/types.ts` (interface `WorldState`)
- Modify: `src/core/sim/world.ts` (`createWorld`, `cloneWorld`)
- Modify: `src/core/sim/constants.ts`
- Test: `tests/core/sim/world.test.ts` (adicionar casos)

**Interfaces:**
- Produces: `WorldState.nearMisses: number` (inicia 0; copiado por `cloneWorld`); `NEAR_MISS_MARGIN: number` exportado de `@core/sim`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/core/sim/world.test.ts` (dentro do arquivo, novo `describe`):

```ts
import { NEAR_MISS_MARGIN } from '@core/sim';

describe('WorldState.nearMisses', () => {
  it('createWorld inicia nearMisses em 0', () => {
    expect(createWorld().nearMisses).toBe(0);
  });
  it('cloneWorld copia nearMisses', () => {
    const w = createWorld();
    w.nearMisses = 3;
    expect(cloneWorld(w).nearMisses).toBe(3);
  });
  it('NEAR_MISS_MARGIN é um número positivo', () => {
    expect(NEAR_MISS_MARGIN).toBeGreaterThan(0);
  });
});
```

Nota: `createWorld`, `cloneWorld` já são importados no topo de `world.test.ts`. Adicionar `NEAR_MISS_MARGIN` ao import existente de `@core/sim` se já houver, senão usar a linha acima. Verificar os imports atuais do arquivo antes de duplicar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/sim/world.test.ts`
Expected: FAIL (propriedade `nearMisses` ausente / `NEAR_MISS_MARGIN` indefinido).

- [ ] **Step 3: Implementar**

Em `src/core/sim/types.ts`, na interface `WorldState`, adicionar após `food`:

```ts
  /** Near-misses: passar perto de um obstáculo sem colidir. Multiplicador/score são 1.8. */
  nearMisses: number;
```

Em `src/core/sim/constants.ts`, adicionar ao final:

```ts
/** Gap vertical máximo (unidades) entre dino e obstáculo ultrapassado para contar near-miss.
 * Placeholder de tuning (Fase 2). */
export const NEAR_MISS_MARGIN = 12;
```

Em `src/core/sim/world.ts`:
- Em `createWorld`, no objeto retornado, adicionar após `food: 0,`:

```ts
    nearMisses: 0,
```

- Em `cloneWorld`, no objeto retornado, adicionar após `food: w.food,`:

```ts
    nearMisses: w.nearMisses,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/core/sim/world.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run check`
Expected: limpo.

```bash
git add src/core/sim/types.ts src/core/sim/constants.ts src/core/sim/world.ts tests/core/sim/world.test.ts
git commit -m "feat(core/sim): WorldState.nearMisses + NEAR_MISS_MARGIN"
```

---

### Task 3: Gatilho no `step` — dino×obstáculo (morte) e dino×coletável (coleta)

**Files:**
- Modify: `src/core/sim/step.ts`
- Test: `tests/core/sim/collision-step.test.ts` (criar)

**Interfaces:**
- Consumes: `overlaps` de `@core/collision`; `collect` de `./collect`; `rightExtent` (já importado).
- Produces: comportamento do `step` — colisão com obstáculo zera `alive`; sobreposição com coletável chama `collect` (food++ e remoção).

- [ ] **Step 1: Escrever os testes que falham**

`tests/core/sim/collision-step.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { Entity, WorldConfig } from '@core/sim';

// Mundo estático: gravidade/flap zerados ⇒ o dino permanece em startY (controle preciso).
const STATIC: WorldConfig = { worldHeight: 200, startY: 100, gravity: 0, flapSpeed: 0, scrollSpeed: 60 };

function obstacleAt(id: number, x: number, y: number, halfW: number, halfH: number): Entity {
  return {
    id,
    type: 'obstacle',
    tags: ['obstacle.tree'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'aabb', halfW, halfH },
  };
}

function coinAt(id: number, x: number, y: number, radius: number): Entity {
  return {
    id,
    type: 'collectible',
    tags: ['bird.coin'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius },
  };
}

describe('step — colisão dino×obstáculo', () => {
  it('sobrepor um obstáculo mata o dino e congela o estado', () => {
    const w = createWorld(STATIC);
    // Dino aabb(10,8) em (≈0,100); obstáculo grande cobrindo a posição.
    w.obstacles.push(obstacleAt(0, 4, 100, 20, 20));
    step(w, { flap: false });
    expect(w.alive).toBe(false);
    const tickAtDeath = w.tick;
    step(w, { flap: false });
    expect(w.tick).toBe(tickAtDeath); // congelado
  });

  it('obstáculo longe não mata', () => {
    const w = createWorld(STATIC);
    w.obstacles.push(obstacleAt(0, 500, 100, 5, 5));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
  });
});

describe('step — coleta dino×coletável (gatilho de 1.5)', () => {
  it('sobrepor um pássaro-moeda incrementa food e remove o coletável', () => {
    const w = createWorld(STATIC);
    const coin = coinAt(0, 4, 100, 8);
    w.collectibles.push(coin);
    step(w, { flap: false });
    expect(w.food).toBe(1);
    expect(w.collectibles).not.toContain(coin);
  });

  it('coleta apenas os coletáveis sobrepostos (não os distantes)', () => {
    const w = createWorld(STATIC);
    const near = coinAt(0, 4, 100, 8);
    const far = coinAt(1, 500, 100, 8);
    w.collectibles.push(near, far);
    step(w, { flap: false });
    expect(w.food).toBe(1);
    expect(w.collectibles).toContain(far);
    expect(w.collectibles).not.toContain(near);
  });

  it('não coleta após morrer no mesmo step (morte por obstáculo tem precedência)', () => {
    const w = createWorld(STATIC);
    w.obstacles.push(obstacleAt(0, 4, 100, 20, 20));
    w.collectibles.push(coinAt(0, 4, 100, 8));
    step(w, { flap: false });
    expect(w.alive).toBe(false);
    expect(w.food).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/sim/collision-step.test.ts`
Expected: FAIL (dino não morre / food não incrementa — gatilho ainda não existe).

- [ ] **Step 3: Implementar a passada de colisão no `step`**

Em `src/core/sim/step.ts`:

1. Ajustar os imports do topo:

```ts
import { FIXED_DT, SPAWN_LOOKAHEAD, CULL_MARGIN } from './constants';
import { rightExtent } from './hitbox';
import { collect } from './collect';
import { overlaps } from '@core/collision';
import type { InputFrame, WorldState } from './types';
```

2. No fim de `step`, **após** os dois blocos de spawner (`if (world.collectibleSpawner) { ... }`), adicionar:

```ts
  // Passada de colisão (só enquanto vivo). O dino é o agente; obstáculos/coletáveis estão em
  // coords de mundo. `overlaps` é alocação-zero (REGRA 3).
  if (world.alive) {
    const obstacles = world.obstacles;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i]!;
      if (overlaps(ptero.hitbox, pos, o.hitbox, o.transform.position)) {
        world.alive = false;
        break;
      }
    }
  }

  if (world.alive) {
    const collectibles = world.collectibles;
    // Itera de trás para frente: `collect` faz splice na lista.
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i]!;
      if (overlaps(ptero.hitbox, pos, c.hitbox, c.transform.position)) {
        collect(world, c);
      }
    }
  }
```

(`ptero` e `pos` já são variáveis locais definidas no início de `step`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/core/sim/collision-step.test.ts`
Expected: PASS.

- [ ] **Step 5: Suíte completa + typecheck e commit**

Run: `npm test && npm run check`
Expected: tudo verde/limpo.

```bash
git add src/core/sim/step.ts tests/core/sim/collision-step.test.ts
git commit -m "feat(core/sim): gatilho de colisão no step (morte por obstáculo, coleta por sobreposição)"
```

---

### Task 4: Near-miss no `step`

**Files:**
- Modify: `src/core/sim/step.ts`
- Test: `tests/core/sim/collision-step.test.ts` (adicionar `describe`)

**Interfaces:**
- Consumes: `boundsOf` de `./hitbox`; `NEAR_MISS_MARGIN` de `./constants`; `dx` (deslocamento de scroll do step, já calculado em `step`).
- Produces: `world.nearMisses` incrementa 1× por obstáculo ultrapassado dentro da margem sem colisão.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `tests/core/sim/collision-step.test.ts` (reutiliza `STATIC`/`obstacleAt`/`coinAt`):

```ts
import { NEAR_MISS_MARGIN } from '@core/sim';

describe('step — near-miss', () => {
  // Dino aabb(10,8) em y=100 ⇒ topo=92, base=108. STATIC: dx=1/step, gravidade 0.
  // Roda passos suficientes para o dino ultrapassar o obstáculo em x.
  function runPast(obs: Entity, steps = 80): ReturnType<typeof createWorld> {
    const w = createWorld(STATIC);
    w.obstacles.push(obs);
    for (let i = 0; i < steps; i++) step(w, { flap: false });
    return w;
  }

  it('ultrapassar um obstáculo dentro da margem conta 1 near-miss', () => {
    // Obstáculo acima: base do obstáculo em y=82 (halfH=5, centro=77) ⇒ gap = 92-82 = 10 ≤ 12.
    const w = runPast(obstacleAt(0, 30, 77, 3, 5));
    expect(w.alive).toBe(true);
    expect(w.nearMisses).toBe(1);
  });

  it('não conta em dobro em steps subsequentes', () => {
    const w = runPast(obstacleAt(0, 30, 77, 3, 5), 200);
    expect(w.nearMisses).toBe(1);
  });

  it('obstáculo fora da margem não conta near-miss', () => {
    // base do obstáculo em y=65 (centro=60, halfH=5) ⇒ gap = 92-65 = 27 > 12.
    const w = runPast(obstacleAt(0, 30, 60, 3, 5));
    expect(w.alive).toBe(true);
    expect(w.nearMisses).toBe(0);
  });

  it('colisão real não gera near-miss (morte, não "quase")', () => {
    // Obstáculo na altura do dino (y=100) ⇒ colisão ⇒ morte; nunca cruza vivo.
    const w = runPast(obstacleAt(0, 30, 100, 3, 8));
    expect(w.alive).toBe(false);
    expect(w.nearMisses).toBe(0);
  });

  it('margem é respeitada no limite', () => {
    expect(NEAR_MISS_MARGIN).toBe(12);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/sim/collision-step.test.ts`
Expected: FAIL (`nearMisses` permanece 0 — lógica ainda não existe).

- [ ] **Step 3: Implementar near-miss no laço de obstáculos**

Em `src/core/sim/step.ts`:

1. Atualizar imports:

```ts
import { rightExtent, boundsOf } from './hitbox';
import { FIXED_DT, SPAWN_LOOKAHEAD, CULL_MARGIN, NEAR_MISS_MARGIN } from './constants';
```

2. Substituir o laço de obstáculos da Task 3 por esta versão (que adiciona o `else` de near-miss):

```ts
  if (world.alive) {
    const dinoHalfW = rightExtent(ptero.hitbox); // dino é AABB ⇒ = halfW
    const dinoHalfH = ptero.hitbox.kind === 'aabb' ? ptero.hitbox.halfH : 0;
    const dinoLeft = pos.x - dinoHalfW;
    const obstacles = world.obstacles;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i]!;
      const oPos = o.transform.position;
      if (overlaps(ptero.hitbox, pos, o.hitbox, oPos)) {
        world.alive = false;
        break;
      }
      // Near-miss: conta 1× no step em que o dino ULTRAPASSA o obstáculo em x (transição),
      // se o gap vertical ≤ margem. Detecção stateless via dx deste step.
      const obsRight = oPos.x + rightExtent(o.hitbox);
      if (dinoLeft - dx <= obsRight && obsRight < dinoLeft) {
        const ob = boundsOf(o.hitbox); // pontual (só no cruzamento) ⇒ não é alocação por frame
        const obsTop = oPos.y + ob.minY;
        const obsBot = oPos.y + ob.maxY;
        const gap = Math.max(0, Math.max(pos.y - dinoHalfH - obsBot, obsTop - (pos.y + dinoHalfH)));
        if (gap > 0 && gap <= NEAR_MISS_MARGIN) world.nearMisses += 1;
      }
    }
  }
```

(`dx` é a variável local já definida em `step` como `world.scrollSpeed * FIXED_DT`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/core/sim/collision-step.test.ts`
Expected: PASS.

- [ ] **Step 5: Suíte completa + typecheck e commit**

Run: `npm test && npm run check`
Expected: tudo verde/limpo.

```bash
git add src/core/sim/step.ts tests/core/sim/collision-step.test.ts
git commit -m "feat(core/sim): contagem de near-miss no step (1x por obstáculo ultrapassado dentro da margem)"
```

---

### Task 5: Determinismo da colisão

**Files:**
- Test: `tests/determinism/collision.determinism.test.ts` (criar)

**Interfaces:**
- Consumes: `createWorld`, `step` de `@core/sim`; `overlaps` de `@core/collision`.
- Produces: prova de reprodutibilidade e fps-independência incluindo `alive`/`food`/`nearMisses`.

- [ ] **Step 1: Escrever os testes**

`tests/determinism/collision.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { overlaps } from '@core/collision';
import { aabb, circle } from '@core/sim/hitbox';

// Mundo semeado: gera obstáculos e coletáveis; o dino voa e eventualmente colide.
const SEEDED: WorldConfig = {
  worldHeight: 200,
  startY: 100,
  gravity: 600,
  flapSpeed: 260,
  scrollSpeed: 130,
  seed: 'endless:COLLIDE1',
};

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 10 === 0 });
  return out;
}

function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) step(w, timeline[i]!);
  }
  return w;
}

describe('determinismo da colisão', () => {
  it('overlaps é simétrico (propriedade)', () => {
    expect(overlaps(aabb(10, 8), { x: 0, y: 0 }, circle(5), { x: 12, y: 3 })).toBe(
      overlaps(circle(5), { x: 12, y: 3 }, aabb(10, 8), { x: 0, y: 0 }),
    );
  });

  it('reprodutibilidade: mesma seed+timeline ⇒ alive/food/nearMisses idênticos', () => {
    const timeline = makeTimeline(1200);
    const a = runBatched(SEEDED, timeline, 1);
    const b = runBatched(SEEDED, timeline, 1);
    expect(a).toEqual(b);
    expect({ alive: a.alive, food: a.food, nearMisses: a.nearMisses }).toEqual({
      alive: b.alive,
      food: b.food,
      nearMisses: b.nearMisses,
    });
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const timeline = makeTimeline(1200);
    const one = runBatched(SEEDED, timeline, 1);
    const two = runBatched(SEEDED, timeline, 2);
    const five = runBatched(SEEDED, timeline, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('a simulação semeada exercita o caminho de colisão (o dino morre)', () => {
    const w = runBatched(SEEDED, makeTimeline(1200), 1);
    // Voo longo num mundo com obstáculos ⇒ colide e morre (prova que o gatilho roda).
    expect(w.alive).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npm test -- tests/determinism/collision.determinism.test.ts`
Expected: PASS. Se "o dino morre" falhar (sobreviveu aos 1200 steps), ajustar a timeline (ex.: cadência de flap) ou o nº de steps até a partida semeada produzir uma colisão — **não** relaxar para um teste trivial.

- [ ] **Step 3: Bateria de determinismo + suíte completa**

Run: `npm run test:determinism && npm test && npm run check`
Expected: tudo verde/limpo.

- [ ] **Step 4: Commit**

```bash
git add tests/determinism/collision.determinism.test.ts
git commit -m "test(determinism): colisão reprodutível e fps-independente (alive/food/nearMisses)"
```

---

## Notas de fechamento (após as 5 tasks)

- Rodar `verify-determinism` (skill) e, se útil, o subagent `determinism-guardian`.
- Marcar 1.6 como `[x]` em `docs/roadmap/PHASE-01-deterministic-core.md`.
- Atualizar o campo "Estado atual" do `CLAUDE.md` (1.6 concluído; próximo 1.7).
- Integrar no `main` (merge local `--no-ff`, pré-autorizado) e aposentar a branch.
