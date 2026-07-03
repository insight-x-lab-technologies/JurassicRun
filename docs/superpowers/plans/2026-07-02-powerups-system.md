# Power-ups System (3.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Framework determinístico de efeitos temporários (duração em steps) + 4 power-ups coletáveis (escudo, vida extra, ímã, moeda-dobrada), gerados keyed por distância e desenhados no render.

**Architecture:** Lógica pura em `src/core/powerup/` (novo módulo-folha) + wiring no `src/core/sim/step`; power-ups são `Entity`s geradas por um `SpawnGenerator` num 3º stream de RNG (`fork('powerups')`), espelhando coletáveis. Estado do mundo permanece dados puros; casca de render desenha os pickups reaproveitando culling/manifesto.

**Tech Stack:** TypeScript estrito, Vitest, Vite (aliases `@core/*`, `@services/*`, `@render/*`). Phaser só na casca de render.

## Global Constraints

- **Determinismo (REGRA 1):** nada em `src/core/` usa `Math.random`/`Date.now`/`performance.now`. Só o RNG com seed e o relógio de passo fixo (`FIXED_DT = 1/60`). `Math.sqrt` é permitido (já usado em `@core/collision`). Mesma seed + inputs ⇒ mesmo estado.
- **Hot path alocação-zero (REGRA 3):** nada de `new`/closures/`.map`/`.filter` por step no caminho quente. Loops `for` indexados; mutação in-place.
- **Arte desacoplada (REGRA 2):** colisão/coleta usam hitbox lógica, nunca pixels.
- **Asset-spec (REGRA 5):** toda imagem trocável nova exige asset-spec em `docs/assets/specs/` + registro.
- **i18n (REGRA 4):** nenhuma string visível hardcoded. *Nesta feature não há texto novo de UI* — não introduza strings.
- **`src/core/` não importa** de `phaser`/`preact`/DOM.
- Rode `npm run check` e `npm test` ao fim de cada task; determinismo via `npm run test:determinism`.

---

### Task 1: Framework de efeitos + catálogo (puro)

**Files:**
- Create: `src/core/powerup/types.ts`
- Create: `src/core/powerup/constants.ts`
- Create: `src/core/powerup/effects.ts`
- Create: `src/core/powerup/catalog.ts`
- Create: `src/core/powerup/index.ts`
- Test: `tests/core/powerup/effects.test.ts`
- Test: `tests/core/powerup/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type PowerupKind = 'shield' | 'extraLife' | 'magnet' | 'doubleCoin'`
  - `interface ActiveEffect { kind: PowerupKind; remaining: number }`
  - `activateEffect(effects: ActiveEffect[], kind: PowerupKind, durationSteps: number): void`
  - `tickEffects(effects: ActiveEffect[]): void`
  - `isEffectActive(effects: readonly ActiveEffect[], kind: PowerupKind): boolean`
  - `cloneEffects(effects: readonly ActiveEffect[]): ActiveEffect[]`
  - `POWERUP_CATALOG: readonly SpawnType[]` (ids `powerup.shield|extraLife|magnet|doubleCoin`, `anchor:'floating'`, hitbox circular)
  - `powerupKindForTag(tag: string): PowerupKind | null`
  - `DEFAULT_POWERUP_CONFIG: SpawnConfig`
  - Constantes: `SHIELD_DURATION_STEPS`, `MAGNET_DURATION_STEPS`, `DOUBLE_COIN_DURATION_STEPS`, `EXTRA_LIFE_GRACE_STEPS`, `MAGNET_RADIUS`, `MAGNET_PULL_SPEED`, `DOUBLE_COIN_FOOD_GAIN`

- [ ] **Step 1: Write failing tests for the effects framework**

`tests/core/powerup/effects.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { activateEffect, tickEffects, isEffectActive, cloneEffects } from '@core/powerup';
import type { ActiveEffect } from '@core/powerup';

describe('effects framework', () => {
  it('activateEffect adds a new timed effect', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 10);
    expect(e).toEqual([{ kind: 'shield', remaining: 10 }]);
    expect(isEffectActive(e, 'shield')).toBe(true);
    expect(isEffectActive(e, 'magnet')).toBe(false);
  });

  it('activateEffect on existing kind extends to the max remaining', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 10);
    activateEffect(e, 'shield', 5); // menor: não encurta
    expect(e).toEqual([{ kind: 'shield', remaining: 10 }]);
    activateEffect(e, 'shield', 20); // maior: estende
    expect(e).toEqual([{ kind: 'shield', remaining: 20 }]);
  });

  it('tickEffects decrements and removes at zero', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 2);
    activateEffect(e, 'magnet', 1);
    tickEffects(e); // shield 1, magnet 0 -> removido
    expect(e).toEqual([{ kind: 'shield', remaining: 1 }]);
    expect(isEffectActive(e, 'magnet')).toBe(false);
    tickEffects(e); // shield 0 -> removido
    expect(e).toEqual([]);
  });

  it('cloneEffects is a deep copy', () => {
    const e: ActiveEffect[] = [{ kind: 'shield', remaining: 3 }];
    const c = cloneEffects(e);
    expect(c).toEqual(e);
    c[0]!.remaining = 99;
    expect(e[0]!.remaining).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/powerup/effects.test.ts`
Expected: FAIL (module `@core/powerup` not found).

- [ ] **Step 3: Implement types + constants + effects + index (minimal to pass effects test)**

`src/core/powerup/types.ts`:
```ts
/** Tipos de power-up. Extensível: 3.2 adiciona 'slowMo'. */
export type PowerupKind = 'shield' | 'extraLife' | 'magnet' | 'doubleCoin';

/** Efeito temporário ativo: quantos steps ainda valem. Vida extra NÃO é um efeito
 * temporário (é uma carga em WorldState.extraLives) e não entra aqui. */
export interface ActiveEffect {
  kind: PowerupKind;
  remaining: number;
}
```

`src/core/powerup/constants.ts`:
```ts
// Placeholders de tuning (unidades abstratas; +y para baixo). Afinados em fase posterior.

/** Duração da invulnerabilidade do escudo (steps). ~5 s a 60 fps. */
export const SHIELD_DURATION_STEPS = 300;
/** Duração do ímã (steps). ~6 s. */
export const MAGNET_DURATION_STEPS = 360;
/** Duração da moeda-dobrada (steps). ~8 s. */
export const DOUBLE_COIN_DURATION_STEPS = 480;
/** Escudo curto concedido ao reviver com vida extra (steps). ~1 s. */
export const EXTRA_LIFE_GRACE_STEPS = 60;

/** Raio (unidades) dentro do qual o ímã atrai coletáveis. */
export const MAGNET_RADIUS = 60;
/** Velocidade de atração do ímã (unidades/s). */
export const MAGNET_PULL_SPEED = 220;

/** Comida ganha por pássaro-moeda enquanto a moeda-dobrada está ativa (vs 1 normal). */
export const DOUBLE_COIN_FOOD_GAIN = 2;
```

`src/core/powerup/effects.ts`:
```ts
import type { ActiveEffect, PowerupKind } from './types';

/** Ativa (ou estende) um efeito temporário. Re-pickup nunca encurta: remaining = max. */
export function activateEffect(effects: ActiveEffect[], kind: PowerupKind, durationSteps: number): void {
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]!;
    if (e.kind === kind) {
      if (durationSteps > e.remaining) e.remaining = durationSteps;
      return;
    }
  }
  effects.push({ kind, remaining: durationSteps });
}

/** Decrementa todos os efeitos 1 step; remove os que expiram. 1×/step (no fim do step). */
export function tickEffects(effects: ActiveEffect[]): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]!;
    e.remaining -= 1;
    if (e.remaining <= 0) effects.splice(i, 1);
  }
}

/** Efeito do kind está ativo? Busca linear (array pequeno), sem alocação. */
export function isEffectActive(effects: readonly ActiveEffect[], kind: PowerupKind): boolean {
  for (let i = 0; i < effects.length; i++) {
    if (effects[i]!.kind === kind) return true;
  }
  return false;
}

/** Cópia profunda (para cloneWorld). */
export function cloneEffects(effects: readonly ActiveEffect[]): ActiveEffect[] {
  return effects.map((e) => ({ kind: e.kind, remaining: e.remaining }));
}
```

`src/core/powerup/index.ts`:
```ts
export type { PowerupKind, ActiveEffect } from './types';
export { activateEffect, tickEffects, isEffectActive, cloneEffects } from './effects';
export { POWERUP_CATALOG, powerupKindForTag, DEFAULT_POWERUP_CONFIG } from './catalog';
export {
  SHIELD_DURATION_STEPS,
  MAGNET_DURATION_STEPS,
  DOUBLE_COIN_DURATION_STEPS,
  EXTRA_LIFE_GRACE_STEPS,
  MAGNET_RADIUS,
  MAGNET_PULL_SPEED,
  DOUBLE_COIN_FOOD_GAIN,
} from './constants';
```

- [ ] **Step 4: Write failing tests for the catalog**

`tests/core/powerup/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { POWERUP_CATALOG, powerupKindForTag } from '@core/powerup';
import { createRng } from '@core/rng';

describe('powerup catalog', () => {
  it('has the 4 power-up types, all floating with a circle hitbox', () => {
    const ids = POWERUP_CATALOG.map((t) => t.id);
    expect(ids).toEqual([
      'powerup.shield',
      'powerup.extraLife',
      'powerup.magnet',
      'powerup.doubleCoin',
    ]);
    const rng = createRng('endless:CAT');
    for (const t of POWERUP_CATALOG) {
      expect(t.anchor).toBe('floating');
      expect(t.makeHitbox(rng).kind).toBe('circle');
    }
  });

  it('powerupKindForTag maps ids to kinds and null otherwise', () => {
    expect(powerupKindForTag('powerup.shield')).toBe('shield');
    expect(powerupKindForTag('powerup.extraLife')).toBe('extraLife');
    expect(powerupKindForTag('powerup.magnet')).toBe('magnet');
    expect(powerupKindForTag('powerup.doubleCoin')).toBe('doubleCoin');
    expect(powerupKindForTag('obstacle.tree')).toBeNull();
    expect(powerupKindForTag('bird.coin')).toBeNull();
  });
});
```

- [ ] **Step 5: Run to verify the catalog test fails**

Run: `npx vitest run tests/core/powerup/catalog.test.ts`
Expected: FAIL (`POWERUP_CATALOG` / `powerupKindForTag` undefined).

- [ ] **Step 6: Implement the catalog**

`src/core/powerup/catalog.ts`:
```ts
import type { SpawnType } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';
import { circle } from '@core/sim/hitbox';
import type { PowerupKind } from './types';

/** Catálogo de power-ups (pickups flutuantes de corpo compacto ⇒ hitbox circular). */
export const POWERUP_CATALOG: readonly SpawnType[] = [
  { id: 'powerup.shield', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.extraLife', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.magnet', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.doubleCoin', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
];

/** Tag (id do tipo) → kind do power-up. Tabela explícita (não parsing). */
const KIND_BY_TAG: Readonly<Record<string, PowerupKind>> = {
  'powerup.shield': 'shield',
  'powerup.extraLife': 'extraLife',
  'powerup.magnet': 'magnet',
  'powerup.doubleCoin': 'doubleCoin',
};

export function powerupKindForTag(tag: string): PowerupKind | null {
  return KIND_BY_TAG[tag] ?? null;
}

/** Spawn de power-ups: raros ⇒ gaps grandes. Placeholders de tuning. */
export const DEFAULT_POWERUP_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: 0, // sobrescrito por createWorld
  yMargin: 24,
  startX: 320,
  gapMin: 600,
  gapMax: 1000,
});
```

Nota: `SpawnConfig` é `readonly`; `worldHeight` é preenchido em `createWorld` via `{ ...DEFAULT_POWERUP_CONFIG, worldHeight }` (mesmo padrão de `DEFAULT_COLLECTIBLE_CONFIG`). Confirme os campos de `SpawnConfig` em `src/core/spawn/generator.ts` (`worldHeight,yMargin,startX,gapMin,gapMax`).

- [ ] **Step 7: Run the powerup tests — all pass**

Run: `npx vitest run tests/core/powerup/`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/core/powerup tests/core/powerup
git commit -m "feat(3.1): framework de efeitos temporários + catálogo de power-ups (puro)"
```

---

### Task 2: Estado do mundo, spawn/cull e pickup (ativação)

**Files:**
- Modify: `src/core/sim/types.ts` (novos campos em `WorldState`)
- Modify: `src/core/sim/world.ts` (`createWorld`, `cloneWorld`, `buildPowerupSpawner`)
- Create: `src/core/powerup/apply.ts` (`pickupPowerup`)
- Modify: `src/core/powerup/index.ts` (reexporta `pickupPowerup`)
- Modify: `src/core/sim/step.ts` (gera/culla power-ups, passada de pickup, `tickEffects`)
- Modify: `src/core/replay/hash.ts` (codifica os novos campos)
- Modify: `tests/core/replay/hash-completeness.test.ts` (chaves: 20 → 24)
- Modify: `tests/determinism/replay.determinism.test.ts` (re-pinar goldens)
- Modify: `tests/core/sim/world.test.ts` se ele fizer `toEqual` do estado completo (adicionar campos)
- Test: `tests/core/sim/powerups-world.test.ts`

**Interfaces:**
- Consumes (Task 1): `POWERUP_CATALOG`, `DEFAULT_POWERUP_CONFIG`, `powerupKindForTag`, `activateEffect`, `tickEffects`, `cloneEffects`, `ActiveEffect`, durações.
- Produces:
  - `WorldState.powerups: Entity[]`, `WorldState.powerupSpawner: SpawnGenerator | null`, `WorldState.effects: ActiveEffect[]`, `WorldState.extraLives: number`
  - `pickupPowerup(world: WorldState, entity: Entity): boolean` — remove o pickup e ativa efeito (temporário) ou incrementa `extraLives`.

- [ ] **Step 1: Write the failing world/pickup test**

`tests/core/sim/powerups-world.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';
import type { Entity } from '@core/sim';
import { pickupPowerup, isEffectActive } from '@core/powerup';

const CONFIG = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200, seed: 'endless:PWR' };

function makePowerup(id: string, x: number, y: number): Entity {
  return {
    id: 0,
    type: 'collectible',
    tags: [id],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('power-ups in the world', () => {
  it('createWorld seeds the powerup spawner and empty effect state', () => {
    const w = createWorld(CONFIG);
    expect(w.powerups).toEqual([]);
    expect(w.effects).toEqual([]);
    expect(w.extraLives).toBe(0);
    expect(w.powerupSpawner).not.toBeNull();
    const noSeed = createWorld({ ...CONFIG, seed: undefined });
    expect(noSeed.powerupSpawner).toBeNull();
  });

  it('pickupPowerup activates a timed effect and removes the pickup', () => {
    const w = createWorld(CONFIG);
    const p = makePowerup('powerup.shield', 100, 300);
    w.powerups.push(p);
    expect(pickupPowerup(w, p)).toBe(true);
    expect(w.powerups).toHaveLength(0);
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(pickupPowerup(w, p)).toBe(false); // idempotente
  });

  it('pickupPowerup extraLife increments the charge, not the effects', () => {
    const w = createWorld(CONFIG);
    const p = makePowerup('powerup.extraLife', 100, 300);
    w.powerups.push(p);
    pickupPowerup(w, p);
    expect(w.extraLives).toBe(1);
    expect(w.effects).toEqual([]);
  });

  it('the spawner materializes power-ups keyed by distance and cloneWorld deep-copies them', () => {
    const w = createWorld(CONFIG);
    for (let i = 0; i < 400; i++) step(w, { flap: i % 20 === 0 });
    expect(w.powerups.length).toBeGreaterThan(0);
    const c = cloneWorld(w);
    expect(c.powerups).toEqual(w.powerups);
    expect(c.powerups[0]).not.toBe(w.powerups[0]);
    expect(c.effects).toEqual(w.effects);
    c.extraLives = 5;
    expect(w.extraLives).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/sim/powerups-world.test.ts`
Expected: FAIL (campos/`pickupPowerup` inexistentes).

- [ ] **Step 3: Add the fields to `WorldState`**

Em `src/core/sim/types.ts`, dentro de `interface WorldState`, após `collectibleSpawner`:
```ts
  /** Pickups de power-up materializados no mundo (item 3.1). */
  powerups: Entity[];
  /** Gerador de power-ups (null quando o mundo não tem seed). */
  powerupSpawner: SpawnGenerator | null;
  /** Efeitos temporários ativos (duração em steps). */
  effects: ActiveEffect[];
  /** Cargas de vida extra acumuladas (não é efeito temporário). */
  extraLives: number;
```
Adicione o import no topo de `types.ts`:
```ts
import type { ActiveEffect } from '@core/powerup';
```

- [ ] **Step 4: Wire `createWorld` and `cloneWorld`**

Em `src/core/sim/world.ts`, importe:
```ts
import { POWERUP_CATALOG, DEFAULT_POWERUP_CONFIG, cloneEffects } from '@core/powerup';
```
Adicione o builder (após `buildCollectibleSpawner`):
```ts
function buildPowerupSpawner(seed: string, worldHeight: number, override?: Partial<SpawnConfig>): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_POWERUP_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('powerups'), config, POWERUP_CATALOG, 'collectible');
}
```
(Power-ups usam `entityType: 'collectible'` — não são obstáculos; o `EntityType` atual é `'obstacle' | 'collectible'`, então reusamos `'collectible'`. A distinção real é pela tag `powerup.*`.)

Em `createWorld`, após montar `collectibleSpawner`:
```ts
  const powerupSpawner =
    config.seed === undefined ? null : buildPowerupSpawner(config.seed, c.worldHeight, config.powerupSpawn);
```
E no objeto retornado (após `collectibleSpawner`):
```ts
    powerups: [],
    powerupSpawner,
    effects: [],
    extraLives: 0,
```
Adicione `powerupSpawn?: Partial<SpawnConfig>;` em `WorldConfig` (types.ts), espelhando `collectibleSpawn`.

Em `cloneWorld`, após `collectibleSpawner`:
```ts
    powerups: w.powerups.map(cloneEntity),
    powerupSpawner: w.powerupSpawner ? w.powerupSpawner.clone() : null,
    effects: cloneEffects(w.effects),
    extraLives: w.extraLives,
```

- [ ] **Step 5: Implement `pickupPowerup`**

`src/core/powerup/apply.ts`:
```ts
import type { Entity, WorldState } from '@core/sim';
import { activateEffect } from './effects';
import { powerupKindForTag } from './catalog';
import { SHIELD_DURATION_STEPS, MAGNET_DURATION_STEPS, DOUBLE_COIN_DURATION_STEPS } from './constants';

/** Duração (steps) de cada power-up temporário. `extraLife` não é temporário. */
function durationFor(kind: 'shield' | 'magnet' | 'doubleCoin'): number {
  switch (kind) {
    case 'shield':
      return SHIELD_DURATION_STEPS;
    case 'magnet':
      return MAGNET_DURATION_STEPS;
    case 'doubleCoin':
      return DOUBLE_COIN_DURATION_STEPS;
  }
}

/**
 * Coleta um power-up: remove do mundo e aplica seu efeito. Temporário ⇒ ativa em `effects`;
 * `extraLife` (carga) ⇒ incrementa `extraLives`. Idempotente (no-op se ausente).
 */
export function pickupPowerup(world: WorldState, entity: Entity): boolean {
  const i = world.powerups.indexOf(entity);
  if (i < 0) return false;
  const kind = powerupKindForTag(entity.tags[0] ?? '');
  world.powerups.splice(i, 1);
  if (kind === null) return true; // tag desconhecida: consome sem efeito
  if (kind === 'extraLife') {
    world.extraLives += 1;
  } else {
    activateEffect(world.effects, kind, durationFor(kind));
  }
  return true;
}
```
Adicione ao `src/core/powerup/index.ts`: `export { pickupPowerup } from './apply';`

- [ ] **Step 6: Wire spawn/cull + pickup + tick into `step`**

Em `src/core/sim/step.ts`, importe:
```ts
import { pickupPowerup, tickEffects } from '@core/powerup';
```
Após o bloco de `collectibleSpawner` (spawn/cull), adicione o de power-ups:
```ts
  if (world.powerupSpawner) {
    world.powerupSpawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.powerups);
    const cullX = pos.x - CULL_MARGIN;
    const pw = world.powerups;
    while (pw.length > 0 && pw[0]!.transform.position.x + rightExtent(pw[0]!.hitbox) < cullX) {
      pw.shift();
    }
  }
```
Após a passada de coleta de coletáveis (`if (world.alive) { ...collectibles... }`), adicione a de pickup:
```ts
  if (world.alive) {
    const powerups = world.powerups;
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i]!;
      if (overlaps(ptero.hitbox, pos, p.hitbox, p.transform.position)) {
        pickupPowerup(world, p);
      }
    }
  }
```
No FIM da função `step` (após o `world.score += ...`), adicione:
```ts
  // Decremento de duração dos efeitos temporários (1×/step, no fim).
  tickEffects(world.effects);
```

- [ ] **Step 7: Encode the new fields in `hashState`**

Em `src/core/replay/hash.ts`, dentro de `hashState`, após o bloco de `collectibles`:
```ts
  d.word(world.powerups.length);
  for (const e of world.powerups) encodeEntity(d, e);
  d.word(world.effects.length);
  for (const eff of world.effects) {
    d.string(eff.kind);
    d.number(eff.remaining);
  }
  d.number(world.extraLives);
```
E onde codifica a presença dos spawners (`d.bool(world.spawner !== null)` etc), adicione:
```ts
  d.bool(world.powerupSpawner !== null);
```
Atualize o comentário de manutenção do arquivo se listar contagem de campos.

- [ ] **Step 8: Update the hash completeness guard**

Em `tests/core/replay/hash-completeness.test.ts`, adicione a `EXPECTED_WORLD_KEYS` (em ordem alfabética conforme o teste): `'effects'`, `'extraLives'`, `'powerups'`, `'powerupSpawner'`. Atualize o comentário de contagem (20 → 24).

- [ ] **Step 9: Run — determinism replay goldens will fail; regenerate them**

Run: `npx vitest run tests/core/replay tests/determinism/replay.determinism.test.ts`
Expected: o teste de completude PASSA; o golden master FALHA (hashes mudaram por causa dos novos campos/power-ups gerados). Isso é esperado.

Regeneração dos goldens (só após confirmar que a mudança é determinística — os asserts de fps-independência e de seeds-distintas no mesmo arquivo continuam válidos e independem dos hex pinos):
1. Crie um script scratch `scratchpad/dump-goldens.mjs` que importa `simulate`, `buildTimeline`, `hashState` e imprime `hashState` para cada `(seed, timeline)` pinado no teste (copie os cenários exatos do teste).
2. Rode com `npx tsx scratchpad/dump-goldens.mjs` (ou `node` via vite-node) e cole os hashes novos nos `golden` do teste.
3. Rode o teste de novo até verde. Apague o script scratch.

Se `tsx` não estiver disponível, alternativa: mude temporariamente o `golden` esperado para `''`, rode o teste, leia o "expected X to be ''" que revela o hash atual, cole o valor e reverta.

- [ ] **Step 10: Fix any full-state `toEqual` in existing tests**

Run: `npm test`
Se `tests/core/sim/world.test.ts` (ou outro) fizer `expect(world).toEqual({...literal...})`, adicione `powerups: [], powerupSpawner: <SpawnGenerator|null>, effects: [], extraLives: 0` ao objeto esperado. Ajuste até verde.

- [ ] **Step 11: Typecheck + full suite + determinism**

Run: `npm run check && npm test && npm run test:determinism`
Expected: tudo verde.

- [ ] **Step 12: Commit**

```bash
git add src/core tests/core tests/determinism
git commit -m "feat(3.1): estado de power-ups no mundo (spawn/cull/pickup/tick) + hash"
```

---

### Task 3: Comportamentos dos efeitos no step

**Files:**
- Modify: `src/core/powerup/apply.ts` (`applyMagnet`, `killOrRevive`)
- Modify: `src/core/powerup/index.ts` (reexporta os dois)
- Modify: `src/core/sim/step.ts` (escudo ignora colisão; morte via `killOrRevive`; ímã antes da coleta)
- Modify: `src/core/sim/collect.ts` (moeda-dobrada: ganho de comida)
- Modify: `tests/determinism/replay.determinism.test.ts` (re-pinar goldens se mudarem)
- Test: `tests/core/sim/powerup-effects.test.ts`

**Interfaces:**
- Consumes (Task 1/2): `isEffectActive`, `activateEffect`, `DOUBLE_COIN_FOOD_GAIN`, `EXTRA_LIFE_GRACE_STEPS`, `MAGNET_RADIUS`, `MAGNET_PULL_SPEED`, `WorldState`, `FIXED_DT`.
- Produces:
  - `applyMagnet(world: WorldState): void` — puxa coletáveis dentro do raio em direção ao dino.
  - `killOrRevive(world: WorldState): void` — consome vida extra e revive, ou marca morte.

- [ ] **Step 1: Write failing per-effect tests**

`tests/core/sim/powerup-effects.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { Entity, WorldState } from '@core/sim';
import { activateEffect, applyMagnet, killOrRevive, isEffectActive } from '@core/powerup';
import { EXTRA_LIFE_GRACE_STEPS } from '@core/powerup';

const CFG = { worldHeight: 600, startY: 300, gravity: 0, flapSpeed: 350, scrollSpeed: 0 };

function obstacleAt(x: number, y: number): Entity {
  return {
    id: 1, type: 'obstacle', tags: ['obstacle.boulder'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 12 },
  };
}
function coinAt(x: number, y: number): Entity {
  return {
    id: 2, type: 'collectible', tags: ['bird.coin'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('shield', () => {
  it('ignores an otherwise-fatal obstacle overlap while active', () => {
    const w: WorldState = createWorld(CFG);
    activateEffect(w.effects, 'shield', 100);
    w.obstacles.push(obstacleAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
  });
});

describe('extra life', () => {
  it('killOrRevive consumes a charge, keeps alive, and grants a grace shield', () => {
    const w: WorldState = createWorld(CFG);
    w.extraLives = 1;
    killOrRevive(w);
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(w.pterodactyl.kinematics.velocity.y).toBe(0);
    expect(w.pterodactyl.transform.position.y).toBe(w.worldHeight / 2);
  });

  it('killOrRevive kills when no charge left', () => {
    const w: WorldState = createWorld(CFG);
    killOrRevive(w);
    expect(w.alive).toBe(false);
  });

  it('a stored extra life saves the dino from an obstacle collision in step', () => {
    const w: WorldState = createWorld(CFG);
    w.extraLives = 1;
    w.obstacles.push(obstacleAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
  });
});

describe('double coin', () => {
  it('a collected coin yields +2 food while active, +1 otherwise', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    w.collectibles.push(coinAt(px, 300));
    step(w, { flap: false });
    expect(w.food).toBe(1);
    activateEffect(w.effects, 'doubleCoin', 100);
    w.collectibles.push(coinAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.food).toBe(3); // 1 + 2
  });
});

describe('magnet', () => {
  it('pulls an in-radius collectible toward the dino, ignores out-of-radius', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    const near = coinAt(px + 30, 300);   // dentro do raio
    const far = coinAt(px + 500, 300);   // fora do raio
    w.collectibles.push(near, far);
    activateEffect(w.effects, 'magnet', 100);
    const nearX0 = near.transform.position.x;
    applyMagnet(w);
    expect(near.transform.position.x).toBeLessThan(nearX0); // puxado para o dino
    expect(far.transform.position.x).toBe(px + 500);        // intocado
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/sim/powerup-effects.test.ts`
Expected: FAIL (`applyMagnet`/`killOrRevive` inexistentes; escudo/dobrada/revive não implementados).

- [ ] **Step 3: Implement `applyMagnet` and `killOrRevive`**

Em `src/core/powerup/apply.ts` adicione:
```ts
import { FIXED_DT } from '@core/sim';
import { isEffectActive } from './effects';
import { MAGNET_RADIUS, MAGNET_PULL_SPEED, EXTRA_LIFE_GRACE_STEPS } from './constants';
```
```ts
/** Ímã: puxa cada coletável dentro de MAGNET_RADIUS em direção ao dino (chamado só quando
 * o efeito 'magnet' está ativo). Alocação-zero: só escalares + Math.sqrt (portável). */
export function applyMagnet(world: WorldState): void {
  const p = world.pterodactyl.transform.position;
  const step = MAGNET_PULL_SPEED * FIXED_DT;
  const cols = world.collectibles;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]!.transform.position;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0 && dist <= MAGNET_RADIUS) {
      const move = dist < step ? dist : step;
      c.x += (dx / dist) * move;
      c.y += (dy / dist) * move;
    }
  }
}

/** Morte-ou-revive: com vida extra, consome 1 carga, revive ao centro com escudo de graça;
 * senão marca morte. Chamado em todo evento letal (colisão de obstáculo e chão). */
export function killOrRevive(world: WorldState): void {
  if (world.extraLives > 0) {
    world.extraLives -= 1;
    const ptero = world.pterodactyl;
    ptero.transform.position.y = world.worldHeight / 2;
    ptero.kinematics.velocity.y = 0;
    activateEffect(world.effects, 'shield', EXTRA_LIFE_GRACE_STEPS);
    return;
  }
  world.alive = false;
}
```
Reexporte em `index.ts`: `export { pickupPowerup, applyMagnet, killOrRevive } from './apply';`

Nota: confirme que `FIXED_DT` é exportado por `@core/sim` (via `src/core/sim/index.ts`); se não, importe de `@core/sim/constants`.

- [ ] **Step 4: Wire the reads into `step`**

Em `src/core/sim/step.ts` importe:
```ts
import { isEffectActive, applyMagnet, killOrRevive } from '@core/powerup';
```
(a) **Chão** (morte no chão): troque `world.alive = false;` no bloco de chão por `killOrRevive(world);`. Após o revive, `pos.y` foi movido para o centro; não force `pos.y = worldHeight - halfH` nesse caso. Reescreva o bloco:
```ts
  // Chão: tocar = morte (ou consome vida extra e revive).
  if (pos.y + halfH >= world.worldHeight) {
    if (world.extraLives > 0) {
      killOrRevive(world); // revive ao centro
    } else {
      pos.y = world.worldHeight - halfH;
      killOrRevive(world); // marca morte, repousa sobre o chão
    }
  }
```
(b) **Ímã**: logo antes da passada de coleta de coletáveis, adicione:
```ts
  if (isEffectActive(world.effects, 'magnet')) applyMagnet(world);
```
(c) **Colisão de obstáculo**: envolva a marcação de morte com o escudo. Substitua:
```ts
      if (overlaps(ptero.hitbox, pos, o.hitbox, oPos)) {
        world.alive = false;
        break;
      }
```
por:
```ts
      if (overlaps(ptero.hitbox, pos, o.hitbox, oPos)) {
        if (!isEffectActive(world.effects, 'shield')) {
          killOrRevive(world);
          if (!world.alive) break;
        }
        // com escudo/vida-extra: sobrevive e ignora esta colisão
      }
```
Nota: mova o cálculo de `isEffectActive(world.effects, 'shield')` para fora do loop de obstáculos (uma vez por step) para não repetir por obstáculo:
```ts
  if (world.alive) {
    const shielded = isEffectActive(world.effects, 'shield');
    // ...loop... use `shielded` em vez de chamar isEffectActive por obstáculo
  }
```

- [ ] **Step 5: Wire double-coin into `collect`**

Em `src/core/sim/collect.ts`, troque `world.food += 1;` por:
```ts
  world.food += isEffectActive(world.effects, 'doubleCoin') ? DOUBLE_COIN_FOOD_GAIN : 1;
```
Imports no topo:
```ts
import { isEffectActive, DOUBLE_COIN_FOOD_GAIN } from '@core/powerup';
```

- [ ] **Step 6: Run per-effect tests — pass**

Run: `npx vitest run tests/core/sim/powerup-effects.test.ts`
Expected: PASS.

- [ ] **Step 7: Regenerate goldens if changed, run full suite + determinism**

Run: `npm run check && npm test && npm run test:determinism`
Se o golden master falhar (o comportamento mudou a trajetória em seeds que pegam power-ups), re-pine os hashes pelo mesmo procedimento do Task 2 Step 9. Verde no fim.

- [ ] **Step 8: Commit**

```bash
git add src/core tests/core tests/determinism
git commit -m "feat(3.1): efeitos de power-up no step (escudo, vida extra, ímã, moeda-dobrada)"
```

---

### Task 4: Render dos pickups + asset-specs

**Files:**
- Modify: `src/render/manifest.ts` (4 entradas de power-up)
- Modify: `src/render/GameScene.ts` (`drawVisible(g, world.powerups, scrollX)`)
- Modify: `tests/render/manifest.test.ts` (guarda de completude inclui `POWERUP_CATALOG`)
- Create: `docs/assets/specs/powerup.shield.md`, `powerup.extraLife.md`, `powerup.magnet.md`, `powerup.doubleCoin.md`
- Modify: registro de asset-specs (mesmo arquivo/índice usado por `bird.coin`)

**Interfaces:**
- Consumes: `POWERUP_CATALOG` (ids), `world.powerups`, `renderableFor`, `drawVisible`.

- [ ] **Step 1: Update the manifest completeness test (failing)**

Leia `tests/render/manifest.test.ts` para o padrão atual (itera `OBSTACLE_CATALOG`/`COLLECTIBLE_CATALOG` + `DINO_TYPE_ID`). Adicione `POWERUP_CATALOG` à cobertura:
```ts
import { POWERUP_CATALOG } from '@core/powerup';
// ...no it de completude, inclua os ids de POWERUP_CATALOG na lista esperada de ids com entrada no ASSET_MANIFEST.
```
(Siga exatamente a forma do teste existente — provavelmente um loop `for (const t of [...OBSTACLE_CATALOG, ...COLLECTIBLE_CATALOG, ...POWERUP_CATALOG]) expect(ASSET_MANIFEST[t.id]).toBeDefined()`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/render/manifest.test.ts`
Expected: FAIL (ids de power-up sem entrada).

- [ ] **Step 3: Add manifest entries**

Em `src/render/manifest.ts`, dentro de `ASSET_MANIFEST`, após `'bird.coin'`:
```ts
  'powerup.shield': { kind: 'primitive', color: 0x4ac0ff },
  'powerup.extraLife': { kind: 'primitive', color: 0xff5a7a },
  'powerup.magnet': { kind: 'primitive', color: 0xc061ff },
  'powerup.doubleCoin': { kind: 'primitive', color: 0xffe14a },
```

- [ ] **Step 4: Draw power-ups in the scene**

Em `src/render/GameScene.ts`, no `update`, após `this.drawVisible(g, world.collectibles, scrollX);`:
```ts
    this.drawVisible(g, world.powerups, scrollX);
```

- [ ] **Step 5: Run manifest test — pass**

Run: `npx vitest run tests/render/manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the 4 asset-specs**

Crie `docs/assets/specs/powerup.<kind>.md` para shield, extraLife, magnet, doubleCoin. Siga o template de `docs/assets/specs/bird.coin.md` (leia-o primeiro): id lógico, papel no jogo, hitbox lógica (círculo r≈7–9), cor placeholder (a do manifesto), silhueta/ícone sugerido (escudo, coração/ovo, ímã em U, moeda dupla), e a nota REGRA 2 (arte nunca muda a hitbox). Registre os 4 no índice de asset-specs (mesmo local onde `bird.coin` está registrado — procure por `bird.coin` em `docs/assets/`).

- [ ] **Step 7: Full check + tests**

Run: `npm run check && npm test`
Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add src/render tests/render docs/assets
git commit -m "feat(3.1): render dos pickups de power-up + asset-specs (REGRA 5)"
```

---

### Task 5: Suíte de determinismo dos power-ups + verificação final

**Files:**
- Create: `tests/determinism/powerups.determinism.test.ts`
- (possível) Modify: `tests/determinism/replay.determinism.test.ts` (goldens já pinados nas tasks anteriores)

**Interfaces:**
- Consumes: `simulate`, `buildTimeline` (`@core/replay`), `hashState`, `createWorld`, `step`, `isEffectActive`.

- [ ] **Step 1: Write the determinism test**

`tests/determinism/powerups.determinism.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { createWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';

const CONFIG: WorldConfig = {
  worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200,
  seed: 'endless:PWRDET',
};

/** Roda a sim com N steps por frame (fps-independência): mesma sequência lógica de inputs. */
function runFps(config: WorldConfig, totalSteps: number, flapEvery: number): string {
  const w = createWorld(config);
  for (let i = 0; i < totalSteps; i++) step(w, { flap: i % flapEvery === 0 });
  return hashState(w);
}

describe('power-ups determinism', () => {
  it('same seed + inputs ⇒ identical final state', () => {
    const a = runFps(CONFIG, 1200, 18);
    const b = runFps(CONFIG, 1200, 18);
    expect(a).toBe(b);
  });

  it('power-ups are actually exercised (pickups happen)', () => {
    // Sanidade: numa corrida longa, ao menos um power-up é gerado (senão o teste é vazio).
    const w = createWorld(CONFIG);
    let sawPowerup = false;
    for (let i = 0; i < 1200; i++) {
      step(w, { flap: i % 18 === 0 });
      if (w.powerups.length > 0 || w.effects.length > 0 || w.extraLives > 0) sawPowerup = true;
    }
    expect(sawPowerup).toBe(true);
  });

  it('distinct seeds ⇒ distinct power-up streams (different final hash)', () => {
    const a = runFps(CONFIG, 800, 18);
    const b = runFps({ ...CONFIG, seed: 'endless:PWRDET2' }, 800, 18);
    expect(a).not.toBe(b);
  });

  it('is fps-independent via simulate (batched steps produce the same hash)', () => {
    // simulate roda 1 step por frame; comparar com uma corrida manual idêntica.
    const timeline = buildTimeline(800, 'everyN18'); // use o pattern existente equivalente
    const viaSimulate = hashState(simulate(CONFIG, timeline));
    const viaManual = runFps(CONFIG, 800, 18);
    expect(viaSimulate).toBe(viaManual);
  });
});
```
Ajuste o `pattern` de `buildTimeline` para um que exista em `src/core/replay/timeline.ts` e que bata com `i % 18 === 0` (leia `buildTimeline`; se não houver equivalente exato, construa a `InputTimeline` manualmente com o mesmo padrão em vez de `buildTimeline`, para o último `it`).

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/determinism/powerups.determinism.test.ts`
Expected: PASS. Se `sawPowerup` falhar, aumente `totalSteps` ou ajuste `DEFAULT_POWERUP_CONFIG.gap*`/`startX` (Task 1) até power-ups aparecerem em corrida razoável; re-rode as tasks afetadas.

- [ ] **Step 3: Skill de verificação de determinismo**

Rode a skill `verify-determinism` (ou `npm run test:determinism`). Se útil, invoque o subagent `determinism-guardian` para auditar o diff de `src/core/`.
Expected: bateria verde; guardião "contrato intacto".

- [ ] **Step 4: Final verification**

Run: `npm run check && npm test && npm run test:determinism`
Expected: tudo verde. Anote as contagens (testes totais / determinismo) para o relatório.

- [ ] **Step 5: Commit**

```bash
git add tests/determinism
git commit -m "test(3.1): determinismo dos power-ups (reprodutibilidade + fps-independência)"
```

---

## Self-Review (autor)

- **Cobertura da spec:** framework (T1) ✓; 4 power-ups (T1 catálogo + T3 efeitos) ✓; geração keyed por distância (T2, `fork('powerups')`) ✓; testes por efeito (T3) + determinismo (T5) ✓; render dos pickups (T4) ✓; hashState/guardas (T2) ✓; asset-specs REGRA 5 (T4) ✓; slow-mo explicitamente adiado p/ 3.2 (spec) ✓.
- **Placeholders:** nenhum passo com "TBD/etc"; todo passo de código mostra o código. As buscas ao `buildTimeline`/`manifest.test.ts`/registro de asset-specs pedem leitura do arquivo existente porque seguem um padrão já no repo — instruções explícitas de onde olhar.
- **Consistência de tipos:** `pickupPowerup/applyMagnet/killOrRevive` assinam `(world: WorldState[, entity])`; `activateEffect(effects, kind, durationSteps)`; `isEffectActive(effects, kind)`; campos `powerups/powerupSpawner/effects/extraLives` usados igual em types/world/step/hash. `entityType: 'collectible'` para power-ups (EntityType não ganha membro novo). `DOUBLE_COIN_FOOD_GAIN`, `EXTRA_LIFE_GRACE_STEPS`, `MAGNET_*` batem entre constants e usos.
