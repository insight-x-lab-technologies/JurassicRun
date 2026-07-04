# Clima que afeta o gameplay (3.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir clima determinístico (chuva/vento/tempestade/neve/limpo) que altera a física vertical da simulação, derivado da seed e amostrado por distância.

**Architecture:** Módulo-folha puro `src/core/weather/` (types + catálogo de física + `WeatherGenerator` keyed por distância num stream RNG dedicado `fork('weather')`). O `step` resolve o clima da distância corrente e o aplica só ao eixo vertical (`gravityScale`, `windY`), mantendo scroll/distância/spawns/economia byte-idênticos. Registro determinístico (`hashState`/completeness/goldens) atualizado. Feedback = linha de clima no HUD (i18n).

**Tech Stack:** TypeScript estrito, Vitest, aliases `@core/*`. Sem phaser/DOM em `src/core/`.

## Global Constraints

- **Determinismo (REGRA 1 / DETERMINISM.md):** proibidos `Math.random`/`Date`/`performance.now` em `src/core/`; aleatoriedade só via `Rng` semeado; conteúdo = `f(seed, distância)`; passo fixo `FIXED_DT`.
- **Arte desacoplada (REGRA 2):** clima não toca hitbox/pixels.
- **Performance (REGRA 3):** zero alocação por frame no hot path (`step`/`update`).
- **i18n (REGRA 4):** nenhuma string visível hardcoded; chaves nos 10 locales; paridade em `tests/i18n/locales.test.ts`.
- **Eixo vertical apenas:** clima não altera `scrollSpeed`/`distance` (desacopla de dificuldade/economia/spawns).
- **`src/core/` não importa phaser/preact/DOM.**
- Aliases: `@core/weather` → `src/core/weather/index.ts`.

---

### Task 1: Módulo de clima — tipos, catálogo e física (puro)

**Files:**
- Create: `src/core/weather/types.ts`
- Create: `src/core/weather/constants.ts`
- Create: `src/core/weather/catalog.ts`
- Create: `src/core/weather/index.ts`
- Test: `tests/core/weather/physics.test.ts`
- Delete: `src/core/weather/.gitkeep`

**Interfaces:**
- Consumes: nada (módulo-folha).
- Produces: `type WeatherKind = 'clear'|'rain'|'wind'|'storm'|'snow'`; `interface WeatherPhysics { gravityScale: number; windY: number }`; `interface WeatherConfig { readonly warmupDistance: number; readonly segmentMin: number; readonly segmentMax: number }`; `WEATHER_KINDS: readonly WeatherKind[]`; `WEATHER_PICK_CATALOG: readonly WeatherKind[]`; `WEATHER_PHYSICS: Readonly<Record<WeatherKind, WeatherPhysics>>`; `weatherPhysics(kind: WeatherKind): WeatherPhysics`.

- [ ] **Step 1: Write the failing test** — `tests/core/weather/physics.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { weatherPhysics, WEATHER_KINDS } from '@core/weather';

describe('weatherPhysics', () => {
  it('clear é baseline (sem alteração de física)', () => {
    expect(weatherPhysics('clear')).toEqual({ gravityScale: 1, windY: 0 });
  });

  it('cobre os 5 climas com pares numéricos finitos e gravityScale > 0', () => {
    expect(WEATHER_KINDS).toHaveLength(5);
    for (const k of WEATHER_KINDS) {
      const p = weatherPhysics(k);
      expect(Number.isFinite(p.gravityScale)).toBe(true);
      expect(Number.isFinite(p.windY)).toBe(true);
      expect(p.gravityScale).toBeGreaterThan(0);
    }
  });

  it('rain/storm mais pesados que clear; snow mais leve', () => {
    expect(weatherPhysics('rain').gravityScale).toBeGreaterThan(1);
    expect(weatherPhysics('storm').gravityScale).toBeGreaterThan(1);
    expect(weatherPhysics('snow').gravityScale).toBeLessThan(1);
  });

  it('wind aplica empuxo/updraft (windY negativo)', () => {
    expect(weatherPhysics('wind').windY).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/weather/physics.test.ts`
Expected: FAIL (`Cannot find module '@core/weather'` / não resolve).

- [ ] **Step 3: Write minimal implementation**

`src/core/weather/types.ts`:
```ts
/** Condição climática ativa (afeta a física vertical). */
export type WeatherKind = 'clear' | 'rain' | 'wind' | 'storm' | 'snow';

/** Modificadores de física vertical de um clima (dados puros; +y para baixo). */
export interface WeatherPhysics {
  /** Multiplica a gravidade efetiva do step. clear = 1. */
  gravityScale: number;
  /** Aceleração vertical constante adicional (unidades/s²). clear = 0.
   * Negativo = empuxo/updraft (sobe); positivo = downdraft (empurra p/ baixo). */
  windY: number;
}

/** Parâmetros de segmentação do WeatherGenerator (dados puros). */
export interface WeatherConfig {
  /** Distância inicial garantida sem clima ('clear'). */
  readonly warmupDistance: number;
  /** Comprimento mínimo de um segmento de clima (distância). */
  readonly segmentMin: number;
  /** Comprimento máximo de um segmento de clima (distância). */
  readonly segmentMax: number;
}
```

`src/core/weather/constants.ts`:
```ts
// Placeholders de tuning do clima (unidades abstratas; +y para baixo). Afinados na Fase 8.

/** Distância inicial garantida 'clear', para um começo calmo. */
export const WEATHER_WARMUP_DISTANCE = 600;
/** Comprimento mínimo de um segmento de clima (distância). */
export const WEATHER_SEGMENT_MIN = 800;
/** Comprimento máximo de um segmento de clima (distância). */
export const WEATHER_SEGMENT_MAX = 1600;

/** Gravidade efetiva sob chuva (asas pesadas/molhadas). */
export const RAIN_GRAVITY_SCALE = 1.15;
/** Empuxo/updraft do vento (unidades/s², negativo = p/ cima). */
export const WIND_UPDRAFT = -120;
/** Gravidade efetiva sob tempestade (pesado). */
export const STORM_GRAVITY_SCALE = 1.25;
/** Downdraft da tempestade (unidades/s², positivo = p/ baixo). */
export const STORM_DOWNDRAFT = 90;
/** Gravidade efetiva sob neve (leve/à deriva). */
export const SNOW_GRAVITY_SCALE = 0.8;
```

`src/core/weather/catalog.ts`:
```ts
import type { WeatherKind, WeatherPhysics } from './types';
import {
  RAIN_GRAVITY_SCALE,
  WIND_UPDRAFT,
  STORM_GRAVITY_SCALE,
  STORM_DOWNDRAFT,
  SNOW_GRAVITY_SCALE,
} from './constants';

/** Ordem estável dos climas (HUD/registro determinístico). */
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'rain', 'wind', 'storm', 'snow'];

/** Climas sorteáveis pelo gerador (inclui 'clear' p/ trechos calmos; peso uniforme por ora;
 * ponderação adiada — mesmo padrão dos pesos de obstáculo). */
export const WEATHER_PICK_CATALOG: readonly WeatherKind[] = WEATHER_KINDS;

/** Modificadores de física por clima. Refs de objeto congelado ⇒ lookup alocação-zero. */
export const WEATHER_PHYSICS: Readonly<Record<WeatherKind, WeatherPhysics>> = Object.freeze({
  clear: Object.freeze({ gravityScale: 1, windY: 0 }),
  rain: Object.freeze({ gravityScale: RAIN_GRAVITY_SCALE, windY: 0 }),
  wind: Object.freeze({ gravityScale: 1, windY: WIND_UPDRAFT }),
  storm: Object.freeze({ gravityScale: STORM_GRAVITY_SCALE, windY: STORM_DOWNDRAFT }),
  snow: Object.freeze({ gravityScale: SNOW_GRAVITY_SCALE, windY: 0 }),
});

/** Física do clima (ref estável do catálogo; não aloca). */
export function weatherPhysics(kind: WeatherKind): WeatherPhysics {
  return WEATHER_PHYSICS[kind];
}
```

`src/core/weather/index.ts`:
```ts
export type { WeatherKind, WeatherPhysics, WeatherConfig } from './types';
export { WEATHER_KINDS, WEATHER_PICK_CATALOG, WEATHER_PHYSICS, weatherPhysics } from './catalog';
```

Remova `src/core/weather/.gitkeep`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/weather/physics.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git rm -q src/core/weather/.gitkeep
git add src/core/weather/ tests/core/weather/physics.test.ts
git commit -m "feat(3.4): módulo de clima (tipos + catálogo de física, puro)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `WeatherGenerator` — sequenciamento keyed por distância (puro)

**Files:**
- Create: `src/core/weather/generator.ts`
- Modify: `src/core/weather/index.ts` (exportar o gerador)
- Test: `tests/core/weather/generator.test.ts`

**Interfaces:**
- Consumes: `WEATHER_PICK_CATALOG`, `WeatherConfig`, `WeatherKind` (Task 1); `Rng`/`createRng` de `@core/rng` (`rng.pick(array)`, `rng.range(min,max)`, `rng.clone()`, `rng.fork(streamId)`).
- Produces: `class WeatherGenerator { constructor(rng: Rng, config?: WeatherConfig); get current(): WeatherKind; advanceTo(distance: number): void; clone(): WeatherGenerator }`; `DEFAULT_WEATHER_CONFIG: WeatherConfig`.

- [ ] **Step 1: Write the failing test** — `tests/core/weather/generator.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { WeatherGenerator, DEFAULT_WEATHER_CONFIG } from '@core/weather';

const mk = () => new WeatherGenerator(createRng('endless:WX').fork('weather'));

describe('WeatherGenerator', () => {
  it('começa clear e permanece clear durante o warmup', () => {
    const g = mk();
    expect(g.current).toBe('clear');
    g.advanceTo(DEFAULT_WEATHER_CONFIG.warmupDistance - 1);
    expect(g.current).toBe('clear');
  });

  it('mesma seed ⇒ mesma sequência amostrada por distância', () => {
    const seq = (g: WeatherGenerator): string[] => {
      const out: string[] = [];
      for (let d = 0; d <= 12000; d += 100) { g.advanceTo(d); out.push(g.current); }
      return out;
    };
    expect(seq(mk())).toEqual(seq(mk()));
  });

  it('independe do batching: 1 salto grande = muitos passos pequenos', () => {
    const coarse = mk();
    const fine = mk();
    coarse.advanceTo(9999);
    for (let d = 0; d <= 9999; d += 37) fine.advanceTo(d);
    fine.advanceTo(9999);
    expect(coarse.current).toBe(fine.current);
  });

  it('muda de clima ao longo da distância (não fica preso em clear)', () => {
    const g = mk();
    const seen = new Set<string>();
    for (let d = 0; d <= 30000; d += 50) { g.advanceTo(d); seen.add(g.current); }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('clone é independente do original e determinístico', () => {
    const g = mk();
    g.advanceTo(5000);
    const c = g.clone();
    expect(c.current).toBe(g.current);
    const cloneKind = c.current;
    g.advanceTo(50000); // mexer no original não deve afetar o clone
    expect(c.current).toBe(cloneKind);
    // o clone avança por conta própria, igual a um gerador fresco levado à mesma distância
    const fresh = mk();
    fresh.advanceTo(7000);
    c.advanceTo(7000);
    expect(c.current).toBe(fresh.current);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/weather/generator.test.ts`
Expected: FAIL (`WeatherGenerator`/`DEFAULT_WEATHER_CONFIG` não exportados).

- [ ] **Step 3: Write minimal implementation**

`src/core/weather/generator.ts`:
```ts
import type { Rng } from '@core/rng';
import type { WeatherConfig, WeatherKind } from './types';
import { WEATHER_PICK_CATALOG } from './catalog';
import { WEATHER_WARMUP_DISTANCE, WEATHER_SEGMENT_MIN, WEATHER_SEGMENT_MAX } from './constants';

/** Config padrão de segmentação (placeholders de tuning). */
export const DEFAULT_WEATHER_CONFIG: WeatherConfig = Object.freeze({
  warmupDistance: WEATHER_WARMUP_DISTANCE,
  segmentMin: WEATHER_SEGMENT_MIN,
  segmentMax: WEATHER_SEGMENT_MAX,
});

/**
 * Sequenciador determinístico de clima, keyed por distância. Consome só o Rng dado; avança
 * um cursor por fronteira de segmento cruzada ⇒ independente de batching/fps (nº de saques =
 * fronteiras cruzadas = f(distância)). Mesma propriedade dos SpawnGenerator.
 */
export class WeatherGenerator {
  private readonly rng: Rng;
  private readonly config: WeatherConfig;
  private currentKind: WeatherKind;
  private nextChangeX: number;

  constructor(rng: Rng, config: WeatherConfig = DEFAULT_WEATHER_CONFIG) {
    this.rng = rng;
    this.config = config;
    this.currentKind = 'clear';
    this.nextChangeX = config.warmupDistance;
  }

  get current(): WeatherKind {
    return this.currentKind;
  }

  /** Avança o cursor até `distance`, atualizando o clima corrente. Monótona quando `distance`
   * não recua; alocação-zero (só escalares + pick/range). */
  advanceTo(distance: number): void {
    while (distance >= this.nextChangeX) {
      this.currentKind = this.rng.pick(WEATHER_PICK_CATALOG);
      this.nextChangeX += this.rng.range(this.config.segmentMin, this.config.segmentMax);
    }
  }

  /** Cópia independente (rng clonado + cursor + kind). Para cloneWorld/snapshots. */
  clone(): WeatherGenerator {
    const c = new WeatherGenerator(this.rng.clone(), this.config);
    c.currentKind = this.currentKind;
    c.nextChangeX = this.nextChangeX;
    return c;
  }
}
```

Adicione ao `src/core/weather/index.ts`:
```ts
export { WeatherGenerator, DEFAULT_WEATHER_CONFIG } from './generator';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/weather/generator.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/weather/generator.ts src/core/weather/index.ts tests/core/weather/generator.test.ts
git commit -m "feat(3.4): WeatherGenerator keyed por distância (puro, fps-independente)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Integração no core (world + step + registro determinístico)

Tarefa atômica: adiciona `weather`/`weatherGenerator` ao `WorldState`, constrói o gerador em `createWorld`, aplica a física no `step`, e atualiza o registro determinístico (`hashState`, completeness, goldens) **no mesmo commit** — não dá para adicionar campos ao `WorldState` sem re-pinar o hash e a completude, então tudo vive junto e re-pina os goldens **uma vez**.

**Files:**
- Modify: `src/core/sim/types.ts` (import de `@core/weather`; `WorldConfig.weather?`; `WorldState.weather` + `WorldState.weatherGenerator`)
- Modify: `src/core/sim/world.ts` (import; `buildWeatherGenerator`; `createWorld`; `cloneWorld`)
- Modify: `src/core/sim/step.ts` (resolver clima + aplicar física vertical)
- Modify: `src/core/replay/hash.ts` (`hashState`: `weather` + presença do gerador)
- Modify: `tests/core/replay/hash-completeness.test.ts` (`EXPECTED_WORLD_KEYS` 24 → 26; comentário de contagem)
- Modify: `tests/determinism/replay.determinism.test.ts` (re-pinar os 4 goldens)
- Test: `tests/core/sim/weather-integration.test.ts` (novo)

**Interfaces:**
- Consumes: `WeatherKind`, `WeatherGenerator`, `weatherPhysics` (Tasks 1–2); `createRng(seed).fork('weather')`.
- Produces: `WorldState.weather: WeatherKind`; `WorldState.weatherGenerator: WeatherGenerator | null`; `WorldConfig.weather?: boolean` (default true).

- [ ] **Step 1: Write the failing test** — `tests/core/sim/weather-integration.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig } from '@core/sim';

const NO_FLAP: InputFrame = { flap: false };
const BASE: WorldConfig = { worldHeight: 600, startY: 100, gravity: 1200, flapSpeed: 350, scrollSpeed: 200 };

function fallSteps(w: ReturnType<typeof createWorld>, n: number): void {
  for (let i = 0; i < n; i++) step(w, NO_FLAP);
}

describe('clima — integração no mundo/step', () => {
  it('sem seed: sem gerador, clima clear, física baseline (dino cai sob gravidade)', () => {
    const w = createWorld({ ...BASE });
    expect(w.weather).toBe('clear');
    expect(w.weatherGenerator).toBeNull();
    fallSteps(w, 30);
    expect(w.pterodactyl.transform.position.y).toBeGreaterThan(BASE.startY!);
  });

  it('com seed: constrói o gerador de clima', () => {
    const w = createWorld({ ...BASE, seed: 'endless:WX' });
    expect(w.weatherGenerator).not.toBeNull();
  });

  it('weather:false desliga o gerador mesmo com seed', () => {
    const w = createWorld({ ...BASE, seed: 'endless:WX', weather: false });
    expect(w.weatherGenerator).toBeNull();
    expect(w.weather).toBe('clear');
  });

  it('rain (gravityScale>1) faz cair mais rápido que clear', () => {
    const clear = createWorld({ ...BASE }); // gerador null ⇒ step não sobrescreve weather
    const rainy = createWorld({ ...BASE });
    rainy.weather = 'rain';
    fallSteps(clear, 20);
    fallSteps(rainy, 20);
    expect(rainy.pterodactyl.transform.position.y).toBeGreaterThan(clear.pterodactyl.transform.position.y);
  });

  it('wind (windY<0, updraft) segura a queda vs clear', () => {
    const clear = createWorld({ ...BASE });
    const windy = createWorld({ ...BASE });
    windy.weather = 'wind';
    fallSteps(clear, 20);
    fallSteps(windy, 20);
    expect(windy.pterodactyl.transform.position.y).toBeLessThan(clear.pterodactyl.transform.position.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sim/weather-integration.test.ts`
Expected: FAIL (`w.weather`/`w.weatherGenerator` inexistentes; `weather` não é campo de `WorldConfig`).

- [ ] **Step 3: Write minimal implementation**

Em `src/core/sim/types.ts`, no topo adicione o import:
```ts
import type { WeatherKind, WeatherGenerator } from '@core/weather';
```
Em `WorldConfig`, após `difficulty?: boolean;`:
```ts
  /** Liga o clima determinístico (afeta a física vertical). Default true. */
  weather?: boolean;
```
Em `WorldState`, após `extraLives: number;` (fim da interface):
```ts
  /** Clima ativo corrente (afeta a física vertical). Default 'clear'. */
  weather: WeatherKind;
  /** Sequenciador de clima keyed por distância (null sem seed/clima). */
  weatherGenerator: WeatherGenerator | null;
```

Em `src/core/sim/world.ts`, adicione o import (junto aos outros de core):
```ts
import { WeatherGenerator } from '@core/weather';
```
Adicione o builder (junto aos outros `build*Spawner`):
```ts
function buildWeatherGenerator(seed: string): WeatherGenerator {
  return new WeatherGenerator(createRng(seed).fork('weather'));
}
```
Em `createWorld`, após a linha do `powerupSpawner`:
```ts
  const weatherEnabled = config.weather ?? true;
  const weatherGenerator =
    config.seed === undefined || !weatherEnabled ? null : buildWeatherGenerator(config.seed);
```
No objeto retornado, após `extraLives: 0,`:
```ts
    weather: 'clear',
    weatherGenerator,
```
Em `cloneWorld`, após `extraLives: w.extraLives,`:
```ts
    weather: w.weather,
    weatherGenerator: w.weatherGenerator ? w.weatherGenerator.clone() : null,
```

Em `src/core/sim/step.ts`, adicione o import:
```ts
import { weatherPhysics } from '@core/weather';
```
Logo após `world.tick += 1;` (antes de `const ptero = ...`):
```ts
  // Clima: resolve o clima da distância corrente (início do step) e aplica à física vertical
  // deste step. weatherPhysics('clear') = {1,0} ⇒ sem gerador, física baseline (sem regressão).
  if (world.weatherGenerator) {
    world.weatherGenerator.advanceTo(world.distance);
    world.weather = world.weatherGenerator.current;
  }
  const weather = weatherPhysics(world.weather);
```
Substitua a linha de integração vertical:
```ts
  vel.y += world.gravity * FIXED_DT;
```
por:
```ts
  vel.y += (world.gravity * weather.gravityScale + weather.windY) * FIXED_DT;
```

Em `src/core/replay/hash.ts`, dentro de `hashState`, após `d.number(world.worldHeight);`:
```ts
  d.string(world.weather);
```
E junto às presenças de gerador, após `d.bool(world.powerupSpawner !== null);`:
```ts
  d.bool(world.weatherGenerator !== null);
```

Em `tests/core/replay/hash-completeness.test.ts`: em `EXPECTED_WORLD_KEYS`, insira em ordem alfabética entre `'tick',` e `'worldHeight',`:
```ts
  'weather',
  'weatherGenerator',
```
E atualize o comentário `(24 campos)` → `(26 campos)`.

- [ ] **Step 4: Run the new integration + completeness tests**

Run: `npx vitest run tests/core/sim/weather-integration.test.ts tests/core/replay/hash-completeness.test.ts`
Expected: integração PASS (5 testes); completeness PASS.

- [ ] **Step 5: Re-pinar os 4 goldens de replay**

Os 4 goldens quebram (formato do hash mudou + trajetória vertical mudou nos seeded). Regenere:

Run: `npx vitest run tests/determinism/replay.determinism.test.ts`
Expected: 4 falhas `expected '<antigo>' to be '<novo>'` (o **received** é o hash novo).

Para cada cenário, copie o hash **received** (o valor atual computado) para o campo `golden` correspondente em `tests/determinism/replay.determinism.test.ts`. As duas asserções relacionais (`GOLD1 ≠ GOLD2` e `difficulty on ≠ off`) devem continuar passando sem edição.

Rode de novo para confirmar verde:
Run: `npx vitest run tests/determinism/replay.determinism.test.ts`
Expected: PASS (todos os cenários + as 2 relacionais).

- [ ] **Step 6: Suíte completa + typecheck**

Run: `npm run check && npx vitest run`
Expected: check limpo; toda a suíte verde.

- [ ] **Step 7: Commit**

```bash
git add src/core/sim/types.ts src/core/sim/world.ts src/core/sim/step.ts src/core/replay/hash.ts \
        tests/core/replay/hash-completeness.test.ts tests/determinism/replay.determinism.test.ts \
        tests/core/sim/weather-integration.test.ts
git commit -m "feat(3.4): clima afeta física vertical no step + registro determinístico

WorldState.{weather,weatherGenerator}; createWorld/cloneWorld/step; hashState +
completeness (24->26); goldens re-pinados (formato do hash + trajetória vertical).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Determinismo end-to-end do clima

**Files:**
- Test: `tests/determinism/weather.determinism.test.ts` (novo)

**Interfaces:**
- Consumes: `createWorld`, `step`, `WorldConfig`, `WorldState`, `InputFrame` de `@core/sim`; `WorldState.weather`/`weatherGenerator` (Task 3).
- Produces: nenhuma API nova (só cobertura de determinismo).

- [ ] **Step 1: Write the failing test** — `tests/determinism/weather.determinism.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

// worldHeight amplo p/ o dino sobreviver o suficiente e o clima sair de 'clear'.
const SEEDED: WorldConfig = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200, seed: 'endless:WEATHER1' };
const STEPS = 3000;

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 6 === 0 });
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

describe('determinismo do clima', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ estado idêntico (clima ativo)', () => {
    const t = makeTimeline(STEPS);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.weatherGenerator).not.toBeNull();
    expect(a).toEqual(b);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const t = makeTimeline(STEPS);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('clima ligado ≠ desligado ⇒ trajetória (posição do dino) difere', () => {
    const t = makeTimeline(STEPS);
    const on = runBatched(SEEDED, t, 1);
    const off = runBatched({ ...SEEDED, weather: false }, t, 1);
    // scroll/distância idênticos (clima só toca o eixo vertical)...
    expect(off.distance).toBeCloseTo(on.distance, 6);
    // ...mas a posição vertical do dino diverge por causa da física do clima.
    const dyOn = on.pterodactyl.transform.position.y;
    const dyOff = off.pterodactyl.transform.position.y;
    expect(dyOn).not.toBe(dyOff);
  });
});
```

- [ ] **Step 2: Run test to verify it (fails or reveals tuning)**

Run: `npx vitest run tests/determinism/weather.determinism.test.ts`
Expected inicial: os dois primeiros testes PASS; o terceiro pode exigir ajuste se `on`/`off` morrerem no mesmo ponto e congelarem no mesmo `y`. Se o 3º falhar (posições iguais), aumente `STEPS` ou ajuste a seed até que a divergência vertical apareça antes de qualquer morte (ambos devem estar vivos ou divergir antes de morrer). Ajuste `SEEDED`/`STEPS` e re-rode até verde. Documente no comentário o valor final medido.

> Nota p/ o implementador: se ambos morrerem, o estado congela e as posições podem coincidir por acaso. Escolha `STEPS`/seed que mantenham o dino vivo o bastante para a divergência aparecer (ex.: reduzir `STEPS`, ou usar `difficulty:false` na config para voo mais estável). A garantia relacional é: **com clima, a trajetória vertical difere de sem clima**.

- [ ] **Step 3: (se necessário) ajustar config e confirmar verde**

Run: `npx vitest run tests/determinism/weather.determinism.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 4: Rodar a bateria de determinismo completa**

Run: `npm run test:determinism`
Expected: toda a bateria verde (incluindo o novo arquivo e os goldens re-pinados).

- [ ] **Step 5: Commit**

```bash
git add tests/determinism/weather.determinism.test.ts
git commit -m "test(3.4): determinismo end-to-end do clima (reprodutível + fps-independente)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Indicador de clima no HUD (i18n, 10 locales)

**Files:**
- Modify: `src/render/hud.ts` (`HudRaw`/`HudView`/`formatHudValues` ganham `weather`)
- Modify: `src/render/GameScene.ts` (ler `world.weather`, montar a linha `hud.weather` no refresh)
- Modify: os 10 arquivos `src/i18n/locales/<lang>.json` (chaves `hud.weather` + `weather.{clear,rain,wind,storm,snow}`)
- Test: `tests/render/hud.test.ts` (estender formatHudValues)
- Test: `tests/i18n/locales.test.ts` já valida paridade — sem edição, só passa a cobrir as novas chaves automaticamente se ele varre todas as chaves do default.

**Interfaces:**
- Consumes: `WorldState.weather` (Task 3); `formatHudValues` existente.
- Produces: `HudRaw.weather: string`, `HudView.weather: string`.

- [ ] **Step 1: Write the failing test** — estenda `tests/render/hud.test.ts`

Localize o teste de `formatHudValues` existente e adicione um caso (ou um novo `it`):
```ts
it('passa o clima adiante como string (rótulo/nome vêm da i18n)', () => {
  const view = formatHudValues({ distance: 0, food: 0, fps: 0, level: 1, speed: 0, seed: 's', weather: 'storm' });
  expect(view.weather).toBe('storm');
});
```
> Se `tests/render/hud.test.ts` não existir, crie-o com o import `import { formatHudValues } from '../../src/render/hud';` (ou alias equivalente usado no projeto) e o caso acima.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/hud.test.ts`
Expected: FAIL (`weather` não existe em `HudRaw`/`HudView`; type error ou `undefined`).

- [ ] **Step 3: Write minimal implementation**

Em `src/render/hud.ts`:
- Em `HudRaw`, adicione `weather: string;`.
- Em `HudView`, adicione `weather: string;`.
- Em `formatHudValues`, adicione ao objeto retornado: `weather: raw.weather,`.

Em `src/render/GameScene.ts`: no método que monta as linhas do HUD (onde chama `i18n.t('hud.distance', …)` etc.), adicione a leitura de `world.weather` ao objeto `HudRaw` e uma linha nova:
```ts
this.i18n.t('hud.weather', { value: this.i18n.t('weather.' + view.weather) }),
```
(insira a chamada seguindo exatamente o padrão das linhas vizinhas do arquivo — mesma lista/`join('\n')`/`setText` já usados; passe `weather: world.weather` no objeto cru que alimenta `formatHudValues`).

Nos 10 locales `src/i18n/locales/<lang>.json`, adicione dentro de `"hud"` a chave `"weather"` e um bloco novo `"weather"` no nível raiz. **Inglês** (`en.json`) — referência:
```json
  "hud": {
    "distance": "Dist: {{value}}m",
    "food": "Food: {{value}}",
    "fps": "FPS: {{value}}",
    "level": "Lv {{value}}",
    "speed": "Speed: {{value}}",
    "seed": "Seed: {{value}}",
    "weather": "Weather: {{value}}"
  },
  "weather": {
    "clear": "Clear",
    "rain": "Rain",
    "wind": "Wind",
    "storm": "Storm",
    "snow": "Snow"
  },
```
Traduza `hud.weather` e os 5 nomes nos outros 9 locales (`es, pt-BR, fr, it, de, ja, zh, ko, hi`). Sugestões:
- pt-BR: `"weather": "Clima: {{value}}"`, `{clear:"Limpo", rain:"Chuva", wind:"Vento", storm:"Tempestade", snow:"Neve"}`
- es: `"Clima: {{value}}"`, `{clear:"Despejado", rain:"Lluvia", wind:"Viento", storm:"Tormenta", snow:"Nieve"}`
- fr: `"Météo : {{value}}"`, `{clear:"Dégagé", rain:"Pluie", wind:"Vent", storm:"Orage", snow:"Neige"}`
- it: `"Meteo: {{value}}"`, `{clear:"Sereno", rain:"Pioggia", wind:"Vento", storm:"Tempesta", snow:"Neve"}`
- de: `"Wetter: {{value}}"`, `{clear:"Klar", rain:"Regen", wind:"Wind", storm:"Sturm", snow:"Schnee"}`
- ja: `"天気: {{value}}"`, `{clear:"晴れ", rain:"雨", wind:"風", storm:"嵐", snow:"雪"}`
- zh: `"天气：{{value}}"`, `{clear:"晴朗", rain:"雨", wind:"风", storm:"暴风", snow:"雪"}`
- ko: `"날씨: {{value}}"`, `{clear:"맑음", rain:"비", wind:"바람", storm:"폭풍", snow:"눈"}`
- hi: `"मौसम: {{value}}"`, `{clear:"साफ़", rain:"बारिश", wind:"हवा", storm:"तूफ़ान", snow:"बर्फ़"}`

> Use a skill `add-locale` se disponível para garantir estrutura/paridade. Mantenha a mesma ordem de chaves das existentes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render/hud.test.ts tests/i18n/locales.test.ts`
Expected: PASS (formatHudValues com `weather`; paridade dos 10 locales com as novas chaves).

- [ ] **Step 5: Typecheck + suíte completa**

Run: `npm run check && npx vitest run`
Expected: check limpo (GameScene compila com a nova linha); toda a suíte verde.

- [ ] **Step 6: Commit**

```bash
git add src/render/hud.ts src/render/GameScene.ts src/i18n/locales/ tests/render/hud.test.ts
git commit -m "feat(3.4): indicador de clima no HUD (i18n, 10 locales)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notas de fechamento (após as tasks)

- **Determinismo:** rode a skill `verify-determinism` e o subagent `determinism-guardian` — o contrato de `src/core/` foi tocado (novo campo/registro), precisa do carimbo "contrato intacto".
- **Verificação (REGRA — evidência antes de afirmar):** `npm run check` limpo + `npm test` verde + `npm run test:determinism` verde. Opcional: verificação visual Playwright do HUD mostrando o clima e da trajetória do dino mudando.
- **Docs/estado:** marque `3.4` como `[x]` em `docs/roadmap/PHASE-03-powerups-and-weather.md`; atualize "Estado atual" no `CLAUDE.md` (novo parágrafo 3.4 + "Próximo: 3.5/…"); atualize `docs/architecture/DETERMINISM.md` §6 se algo além do previsto mudou (provavelmente não — o §6 já reserva o clima).
- **Integração:** sem remote `gh` ⇒ merge local `--no-ff` de `feat/3.4-weather` em `main` e aposentar a branch. Com `gh` ⇒ PR + auto-merge.

## Self-review (feito)

- **Cobertura da spec:** 5 climas + física (Task 1); WeatherGenerator keyed por distância (Task 2); WorldState/step/registro (Task 3); determinismo e2e/mesma-seed⇒mesma-sequência (Tasks 2 e 4); HUD i18n (Task 5). ✔
- **Placeholders:** nenhum "TBD"/"handle edge cases"; todo passo tem código/comando. ✔
- **Consistência de tipos:** `WeatherKind`/`WeatherPhysics`/`WeatherConfig`, `weatherPhysics`, `WeatherGenerator.advanceTo/current/clone`, `WorldState.weather`/`weatherGenerator`, `HudRaw/HudView.weather` — nomes idênticos entre tasks. ✔
</content>
