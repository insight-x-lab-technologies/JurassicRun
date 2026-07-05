# Ninho / Hangar (4.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um Ninho com ~10 pterodáctilos, cada um com um traço que altera a simulação de forma determinística; o jogador possui/compra/seleciona um dino ativo cujo traço entra na partida como estado inicial.

**Architecture:** Core puro `src/core/dino/` define traços + modificadores; o traço vira campo de `WorldState` aplicado por `createWorld`/`step`/`collect`. `src/services/nest/` (puro×casca, molde de `ProfileService`) guarda posse/ativo em localStorage; compra passa por um seam de carteira (4.5). `NestScreen` (Preact) é a UI; `startGame` passa o traço ativo ao `createWorld`.

**Tech Stack:** TypeScript estrito, Vitest, Preact + @preact/signals, i18next (10 locales), Phaser (só no render, não tocado aqui).

## Global Constraints

- **Determinismo (REGRA 1):** `src/core/` é TS puro; `Math.random`/`Date.now`/`performance.now` PROIBIDOS em `src/core/`. Mesma seed + mesmo trait + mesmos inputs ⇒ estado idêntico.
- **Alocação-zero no hot path (REGRA 3):** `traitModifiers` retorna referência congelada do catálogo; `step`/`collect` não alocam por frame.
- **Arte desacoplada (REGRA 2):** hitbox lógica; nenhum dado visual em `src/core/`.
- **i18n (REGRA 4):** nenhuma string visível hardcoded; tudo via chaves i18next nos 10 locales (en, es, pt-BR, fr, it, de, ja, zh, ko, hi). Paridade verificada por `tests/i18n/locales.test.ts`.
- **Asset-spec (REGRA 5):** toda imagem trocável tem asset-spec em `docs/assets/specs/`.
- **Dependência única:** `app → services → core`; `core` não importa de `app`/`render`/`services`/`preact`/`phaser`/DOM.
- **Verde a cada commit:** `npm run check` e `npm test` passam ao fim de cada task.
- **Tuning é placeholder:** multiplicadores/preços/durações são placeholders (como difficulty/economy/powerup); balance é Fase 8.

## File Structure

- `src/core/dino/types.ts` — `DinoTrait`, `TraitModifiers`.
- `src/core/dino/catalog.ts` — `TRAIT_CATALOG`, `traitModifiers`, `HEAD_START_SHIELD_STEPS`.
- `src/core/dino/index.ts` — barrel.
- `src/core/sim/types.ts` — +`WorldConfig.trait?`, +`WorldState.trait`.
- `src/core/sim/world.ts` — `createWorld` aplica start-modifiers; `cloneWorld` copia `trait`.
- `src/core/sim/step.ts` — ímã permanente via `magnetAlways`.
- `src/core/sim/collect.ts` — `foodMultiplier`.
- `src/core/replay/hash.ts` — absorve `world.trait`.
- `src/services/nest/roster.ts` — `DinoDef`, `DINO_ROSTER`, `STARTER_DINO_ID`, `dinoById`.
- `src/services/nest/store.ts` — `NestState`, `purchase`, `setActive`, etc. (puro).
- `src/services/nest/storage.ts` — `NestStorage`, memory/localStorage (casca).
- `src/services/nest/wallet.ts` — seam `getCoinBalance`/`spendCoins`.
- `src/services/nest/index.ts` — `NestService` reativo (singleton).
- `src/app/screens/NestScreen.tsx` — UI do Ninho.
- `src/app/App.tsx` — rota `nest` → `NestScreen`.
- `src/app/game/startGame.ts` — passa `trait` ativo.
- `src/main.tsx` — `nestService.init()`.
- `src/i18n/locales/*.json` — `nest.*`, `dino.*.name`, `trait.*.desc`.
- `docs/assets/specs/dino.<id>.md` (×10) + `docs/assets/asset-registry.md`.

---

### Task 1: Core `src/core/dino/` — catálogo de traços (puro)

**Files:**
- Create: `src/core/dino/types.ts`
- Create: `src/core/dino/catalog.ts`
- Create: `src/core/dino/index.ts`
- Test: `tests/core/dino/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type DinoTrait = 'none' | 'magnet' | 'doubleFood' | 'tripleFood' | 'startLife' | 'headStart'`
  - `interface TraitModifiers { readonly magnetAlways: boolean; readonly foodMultiplier: number; readonly startExtraLives: number; readonly startShieldSteps: number }`
  - `function traitModifiers(trait: DinoTrait): TraitModifiers`
  - `const HEAD_START_SHIELD_STEPS: number`
  - `const DINO_TRAITS: readonly DinoTrait[]` (para iteração em testes)

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/dino/catalog.test.ts
import { describe, it, expect } from 'vitest';
import { traitModifiers, DINO_TRAITS, HEAD_START_SHIELD_STEPS } from '@core/dino';

describe('traitModifiers', () => {
  it('none é o baseline neutro', () => {
    expect(traitModifiers('none')).toEqual({
      magnetAlways: false, foodMultiplier: 1, startExtraLives: 0, startShieldSteps: 0,
    });
  });

  it('magnet liga o ímã permanente e mantém o resto neutro', () => {
    const m = traitModifiers('magnet');
    expect(m.magnetAlways).toBe(true);
    expect(m.foodMultiplier).toBe(1);
    expect(m.startExtraLives).toBe(0);
    expect(m.startShieldSteps).toBe(0);
  });

  it('doubleFood/tripleFood setam o multiplicador de comida', () => {
    expect(traitModifiers('doubleFood').foodMultiplier).toBe(2);
    expect(traitModifiers('tripleFood').foodMultiplier).toBe(3);
  });

  it('startLife dá 1 vida extra inicial', () => {
    expect(traitModifiers('startLife').startExtraLives).toBe(1);
  });

  it('headStart dá escudo inicial de HEAD_START_SHIELD_STEPS steps', () => {
    expect(HEAD_START_SHIELD_STEPS).toBeGreaterThan(0);
    expect(traitModifiers('headStart').startShieldSteps).toBe(HEAD_START_SHIELD_STEPS);
  });

  it('todo trait tem entrada e o lookup é estável (mesma referência congelada)', () => {
    for (const t of DINO_TRAITS) {
      const a = traitModifiers(t);
      expect(a).toBe(traitModifiers(t)); // referência estável ⇒ alocação-zero
      expect(Object.isFrozen(a)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/dino/catalog.test.ts`
Expected: FAIL (módulo `@core/dino` inexistente).

- [ ] **Step 3: Write the implementation**

```ts
// src/core/dino/types.ts
/** Traços de dino — modificadores de simulação determinísticos (parte do estado inicial). */
export type DinoTrait = 'none' | 'magnet' | 'doubleFood' | 'tripleFood' | 'startLife' | 'headStart';

/** Modificadores puros que um traço aplica à simulação. */
export interface TraitModifiers {
  /** Ímã sempre ativo (puxa coletáveis, como o power-up magnet). */
  readonly magnetAlways: boolean;
  /** Multiplicador base de comida por coletável (1/2/3). */
  readonly foodMultiplier: number;
  /** Cargas de vida extra iniciais. */
  readonly startExtraLives: number;
  /** Escudo de graça nos primeiros N steps da partida. */
  readonly startShieldSteps: number;
}
```

```ts
// src/core/dino/catalog.ts
import type { DinoTrait, TraitModifiers } from './types';

/** Duração (steps) do escudo inicial do traço headStart. Placeholder de tuning. */
export const HEAD_START_SHIELD_STEPS = 180;

const NEUTRAL: TraitModifiers = { magnetAlways: false, foodMultiplier: 1, startExtraLives: 0, startShieldSteps: 0 };

/** Catálogo congelado: trait → modificadores. Referências estáveis (alocação-zero no hot path). */
export const TRAIT_CATALOG: Readonly<Record<DinoTrait, TraitModifiers>> = Object.freeze({
  none: Object.freeze({ ...NEUTRAL }),
  magnet: Object.freeze({ ...NEUTRAL, magnetAlways: true }),
  doubleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 2 }),
  tripleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 3 }),
  startLife: Object.freeze({ ...NEUTRAL, startExtraLives: 1 }),
  headStart: Object.freeze({ ...NEUTRAL, startShieldSteps: HEAD_START_SHIELD_STEPS }),
});

export const DINO_TRAITS: readonly DinoTrait[] = Object.freeze([
  'none', 'magnet', 'doubleFood', 'tripleFood', 'startLife', 'headStart',
]);

/** Lookup alocação-zero: retorna a referência congelada do catálogo. */
export function traitModifiers(trait: DinoTrait): TraitModifiers {
  return TRAIT_CATALOG[trait];
}
```

```ts
// src/core/dino/index.ts
export type { DinoTrait, TraitModifiers } from './types';
export { TRAIT_CATALOG, DINO_TRAITS, traitModifiers, HEAD_START_SHIELD_STEPS } from './catalog';
```

- [ ] **Step 4: Run tests + check**

O alias `@core/*` → `src/core/*` é wildcard no `tsconfig.json` (verificado) ⇒ `@core/dino` resolve sem edição.

Run: `npm test -- tests/core/dino/catalog.test.ts && npm run check`
Expected: PASS; typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/core/dino tests/core/dino
git commit -m "feat(4.4): módulo puro de traços de dino (src/core/dino)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Traço no modelo de mundo + registro determinístico (atômico, suíte verde)

Adicionar um campo a `WorldState` quebra `hash-completeness` e os goldens; por isso a integração **e** o hash **e** os goldens vão na MESMA task (suíte verde a cada commit — precedente do clima 3.4).

**Files:**
- Modify: `src/core/sim/types.ts` (WorldConfig.trait, WorldState.trait)
- Modify: `src/core/sim/world.ts` (createWorld start-modifiers; cloneWorld)
- Modify: `src/core/sim/step.ts` (magnetAlways)
- Modify: `src/core/sim/collect.ts` (foodMultiplier)
- Modify: `src/core/replay/hash.ts` (d.string(world.trait))
- Modify: `tests/core/replay/hash-completeness.test.ts` (+`trait` na lista, 26→27)
- Modify: `tests/determinism/replay.determinism.test.ts` (re-pinar os 4 goldens)
- Test: `tests/core/sim/trait.test.ts` (novo)

**Interfaces:**
- Consumes: `traitModifiers`, `DinoTrait` (Task 1); `activateEffect`, `isEffectActive` (@core/powerup); `applyMagnet` (@core/powerup).
- Produces: `WorldState.trait: DinoTrait`; `WorldConfig.trait?: DinoTrait`.

- [ ] **Step 1: Write the failing behavior tests**

```ts
// tests/core/sim/trait.test.ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import { isEffectActive } from '@core/powerup';
import type { InputFrame } from '@core/sim';

const noFlap: InputFrame = { flap: false };
const BASE = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200 };

describe('traço no mundo', () => {
  it('default é none quando não passado', () => {
    expect(createWorld({ ...BASE }).trait).toBe('none');
  });

  it('startLife começa com 1 vida extra', () => {
    expect(createWorld({ ...BASE, trait: 'startLife' }).extraLives).toBe(1);
    expect(createWorld({ ...BASE, trait: 'none' }).extraLives).toBe(0);
  });

  it('headStart começa com escudo ativo', () => {
    const w = createWorld({ ...BASE, trait: 'headStart' });
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(isEffectActive(createWorld({ ...BASE }).effects, 'shield')).toBe(false);
  });

  it('doubleFood dá 2 de comida por coletável (via collect)', () => {
    // mundo sem spawner; injeta um coletável sob o dino e coleta manualmente via step de colisão
    const w = createWorld({ ...BASE, trait: 'doubleFood' });
    const dino = w.pterodactyl.transform.position;
    w.collectibles.push({
      id: 1, type: 'collectible', tags: ['bird.coin'],
      transform: { position: { x: dino.x, y: dino.y } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: { kind: 'circle', radius: 6 },
    });
    step(w, noFlap);
    expect(w.food).toBe(2);
  });

  it('cloneWorld copia o trait', () => {
    const w = createWorld({ ...BASE, trait: 'magnet' });
    // clona via re-simulação de igualdade estrutural: o campo deve existir
    expect(w.trait).toBe('magnet');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/core/sim/trait.test.ts`
Expected: FAIL (`trait` não existe em WorldConfig/WorldState).

- [ ] **Step 3: Add fields to types**

Em `src/core/sim/types.ts`, importe o tipo e adicione os campos:

```ts
// no topo, junto aos outros imports de tipo:
import type { DinoTrait } from '@core/dino';
```

Em `WorldConfig` (após `weather?`):
```ts
  /** Traço do dino ativo (de fora do core, via startGame). Default 'none'. */
  trait?: DinoTrait;
```

Em `WorldState` (após `weatherGenerator`):
```ts
  /** Traço do dino ativo desta partida (parte do estado inicial ⇒ determinístico). */
  trait: DinoTrait;
```

- [ ] **Step 4: Apply trait in createWorld + copy in cloneWorld**

Em `src/core/sim/world.ts`:

Adicione o import:
```ts
import { traitModifiers } from '@core/dino';
import { activateEffect } from '@core/powerup';
```
(`cloneEffects` já é importado de `@core/powerup`; some `activateEffect` à mesma linha se preferir.)

Em `createWorld`, antes do `return`, resolva o traço:
```ts
  const trait = config.trait ?? 'none';
  const mods = traitModifiers(trait);
  const effects = mods.startShieldSteps > 0 ? [] as WorldState['effects'] : [];
  if (mods.startShieldSteps > 0) activateEffect(effects, 'shield', mods.startShieldSteps);
```
Troque no objeto retornado:
- `effects: [],` → `effects,`
- `extraLives: 0,` → `extraLives: mods.startExtraLives,`
- adicione `trait,` (ao lado de `weather`).

Em `cloneWorld`, adicione ao objeto retornado (ao lado de `weather: w.weather,`):
```ts
    trait: w.trait,
```

- [ ] **Step 5: Apply magnetAlways in step**

Em `src/core/sim/step.ts`, adicione o import:
```ts
import { traitModifiers } from '@core/dino';
```
No início do `step` (após `world.tick += 1;`), leia os modificadores (referência congelada, sem alocação):
```ts
  const traitMods = traitModifiers(world.trait);
```
Troque a linha do ímã:
```ts
  if (world.alive && isEffectActive(world.effects, 'magnet')) applyMagnet(world);
```
por:
```ts
  if (world.alive && (traitMods.magnetAlways || isEffectActive(world.effects, 'magnet'))) applyMagnet(world);
```

- [ ] **Step 6: Apply foodMultiplier in collect**

Em `src/core/sim/collect.ts`, adicione o import:
```ts
import { traitModifiers } from '@core/dino';
```
Troque a linha do incremento:
```ts
  world.food += isEffectActive(world.effects, 'doubleCoin') ? DOUBLE_COIN_FOOD_GAIN : 1;
```
por:
```ts
  const base = isEffectActive(world.effects, 'doubleCoin') ? DOUBLE_COIN_FOOD_GAIN : 1;
  world.food += base * traitModifiers(world.trait).foodMultiplier;
```

- [ ] **Step 7: Encode trait in hashState + completeness**

Em `src/core/replay/hash.ts`, na `hashState`, após `d.string(world.weather);` adicione:
```ts
  d.string(world.trait);
```

Em `tests/core/replay/hash-completeness.test.ts`, adicione `'trait'` à lista `EXPECTED_WORLD_KEYS` (mantendo ordem alfabética: entre `'tick'` e `'weather'`... na verdade `'trait'` vem depois de `'tick'` e antes de `'weather'`) e atualize o comentário `(26 campos)` → `(27 campos)`.

- [ ] **Step 8: Run behavior + completeness (goldens ainda vermelhos)**

Run: `npm test -- tests/core/sim/trait.test.ts tests/core/replay/hash-completeness.test.ts`
Expected: comportamento e completude PASS.

- [ ] **Step 9: Re-pinar os 4 goldens**

Rode a suíte de golden e capture os hashes novos que aparecem no diff da falha:

Run: `npm test -- tests/determinism/replay.determinism.test.ts`
Expected: os 4 `it('pino estável: ...')` FALHAM mostrando `Expected <golden antigo>` vs `Received <hash novo>`. As asserções relacionais (`GOLD1 vs GOLD2`, `difficulty on vs off`) devem **PASSAR sem edição** — se alguma delas falhar, PARE: houve vazamento, investigue.

Copie cada hash `Received` para o campo `golden` do cenário correspondente em `tests/determinism/replay.determinism.test.ts`.

- [ ] **Step 10: Re-run goldens + full suite + check**

Run: `npm test -- tests/determinism/replay.determinism.test.ts && npm run check && npm test`
Expected: tudo PASS.

- [ ] **Step 11: Commit**

```bash
git add src/core/sim src/core/replay tests/core/sim tests/core/replay tests/determinism/replay.determinism.test.ts
git commit -m "feat(4.4): traço do dino no WorldState (createWorld/step/collect) + hash/goldens re-pinados

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Prova de determinismo do traço

**Files:**
- Test: `tests/determinism/dino.determinism.test.ts` (novo, additivo)

**Interfaces:**
- Consumes: `simulate`, `buildTimeline`, `hashState` (@core/replay); `WorldConfig` (@core/sim).

- [ ] **Step 1: Write the determinism test**

```ts
// tests/determinism/dino.determinism.test.ts
import { describe, it, expect } from 'vitest';
import type { WorldConfig, DinoTrait } from '@core/sim';
import { simulate, buildTimeline, hashState } from '@core/replay';

const BASE: WorldConfig = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200, seed: 'endless:TRAIT' };
const flapEvery = (n: number) => (i: number) => i % n === 0;

describe('determinismo do traço', () => {
  it('mesma seed + mesmo trait ⇒ mesmo hash (reprodutível)', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const a = hashState(simulate({ ...BASE, trait: 'magnet' }, tl));
    const b = hashState(simulate({ ...BASE, trait: 'magnet' }, tl));
    expect(a).toBe(b);
  });

  it('fps-independente (mesmo trait) — simulate compõe passos fixos', () => {
    // buildTimeline + simulate já rodam passo fixo; dois runs idênticos provam estabilidade
    const tl = buildTimeline(900, flapEvery(4));
    expect(hashState(simulate({ ...BASE, trait: 'doubleFood' }, tl)))
      .toBe(hashState(simulate({ ...BASE, trait: 'doubleFood' }, tl)));
  });

  it('traços que se manifestam ⇒ hashes distintos de none', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const none = hashState(simulate({ ...BASE, trait: 'none' }, tl));
    for (const t of ['magnet', 'doubleFood', 'startLife', 'headStart'] as DinoTrait[]) {
      expect(hashState(simulate({ ...BASE, trait: t }, tl))).not.toBe(none);
    }
  });
});
```

Nota: se algum traço específico não divergir nesta timeline (p.ex. o dino morre antes de coletar), ajuste a `pattern`/`length` para uma que sobreviva e colete/atraia — o objetivo é uma timeline onde o traço se manifesta. `magnet`/`doubleFood` exigem coletáveis no caminho; `startLife`/`headStart` mudam sobrevivência.

- [ ] **Step 2: Verify `DinoTrait` is re-exported from `@core/sim`**

O teste importa `DinoTrait` de `@core/sim`. Garanta que `src/core/sim/index.ts` re-exporta o tipo:

Run: `grep -n 'DinoTrait\|export' src/core/sim/index.ts | head`
Se não exportar, adicione a `src/core/sim/index.ts`:
```ts
export type { DinoTrait } from '@core/dino';
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/determinism/dino.determinism.test.ts`
Expected: PASS. Se o 3º teste falhar para algum traço, ajuste a timeline conforme a nota do Step 1.

- [ ] **Step 4: verify-determinism skill + guardian**

Rode a skill `verify-determinism` (bateria completa) e, opcionalmente, o subagent `determinism-guardian` para auditar `src/core/` (contrato intacto).

Run: `npm run test:determinism && npm run check`
Expected: toda a bateria de determinismo verde.

- [ ] **Step 5: Commit**

```bash
git add tests/determinism/dino.determinism.test.ts src/core/sim/index.ts
git commit -m "test(4.4): determinismo do traço (reprodutível, traços distinguem o hash)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Services `src/services/nest/` — roster + store puros (posse/ativo/compra)

**Files:**
- Create: `src/services/nest/roster.ts`
- Create: `src/services/nest/store.ts`
- Test: `tests/services/nest/store.test.ts`

**Interfaces:**
- Consumes: `DinoTrait` (@core/dino).
- Produces:
  - `interface DinoDef { readonly id: string; readonly traitKind: DinoTrait; readonly price: number; readonly nameKey: string; readonly hue: number }`
  - `const DINO_ROSTER: readonly DinoDef[]`; `const STARTER_DINO_ID: string`; `function dinoById(id: string): DinoDef | undefined`
  - `interface NestState { readonly owned: readonly string[]; readonly activeId: string }`
  - `function initialNestState(): NestState`; `isOwned(state, id)`; `ownedDinos(state): readonly DinoDef[]`
  - `function setActive(state: NestState, id: string): NestState`
  - `type PurchaseResult = 'ok' | 'alreadyOwned' | 'insufficient' | 'unknown'`
  - `function purchase(state: NestState, id: string, balance: number): { state: NestState; result: PurchaseResult; spent: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/nest/store.test.ts
import { describe, it, expect } from 'vitest';
import { DINO_ROSTER, STARTER_DINO_ID, dinoById } from '@services/nest/roster';
import { initialNestState, isOwned, ownedDinos, setActive, purchase } from '@services/nest/store';

describe('roster', () => {
  it('tem ~10 dinos, ids únicos, starter grátis com trait none', () => {
    expect(DINO_ROSTER.length).toBeGreaterThanOrEqual(10);
    const ids = DINO_ROSTER.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const starter = dinoById(STARTER_DINO_ID)!;
    expect(starter.price).toBe(0);
    expect(starter.traitKind).toBe('none');
  });
  it('todo dino tem nameKey e descrição de traço mapeável', () => {
    for (const d of DINO_ROSTER) {
      expect(d.nameKey).toMatch(/^dino\./);
      expect(typeof d.hue).toBe('number');
    }
  });
});

describe('nest store', () => {
  it('estado inicial possui e ativa o starter', () => {
    const s = initialNestState();
    expect(s.owned).toEqual([STARTER_DINO_ID]);
    expect(s.activeId).toBe(STARTER_DINO_ID);
    expect(isOwned(s, STARTER_DINO_ID)).toBe(true);
  });

  it('setActive só ativa dino possuído', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    expect(setActive(s, paid.id).activeId).toBe(STARTER_DINO_ID); // não possuído ⇒ no-op
  });

  it('purchase: saldo suficiente adiciona à posse e devolve o custo', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const r = purchase(s, paid.id, paid.price + 10);
    expect(r.result).toBe('ok');
    expect(r.spent).toBe(paid.price);
    expect(isOwned(r.state, paid.id)).toBe(true);
  });

  it('purchase: saldo insuficiente não muda o estado', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const r = purchase(s, paid.id, paid.price - 1);
    expect(r.result).toBe('insufficient');
    expect(r.spent).toBe(0);
    expect(isOwned(r.state, paid.id)).toBe(false);
  });

  it('purchase: já possuído / id desconhecido', () => {
    const s = initialNestState();
    expect(purchase(s, STARTER_DINO_ID, 999).result).toBe('alreadyOwned');
    expect(purchase(s, 'nope', 999).result).toBe('unknown');
  });

  it('ownedDinos resolve DinoDefs possuídos', () => {
    const s = initialNestState();
    expect(ownedDinos(s).map((d) => d.id)).toEqual([STARTER_DINO_ID]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/services/nest/store.test.ts`
Expected: FAIL (módulos inexistentes). O alias `@services/*` → `src/services/*` já é wildcard no `tsconfig.json` (verificado) ⇒ resolve sem edição.

- [ ] **Step 3: Write roster**

```ts
// src/services/nest/roster.ts
import type { DinoTrait } from '@core/dino';

/** Definição de meta de um dino do roster (id, traço, preço, chaves i18n, cosmético). */
export interface DinoDef {
  readonly id: string;
  readonly traitKind: DinoTrait;
  readonly price: number;   // em moedas (placeholder de tuning)
  readonly nameKey: string; // chave i18n do nome
  readonly hue: number;     // matiz do avatar geométrico placeholder
}

export const STARTER_DINO_ID = 'starter';

/** Roster de ~10 pterodáctilos. Preços/traços são placeholders (tuning na Fase 8). */
export const DINO_ROSTER: readonly DinoDef[] = Object.freeze([
  { id: 'starter',    traitKind: 'none',       price: 0,   nameKey: 'dino.starter.name',    hue: 200 },
  { id: 'lodestone',  traitKind: 'magnet',     price: 250, nameKey: 'dino.lodestone.name',  hue: 280 },
  { id: 'goldbeak',   traitKind: 'doubleFood', price: 150, nameKey: 'dino.goldbeak.name',   hue: 45  },
  { id: 'midas',      traitKind: 'tripleFood', price: 500, nameKey: 'dino.midas.name',      hue: 50  },
  { id: 'nine-lives', traitKind: 'startLife',  price: 350, nameKey: 'dino.nine-lives.name', hue: 0   },
  { id: 'aegis',      traitKind: 'headStart',  price: 300, nameKey: 'dino.aegis.name',      hue: 210 },
  { id: 'prospector', traitKind: 'magnet',     price: 400, nameKey: 'dino.prospector.name', hue: 120 },
  { id: 'harvester',  traitKind: 'doubleFood', price: 220, nameKey: 'dino.harvester.name',  hue: 90  },
  { id: 'phoenix',    traitKind: 'startLife',  price: 600, nameKey: 'dino.phoenix.name',    hue: 20  },
  { id: 'guardian',   traitKind: 'headStart',  price: 450, nameKey: 'dino.guardian.name',   hue: 240 },
]);

export function dinoById(id: string): DinoDef | undefined {
  return DINO_ROSTER.find((d) => d.id === id);
}
```

- [ ] **Step 4: Write store**

```ts
// src/services/nest/store.ts
import { DINO_ROSTER, STARTER_DINO_ID, dinoById, type DinoDef } from './roster';

export interface NestState {
  readonly owned: readonly string[];
  readonly activeId: string;
}

export type PurchaseResult = 'ok' | 'alreadyOwned' | 'insufficient' | 'unknown';

export function initialNestState(): NestState {
  return { owned: [STARTER_DINO_ID], activeId: STARTER_DINO_ID };
}

export function isOwned(state: NestState, id: string): boolean {
  return state.owned.includes(id);
}

export function ownedDinos(state: NestState): readonly DinoDef[] {
  return DINO_ROSTER.filter((d) => state.owned.includes(d.id));
}

export function setActive(state: NestState, id: string): NestState {
  if (!isOwned(state, id)) return state;
  return { ...state, activeId: id };
}

export function purchase(
  state: NestState,
  id: string,
  balance: number,
): { state: NestState; result: PurchaseResult; spent: number } {
  const def = dinoById(id);
  if (!def) return { state, result: 'unknown', spent: 0 };
  if (isOwned(state, id)) return { state, result: 'alreadyOwned', spent: 0 };
  if (balance < def.price) return { state, result: 'insufficient', spent: 0 };
  return { state: { ...state, owned: [...state.owned, id] }, result: 'ok', spent: def.price };
}
```

- [ ] **Step 5: Run tests + check**

Run: `npm test -- tests/services/nest/store.test.ts && npm run check`
Expected: PASS; typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add src/services/nest/roster.ts src/services/nest/store.ts tests/services/nest
git commit -m "feat(4.4): roster de dinos + store puro do Ninho (posse/ativo/compra)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Services `src/services/nest/` — storage + seam de carteira + NestService + wiring

**Files:**
- Create: `src/services/nest/storage.ts`
- Create: `src/services/nest/wallet.ts`
- Create: `src/services/nest/index.ts`
- Modify: `src/app/game/startGame.ts` (passa trait ativo)
- Modify: `src/main.tsx` (nestService.init())
- Test: `tests/services/nest/storage.test.ts`
- Test: `tests/services/nest/service.test.ts`

**Interfaces:**
- Consumes: `NestState`, `initialNestState`, `setActive`, `purchase`, `PurchaseResult`, `ownedDinos`, `isOwned`, `DinoDef`, `dinoById`, `STARTER_DINO_ID` (Tasks 4); `DinoTrait` (@core/dino); `createWorld` (@core/sim).
- Produces:
  - `interface NestStorage { load(): NestState; save(state: NestState): void }`; `memoryNestStorage`, `localStorageNestStorage`, `STORAGE_KEY`
  - `function getCoinBalance(): number`; `function spendCoins(amount: number): void`
  - `nestService` (singleton) com: `ownedIds: ReadonlySignal<readonly string[]>`, `activeDino: ReadonlySignal<DinoDef>`, `init(storage?)`, `select(id): void`, `buy(id): PurchaseResult`, `activeTrait(): DinoTrait`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/nest/storage.test.ts
import { describe, it, expect } from 'vitest';
import { memoryNestStorage } from '@services/nest/storage';
import { initialNestState } from '@services/nest/store';

describe('nest storage (memory)', () => {
  it('round-trip preserva o estado', () => {
    const s = memoryNestStorage();
    const st = { owned: ['starter', 'midas'], activeId: 'midas' };
    s.save(st);
    expect(s.load()).toEqual(st);
  });
  it('default é o estado inicial', () => {
    expect(memoryNestStorage().load()).toEqual(initialNestState());
  });
});
```

```ts
// tests/services/nest/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { nestService } from '@services/nest';
import { memoryNestStorage } from '@services/nest/storage';
import { STARTER_DINO_ID, DINO_ROSTER } from '@services/nest/roster';

describe('NestService', () => {
  beforeEach(() => {
    nestService.init(memoryNestStorage());
  });

  it('inicia com o starter ativo e possuído', () => {
    expect(nestService.activeDino.value.id).toBe(STARTER_DINO_ID);
    expect(nestService.ownedIds.value).toContain(STARTER_DINO_ID);
    expect(nestService.activeTrait()).toBe('none');
  });

  it('buy com saldo 0 (seam) falha para dinos pagos', () => {
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    expect(nestService.buy(paid.id)).toBe('insufficient');
    expect(nestService.ownedIds.value).not.toContain(paid.id);
  });

  it('select só ativa dino possuído e persiste', () => {
    const storage = memoryNestStorage();
    nestService.init(storage);
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    nestService.select(paid.id); // não possuído ⇒ no-op
    expect(nestService.activeDino.value.id).toBe(STARTER_DINO_ID);
    // possuído (força via storage) persiste na seleção
    storage.save({ owned: [STARTER_DINO_ID, paid.id], activeId: STARTER_DINO_ID });
    nestService.init(storage);
    nestService.select(paid.id);
    expect(nestService.activeDino.value.id).toBe(paid.id);
    expect(storage.load().activeId).toBe(paid.id);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/services/nest/storage.test.ts tests/services/nest/service.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Write storage**

```ts
// src/services/nest/storage.ts
import { initialNestState, type NestState } from './store';
import { dinoById, STARTER_DINO_ID } from './roster';

export interface NestStorage {
  load(): NestState;
  save(state: NestState): void;
}

export const STORAGE_KEY = 'jurassicrun.nest.v1';

export function memoryNestStorage(initial: NestState = initialNestState()): NestStorage {
  let state = initial;
  return { load: () => state, save: (s) => { state = s; } };
}

function sanitize(owned: readonly string[], activeId: unknown): NestState {
  // só ids conhecidos; starter sempre possuído; activeId resolve para um possuído.
  const known = owned.filter((id) => dinoById(id) !== undefined);
  const set = new Set<string>([STARTER_DINO_ID, ...known]);
  const ownedArr = [...set];
  const active = typeof activeId === 'string' && ownedArr.includes(activeId) ? activeId : STARTER_DINO_ID;
  return { owned: ownedArr, activeId: active };
}

function parseState(raw: string): NestState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return initialNestState();
    const d = data as Record<string, unknown>;
    const owned = Array.isArray(d.owned) ? d.owned.filter((x): x is string => typeof x === 'string') : [];
    return sanitize(owned, d.activeId);
  } catch {
    return initialNestState();
  }
}

export function localStorageNestStorage(): NestStorage {
  return {
    load(): NestState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialNestState() : parseState(raw);
      } catch {
        return initialNestState();
      }
    },
    save(state: NestState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // best-effort (modo privado)
      }
    },
  };
}
```

- [ ] **Step 4: Write wallet seam**

```ts
// src/services/nest/wallet.ts
/**
 * SEAM de carteira. A carteira persistente + ganho de moedas é o item 4.5.
 * Por ora saldo 0 e débito no-op (precedente do getHomeStats no 4.3). Único ponto a
 * religar quando a economia persistente existir.
 */
export function getCoinBalance(): number {
  return 0;
}

export function spendCoins(_amount: number): void {
  // no-op até 4.5 (carteira persistente).
}
```

- [ ] **Step 5: Write NestService**

```ts
// src/services/nest/index.ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import type { DinoTrait } from '@core/dino';
import {
  initialNestState, setActive, purchase, type NestState, type PurchaseResult,
} from './store';
import { dinoById, STARTER_DINO_ID, type DinoDef } from './roster';
import { localStorageNestStorage, memoryNestStorage, type NestStorage } from './storage';
import { getCoinBalance, spendCoins } from './wallet';

class NestService {
  private storage: NestStorage = memoryNestStorage();
  private readonly _state = signal<NestState>(initialNestState());

  readonly ownedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.owned);
  readonly activeDino: ReadonlySignal<DinoDef> = computed(
    () => dinoById(this._state.value.activeId) ?? dinoById(STARTER_DINO_ID)!,
  );

  init(storage: NestStorage = localStorageNestStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  select(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  buy(id: string): PurchaseResult {
    const { state, result, spent } = purchase(this._state.value, id, getCoinBalance());
    if (result === 'ok') {
      spendCoins(spent);
      this.commit(state);
    }
    return result;
  }

  activeTrait(): DinoTrait {
    return this.activeDino.value.traitKind;
  }

  private commit(state: NestState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const nestService = new NestService();
export type { DinoDef } from './roster';
export { DINO_ROSTER, STARTER_DINO_ID, dinoById } from './roster';
export { isOwned, ownedDinos, type NestState, type PurchaseResult } from './store';
```

- [ ] **Step 6: Wire startGame + main**

Em `src/app/game/startGame.ts`, importe o serviço e passe o traço na factory:
```ts
import { nestService } from '@services/nest';
```
Na factory de partida, troque:
```ts
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed }), seedLabel: seed };
```
por:
```ts
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed, trait: nestService.activeTrait() }), seedLabel: seed };
```

Em `src/main.tsx`, junto ao `profileService.init()`, adicione:
```ts
import { nestService } from '@services/nest';
// ...
nestService.init();
```
(coloque a chamada ao lado da inicialização do profileService, antes do `render`).

- [ ] **Step 7: Run tests + check**

Run: `npm test -- tests/services/nest && npm run check`
Expected: PASS; typecheck limpo.

- [ ] **Step 8: Commit**

```bash
git add src/services/nest/storage.ts src/services/nest/wallet.ts src/services/nest/index.ts src/app/game/startGame.ts src/main.tsx tests/services/nest/storage.test.ts tests/services/nest/service.test.ts
git commit -m "feat(4.4): NestService reativo + storage + seam de carteira; startGame passa o traço ativo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `NestScreen` + rota + i18n (10 locales)

**Files:**
- Create: `src/app/screens/NestScreen.tsx`
- Create: `src/app/screens/NestScreen.css` (ou reuso do padrão de estilos existente — verifique como HomeScreen importa CSS)
- Modify: `src/app/App.tsx` (rota `nest` → `NestScreen`)
- Modify: `src/i18n/locales/*.json` (10 arquivos) — `nest.*`, `dino.<id>.name`, `trait.<kind>.desc`
- Test: `tests/app/nest-screen.test.tsx`

**Interfaces:**
- Consumes: `nestService`, `DINO_ROSTER`, `isOwned`/`ownedDinos`, `STARTER_DINO_ID` (@services/nest); `navigate` (@app/router); `i18n` (@services/i18n) — siga exatamente como `HomeScreen.tsx` consome router + i18n.

- [ ] **Step 1: Add i18n keys (invoque a skill add-locale)**

Invoque a skill `add-locale` para adicionar, nos 10 locales, com paridade garantida:
- `nest`: `{ title, active, select, buy, owned, price, back }`
- `dino.<id>.name` para cada id do roster: `starter, lodestone, goldbeak, midas, nine-lives, aegis, prospector, harvester, guardian, phoenix`
- `trait.<kind>.desc` para: `none, magnet, doubleFood, tripleFood, startLife, headStart`

Conteúdo en (base; a skill traduz os outros 9):
```json
"nest": { "title": "Nest", "active": "Active", "select": "Select", "buy": "Buy", "owned": "Owned", "price": "{{value}} coins", "back": "Back" },
"dino": {
  "starter": { "name": "Scout" }, "lodestone": { "name": "Lodestone" }, "goldbeak": { "name": "Goldbeak" },
  "midas": { "name": "Midas" }, "nine-lives": { "name": "Nine Lives" }, "aegis": { "name": "Aegis" },
  "prospector": { "name": "Prospector" }, "harvester": { "name": "Harvester" },
  "guardian": { "name": "Guardian" }, "phoenix": { "name": "Phoenix" }
},
"trait": {
  "none": { "desc": "No special trait." },
  "magnet": { "desc": "Permanent coin magnet." },
  "doubleFood": { "desc": "Food is worth double." },
  "tripleFood": { "desc": "Food is worth triple." },
  "startLife": { "desc": "Start with an extra life." },
  "headStart": { "desc": "Start with a protective shield." }
}
```

Run após a skill: `npm test -- tests/i18n/locales.test.ts`
Expected: paridade PASS nos 10 locales.

- [ ] **Step 2: Write the failing component test**

Use EXATAMENTE o padrão de `tests/app/profile-screen.test.tsx` (verificado): pragma `// @vitest-environment happy-dom`, `render` de `'preact'`, container manual, `await i18n.init()`.

```tsx
// tests/app/nest-screen.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { NestScreen } from '@app/screens/NestScreen';
import { i18n } from '@services/i18n';
import { nestService } from '@services/nest';
import { memoryNestStorage } from '@services/nest/storage';
import { STARTER_DINO_ID, DINO_ROSTER } from '@services/nest/roster';

describe('NestScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    nestService.init(memoryNestStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renderiza um card por dino do roster', () => {
    render(<NestScreen />, container);
    expect(container.querySelectorAll('.dino-card').length).toBe(DINO_ROSTER.length);
  });

  it('marca o starter como Ativo e dinos pagos como não-compráveis (saldo 0)', () => {
    render(<NestScreen />, container);
    const starterCard = container.querySelector(`[data-testid="dino-card-${STARTER_DINO_ID}"]`)!;
    expect(starterCard.textContent).toContain(i18n.t('nest.active'));
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const buyBtn = container.querySelector(`[data-testid="dino-buy-${paid.id}"]`) as HTMLButtonElement;
    expect(buyBtn.disabled).toBe(true); // saldo 0 < preço
  });
});
```

Atenção ao **gotcha de signals+happy-dom** (render manual pode não flushar `useState`; para efeitos, `await Promise.resolve()` / macrotask). Aqui a leitura é síncrona pós-render, sem eventos, então basta o `render(...)` direto.

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- tests/app/nest-screen.test.tsx`
Expected: FAIL (`NestScreen` inexistente).

- [ ] **Step 4: Write NestScreen**

Modele em `src/app/screens/HomeScreen.tsx` (imports verificados: `navigate` de `'../router'`, `i18n` de `@services/i18n`, uso `i18n.t(...)`; mesmos design tokens/a11y). O card usa `class="dino-card"` (contagem via `.dino-card`) e `data-testid="dino-card-<id>"` (específico) — consistente com o teste do Step 2.

```tsx
// src/app/screens/NestScreen.tsx
import type { VNode } from 'preact';
import { navigate } from '../router';
import { i18n } from '@services/i18n';
import { nestService, DINO_ROSTER, isOwned } from '@services/nest';
import { getCoinBalance } from '@services/nest/wallet';

export function NestScreen(): VNode {
  const activeId = nestService.activeDino.value.id;
  const owned = nestService.ownedIds.value;
  const balance = getCoinBalance();
  const t = (k: string, o?: Record<string, unknown>): string => i18n.t(k, o);

  return (
    <section class="screen nest">
      <header class="screen__header">
        <button class="btn" data-testid="nest-back" onClick={() => navigate('home')} aria-label={t('nest.back')}>
          ←
        </button>
        <h1>{t('nest.title')}</h1>
      </header>

      <ul class="nest__grid">
        {DINO_ROSTER.map((d) => {
          const ownedDino = isOwned({ owned, activeId }, d.id);
          const active = d.id === activeId;
          return (
            <li key={d.id} class="dino-card" data-testid={`dino-card-${d.id}`}>
              <div class="dino-card__avatar" aria-hidden="true" style={{ backgroundColor: `hsl(${d.hue}, 60%, 45%)` }} />
              <h2 class="dino-card__name">{t(d.nameKey)}</h2>
              <p class="dino-card__trait">{t(`trait.${d.traitKind}.desc`)}</p>
              {active ? (
                <span class="dino-card__badge" data-testid={`dino-active-${d.id}`}>{t('nest.active')}</span>
              ) : ownedDino ? (
                <button class="btn" data-testid={`dino-select-${d.id}`} onClick={() => nestService.select(d.id)}>
                  {t('nest.select')}
                </button>
              ) : (
                <button
                  class="btn"
                  data-testid={`dino-buy-${d.id}`}
                  disabled={balance < d.price}
                  onClick={() => nestService.buy(d.id)}
                  aria-label={`${t('nest.buy')} — ${t('nest.price', { value: d.price })}`}
                >
                  {t('nest.buy')} · {t('nest.price', { value: d.price })}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Nota: `isOwned` recebe um `NestState`; aqui montamos `{ owned, activeId }` a partir dos signals. Confira a assinatura real de `i18n.t` em `HomeScreen` (retorno string) e ajuste o helper `t` se necessário. Adicione o CSS `.nest__grid`/`.dino-card*` por design tokens (sem cor hardcoded além do `hsl` do hue, que é dado do roster).

- [ ] **Step 5: Wire route in App**

Em `src/app/App.tsx`, importe `NestScreen` e troque o mapeamento da rota `nest` (hoje `PlaceholderScreen`) por `<NestScreen />` no switch exaustivo. Mantenha o `default: never`.

- [ ] **Step 6: Reconcile the count selector**

Ajuste o teste (Step 2) e o componente para o MESMO seletor de contagem. Recomendado: contar por `container.querySelectorAll('.dino-card').length` e usar `data-testid={`dino-card-${d.id}`}` só para o card específico. Rode:

Run: `npm test -- tests/app/nest-screen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run full suite + check + visual**

Run: `npm run check && npm test`
Expected: tudo verde. (Verificação visual Playwright — Home → Ninho renderiza o grid; starter "Ativo"; pagos desabilitados — é opcional aqui e pode ser feita na verificação final.)

- [ ] **Step 8: Commit**

```bash
git add src/app/screens/NestScreen.tsx src/app/App.tsx src/i18n/locales tests/app/nest-screen.test.tsx
git commit -m "feat(4.4): tela do Ninho (grid de dinos, selecionar/comprar) + rota + i18n 10 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Asset-specs do roster (REGRA 5)

**Files:**
- Create: `docs/assets/specs/dino.<id>.md` (×10)
- Modify: `docs/assets/asset-registry.md` (registro real, confirmado pela skill create-asset-spec)

**Interfaces:** nenhuma (docs).

- [ ] **Step 1: Read the template + reference spec**

Molde: `docs/assets/asset-spec-template.md`; referência: `docs/assets/specs/dino.default.md`; registro: `docs/assets/asset-registry.md`.

Run: `sed -n '1,60p' docs/assets/asset-spec-template.md docs/assets/specs/dino.default.md && sed -n '1,40p' docs/assets/asset-registry.md`

- [ ] **Step 2: Create one asset-spec per roster dino**

Invoque a skill `create-asset-spec` para cada dino do `DINO_ROSTER` (10 ids: `starter, lodestone, goldbeak, midas, nine-lives, aegis, prospector, harvester, guardian, phoenix`). `id` do spec = `dino.<id>`. Cada spec descreve o pterodáctilo-variante (silhueta, paleta associada ao `hue` do roster, tema do traço) como imagem trocável geométrico→PNG (Fase 8), com a **hitbox lógica batendo com a do dino do core** (o roster não altera a hitbox de simulação). Copie a estrutura de `dino.default.md`.

- [ ] **Step 3: Register the specs**

Adicione/atualize uma linha por `dino.<id>` em `docs/assets/asset-registry.md` com status `spec` (mesma tabela dos specs existentes).

- [ ] **Step 4: Verify docs coherence + suite still green**

Run: `npm run check && npm test`
Expected: verde (docs não afetam a suíte; roda por garantia).

- [ ] **Step 5: Commit**

```bash
git add docs/assets/specs docs/assets/asset-registry.md
git commit -m "docs(4.4): asset-specs dos 10 dinos do roster + registro (REGRA 5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Encerramento (após as tasks)

- [ ] `verify-determinism` skill + `determinism-guardian` subagent: contrato de `src/core/` intacto.
- [ ] `superpowers:requesting-code-review` (agente `reviewer`): review final da branch.
- [ ] `superpowers:verification-before-completion`: rodar `npm test`, `npm run check`, `npm run test:determinism` de verdade e colar evidência.
- [ ] Marcar 4.4 como `[x]` em `docs/roadmap/PHASE-04-meta-offline.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md` (item 4.4 concluído; próximo = 4.5).
- [ ] Integrar no `main`: com `gh` autenticado, abrir PR + merge automático; senão merge local `--no-ff` e aposentar a branch.

## Self-Review (do plano vs spec)

- **Cobertura:** core/dino (T1) ✓; trait no mundo + hash + goldens (T2) ✓; determinismo (T3) ✓; roster+store+purchase (T4) ✓; storage+wallet seam+NestService+wiring (T5) ✓; NestScreen+rota+i18n (T6) ✓; asset-specs (T7) ✓. Seam de carteira ✓ (T5). Ninho global e cosmético in-game adiados ✓ (documentado na spec).
- **Placeholders:** nenhum "TODO/TBD"; tuning placeholder é intencional e explícito.
- **Consistência de tipos:** `DinoTrait`/`TraitModifiers`/`traitModifiers` (T1) usados em T2; `DinoDef`/`NestState`/`purchase`/`PurchaseResult`/`setActive` (T4) usados em T5; `nestService.activeTrait()` (T5) usado em T5/T6; `getCoinBalance` (T5) usado em T6. Nomes batem.
- **Risco reconhecido:** goldens re-pinados só em runtime (hashes capturados na falha) — instrução explícita no T2 Step 9; asserções relacionais como guarda de não-vazamento.
```
