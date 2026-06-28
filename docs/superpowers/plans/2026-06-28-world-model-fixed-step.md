# Modelo de Mundo + Loop de Passo Fixo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o modelo de dados do mundo (`WorldState`/`Entity`/`Hitbox`) e o loop de passo fixo `step(world, input)` com física do pterodáctilo (gravidade, flap, teto, chão) e scroll horizontal, headless e determinístico.

**Architecture:** Núcleo TS puro em `src/core/sim/`. `step` muta o `world` in-place (zero alocação no hot path) e é função pura de `(world, input)` — o `world` carrega seus próprios parâmetros de simulação (gravidade, flapSpeed, scrollSpeed, worldHeight), tornando a evolução totalmente determinística. `createWorld`/`cloneWorld` dão snapshots para testes/replay/render.

**Tech Stack:** TypeScript estrito, Vitest. Sem Phaser/Preact/DOM em `src/core/`.

## Global Constraints

- `src/core/` **não importa** de `phaser`, `preact`, `@preact/*`, nem usa DOM/`window`/`document`/`localStorage`/`fetch`. (CONVENTIONS)
- `src/core/` **não usa** `Math.random`, `Date`, `Date.now`, `performance.now`, `setTimeout`, `requestAnimationFrame`. (DETERMINISM) — já há teste-guarda `tests/determinism/no-forbidden-apis.determinism.test.ts` cobrindo `src/core/` inteiro.
- TypeScript estrito, **sem `any`** sem justificativa. (CONVENTIONS)
- Passo fixo `FIXED_DT = 1/60`; o core nunca recebe dt variável. (DETERMINISM)
- Apenas `+`, `−`, `*` com dt constante na física — **sem** `Math.sin/cos/pow`. (DETERMINISM, portabilidade IEEE-754)
- Nomes: tipos/classes PascalCase, funções/vars camelCase, constantes UPPER_SNAKE, pastas kebab-case. (CONVENTIONS)
- Aliases de import: `@core/*` → `src/core/*`. Use `@core/sim` para a API pública.

---

## Convenções de coordenadas (referência para todas as tasks)

- **+y para baixo.** Teto em `y = 0` (clamp). Chão em `y = worldHeight` (morte ao tocar).
- Bordas usam as **extents da hitbox** (assume AABB do pterodáctilo): topo da hitbox = `position.y - halfH`; base = `position.y + halfH`.
- `step` (ordem exata): se morto → no-op; senão `tick++`; aplica flap (borda de subida); `vy += gravity*FIXED_DT`; `y += vy*FIXED_DT`; `x += scrollSpeed*FIXED_DT` e `distance += scrollSpeed*FIXED_DT`; clamp de teto; checagem de chão (morte + repouso).

---

## Task 1: Tipos, constantes e construtores de hitbox

**Files:**
- Create: `src/core/sim/types.ts`
- Create: `src/core/sim/hitbox.ts`
- Create: `src/core/sim/constants.ts`
- Test: `tests/core/sim/hitbox.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `types.ts`: `Vec2`, `Hitbox`, `Transform`, `Kinematics`, `EntityType`, `Entity`, `Pterodactyl`, `WorldState`, `InputFrame`, `WorldConfig`.
  - `hitbox.ts`: `aabb(halfW: number, halfH: number): Hitbox`, `circle(radius: number): Hitbox`, `cloneHitbox(h: Hitbox): Hitbox`.
  - `constants.ts`: `FIXED_DT`, `WORLD_HEIGHT`, `START_Y`, `GRAVITY`, `FLAP_SPEED`, `SCROLL_SPEED`, `PTERODACTYL_HITBOX`, `DEFAULT_WORLD_CONFIG: Required<WorldConfig>`.

- [ ] **Step 1: Write the failing test**

`tests/core/sim/hitbox.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aabb, circle, cloneHitbox } from '@core/sim';
import { FIXED_DT, DEFAULT_WORLD_CONFIG } from '@core/sim';

describe('hitbox — construtores de dados', () => {
  it('aabb produz união discriminada correta', () => {
    expect(aabb(10, 8)).toEqual({ kind: 'aabb', halfW: 10, halfH: 8 });
  });

  it('circle produz união discriminada correta', () => {
    expect(circle(5)).toEqual({ kind: 'circle', radius: 5 });
  });

  it('cloneHitbox copia em profundidade (polígono não compartilha referência)', () => {
    const poly = { kind: 'polygon' as const, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] };
    const copy = cloneHitbox(poly);
    expect(copy).toEqual(poly);
    expect(copy).not.toBe(poly);
    if (copy.kind === 'polygon') {
      expect(copy.points).not.toBe(poly.points);
      expect(copy.points[0]).not.toBe(poly.points[0]);
    }
  });
});

describe('constantes de simulação', () => {
  it('FIXED_DT é 1/60', () => {
    expect(FIXED_DT).toBe(1 / 60);
  });

  it('DEFAULT_WORLD_CONFIG tem todos os campos preenchidos e coerentes', () => {
    expect(DEFAULT_WORLD_CONFIG.worldHeight).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.startY).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.startY).toBeLessThan(DEFAULT_WORLD_CONFIG.worldHeight);
    expect(DEFAULT_WORLD_CONFIG.gravity).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.flapSpeed).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.scrollSpeed).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.pterodactylHitbox.kind).toBe('aabb');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/hitbox.test.ts`
Expected: FAIL — não resolve `@core/sim` (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`src/core/sim/types.ts`:
```ts
/** Vetor 2D (dados puros). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Hitbox lógica — independente da arte (REGRA 2). Polígono é convexo, pontos relativos ao centro. */
export type Hitbox =
  | { kind: 'aabb'; halfW: number; halfH: number }
  | { kind: 'circle'; radius: number }
  | { kind: 'polygon'; points: readonly Vec2[] };

export interface Transform {
  position: Vec2;
}

export interface Kinematics {
  velocity: Vec2;
}

export type EntityType = 'obstacle' | 'collectible';

/** Entidade genérica para conteúdo procedural (1.4/1.5). SEM dados visuais. */
export interface Entity {
  id: number;
  type: EntityType;
  transform: Transform;
  hitbox: Hitbox;
  kinematics: Kinematics;
  tags: readonly string[];
}

/** O pterodáctilo é um campo nomeado e tipado do mundo. */
export interface Pterodactyl {
  transform: Transform;
  kinematics: Kinematics;
  hitbox: Hitbox;
}

/** Input bruto de um step: estado do botão de flap (segurado ou não). */
export interface InputFrame {
  flap: boolean;
}

/** Configuração opcional para construir um mundo; ausências usam DEFAULT_WORLD_CONFIG. */
export interface WorldConfig {
  worldHeight?: number;
  gravity?: number;
  flapSpeed?: number;
  scrollSpeed?: number;
  startY?: number;
  pterodactylHitbox?: Hitbox;
}

/**
 * Estado completo da simulação. `step` é função pura de (WorldState, InputFrame):
 * o mundo carrega seus próprios parâmetros de simulação (alguns ficam dinâmicos em fases futuras).
 */
export interface WorldState {
  tick: number;
  distance: number;
  alive: boolean;
  /** Estado do botão de flap no step anterior (detecção de borda de subida). */
  lastFlap: boolean;
  scrollSpeed: number;
  gravity: number;
  flapSpeed: number;
  worldHeight: number;
  pterodactyl: Pterodactyl;
  obstacles: Entity[];
  collectibles: Entity[];
}
```

`src/core/sim/hitbox.ts`:
```ts
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
```

`src/core/sim/constants.ts`:
```ts
import { aabb } from './hitbox';
import type { Hitbox, WorldConfig } from './types';

/** Passo fixo da simulação (s). O core nunca recebe dt variável. */
export const FIXED_DT = 1 / 60;

// Constantes de tuning (placeholders; afinadas na Fase 2). Unidades abstratas, +y para baixo.
export const WORLD_HEIGHT = 180;
export const START_Y = WORLD_HEIGHT / 2;
export const GRAVITY = 540; // unidades/s² (para baixo)
export const FLAP_SPEED = 240; // unidades/s (impulso para cima)
export const SCROLL_SPEED = 120; // unidades/s (avanço em +x)
export const PTERODACTYL_HITBOX: Hitbox = aabb(10, 8);

/** Config padrão totalmente preenchida (merge com WorldConfig parcial em createWorld). */
export const DEFAULT_WORLD_CONFIG: Required<WorldConfig> = {
  worldHeight: WORLD_HEIGHT,
  gravity: GRAVITY,
  flapSpeed: FLAP_SPEED,
  scrollSpeed: SCROLL_SPEED,
  startY: START_Y,
  pterodactylHitbox: PTERODACTYL_HITBOX,
};
```

Criar também `src/core/sim/index.ts` mínimo para o alias resolver (será expandido na Task 6):
```ts
export * from './types';
export * from './hitbox';
export * from './constants';
```

Remover `src/core/sim/.gitkeep` (a pasta agora tem conteúdo).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/sim/hitbox.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Verify typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/types.ts src/core/sim/hitbox.ts src/core/sim/constants.ts src/core/sim/index.ts tests/core/sim/hitbox.test.ts
git rm -q src/core/sim/.gitkeep
git commit -m "feat(core/sim): tipos, constantes e construtores de hitbox"
```

---

## Task 2: createWorld e cloneWorld

**Files:**
- Create: `src/core/sim/world.ts`
- Modify: `src/core/sim/index.ts` (exportar `./world`)
- Test: `tests/core/sim/world.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `WorldConfig`, `Entity` (types.ts); `cloneHitbox`, `PTERODACTYL_HITBOX`, `DEFAULT_WORLD_CONFIG`.
- Produces: `createWorld(config?: WorldConfig): WorldState`, `cloneWorld(world: WorldState): WorldState`.

- [ ] **Step 1: Write the failing test**

`tests/core/sim/world.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, DEFAULT_WORLD_CONFIG } from '@core/sim';

describe('createWorld', () => {
  it('usa os defaults e começa vivo, parado, no centro', () => {
    const w = createWorld();
    expect(w.tick).toBe(0);
    expect(w.distance).toBe(0);
    expect(w.alive).toBe(true);
    expect(w.lastFlap).toBe(false);
    expect(w.worldHeight).toBe(DEFAULT_WORLD_CONFIG.worldHeight);
    expect(w.gravity).toBe(DEFAULT_WORLD_CONFIG.gravity);
    expect(w.flapSpeed).toBe(DEFAULT_WORLD_CONFIG.flapSpeed);
    expect(w.scrollSpeed).toBe(DEFAULT_WORLD_CONFIG.scrollSpeed);
    expect(w.pterodactyl.transform.position).toEqual({ x: 0, y: DEFAULT_WORLD_CONFIG.startY });
    expect(w.pterodactyl.kinematics.velocity).toEqual({ x: 0, y: 0 });
    expect(w.obstacles).toEqual([]);
    expect(w.collectibles).toEqual([]);
  });

  it('respeita config custom (merge parcial)', () => {
    const w = createWorld({ worldHeight: 100, startY: 25, gravity: 1000 });
    expect(w.worldHeight).toBe(100);
    expect(w.pterodactyl.transform.position.y).toBe(25);
    expect(w.gravity).toBe(1000);
    expect(w.scrollSpeed).toBe(DEFAULT_WORLD_CONFIG.scrollSpeed); // não sobrescrito
  });
});

describe('cloneWorld', () => {
  it('produz cópia profunda independente do original', () => {
    const w = createWorld();
    const c = cloneWorld(w);
    expect(c).toEqual(w);
    expect(c).not.toBe(w);

    c.pterodactyl.transform.position.y = 999;
    c.pterodactyl.kinematics.velocity.x = 7;
    c.obstacles.push({
      id: 1, type: 'obstacle', tags: [],
      transform: { position: { x: 0, y: 0 } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: { kind: 'circle', radius: 1 },
    });

    expect(w.pterodactyl.transform.position.y).toBe(DEFAULT_WORLD_CONFIG.startY);
    expect(w.pterodactyl.kinematics.velocity.x).toBe(0);
    expect(w.obstacles).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/world.test.ts`
Expected: FAIL — `createWorld`/`cloneWorld` não exportados.

- [ ] **Step 3: Write minimal implementation**

`src/core/sim/world.ts`:
```ts
import { DEFAULT_WORLD_CONFIG } from './constants';
import { cloneHitbox } from './hitbox';
import type { Entity, WorldConfig, WorldState } from './types';

/** Constrói o mundo inicial a partir de uma config parcial (ausências usam os defaults). */
export function createWorld(config: WorldConfig = {}): WorldState {
  const c = { ...DEFAULT_WORLD_CONFIG, ...config };
  return {
    tick: 0,
    distance: 0,
    alive: true,
    lastFlap: false,
    scrollSpeed: c.scrollSpeed,
    gravity: c.gravity,
    flapSpeed: c.flapSpeed,
    worldHeight: c.worldHeight,
    pterodactyl: {
      transform: { position: { x: 0, y: c.startY } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: cloneHitbox(c.pterodactylHitbox),
    },
    obstacles: [],
    collectibles: [],
  };
}

function cloneEntity(e: Entity): Entity {
  return {
    id: e.id,
    type: e.type,
    tags: [...e.tags],
    transform: { position: { x: e.transform.position.x, y: e.transform.position.y } },
    kinematics: { velocity: { x: e.kinematics.velocity.x, y: e.kinematics.velocity.y } },
    hitbox: cloneHitbox(e.hitbox),
  };
}

/** Cópia profunda do mundo (snapshots para testes/replay/render). */
export function cloneWorld(w: WorldState): WorldState {
  return {
    tick: w.tick,
    distance: w.distance,
    alive: w.alive,
    lastFlap: w.lastFlap,
    scrollSpeed: w.scrollSpeed,
    gravity: w.gravity,
    flapSpeed: w.flapSpeed,
    worldHeight: w.worldHeight,
    pterodactyl: {
      transform: { position: { x: w.pterodactyl.transform.position.x, y: w.pterodactyl.transform.position.y } },
      kinematics: { velocity: { x: w.pterodactyl.kinematics.velocity.x, y: w.pterodactyl.kinematics.velocity.y } },
      hitbox: cloneHitbox(w.pterodactyl.hitbox),
    },
    obstacles: w.obstacles.map(cloneEntity),
    collectibles: w.collectibles.map(cloneEntity),
  };
}
```

Adicionar a `src/core/sim/index.ts`:
```ts
export * from './world';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/sim/world.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/world.ts src/core/sim/index.ts tests/core/sim/world.test.ts
git commit -m "feat(core/sim): createWorld e cloneWorld (cópia profunda)"
```

---

## Task 3: step — integração base (gravidade, scroll, tick, distance)

**Files:**
- Create: `src/core/sim/step.ts`
- Modify: `src/core/sim/index.ts` (exportar `./step`)
- Test: `tests/core/sim/step.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `InputFrame`; `FIXED_DT`; `createWorld`.
- Produces: `step(world: WorldState, input: InputFrame): void` — muta o mundo in-place (nesta task: tick, gravidade vertical, scroll horizontal, distance; flap e bordas vêm nas tasks 4 e 5).

- [ ] **Step 1: Write the failing test**

`tests/core/sim/step.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step, FIXED_DT } from '@core/sim';

const NO_FLAP = { flap: false };

describe('step — integração base', () => {
  it('tick incrementa de 1 por step', () => {
    const w = createWorld();
    step(w, NO_FLAP);
    expect(w.tick).toBe(1);
    step(w, NO_FLAP);
    expect(w.tick).toBe(2);
  });

  it('gravidade aumenta velocity.y e faz o pterodáctilo cair (y cresce)', () => {
    const w = createWorld();
    const y0 = w.pterodactyl.transform.position.y;
    step(w, NO_FLAP);
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(w.gravity * FIXED_DT, 10);
    expect(w.pterodactyl.transform.position.y).toBeGreaterThan(y0);
  });

  it('scroll avança x e distance em scrollSpeed*FIXED_DT por step', () => {
    const w = createWorld();
    const dx = w.scrollSpeed * FIXED_DT;
    step(w, NO_FLAP);
    expect(w.pterodactyl.transform.position.x).toBeCloseTo(dx, 10);
    expect(w.distance).toBeCloseTo(dx, 10);
    step(w, NO_FLAP);
    expect(w.distance).toBeCloseTo(2 * dx, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/step.test.ts`
Expected: FAIL — `step` não exportado.

- [ ] **Step 3: Write minimal implementation**

`src/core/sim/step.ts`:
```ts
import { FIXED_DT } from './constants';
import type { InputFrame, WorldState } from './types';

/**
 * Avança a simulação em exatamente um passo fixo, mutando o mundo in-place.
 * Função pura de (world, input): o mundo carrega seus próprios parâmetros.
 */
export function step(world: WorldState, _input: InputFrame): void {
  world.tick += 1;

  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;

  // Integração vertical (Euler semi-implícito).
  vel.y += world.gravity * FIXED_DT;
  pos.y += vel.y * FIXED_DT;

  // Scroll horizontal.
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;
}
```

Adicionar a `src/core/sim/index.ts`:
```ts
export * from './step';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/sim/step.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck/lint**

Run: `npm run check`
Expected: sem erros. (O parâmetro não usado deve ter prefixo `_input` para satisfazer o lint.)

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/step.ts src/core/sim/index.ts tests/core/sim/step.test.ts
git commit -m "feat(core/sim): step com integração base (gravidade, scroll, tick)"
```

---

## Task 4: step — flap com detecção de borda

**Files:**
- Modify: `src/core/sim/step.ts`
- Test: `tests/core/sim/step.test.ts` (adicionar describe)

**Interfaces:**
- Consumes: `world.lastFlap`, `world.flapSpeed`, `input.flap`.
- Produces: comportamento de flap em `step` — na borda de subida (input.flap true e lastFlap false), `velocity.y = -flapSpeed` ANTES da gravidade do step; `lastFlap` passa a refletir `input.flap`.

- [ ] **Step 1: Write the failing test**

Adicionar a `tests/core/sim/step.test.ts`:
```ts
describe('step — flap (detecção de borda)', () => {
  it('flap na borda de subida zera a queda e impulsiona para cima', () => {
    const w = createWorld();
    step(w, { flap: true });
    // impulso (-flapSpeed) seguido da gravidade do mesmo step
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(-w.flapSpeed + w.gravity * FIXED_DT, 10);
    expect(w.lastFlap).toBe(true);
  });

  it('segurar o botão NÃO re-dispara o flap (só gravidade no 2º step)', () => {
    const w = createWorld();
    step(w, { flap: true });
    const vyAfterFirst = w.pterodactyl.kinematics.velocity.y;
    step(w, { flap: true }); // segurado: sem novo impulso
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(vyAfterFirst + w.gravity * FIXED_DT, 10);
  });

  it('soltar e apertar de novo dispara um novo flap', () => {
    const w = createWorld();
    step(w, { flap: true });
    step(w, { flap: false });
    const vyBefore = w.pterodactyl.kinematics.velocity.y;
    step(w, { flap: true }); // nova borda
    // novo impulso reduz vy em ~flapSpeed (descontada a gravidade do step)
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(-w.flapSpeed + w.gravity * FIXED_DT, 10);
    expect(w.pterodactyl.kinematics.velocity.y).toBeLessThan(vyBefore);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/step.test.ts`
Expected: FAIL nos novos testes de flap (vy não recebe o impulso; `lastFlap` não atualiza).

- [ ] **Step 3: Write minimal implementation**

Editar `src/core/sim/step.ts` — renomear `_input` para `input`, inserir o bloco de flap após `tick += 1` e antes da integração, e atualizar `lastFlap` ao final:
```ts
export function step(world: WorldState, input: InputFrame): void {
  world.tick += 1;

  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;

  // Flap: impulso na borda de subida do botão (não re-dispara enquanto segurado).
  if (input.flap && !world.lastFlap) {
    vel.y = -world.flapSpeed;
  }
  world.lastFlap = input.flap;

  // Integração vertical (Euler semi-implícito).
  vel.y += world.gravity * FIXED_DT;
  pos.y += vel.y * FIXED_DT;

  // Scroll horizontal.
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/sim/step.test.ts`
Expected: PASS (todos, incluindo os da Task 3).

- [ ] **Step 5: Verify typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/step.ts tests/core/sim/step.test.ts
git commit -m "feat(core/sim): flap do pterodáctilo com detecção de borda"
```

---

## Task 5: step — bordas (teto clamp, chão morte, congelar quando morto)

**Files:**
- Modify: `src/core/sim/step.ts`
- Test: `tests/core/sim/physics.test.ts`

**Interfaces:**
- Consumes: `world.worldHeight`, hitbox AABB do pterodáctilo (`halfH`), `world.alive`.
- Produces: comportamento de bordas em `step` — teto: se `pos.y - halfH < 0` então `pos.y = halfH` e `vel.y = 0`; chão: se `pos.y + halfH >= worldHeight` então `alive = false` e `pos.y = worldHeight - halfH`; e `step` em mundo morto é no-op (retorna antes de qualquer mutação, inclusive `tick`).

- [ ] **Step 1: Write the failing test**

`tests/core/sim/physics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';

const NO_FLAP = { flap: false };

/** half-extent vertical da hitbox AABB do pterodáctilo (assume kind 'aabb'). */
function halfH(w: ReturnType<typeof createWorld>): number {
  const hb = w.pterodactyl.hitbox;
  if (hb.kind !== 'aabb') throw new Error('teste assume hitbox aabb');
  return hb.halfH;
}

describe('step — teto (clamp)', () => {
  it('não deixa o topo da hitbox passar de y=0; zera a velocidade', () => {
    // mundo baixo + flap forte para subir rápido contra o teto
    const w = createWorld({ worldHeight: 60, startY: 20, flapSpeed: 5000 });
    step(w, { flap: true });
    for (let i = 0; i < 30; i++) step(w, NO_FLAP);
    expect(w.pterodactyl.transform.position.y - halfH(w)).toBeGreaterThanOrEqual(0);
    expect(w.pterodactyl.transform.position.y).toBe(halfH(w)); // repousa no teto
    expect(w.pterodactyl.kinematics.velocity.y).toBe(0);
    expect(w.alive).toBe(true); // teto não mata
  });
});

describe('step — chão (morte)', () => {
  it('tocar o chão com a base da hitbox mata e repousa no chão', () => {
    const w = createWorld({ worldHeight: 60, startY: 30 });
    let steps = 0;
    while (w.alive && steps < 1000) {
      step(w, NO_FLAP);
      steps++;
    }
    expect(w.alive).toBe(false);
    expect(w.pterodactyl.transform.position.y + halfH(w)).toBeCloseTo(w.worldHeight, 6);
  });

  it('step em mundo morto é no-op (estado congelado, tick não avança)', () => {
    const w = createWorld({ worldHeight: 60, startY: 30 });
    while (w.alive) step(w, NO_FLAP);
    const snapshot = cloneWorld(w);
    step(w, { flap: true });
    step(w, NO_FLAP);
    expect(w).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/physics.test.ts`
Expected: FAIL — sem clamp de teto, sem morte no chão, sem congelamento.

- [ ] **Step 3: Write minimal implementation**

Editar `src/core/sim/step.ts` — adicionar guarda de morto no topo, ler `halfH` da hitbox e aplicar bordas após a integração:
```ts
import { FIXED_DT } from './constants';
import type { InputFrame, WorldState } from './types';

export function step(world: WorldState, input: InputFrame): void {
  if (!world.alive) return; // estado congelado após a morte

  world.tick += 1;

  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;

  // Flap: impulso na borda de subida do botão (não re-dispara enquanto segurado).
  if (input.flap && !world.lastFlap) {
    vel.y = -world.flapSpeed;
  }
  world.lastFlap = input.flap;

  // Integração vertical (Euler semi-implícito).
  vel.y += world.gravity * FIXED_DT;
  pos.y += vel.y * FIXED_DT;

  // Scroll horizontal.
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;

  // Bordas verticais via extents da hitbox (assume AABB no pterodáctilo).
  const halfH = ptero.hitbox.kind === 'aabb' ? ptero.hitbox.halfH : 0;

  // Teto: clamp em y=0.
  if (pos.y - halfH < 0) {
    pos.y = halfH;
    vel.y = 0;
  }

  // Chão: tocar = morte; repousa exatamente sobre o chão.
  if (pos.y + halfH >= world.worldHeight) {
    pos.y = world.worldHeight - halfH;
    world.alive = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/sim/physics.test.ts tests/core/sim/step.test.ts`
Expected: PASS (bordas + tasks anteriores intactas).

- [ ] **Step 5: Verify typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/step.ts tests/core/sim/physics.test.ts
git commit -m "feat(core/sim): bordas teto/chão e congelamento pós-morte"
```

---

## Task 6: Suíte de determinismo (reprodutibilidade + independência de fps)

**Files:**
- Create: `tests/determinism/sim.determinism.test.ts`
- Modify: `CLAUDE.md` (campo "Estado atual"), `docs/roadmap/PHASE-01-deterministic-core.md` (marcar 1.3)

**Interfaces:**
- Consumes: `createWorld`, `cloneWorld`, `step`, `FIXED_DT`, `InputFrame`, `WorldConfig`.
- Produces: nada de código de produção — apenas testes e atualização de docs.

- [ ] **Step 1: Write the failing test**

`tests/determinism/sim.determinism.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step, FIXED_DT } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

// Config fixa (independente das constantes de tuning de gameplay) para pinos de regressão.
const FIXED_CONFIG: WorldConfig = {
  worldHeight: 200,
  startY: 100,
  gravity: 600,
  flapSpeed: 260,
  scrollSpeed: 130,
};

/** Timeline determinística: flap a cada 12 steps (segurado por 1 step). */
function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 12 === 0 });
  return out;
}

/** Roda a timeline com `batch` steps por "frame" (simula o acumulador do render). */
function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) {
      step(w, timeline[i]!);
    }
  }
  return w;
}

describe('determinismo da simulação', () => {
  it('reprodutibilidade: mesma seed-config + mesma timeline ⇒ estado idêntico', () => {
    const timeline = makeTimeline(600);
    const a = runBatched(FIXED_CONFIG, timeline, 1);
    const b = runBatched(FIXED_CONFIG, timeline, 1);
    expect(a).toEqual(b);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const timeline = makeTimeline(600);
    const one = runBatched(FIXED_CONFIG, timeline, 1);
    const two = runBatched(FIXED_CONFIG, timeline, 2);
    const five = runBatched(FIXED_CONFIG, timeline, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('config fixa: avanço de distance e tick é estável e previsível antes da morte', () => {
    // Sem flap: cai até morrer; verifica relações exatas até o passo da morte.
    const w = createWorld(FIXED_CONFIG);
    let steps = 0;
    while (w.alive && steps < 10000) {
      step(w, { flap: false });
      steps++;
    }
    expect(w.alive).toBe(false);
    expect(w.tick).toBe(steps);
    expect(w.distance).toBeCloseTo(steps * FIXED_CONFIG.scrollSpeed! * FIXED_DT, 6);
  });

  it('cloneWorld isola snapshots: avançar o clone não altera o original', () => {
    const w = createWorld(FIXED_CONFIG);
    step(w, { flap: false });
    const snapshot = cloneWorld(w);
    for (let i = 0; i < 50; i++) step(w, { flap: i % 5 === 0 });
    // snapshot permanece no estado de tick=1
    expect(snapshot.tick).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (then passes — code already exists)**

Run: `npx vitest run tests/determinism/sim.determinism.test.ts`
Expected: PASS (o código das Tasks 1–5 já satisfaz; este é um teste de característica/regressão). Se algo falhar, é bug de determinismo a corrigir antes de seguir.

- [ ] **Step 3: Rodar a bateria de determinismo inteira**

Run: `npm run test:determinism`
Expected: PASS — todas as suítes de determinismo (rng, seed, sim, guarda de APIs proibidas).

- [ ] **Step 4: Atualizar docs**

Em `docs/roadmap/PHASE-01-deterministic-core.md`, marcar os três checkboxes do item 1.3 como `[x]`.

Em `CLAUDE.md`, no bloco "Fase 1", atualizar para registrar 1.3 concluído e apontar o próximo item (1.4 — geração de obstáculos). Manter curto e verdadeiro, no estilo dos itens 1.1/1.2 existentes.

- [ ] **Step 5: Verificação final**

Run: `npm test && npm run check`
Expected: tudo verde, typecheck/lint limpos.

- [ ] **Step 6: Commit**

```bash
git add tests/determinism/sim.determinism.test.ts CLAUDE.md docs/roadmap/PHASE-01-deterministic-core.md
git commit -m "test(core/sim): determinismo + independência de fps; fecha item 1.3"
```

---

## Notas de execução

- Após a Task 5, rodar a skill `verify-determinism` (ou o subagent `determinism-guardian`) para auditar `src/core/sim/`.
- Review final da branch antes do merge em `main` (subagent-driven-development cobre isso).
