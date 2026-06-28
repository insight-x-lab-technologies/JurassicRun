# Geração de obstáculos (item 1.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar deterministicamente, keyed por distância, uma sequência de obstáculos de formatos variados (aabb/circle/polygon) à frente do pterodáctilo.

**Architecture:** Novo módulo `src/core/spawn/` (catálogo de tipos + `SpawnGenerator` que consome um stream de `Rng` forkado e emite obstáculos por cursor de posição x). Integrado ao mundo: `createWorld` cria o spawner quando há `seed`; `step` gera até `distance + lookahead` e culla os ultrapassados. Sem `seed` ⇒ `spawner = null` (compat com testes de física existentes).

**Tech Stack:** TypeScript estrito, Vitest, aliases `@core/*` (via `vite-tsconfig-paths`).

## Global Constraints

- `src/core/` é TS puro: sem `phaser`/`preact`/DOM/IO. (CLAUDE.md REGRA 1)
- Proibido em `src/core/`: `Math.random()`, `Date`, `Date.now()`, `performance.now()`. Aleatoriedade só via `Rng` semeado; tempo só via `FIXED_DT`. (DETERMINISM.md)
- Conteúdo procedural = `f(seed, distância)`; amostrado por posição, nunca por tempo de parede.
- Determinismo: mesma seed + mesma timeline ⇒ estado idêntico, independente de fps/batching.
- Sem alocação por frame no hot path do `step`. (CLAUDE.md REGRA 3)
- Sem `any` sem justificativa; preferir `import type` para imports de tipo (`consistent-type-imports`).
- Colisão usa hitbox lógica, nunca pixels. (REGRA 2)
- Toda imagem trocável precisa de asset-spec em `docs/assets/specs/`. (REGRA 5)
- Comandos: testes `npm test`; typecheck+lint `npm run check`; determinismo `npm run test:determinism`.

---

### Task 1: Helpers de hitbox (`polygon`, `boundsOf`)

**Files:**
- Modify: `src/core/sim/hitbox.ts`
- Test: `tests/core/sim/hitbox.test.ts`

**Interfaces:**
- Consumes: `Hitbox`, `Vec2` de `./types`.
- Produces:
  - `polygon(points: readonly Vec2[]): Hitbox` — constrói hitbox polígono (cópia dos pontos).
  - `interface Bounds { minX: number; maxX: number; minY: number; maxY: number }`
  - `boundsOf(h: Hitbox): Bounds` — extents relativos ao centro (aabb: ±half; circle: ±radius; polygon: min/max dos pontos).

- [ ] **Step 1: Escrever os testes que falham** (append em `tests/core/sim/hitbox.test.ts`)

```ts
import { aabb, circle, polygon, boundsOf } from '@core/sim';

describe('polygon', () => {
  it('copia os pontos (não compartilha referência)', () => {
    const pts = [{ x: 0, y: -5 }, { x: 4, y: 5 }, { x: -4, y: 5 }];
    const h = polygon(pts);
    expect(h).toEqual({ kind: 'polygon', points: pts });
    if (h.kind === 'polygon') expect(h.points).not.toBe(pts);
  });
});

describe('boundsOf', () => {
  it('aabb: ±half em cada eixo', () => {
    expect(boundsOf(aabb(6, 8))).toEqual({ minX: -6, maxX: 6, minY: -8, maxY: 8 });
  });
  it('circle: ±radius em cada eixo', () => {
    expect(boundsOf(circle(10))).toEqual({ minX: -10, maxX: 10, minY: -10, maxY: 10 });
  });
  it('polygon: min/max dos pontos', () => {
    const h = polygon([{ x: -4, y: -3 }, { x: 6, y: -3 }, { x: 0, y: 9 }]);
    expect(boundsOf(h)).toEqual({ minX: -4, maxX: 6, minY: -3, maxY: 9 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/sim/hitbox.test.ts`
Expected: FAIL — `polygon`/`boundsOf` não existem (import error / not a function).

- [ ] **Step 3: Implementar** (em `src/core/sim/hitbox.ts`)

Trocar a 1ª linha de import para incluir `Vec2`:
```ts
import type { Hitbox, Vec2 } from './types';
```
Adicionar ao final do arquivo:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/sim/hitbox.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/hitbox.ts tests/core/sim/hitbox.test.ts
git commit -m "feat(core/sim): polygon() e boundsOf() para extents de hitbox"
```

---

### Task 2: Catálogo de obstáculos + constantes de spawn

**Files:**
- Create: `src/core/spawn/generator.ts` (apenas a interface `SpawnConfig` nesta task)
- Create: `src/core/spawn/catalog.ts`
- Create: `src/core/spawn/constants.ts`
- Test: `tests/core/spawn/catalog.test.ts`

**Interfaces:**
- Consumes: `Rng` (`@core/rng`); `Hitbox` (`@core/sim/types`); `aabb`, `circle`, `polygon` (`@core/sim/hitbox`); `WORLD_HEIGHT` (`@core/sim/constants`).
- Produces:
  - `type ObstacleAnchor = 'floor' | 'ceiling' | 'floating'`
  - `interface ObstacleType { readonly id: string; readonly anchor: ObstacleAnchor; makeHitbox(rng: Rng): Hitbox }`
  - `const OBSTACLE_CATALOG: readonly ObstacleType[]` (4 tipos: tree=aabb/floor, vine=aabb/ceiling, boulder=circle/floating, stalactite=polygon/ceiling)
  - `interface SpawnConfig { worldHeight: number; yMargin: number; startX: number; gapMin: number; gapMax: number }`
  - `const SPAWN_START_X`, `SPAWN_GAP_MIN`, `SPAWN_GAP_MAX`, `SPAWN_Y_MARGIN`, `DEFAULT_SPAWN_CONFIG: SpawnConfig`

- [ ] **Step 1: Escrever o teste que falha** (`tests/core/spawn/catalog.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { OBSTACLE_CATALOG } from '@core/spawn';

describe('OBSTACLE_CATALOG', () => {
  it('tem ids únicos e âncoras válidas', () => {
    const ids = OBSTACLE_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of OBSTACLE_CATALOG) {
      expect(t.id.startsWith('obstacle.')).toBe(true);
      expect(['floor', 'ceiling', 'floating']).toContain(t.anchor);
    }
  });

  it('cobre os três tipos de hitbox (não só retângulos)', () => {
    const rng = createRng('catalog-test');
    const kinds = new Set(OBSTACLE_CATALOG.map((t) => t.makeHitbox(rng).kind));
    expect(kinds.has('aabb')).toBe(true);
    expect(kinds.has('circle')).toBe(true);
    expect(kinds.has('polygon')).toBe(true);
  });

  it('makeHitbox é determinístico para o mesmo estado de rng', () => {
    const t = OBSTACLE_CATALOG[0]!;
    const a = t.makeHitbox(createRng('seed-x'));
    const b = t.makeHitbox(createRng('seed-x'));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/spawn/catalog.test.ts`
Expected: FAIL — `@core/spawn` não resolve / `OBSTACLE_CATALOG` indefinido.

- [ ] **Step 3: Criar `src/core/spawn/generator.ts`** (somente a config nesta task; a classe vem na Task 3)

```ts
/** Parâmetros de geração de obstáculos. Placeholders desta fase; 1.7/Fase 2 afinam. */
export interface SpawnConfig {
  worldHeight: number;
  yMargin: number;
  startX: number;
  gapMin: number;
  gapMax: number;
}
```

- [ ] **Step 4: Criar `src/core/spawn/catalog.ts`**

```ts
import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde o obstáculo se ancora verticalmente. */
export type ObstacleAnchor = 'floor' | 'ceiling' | 'floating';

/**
 * Tipo lógico de obstáculo: dado puro. `id` = chave do manifesto/asset-registry e tag da
 * entidade. `makeHitbox` pode variar o tamanho via Rng (a arte nunca muda a hitbox).
 */
export interface ObstacleType {
  readonly id: string;
  readonly anchor: ObstacleAnchor;
  makeHitbox(rng: Rng): Hitbox;
}

/** Catálogo de obstáculos. Cobre aabb, circle e polygon (formatos variados). */
export const OBSTACLE_CATALOG: readonly ObstacleType[] = [
  // Tronco subindo do chão.
  { id: 'obstacle.tree', anchor: 'floor', makeHitbox: (rng) => aabb(6, rng.range(24, 40)) },
  // Cipó pendendo do teto.
  { id: 'obstacle.vine', anchor: 'ceiling', makeHitbox: (rng) => aabb(4, rng.range(20, 34)) },
  // Pedregulho flutuante.
  { id: 'obstacle.boulder', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(10, 18)) },
  // Estalactite: triângulo convexo apontando para baixo (ápice embaixo).
  {
    id: 'obstacle.stalactite',
    anchor: 'ceiling',
    makeHitbox: (rng) => {
      const halfW = rng.range(8, 14);
      const halfH = rng.range(11, 18);
      return polygon([
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: 0, y: halfH },
      ]);
    },
  },
];
```

- [ ] **Step 5: Criar `src/core/spawn/constants.ts`**

```ts
import { WORLD_HEIGHT } from '@core/sim/constants';
import type { SpawnConfig } from './generator';

// Placeholders de tuning (unidades de mundo). 1.7/Fase 2 afinam.
export const SPAWN_START_X = 200; // x do primeiro obstáculo (folga inicial p/ o jogador)
export const SPAWN_GAP_MIN = 120; // distância x mínima entre spawns consecutivos
export const SPAWN_GAP_MAX = 220; // distância x máxima
export const SPAWN_Y_MARGIN = 8; // folga das bordas teto/chão

/** Config padrão do gerador (uso standalone/teste; createWorld sobrescreve worldHeight). */
export const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: SPAWN_START_X,
  gapMin: SPAWN_GAP_MIN,
  gapMax: SPAWN_GAP_MAX,
};
```

- [ ] **Step 6: Criar barrel temporário `src/core/spawn/index.ts`** (a Task 3 reexporta a classe)

```ts
export * from './catalog';
export * from './generator';
export * from './constants';
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run tests/core/spawn/catalog.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/core/spawn/catalog.ts src/core/spawn/constants.ts src/core/spawn/generator.ts src/core/spawn/index.ts tests/core/spawn/catalog.test.ts
git commit -m "feat(core/spawn): catálogo de obstáculos + config de spawn"
```

---

### Task 3: `SpawnGenerator` (gerador keyed por distância)

**Files:**
- Modify: `src/core/spawn/generator.ts`
- Test: `tests/core/spawn/generator.test.ts`
- Test: `tests/determinism/spawn.determinism.test.ts`

**Interfaces:**
- Consumes: `Rng` (`@core/rng`); `Entity`, `Hitbox` (`@core/sim/types`); `boundsOf` (`@core/sim/hitbox`); `OBSTACLE_CATALOG`, `ObstacleType`, `ObstacleAnchor` (`./catalog`); `SpawnConfig` (mesmo arquivo).
- Produces:
  - `class SpawnGenerator { constructor(rng: Rng, config: SpawnConfig); generateUpTo(upToX: number, sink: Entity[]): void; clone(): SpawnGenerator }`
  - Entidades emitidas: `type: 'obstacle'`, `tags: [type.id]`, `transform.position.x` crescente a partir de `startX`, `id` monotônico de 0, `kinematics.velocity = {x:0,y:0}`.

- [ ] **Step 1: Escrever os testes do gerador** (`tests/core/spawn/generator.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { boundsOf } from '@core/sim';
import type { Entity } from '@core/sim';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';

const CONFIG: SpawnConfig = { ...DEFAULT_SPAWN_CONFIG, worldHeight: 180 };

function gen(seed = 'gen-test'): SpawnGenerator {
  return new SpawnGenerator(createRng(seed).fork('obstacles'), CONFIG);
}

describe('SpawnGenerator.generateUpTo', () => {
  it('não emite nada abaixo de startX', () => {
    const out: Entity[] = [];
    gen().generateUpTo(CONFIG.startX - 1, out);
    expect(out).toEqual([]);
  });

  it('emite obstáculos com x crescente e ids monotônicos a partir de 0', () => {
    const out: Entity[] = [];
    gen().generateUpTo(2000, out);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]!.id).toBe(i);
      expect(out[i]!.type).toBe('obstacle');
      expect(out[i]!.tags[0]!.startsWith('obstacle.')).toBe(true);
      if (i > 0) expect(out[i]!.transform.position.x).toBeGreaterThan(out[i - 1]!.transform.position.x);
    }
    expect(out[0]!.transform.position.x).toBe(CONFIG.startX);
  });

  it('placement mantém a hitbox dentro de [margin, worldHeight - margin]', () => {
    const out: Entity[] = [];
    gen().generateUpTo(5000, out);
    for (const e of out) {
      const b = boundsOf(e.hitbox);
      const top = e.transform.position.y + b.minY;
      const bottom = e.transform.position.y + b.maxY;
      expect(top).toBeGreaterThanOrEqual(CONFIG.yMargin - 1e-9);
      expect(bottom).toBeLessThanOrEqual(CONFIG.worldHeight - CONFIG.yMargin + 1e-9);
    }
  });

  it('clone isola estado: avançar o clone não afeta o original', () => {
    const g = gen();
    const a: Entity[] = [];
    g.generateUpTo(600, a);
    const c = g.clone();
    const more: Entity[] = [];
    c.generateUpTo(5000, more);
    const aTail: Entity[] = [];
    g.generateUpTo(5000, aTail); // g continua de onde parou, igual ao clone
    expect(aTail).toEqual(more);
  });
});
```

- [ ] **Step 2: Escrever os testes de determinismo** (`tests/determinism/spawn.determinism.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import type { Entity } from '@core/sim';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';

function run(seed: string, upTo: number): Entity[] {
  const g = new SpawnGenerator(createRng(seed).fork('obstacles'), DEFAULT_SPAWN_CONFIG);
  const out: Entity[] = [];
  g.generateUpTo(upTo, out);
  return out;
}

describe('determinismo do spawn de obstáculos', () => {
  it('mesma seed ⇒ mesma sequência', () => {
    expect(run('endless:ABC', 4000)).toEqual(run('endless:ABC', 4000));
  });

  it('seeds diferentes ⇒ sequências diferentes', () => {
    expect(run('endless:ABC', 4000)).not.toEqual(run('endless:XYZ', 4000));
  });

  it('independência de batching: uma chamada == várias incrementais', () => {
    const single = run('endless:ABC', 4000);

    const g = new SpawnGenerator(createRng('endless:ABC').fork('obstacles'), DEFAULT_SPAWN_CONFIG);
    const incremental: Entity[] = [];
    for (let x = 0; x <= 4000; x += 137) g.generateUpTo(x, incremental);
    g.generateUpTo(4000, incremental);

    expect(incremental).toEqual(single);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/core/spawn/generator.test.ts tests/determinism/spawn.determinism.test.ts`
Expected: FAIL — `SpawnGenerator` não é exportado / não é construtor.

- [ ] **Step 4: Implementar a classe** (substituir o conteúdo de `src/core/spawn/generator.ts`, mantendo a interface `SpawnConfig`)

```ts
import type { Rng } from '@core/rng';
import type { Entity, Hitbox } from '@core/sim/types';
import { boundsOf } from '@core/sim/hitbox';
import { OBSTACLE_CATALOG } from './catalog';
import type { ObstacleAnchor } from './catalog';

/** Parâmetros de geração de obstáculos. Placeholders desta fase; 1.7/Fase 2 afinam. */
export interface SpawnConfig {
  worldHeight: number;
  yMargin: number;
  startX: number;
  gapMin: number;
  gapMax: number;
}

/** Calcula o y (centro) de um obstáculo conforme a âncora, mantendo a hitbox nas margens. */
function placeY(anchor: ObstacleAnchor, hitbox: Hitbox, config: SpawnConfig, rng: Rng): number {
  const b = boundsOf(hitbox);
  const m = config.yMargin;
  switch (anchor) {
    case 'floor':
      return config.worldHeight - m - b.maxY;
    case 'ceiling':
      return m - b.minY;
    case 'floating':
      return rng.range(m - b.minY, config.worldHeight - m - b.maxY);
  }
}

/**
 * Gerador determinístico de obstáculos, keyed por posição x do mundo. Avança um cursor por
 * obstáculo emitido (não por chamada) ⇒ independente de batching/fps. Consome só o Rng dado.
 */
export class SpawnGenerator {
  private readonly rng: Rng;
  private readonly config: SpawnConfig;
  private nextSpawnX: number;
  private nextId: number;

  constructor(rng: Rng, config: SpawnConfig) {
    this.rng = rng;
    this.config = config;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }

  /** Empurra em `sink` todo obstáculo com spawnX <= upToX (ordem de x crescente). */
  generateUpTo(upToX: number, sink: Entity[]): void {
    while (this.nextSpawnX <= upToX) {
      const type = this.rng.pick(OBSTACLE_CATALOG);
      const hitbox = type.makeHitbox(this.rng);
      const y = placeY(type.anchor, hitbox, this.config, this.rng);
      sink.push({
        id: this.nextId,
        type: 'obstacle',
        tags: [type.id],
        transform: { position: { x: this.nextSpawnX, y } },
        kinematics: { velocity: { x: 0, y: 0 } },
        hitbox,
      });
      this.nextId += 1;
      this.nextSpawnX += this.rng.range(this.config.gapMin, this.config.gapMax);
    }
  }

  /** Cópia independente (rng clonado + cursor). Para cloneWorld/snapshots. */
  clone(): SpawnGenerator {
    const c = new SpawnGenerator(this.rng.clone(), this.config);
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/core/spawn/generator.test.ts tests/determinism/spawn.determinism.test.ts`
Expected: PASS (todos).

- [ ] **Step 6: Typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/spawn/generator.ts tests/core/spawn/generator.test.ts tests/determinism/spawn.determinism.test.ts
git commit -m "feat(core/spawn): SpawnGenerator keyed por distância + testes de determinismo"
```

---

### Task 4: Integração no mundo e no `step`

**Files:**
- Modify: `src/core/sim/types.ts`
- Modify: `src/core/sim/constants.ts`
- Modify: `src/core/sim/world.ts`
- Modify: `src/core/sim/step.ts`
- Test: `tests/determinism/sim.determinism.test.ts` (append)

**Interfaces:**
- Consumes: `SpawnGenerator`, `DEFAULT_SPAWN_CONFIG`, `SpawnConfig` (`@core/spawn`); `createRng` (`@core/rng`); `boundsOf` (`./hitbox`).
- Produces:
  - `WorldConfig.seed?: string`, `WorldConfig.spawn?: Partial<SpawnConfig>`
  - `WorldState.spawner: SpawnGenerator | null`
  - `SPAWN_LOOKAHEAD`, `CULL_MARGIN` em `@core/sim`
  - `createWorld({ seed })` popula obstáculos ao longo dos steps; sem `seed` ⇒ `spawner = null`.

- [ ] **Step 1: Escrever o teste de integração** (append em `tests/determinism/sim.determinism.test.ts`)

```ts
import { SpawnGenerator } from '@core/spawn';

describe('determinismo de spawn integrado ao step', () => {
  const SEEDED: WorldConfig = { ...FIXED_CONFIG, seed: 'endless:RUN1' };

  it('sem seed ⇒ sem spawner e sem obstáculos', () => {
    const w = createWorld(FIXED_CONFIG);
    expect(w.spawner).toBeNull();
    for (let i = 0; i < 300; i++) step(w, { flap: i % 12 === 0 });
    expect(w.obstacles).toEqual([]);
  });

  it('com seed ⇒ obstáculos aparecem ao avançar', () => {
    const w = createWorld(SEEDED);
    expect(w.spawner).toBeInstanceOf(SpawnGenerator);
    for (let i = 0; i < 400; i++) step(w, { flap: i % 12 === 0 });
    expect(w.obstacles.length).toBeGreaterThan(0);
  });

  it('fps-independência: 1, 2 e 5 steps por frame ⇒ obstáculos idênticos', () => {
    const timeline = makeTimeline(900);
    const one = runBatched(SEEDED, timeline, 1);
    const two = runBatched(SEEDED, timeline, 2);
    const five = runBatched(SEEDED, timeline, 5);
    expect(two.obstacles).toEqual(one.obstacles);
    expect(five.obstacles).toEqual(one.obstacles);
  });

  it('cloneWorld isola o spawner: avançar o clone não muda o original', () => {
    const w = createWorld(SEEDED);
    for (let i = 0; i < 300; i++) step(w, { flap: false });
    const snap = cloneWorld(w);
    const before = snap.obstacles.length;
    for (let i = 0; i < 600; i++) step(w, { flap: false });
    expect(snap.obstacles.length).toBe(before);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/determinism/sim.determinism.test.ts`
Expected: FAIL — `WorldConfig.seed` desconhecido / `w.spawner` inexistente.

- [ ] **Step 3: Atualizar `src/core/sim/types.ts`**

Adicionar no topo (após eventuais imports — o arquivo hoje não importa nada; adicionar):
```ts
import type { SpawnGenerator, SpawnConfig } from '@core/spawn';
```
Em `WorldConfig`, adicionar os campos opcionais:
```ts
  startY?: number;
  pterodactylHitbox?: Hitbox;
  /** Seed canônica da partida (de fora do core). Presente ⇒ o mundo gera obstáculos. */
  seed?: string;
  /** Overrides parciais da config de spawn (tuning). */
  spawn?: Partial<SpawnConfig>;
}
```
Em `WorldState`, adicionar o campo:
```ts
  obstacles: Entity[];
  collectibles: Entity[];
  /** Gerador de obstáculos (null quando o mundo não tem seed). */
  spawner: SpawnGenerator | null;
}
```

- [ ] **Step 4: Atualizar `src/core/sim/constants.ts`**

Mudar o tipo de `DEFAULT_WORLD_CONFIG` para excluir `seed`/`spawn` (não têm default fixo):
```ts
export const DEFAULT_WORLD_CONFIG: Required<Omit<WorldConfig, 'seed' | 'spawn'>> = {
```
Adicionar ao final do arquivo:
```ts
/** Quão à frente do pterodáctilo (em x) o gerador materializa obstáculos. */
export const SPAWN_LOOKAHEAD = 400;
/** Distância atrás do pterodáctilo após a qual obstáculos ultrapassados são removidos. */
export const CULL_MARGIN = 100;
```

- [ ] **Step 5: Atualizar `src/core/sim/world.ts`**

Imports no topo:
```ts
import { DEFAULT_WORLD_CONFIG } from './constants';
import { cloneHitbox } from './hitbox';
import type { Entity, WorldConfig, WorldState } from './types';
import { createRng } from '@core/rng';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';
```
Adicionar helper e usar em `createWorld` (definir `spawner` e incluí-lo no objeto retornado):
```ts
function buildSpawner(seed: string, worldHeight: number, override?: Partial<SpawnConfig>): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_SPAWN_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('obstacles'), config);
}
```
Em `createWorld`, antes do `return`:
```ts
  const spawner = config.seed === undefined ? null : buildSpawner(config.seed, c.worldHeight, config.spawn);
```
e no objeto retornado adicionar `spawner,` (junto a obstacles/collectibles).
Em `cloneWorld`, no objeto retornado adicionar:
```ts
    spawner: w.spawner ? w.spawner.clone() : null,
```

- [ ] **Step 6: Atualizar `src/core/sim/step.ts`**

Imports:
```ts
import { FIXED_DT, SPAWN_LOOKAHEAD, CULL_MARGIN } from './constants';
import { boundsOf } from './hitbox';
import type { InputFrame, WorldState } from './types';
```
No fim de `step`, após o tratamento das bordas verticais, adicionar:
```ts
  // Geração de obstáculos keyed por distância + cull dos ultrapassados (hot path: sem alocação
  // quando nada é emitido/cullado).
  if (world.spawner) {
    world.spawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.obstacles);
    const cullX = pos.x - CULL_MARGIN;
    const obs = world.obstacles;
    while (obs.length > 0 && obs[0]!.transform.position.x + boundsOf(obs[0]!.hitbox).maxX < cullX) {
      obs.shift();
    }
  }
```

- [ ] **Step 7: Rodar a suíte de determinismo e de sim**

Run: `npx vitest run tests/determinism/sim.determinism.test.ts tests/core/sim`
Expected: PASS (incluindo os testes antigos sem seed, que seguem com `spawner: null`).

- [ ] **Step 8: Rodar tudo + typecheck/lint + determinismo**

Run: `npm test && npm run check && npm run test:determinism`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add src/core/sim/types.ts src/core/sim/constants.ts src/core/sim/world.ts src/core/sim/step.ts tests/determinism/sim.determinism.test.ts
git commit -m "feat(core/sim): integra SpawnGenerator ao mundo e ao step (spawn keyed por distância + cull)"
```

---

### Task 5: Asset-specs dos obstáculos + registro

**Files:**
- Create: `docs/assets/specs/obstacle.tree.md`
- Create: `docs/assets/specs/obstacle.vine.md`
- Create: `docs/assets/specs/obstacle.boulder.md`
- Create: `docs/assets/specs/obstacle.stalactite.md`
- Modify: `docs/assets/asset-registry.md`

Sem testes (documentação). Verificação = arquivos existem, hitbox bate com o catálogo, registro atualizado.

- [ ] **Step 1: Criar os 4 asset-specs** seguindo `docs/assets/asset-spec-template.md`. Cada um com a hitbox lógica idêntica ao catálogo (Task 2):
  - `obstacle.tree` — categoria obstáculo; placeholder = retângulo vertical (tronco); hitbox aabb estreita e alta (halfW≈6, halfH 24–40); âncora pés no chão; atlas `obstacles`; prompt IA de um tronco/árvore jurássica vista lateral, fundo transparente.
  - `obstacle.vine` — cipó pendendo do teto; hitbox aabb fina (halfW≈4, halfH 20–34); âncora topo no teto; atlas `obstacles`.
  - `obstacle.boulder` — pedregulho flutuante; hitbox circle (raio 10–18); âncora flutuante; atlas `obstacles`.
  - `obstacle.stalactite` — estalactite do teto; hitbox polígono triangular convexo apontando p/ baixo (largura 16–28, altura 22–36); âncora topo no teto; atlas `obstacles`.

  Conteúdo de cada arquivo (preencher os campos do template; exemplo para `obstacle.tree.md`):
```markdown
# Asset Spec — obstacle.tree

## Identidade
- **id:** `obstacle.tree`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** retângulo vertical (tronco) subindo do chão.

## Especificação técnica
- **Dimensões alvo (px):** 96 × 320 (@1x; exportar @2x)
- **Pivô / âncora:** base centralizada (encosta no chão)
- **Hitbox lógica associada:** aabb estreita e alta — halfW ≈ 6, halfH 24–40 (variável por instância). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** estático (1 frame); opcional leve balanço de folhas (cosmético)
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** tronco `#6b4a2b`, folhagem `#2f6b2f`, contorno `#2a1a10`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave.
- **Coerência:** pack jurássico inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite of a tall prehistoric tree trunk with sparse fern-like foliage on top, flat cartoon vector style, bold dark outline, simple cel shading, brown trunk, green foliage, transparent background, centered, no text, no ground shadow."

## Checklist de aceite
- [ ] Fundo transparente; base alinhada ao pivô inferior.
- [ ] Proporções batem com a hitbox lógica (estreita e alta).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada.
```
  Repetir análogo para vine (cipó verde pendente), boulder (pedra cinza arredondada, prompt de boulder/rock), stalactite (estalactite de pedra apontando p/ baixo, hitbox triangular).

- [ ] **Step 2: Atualizar `docs/assets/asset-registry.md`** — na seção "Obstáculos": mudar `tree`, `vine`, `stalactite` para status `spec` com link para o spec; adicionar linha `obstacle.boulder | pedregulho flutuante | spec | specs/obstacle.boulder.md`. Manter `rock_arch` como `placeholder` (arch real exige multi-hitbox; ver spec da feature). Atualizar as linhas existentes para apontar `specs/obstacle.<nome>.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/assets/specs/obstacle.tree.md docs/assets/specs/obstacle.vine.md docs/assets/specs/obstacle.boulder.md docs/assets/specs/obstacle.stalactite.md docs/assets/asset-registry.md
git commit -m "docs(assets): asset-specs dos obstáculos do item 1.4 + registro"
```

---

## Fechamento (após as 5 tasks)

- [ ] Marcar o item 1.4 como `[x]` em `docs/roadmap/PHASE-01-deterministic-core.md` (os 3 sub-bullets).
- [ ] Atualizar "Estado atual" no `CLAUDE.md` (1.4 concluído; próximo = 1.5).
- [ ] `superpowers:verification-before-completion`: rodar `npm test`, `npm run check`, `npm run test:determinism` e colar a saída.
- [ ] Review final da branch (`superpowers:requesting-code-review` / agente `reviewer` + `determinism-guardian`).
- [ ] Merge para `main` (`--no-ff`) e aposentar a branch (pré-autorizado).
</content>
