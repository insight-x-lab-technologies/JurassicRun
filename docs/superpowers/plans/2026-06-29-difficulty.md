# Dificuldade (Item 1.7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma curva de dificuldade pura (`difficultyAt(distance)`) que faz a velocidade do scroll crescer e o espaçamento dos obstáculos encolher conforme a distância, com um nível inteiro derivado — tudo determinístico e reiniciando a cada partida.

**Architecture:** Novo módulo `src/core/difficulty/` com uma curva **adimensional** (escalas ancoradas em 1.0 na distância 0). O `step` multiplica a velocidade-base pela `speedScale(distance)`; o `SpawnGenerator` de obstáculos multiplica o gap-base pela `gapScale(x)` na posição de cada spawn. Como tudo deriva de `distance` (que começa em 0 a cada partida), a dificuldade reinicia sozinha.

**Tech Stack:** TypeScript estrito, Vitest. `src/core/` é TS puro (sem Phaser/DOM/IO).

## Global Constraints

- **Determinismo (REGRA 1):** nada de `Math.random()`/`Date.now()`/`performance.now()` em `src/core/`. Só aritmética IEEE-754 portável + `Math.floor`. Sem `Math.pow`/`exp`/`log`/`hypot` na curva. Mesma seed + inputs ⇒ estado idêntico; independência de fps/batching.
- **Arte desacoplada (REGRA 2):** dificuldade não toca em arte; só números lógicos.
- **Performance (REGRA 3):** sem alocação por-entidade-por-frame no hot path (cull/colisão seguem alocação-zero). `difficultyAt` aloca 1 literal por step (velocidade) e 1 por obstáculo emitido (gap) — pontual, aceitável.
- **TS estrito:** sem `any` sem justificativa. Aliases: `@core/*` → `src/core/*`.
- **Comando de teste:** `npm test` (Vitest), typecheck `npm run check`, determinismo `npm run test:determinism`.
- Valores de tuning são **placeholders** (afinados na Fase 2); marque-os como tal.

---

### Task 1: Módulo `src/core/difficulty/` — curva pura

**Files:**
- Create: `src/core/difficulty/constants.ts`
- Create: `src/core/difficulty/curve.ts`
- Create: `src/core/difficulty/index.ts`
- Test: `tests/core/difficulty/curve.test.ts`

**Interfaces:**
- Produces:
  - `interface DifficultyParams { level: number; speedScale: number; gapScale: number }`
  - `difficultyAt(distance: number): DifficultyParams`
  - `levelForDistance(distance: number): number`
  - Constantes `SPEED_SCALE_MAX`, `SPEED_HALF_DISTANCE`, `GAP_SCALE_MIN`, `GAP_HALF_DISTANCE`, `DISTANCE_PER_LEVEL`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/core/difficulty/curve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  difficultyAt,
  levelForDistance,
  SPEED_SCALE_MAX,
  GAP_SCALE_MIN,
  DISTANCE_PER_LEVEL,
} from '@core/difficulty';

describe('difficultyAt — ancoragem (reset por partida)', () => {
  it('em d=0: escalas 1.0 e nível 1', () => {
    const d0 = difficultyAt(0);
    expect(d0.speedScale).toBe(1);
    expect(d0.gapScale).toBe(1);
    expect(d0.level).toBe(1);
  });
  it('clampa distância negativa em 0', () => {
    expect(difficultyAt(-100)).toEqual(difficultyAt(0));
  });
});

describe('difficultyAt — monotonicidade e limites', () => {
  const samples = [0, 100, 500, 1000, 3000, 10000, 100000];
  it('speedScale estritamente crescente, gapScale estritamente decrescente', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = difficultyAt(samples[i - 1]!);
      const b = difficultyAt(samples[i]!);
      expect(b.speedScale).toBeGreaterThan(a.speedScale);
      expect(b.gapScale).toBeLessThan(a.gapScale);
    }
  });
  it('limitada: 1 ≤ speedScale < MAX e MIN < gapScale ≤ 1 para todo d finito', () => {
    for (const d of [...samples, 1e7]) {
      const p = difficultyAt(d);
      expect(p.speedScale).toBeGreaterThanOrEqual(1);
      expect(p.speedScale).toBeLessThan(SPEED_SCALE_MAX);
      expect(p.gapScale).toBeLessThanOrEqual(1);
      expect(p.gapScale).toBeGreaterThan(GAP_SCALE_MIN);
    }
  });
  it('tende aos limites em d grande', () => {
    const p = difficultyAt(1e7);
    expect(p.speedScale).toBeCloseTo(SPEED_SCALE_MAX, 2);
    expect(p.gapScale).toBeCloseTo(GAP_SCALE_MIN, 2);
  });
});

describe('levelForDistance — degraus', () => {
  it('nível 1 antes do 1º degrau; sobe em múltiplos de DISTANCE_PER_LEVEL', () => {
    expect(levelForDistance(0)).toBe(1);
    expect(levelForDistance(DISTANCE_PER_LEVEL - 0.001)).toBe(1);
    expect(levelForDistance(DISTANCE_PER_LEVEL)).toBe(2);
    expect(levelForDistance(DISTANCE_PER_LEVEL * 2)).toBe(3);
    expect(levelForDistance(DISTANCE_PER_LEVEL * 5 + 1)).toBe(6);
  });
});

describe('difficultyAt — pureza', () => {
  it('mesma distância ⇒ mesmo resultado', () => {
    expect(difficultyAt(1234.5)).toEqual(difficultyAt(1234.5));
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/core/difficulty/curve.test.ts`
Expected: FAIL (módulo `@core/difficulty` não existe).

- [ ] **Step 3: Implementar as constantes**

Create `src/core/difficulty/constants.ts`:

```ts
// Constantes de tuning da curva de dificuldade. Placeholders; afinados na Fase 2.
// A dificuldade é uma curva de ESCALAS (multiplicadores adimensionais) ancorada em 1.0
// na distância 0 ⇒ comportamento inicial idêntico ao base. distance ≥ 0 (monotônica).

/** Velocidade-teto como múltiplo da velocidade-base (2 ⇒ até 2× a base). */
export const SPEED_SCALE_MAX = 2;
/** Distância em que speedScale atinge metade do caminho até SPEED_SCALE_MAX. */
export const SPEED_HALF_DISTANCE = 3000;
/** Piso do gap como fração do gap-base (0.6 ⇒ obstáculos chegam a 60% do espaçamento). */
export const GAP_SCALE_MIN = 0.6;
/** Distância em que gapScale atinge metade do caminho até GAP_SCALE_MIN. */
export const GAP_HALF_DISTANCE = 3000;
/** Distância (unidades de mundo) por degrau de nível. */
export const DISTANCE_PER_LEVEL = 500;
```

- [ ] **Step 4: Implementar a curva**

Create `src/core/difficulty/curve.ts`:

```ts
import {
  SPEED_SCALE_MAX,
  SPEED_HALF_DISTANCE,
  GAP_SCALE_MIN,
  GAP_HALF_DISTANCE,
  DISTANCE_PER_LEVEL,
} from './constants';

/** Parâmetros de dificuldade derivados PURAMENTE da distância. Escalas adimensionais
 * ancoradas em 1.0 na distância 0. */
export interface DifficultyParams {
  /** Nível 1-based (HUD/Game Over). Cresce em degraus com a distância. */
  level: number;
  /** Multiplicador da velocidade-base (≥ 1, cresce até SPEED_SCALE_MAX). */
  speedScale: number;
  /** Multiplicador do gap-base dos obstáculos (≤ 1, cai até GAP_SCALE_MIN). */
  gapScale: number;
}

/** Nível 1-based a partir da distância. */
export function levelForDistance(distance: number): number {
  const d = distance > 0 ? distance : 0;
  return 1 + Math.floor(d / DISTANCE_PER_LEVEL);
}

/**
 * Curva de dificuldade pura: distância → escalas + nível. Sem RNG, sem tempo.
 * Forma hiperbólica assintótica `d/(d+H)`: cresce sempre (bom p/ Endless), mas LIMITADA
 * (jogável). Só aritmética IEEE-754 portável (DETERMINISM.md §5): +, −, ·, /, floor.
 * Sem Math.pow/exp/log/hypot. `d ≥ 0` ⇒ `d + H > 0` (sem divisão por zero).
 */
export function difficultyAt(distance: number): DifficultyParams {
  const d = distance > 0 ? distance : 0;
  const speedT = d / (d + SPEED_HALF_DISTANCE); // [0, 1)
  const gapT = d / (d + GAP_HALF_DISTANCE); // [0, 1)
  return {
    level: levelForDistance(d),
    speedScale: 1 + (SPEED_SCALE_MAX - 1) * speedT,
    gapScale: 1 - (1 - GAP_SCALE_MIN) * gapT,
  };
}
```

Create `src/core/difficulty/index.ts`:

```ts
export * from './curve';
export * from './constants';
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/core/difficulty/curve.test.ts`
Expected: PASS (todos verdes).

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/difficulty tests/core/difficulty
git commit -m "feat(core/difficulty): curva pura distância→velocidade/gaps/nível (1.7)"
```

---

### Task 2: `SpawnGenerator` aceita `gapScale` + `SpawnConfig` readonly + defaults congelados

**Files:**
- Modify: `src/core/spawn/generator.ts`
- Modify: `src/core/spawn/constants.ts`
- Test: `tests/core/spawn/generator.test.ts` (adicionar bloco)

**Interfaces:**
- Consumes: `difficultyAt` (Task 1) — usado só no teste deste passo.
- Produces: `new SpawnGenerator(rng, config, catalog?, entityType?, gapScale?: (x: number) => number)` — `gapScale` default `() => 1` (espaçamento constante; retrocompatível). `SpawnConfig` com campos `readonly`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `tests/core/spawn/generator.test.ts` (antes do fim do arquivo) um novo bloco; e adicionar `difficultyAt` ao import topo. No topo, após a linha 6, adicione:

```ts
import { difficultyAt } from '@core/difficulty';
```

E ao final do arquivo:

```ts
describe('SpawnGenerator — gapScale (dificuldade)', () => {
  function meanGaps(out: { transform: { position: { x: number } } }[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < out.length; i++) {
      gaps.push(out[i]!.transform.position.x - out[i - 1]!.transform.position.x);
    }
    return gaps;
  }

  it('gapScale default (() => 1) ⇒ idêntico ao comportamento atual', () => {
    const a: Entity[] = [];
    new SpawnGenerator(createRng('s').fork('obstacles'), CONFIG).generateUpTo(5000, a);
    const b: Entity[] = [];
    new SpawnGenerator(createRng('s').fork('obstacles'), CONFIG, undefined, undefined, () => 1).generateUpTo(5000, b);
    expect(b).toEqual(a);
  });

  it('com gapScale da dificuldade, o campo fica mais denso longe da origem', () => {
    const out: Entity[] = [];
    new SpawnGenerator(
      createRng('dense').fork('obstacles'),
      CONFIG,
      undefined,
      undefined,
      (x) => difficultyAt(x).gapScale,
    ).generateUpTo(60000, out);
    const gaps = meanGaps(out);
    const early = gaps.slice(0, 10).reduce((s, g) => s + g, 0) / 10;
    const late = gaps.slice(-10).reduce((s, g) => s + g, 0) / 10;
    expect(late).toBeLessThan(early); // gaps encolheram ⇒ densidade subiu
  });

  it('clone propaga o gapScale (gera idêntico ao original a partir do mesmo ponto)', () => {
    const g = new SpawnGenerator(
      createRng('clone').fork('obstacles'),
      CONFIG,
      undefined,
      undefined,
      (x) => difficultyAt(x).gapScale,
    );
    const a: Entity[] = [];
    g.generateUpTo(3000, a);
    const c = g.clone();
    const fromClone: Entity[] = [];
    c.generateUpTo(30000, fromClone);
    const fromOrig: Entity[] = [];
    g.generateUpTo(30000, fromOrig);
    expect(fromOrig).toEqual(fromClone);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/core/spawn/generator.test.ts`
Expected: FAIL (o 5º parâmetro `gapScale` ainda não existe / sem efeito).

- [ ] **Step 3: Tornar `SpawnConfig` readonly e adicionar `gapScale` ao gerador**

Em `src/core/spawn/generator.ts`, troque a interface `SpawnConfig` para campos `readonly`:

```ts
/** Parâmetros de geração. Dados puros (sem comportamento). 1.7/Fase 2 afinam tuning. */
export interface SpawnConfig {
  readonly worldHeight: number;
  readonly yMargin: number;
  readonly startX: number;
  readonly gapMin: number;
  readonly gapMax: number;
}
```

Na classe `SpawnGenerator`, adicione o campo e o parâmetro de construtor (default `() => 1`):

```ts
export class SpawnGenerator {
  private readonly rng: Rng;
  private readonly config: SpawnConfig;
  private readonly catalog: readonly SpawnType[];
  private readonly entityType: EntityType;
  private readonly gapScale: (x: number) => number;
  private nextSpawnX: number;
  private nextId: number;

  constructor(
    rng: Rng,
    config: SpawnConfig,
    catalog: readonly SpawnType[] = OBSTACLE_CATALOG,
    entityType: EntityType = 'obstacle',
    gapScale: (x: number) => number = () => 1,
  ) {
    this.rng = rng;
    this.config = config;
    this.catalog = catalog;
    this.entityType = entityType;
    this.gapScale = gapScale;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }
```

No laço de `generateUpTo`, troque o avanço do cursor para escalar o gap pela dificuldade na
posição x do spawn recém-posto (a contagem/ordem de saques do RNG NÃO muda):

```ts
      this.nextId += 1;
      const s = this.gapScale(this.nextSpawnX);
      this.nextSpawnX += this.rng.range(this.config.gapMin * s, this.config.gapMax * s);
```

No `clone()`, propague `gapScale`:

```ts
  clone(): SpawnGenerator {
    const c = new SpawnGenerator(
      this.rng.clone(),
      this.config,
      this.catalog,
      this.entityType,
      this.gapScale,
    );
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
```

- [ ] **Step 4: Congelar os defaults de config**

Em `src/core/spawn/constants.ts`, envolva os dois defaults com `Object.freeze` (endereça a
pendência de "SpawnConfig readonly" do item 1.4):

```ts
export const DEFAULT_SPAWN_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: SPAWN_START_X,
  gapMin: SPAWN_GAP_MIN,
  gapMax: SPAWN_GAP_MAX,
});
```

e

```ts
export const DEFAULT_COLLECTIBLE_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: COLLECTIBLE_START_X,
  gapMin: COLLECTIBLE_GAP_MIN,
  gapMax: COLLECTIBLE_GAP_MAX,
});
```

(O `{ ...DEFAULT_SPAWN_CONFIG, ...override, worldHeight }` em `world.ts` cria um objeto novo a
cada build ⇒ o `freeze` não impede os overrides.)

- [ ] **Step 5: Rodar os testes do spawn e confirmar que passam**

Run: `npm test -- tests/core/spawn/`
Expected: PASS (novos casos de gapScale + os existentes verdes).

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/spawn tests/core/spawn/generator.test.ts
git commit -m "feat(core/spawn): SpawnGenerator.gapScale + SpawnConfig readonly/frozen (1.7)"
```

---

### Task 3: Integração no `sim` — velocidade efetiva, nível, wiring do gapScale

**Files:**
- Modify: `src/core/sim/types.ts`
- Modify: `src/core/sim/world.ts`
- Modify: `src/core/sim/step.ts`
- Modify: `tests/core/sim/step.test.ts` (1 teste: usar `difficulty: false`)
- Modify: `tests/determinism/sim.determinism.test.ts` (1 teste: usar `difficulty: false`)
- Test: `tests/core/sim/difficulty-step.test.ts` (novo)

**Interfaces:**
- Consumes: `difficultyAt` (Task 1); `SpawnGenerator(..., gapScale)` (Task 2).
- Produces: `WorldState` ganha `baseScrollSpeed: number`, `level: number`, `difficultyEnabled: boolean`; `WorldConfig` ganha `difficulty?: boolean` (default `true`). `world.scrollSpeed` passa a ser a velocidade **efetiva** (atualizada por step).

- [ ] **Step 1: Escrever o teste de integração que falha**

Create `tests/core/sim/difficulty-step.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import { DISTANCE_PER_LEVEL } from '@core/difficulty';

describe('integração da dificuldade no step', () => {
  it('mundo recém-criado: level 1 e scrollSpeed = baseScrollSpeed (reset por partida)', () => {
    const w = createWorld({ seed: 'endless:R' });
    expect(w.level).toBe(1);
    expect(w.scrollSpeed).toBe(w.baseScrollSpeed);
  });

  it('com dificuldade (default): scrollSpeed cresce ao longo de muitos steps', () => {
    // Sem seed (sem obstáculos/colisão); mundo alto: o dino sobe e encosta no teto (clamp,
    // sem morte) e segue avançando em x ⇒ distância cresce ⇒ velocidade efetiva cresce.
    const w = createWorld({ worldHeight: 1000, startY: 500 });
    const s0 = w.scrollSpeed;
    for (let i = 0; i < 1000; i++) step(w, { flap: i % 8 === 0 });
    expect(w.distance).toBeGreaterThan(0);
    expect(w.scrollSpeed).toBeGreaterThan(s0);
  });

  it('com difficulty:false: scrollSpeed constante e level sempre 1', () => {
    const w = createWorld({ difficulty: false, worldHeight: 1000, startY: 500 });
    const s0 = w.scrollSpeed;
    for (let i = 0; i < 1000; i++) step(w, { flap: i % 8 === 0 });
    expect(w.scrollSpeed).toBe(s0);
    expect(w.level).toBe(1);
  });

  it('level sobe ao cruzar DISTANCE_PER_LEVEL', () => {
    // Mundo enorme p/ não morrer; voa ~estável e acumula distância.
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    while (w.distance < DISTANCE_PER_LEVEL && w.tick < 100000) step(w, { flap: w.tick % 2 === 0 });
    expect(w.level).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/core/sim/difficulty-step.test.ts`
Expected: FAIL (`w.level`/`w.baseScrollSpeed`/`difficulty` ainda não existem).

- [ ] **Step 3: Estender os tipos**

Em `src/core/sim/types.ts`, no `WorldConfig` adicione (após `collectibleSpawn?`):

```ts
  /** Liga a curva de dificuldade (velocidade/gaps crescentes). Default true. */
  difficulty?: boolean;
```

No `WorldState`, adicione os campos (após `scrollSpeed: number;`):

```ts
  /** Velocidade-base imutável (a `scrollSpeed` efetiva = base × speedScale(distance)). */
  baseScrollSpeed: number;
  /** Nível atual (1-based), derivado da distância. Reinicia a cada partida (distance=0). */
  level: number;
  /** Se a curva de dificuldade está ativa (escala velocidade/gaps). */
  difficultyEnabled: boolean;
```

E ajuste o comentário de `scrollSpeed` para refletir que é o valor efetivo vivo:

```ts
  /** Velocidade de scroll EFETIVA do step atual (base × speedScale; ver baseScrollSpeed). */
  scrollSpeed: number;
```

- [ ] **Step 4: Wiring em `createWorld`/`cloneWorld`**

Em `src/core/sim/world.ts`:

Importe a curva no topo (após os imports existentes):

```ts
import { difficultyAt } from '@core/difficulty';
```

Troque a assinatura de `buildSpawner` para aceitar `gapScale` e repassá-lo ao gerador:

```ts
function buildSpawner(
  seed: string,
  worldHeight: number,
  override?: Partial<SpawnConfig>,
  gapScale?: (x: number) => number,
): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_SPAWN_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('obstacles'), config, undefined, undefined, gapScale);
}
```

Em `createWorld`, compute o flag e o `gapScale`, e preencha os novos campos:

```ts
export function createWorld(config: WorldConfig = {}): WorldState {
  const c = { ...DEFAULT_WORLD_CONFIG, ...config };
  const difficultyEnabled = config.difficulty ?? true;
  const gapScale = difficultyEnabled ? (x: number) => difficultyAt(x).gapScale : undefined;
  const spawner = config.seed === undefined ? null : buildSpawner(config.seed, c.worldHeight, config.spawn, gapScale);
  const collectibleSpawner =
    config.seed === undefined ? null : buildCollectibleSpawner(config.seed, c.worldHeight, config.collectibleSpawn);
  return {
    tick: 0,
    distance: 0,
    food: 0,
    nearMisses: 0,
    alive: true,
    lastFlap: false,
    scrollSpeed: c.scrollSpeed,
    baseScrollSpeed: c.scrollSpeed,
    level: 1,
    difficultyEnabled,
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
    spawner,
    collectibleSpawner,
  };
}
```

Em `cloneWorld`, copie os novos campos (após `scrollSpeed: w.scrollSpeed,`):

```ts
    scrollSpeed: w.scrollSpeed,
    baseScrollSpeed: w.baseScrollSpeed,
    level: w.level,
    difficultyEnabled: w.difficultyEnabled,
```

- [ ] **Step 5: Aplicar a dificuldade no `step`**

Em `src/core/sim/step.ts`, importe a curva no topo (junto aos imports de `@core/...`):

```ts
import { difficultyAt } from '@core/difficulty';
```

Logo após `world.tick += 1;`, antes de ler o pterodáctilo, insira:

```ts
  // Dificuldade: amostra na distância acumulada até agora (função pura ⇒ determinística).
  // Atualiza a velocidade EFETIVA e o nível antes da integração deste step.
  if (world.difficultyEnabled) {
    const d = difficultyAt(world.distance);
    world.scrollSpeed = world.baseScrollSpeed * d.speedScale;
    world.level = d.level;
  }
```

(O restante do `step` já usa `world.scrollSpeed` para `dx`/near-miss — passa a usar a efetiva.)

- [ ] **Step 6: Ajustar os 2 testes existentes que assumem velocidade constante**

Em `tests/core/sim/step.test.ts`, no teste **"scroll avança x e distance em scrollSpeed*FIXED_DT por step"**, troque a criação do mundo (linha ~24) para desligar a dificuldade (este teste verifica o integrador linear, não a progressão):

```ts
  it('scroll avança x e distance em scrollSpeed*FIXED_DT por step', () => {
    const w = createWorld({ difficulty: false });
    const dx = w.scrollSpeed * FIXED_DT;
```

Em `tests/determinism/sim.determinism.test.ts`, no teste **"config fixa: avanço de distance e tick é estável e previsível antes da morte"**, troque a criação do mundo para `difficulty: false` (mantém a relação linear `distance == steps*scrollSpeed*dt`):

```ts
    const w = createWorld({ ...FIXED_CONFIG, difficulty: false });
```

(Os testes de reprodutibilidade e de fps-independência desse arquivo permanecem com a
dificuldade LIGADA — provam que o determinismo se mantém com velocidade variável.)

- [ ] **Step 7: Rodar os testes do sim e confirmar que passam**

Run: `npm test -- tests/core/sim/ tests/determinism/sim.determinism.test.ts`
Expected: PASS (integração + os existentes ajustados verdes).

- [ ] **Step 8: Typecheck + suíte completa**

Run: `npm run check && npm test`
Expected: typecheck limpo; toda a suíte verde.

- [ ] **Step 9: Commit**

```bash
git add src/core/sim tests/core/sim/step.test.ts tests/core/sim/difficulty-step.test.ts tests/determinism/sim.determinism.test.ts
git commit -m "feat(core/sim): velocidade efetiva + nível derivados da dificuldade (1.7)"
```

---

### Task 4: Bateria de determinismo da dificuldade

**Files:**
- Test: `tests/determinism/difficulty.determinism.test.ts` (novo)

**Interfaces:**
- Consumes: `createWorld`/`step` (`@core/sim`), `difficultyAt` (`@core/difficulty`).

- [ ] **Step 1: Escrever os testes de determinismo**

Create `tests/determinism/difficulty.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { difficultyAt } from '@core/difficulty';

// Mundo alto p/ a partida durar; seed liga obstáculos (gapScale da dificuldade ativo).
const SEEDED: WorldConfig = { worldHeight: 100000, startY: 50000, seed: 'endless:DIFF1' };

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 2 === 0 });
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

describe('determinismo da dificuldade', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ distance/level/scrollSpeed/obstáculos idênticos', () => {
    const t = makeTimeline(1200);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.distance).toBe(b.distance);
    expect(a.level).toBe(b.level);
    expect(a.scrollSpeed).toBe(b.scrollSpeed);
    expect(a.obstacles).toEqual(b.obstacles);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico (velocidade variável)', () => {
    const t = makeTimeline(1200);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('duas partidas frescas ⇒ dificuldade idêntica na mesma distância (reset por partida)', () => {
    const t = makeTimeline(800);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(difficultyAt(a.distance)).toEqual(difficultyAt(b.distance));
    expect(a.level).toBe(difficultyAt(a.distance).level);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- tests/determinism/difficulty.determinism.test.ts`
Expected: PASS.

- [ ] **Step 3: Rodar a bateria de determinismo inteira**

Run: `npm run test:determinism`
Expected: PASS (todas as suítes de determinismo verdes).

- [ ] **Step 4: Commit**

```bash
git add tests/determinism/difficulty.determinism.test.ts
git commit -m "test(determinism): dificuldade reprodutível e fps-independente (1.7)"
```

---

## Self-Review (cobertura da spec)

- **Função pura `difficultyAt`/`levelForDistance`** → Task 1. ✓
- **Velocidade cresce com a distância (cap)** → Task 1 (curva) + Task 3 (step). ✓
- **Gaps/densidade dos obstáculos encolhem (piso)** → Task 1 + Task 2 (gapScale no gerador) + Task 3 (wiring). ✓
- **Nível derivado, reinicia a cada partida** → Task 1 (`levelForDistance`) + Task 3 (`world.level`, distance=0 ⇒ level 1). ✓
- **Determinismo + fps-independência** → Task 4 + ajuste dos testes existentes (Task 3). ✓
- **`SpawnConfig` readonly + defaults congelados (pendência 1.4)** → Task 2. ✓
- **Sem alocação por-entidade-por-frame** → curva aloca 1 literal/step e 1/obstáculo (pontual); cull/colisão intactos. ✓
- **Adiados** (distribuição ponderada de tipos, densidade de coletáveis) → fora de escopo, documentado na spec; nenhuma task os implementa (correto). ✓

Sem placeholders. Tipos consistentes entre tasks (`DifficultyParams`, `gapScale: (x:number)=>number`, campos novos de `WorldState`).

## Pós-implementação (fora das tasks de código)

- `verify-determinism` (skill) + subagent `determinism-guardian` (contrato intacto).
- `superpowers:requesting-code-review` / agente `reviewer` na branch.
- Marcar 1.7 `[x]` em `docs/roadmap/PHASE-01-deterministic-core.md`; atualizar "Estado atual" do `CLAUDE.md`.
- Integrar no `main` via PR + merge automático (há remote `origin` + `gh`).
