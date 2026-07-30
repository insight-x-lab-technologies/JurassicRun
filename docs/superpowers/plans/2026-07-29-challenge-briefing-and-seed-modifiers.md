# 9.9 — Briefing de desafio + modificadores por seed — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desafios Diário/Semanal ganham regras próprias derivadas por função pura da seed (clima
fixo + 1 power-up banido) e uma tela de briefing que mostra seed, recorde e regras antes de jogar.

**Architecture:** Núcleo novo `src/core/challenge/` deriva `ChallengeModifiers` da seed via RNG
forkado; `createWorld` aplica os mods quando `WorldConfig.challenge === true` (clima constante +
catálogo de power-up filtrado), **sem novos campos em `WorldState`** ⇒ `hashState` intocado. Um
builder único `challengeWorldConfig(seed)` passa a ser a fonte da verdade usada por
`createMatchFactory`, `verifyReplay` e `verifyChallengeSubmission`. Na casca, `ChallengeScreen`
alterna briefing ⇄ `PlayScreen` por estado local, sem rota nova.

**Tech Stack:** TypeScript estrito, Vitest, Preact + `@preact/signals`, i18next (10 locales),
esbuild (bundle da Edge Function).

Spec: `docs/superpowers/specs/2026-07-29-challenge-briefing-and-seed-modifiers-design.md`.

## Global Constraints

- **Determinismo (REGRA 1):** proibido `Math.random`, `Date.now`, `performance.now` em
  `src/core/`. Aleatoriedade só via `@core/rng`. `src/core/` não importa phaser/preact/DOM.
- **Contrato de ordem dos saques:** `challengeModifiersForSeed` consome exatamente 2 saques, nesta
  ordem: (1) `pick(WEATHER_KINDS)`, (2) `pick(POWERUP_KINDS)`. Mudar a ordem muda as regras de
  todas as seeds do mundo.
- **Caminho não-desafio byte-idêntico:** com `challenge` ausente/`false`, `createWorld` produz
  exatamente o mundo atual. Os 4 goldens de `tests/determinism/replay.determinism.test.ts`
  **não** podem mudar de valor.
- **Sem novos campos em `WorldState`** ⇒ não tocar `src/core/replay/hash.ts` nem
  `tests/core/replay/hash-completeness.test.ts`.
- **Zero alocação por frame no hot path**; catálogos congelados e memoizados.
- **i18n (REGRA 4):** nenhuma string visível hardcoded; toda chave nova entra nos 10 locales
  (`src/i18n/locales/*.json`: en, pt-BR, es, fr, de, it, ja, ko, zh, hi).
- **Um commit por task**, só com os arquivos da task (nunca `git commit -am`).
- Comandos: `npm test`, `npm run check`, `npm run test:determinism`, `npm run build:edge`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/core/challenge/types.ts` (novo) | `ChallengeModifiers` (dados puros) |
| `src/core/challenge/modifiers.ts` (novo) | `challengeModifiersForSeed(seed)` — derivação pura |
| `src/core/challenge/config.ts` (novo) | `challengeWorldConfig(seed)` — config canônica de desafio |
| `src/core/challenge/index.ts` (novo) | barrel |
| `src/core/powerup/catalog.ts` (mod) | `POWERUP_KINDS`, `powerupCatalogExcluding(kind)` |
| `src/core/sim/types.ts` (mod) | `WorldConfig.challenge?: boolean` |
| `src/core/sim/world.ts` (mod) | aplica os mods em `createWorld` |
| `src/render/matchFactory.ts` (mod) | daily/weekly usam `challengeWorldConfig` |
| `src/services/replay/verify.ts` (mod) | re-sim com config de desafio |
| `src/services/replay/storage.ts` (mod) | `STORAGE_KEY` v2 → v3 |
| `src/services/online/verifyChallenge.ts` (mod) | re-sim com config de desafio |
| `src/app/challenge/brief.ts` (novo) | view-model puro do briefing |
| `src/app/screens/ChallengeBrief.tsx` (novo) | apresentação do briefing |
| `src/app/screens/ChallengeScreen.tsx` (novo) | alterna briefing ⇄ PlayScreen |
| `src/app/screens/PlayScreen.tsx` (mod) | prop opcional `onExit` |
| `src/app/App.tsx` (mod) | `daily`/`weekly` → `ChallengeScreen` |
| `src/app/styles/global.css` (mod) | estilos `.challenge-brief*` |
| `src/i18n/locales/*.json` (mod ×10) | chaves `challenge.brief.*` |

---

### Task 1: Núcleo — modificadores por seed + config canônica

**Files:**
- Create: `src/core/challenge/types.ts`, `src/core/challenge/modifiers.ts`,
  `src/core/challenge/config.ts`, `src/core/challenge/index.ts`
- Modify: `src/core/powerup/catalog.ts`, `src/core/powerup/index.ts`
- Test: `tests/core/challenge/modifiers.test.ts`, `tests/core/challenge/config.test.ts`

**Interfaces:**
- Consumes: `createRng` de `@core/rng`; `WEATHER_KINDS`/`WeatherKind` de `@core/weather`;
  `PowerupKind` de `@core/powerup`; `WorldConfig` de `@core/sim`.
- Produces:
  - `POWERUP_KINDS: readonly PowerupKind[]` (ordem estável dos 5 kinds) em `@core/powerup`
  - `interface ChallengeModifiers { readonly forcedWeather: WeatherKind; readonly bannedPowerup: PowerupKind }`
  - `challengeModifiersForSeed(seed: string): ChallengeModifiers`
  - `challengeWorldConfig(seed: string): WorldConfig`

- [ ] **Step 1: Escrever os testes que falham**

`tests/core/challenge/modifiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { challengeModifiersForSeed } from '@core/challenge';
import { WEATHER_KINDS } from '@core/weather';
import { POWERUP_KINDS } from '@core/powerup';
import { createRng } from '@core/rng';

const SEEDS = ['daily:2026-01-01', 'daily:2026-07-29', 'weekly:2026-W31'];

describe('challengeModifiersForSeed', () => {
  it('é determinística: mesma seed ⇒ mesmos modificadores', () => {
    for (const seed of SEEDS) {
      expect(challengeModifiersForSeed(seed)).toEqual(challengeModifiersForSeed(seed));
    }
  });

  it('devolve sempre valores dos catálogos', () => {
    for (let d = 1; d <= 60; d++) {
      const m = challengeModifiersForSeed(`daily:2026-03-${String(d).padStart(2, '0')}`);
      expect(WEATHER_KINDS).toContain(m.forcedWeather);
      expect(POWERUP_KINDS).toContain(m.bannedPowerup);
    }
  });

  it('varia entre seeds (>1 clima e >1 power-up em 60 datas)', () => {
    const weathers = new Set<string>();
    const banned = new Set<string>();
    for (let d = 1; d <= 60; d++) {
      const m = challengeModifiersForSeed(`daily:2026-03-${String(d).padStart(2, '0')}`);
      weathers.add(m.forcedWeather);
      banned.add(m.bannedPowerup);
    }
    expect(weathers.size).toBeGreaterThan(1);
    expect(banned.size).toBeGreaterThan(1);
  });

  it('contrato de ordem: clima primeiro, power-up depois (stream "challenge")', () => {
    const seed = 'daily:2026-01-01';
    const rng = createRng(seed).fork('challenge');
    const expected = {
      forcedWeather: rng.pick(WEATHER_KINDS),
      bannedPowerup: rng.pick(POWERUP_KINDS),
    };
    expect(challengeModifiersForSeed(seed)).toEqual(expected);
  });

  it('objeto congelado (não mutável por engano)', () => {
    expect(Object.isFrozen(challengeModifiersForSeed('daily:2026-01-01'))).toBe(true);
  });
});
```

`tests/core/challenge/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { challengeWorldConfig } from '@core/challenge';

describe('challengeWorldConfig', () => {
  it('é a config canônica de desafio: seed + trait none + challenge true', () => {
    expect(challengeWorldConfig('daily:2026-01-01')).toEqual({
      seed: 'daily:2026-01-01',
      trait: 'none',
      challenge: true,
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run tests/core/challenge`
Expected: FAIL — `Cannot find module '@core/challenge'` / `POWERUP_KINDS` não exportado.

- [ ] **Step 3: Exportar a ordem estável dos power-ups**

Em `src/core/powerup/catalog.ts`, logo antes de `POWERUP_CATALOG`:

```ts
/** Ordem estável dos kinds de power-up (sorteios determinísticos/UI). Espelha POWERUP_CATALOG. */
export const POWERUP_KINDS: readonly PowerupKind[] = Object.freeze([
  'shield', 'extraLife', 'magnet', 'doubleCoin', 'slowMo',
] as const);
```

Em `src/core/powerup/index.ts`, adicionar `POWERUP_KINDS` à lista exportada de `./catalog`.

- [ ] **Step 4: Implementar o núcleo de desafio**

`src/core/challenge/types.ts`:

```ts
import type { WeatherKind } from '@core/weather';
import type { PowerupKind } from '@core/powerup';

/**
 * Regras vigentes de um desafio, derivadas por função pura da seed ⇒ idênticas para todos os
 * jogadores e recomputáveis pelo verificador anti-cheat. Dados puros, congelados.
 */
export interface ChallengeModifiers {
  /** Clima constante da partida (substitui o sequenciador de clima). */
  readonly forcedWeather: WeatherKind;
  /** Power-up que NÃO spawna neste desafio. */
  readonly bannedPowerup: PowerupKind;
}
```

`src/core/challenge/modifiers.ts`:

```ts
import { createRng } from '@core/rng';
import { WEATHER_KINDS } from '@core/weather';
import { POWERUP_KINDS } from '@core/powerup';
import type { ChallengeModifiers } from './types';

/** Stream de RNG dedicado: não interfere em obstacles/collectibles/powerups/weather. */
const CHALLENGE_STREAM = 'challenge';

/**
 * Modificadores do desafio desta seed. PURA (só `@core/rng`): mesmo `seed` ⇒ mesmas regras em
 * qualquer dispositivo, hoje e no verificador.
 *
 * CONTRATO: consome exatamente 2 saques, nesta ordem — clima, depois power-up banido.
 * Mudar a ordem, o stream ou os catálogos muda as regras de TODAS as seeds já jogadas.
 */
export function challengeModifiersForSeed(seed: string): ChallengeModifiers {
  const rng = createRng(seed).fork(CHALLENGE_STREAM);
  const forcedWeather = rng.pick(WEATHER_KINDS);
  const bannedPowerup = rng.pick(POWERUP_KINDS);
  return Object.freeze({ forcedWeather, bannedPowerup });
}
```

`src/core/challenge/config.ts`:

```ts
import type { WorldConfig } from '@core/sim';

/**
 * Config canônica de uma partida de desafio (Diário/Semanal). FONTE DA VERDADE única: a fábrica
 * de partidas, o verificador de replay local e a Edge Function anti-cheat usam esta função — se
 * divergirem, um replay honesto é rejeitado.
 *
 * `trait: 'none'` mantém a corrida justa; `challenge: true` faz `createWorld` derivar os
 * modificadores da própria seed.
 */
export function challengeWorldConfig(seed: string): WorldConfig {
  return { seed, trait: 'none', challenge: true };
}
```

`src/core/challenge/index.ts`:

```ts
export type { ChallengeModifiers } from './types';
export { challengeModifiersForSeed } from './modifiers';
export { challengeWorldConfig } from './config';
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run tests/core/challenge tests/core/powerup && npx tsc --noEmit`
Expected: PASS (o `challenge: true` de `challengeWorldConfig` só compila depois da Task 2 —
se o typecheck reclamar de `challenge` não existir em `WorldConfig`, adicione o campo opcional
agora, conforme Task 2 Step 3, e siga).

- [ ] **Step 6: Commit**

```bash
git add src/core/challenge src/core/powerup/catalog.ts src/core/powerup/index.ts tests/core/challenge
git commit -m "feat(9.9): modificadores de desafio derivados da seed (função pura) + config canônica"
```

---

### Task 2: Núcleo — `createWorld` aplica os modificadores

**Files:**
- Modify: `src/core/sim/types.ts` (campo `challenge` em `WorldConfig`), `src/core/sim/world.ts`,
  `src/core/powerup/catalog.ts` (+ `index.ts` se necessário)
- Test: `tests/core/sim/challenge-world.test.ts`, `tests/core/powerup/catalog-exclude.test.ts`

**Interfaces:**
- Consumes: `challengeModifiersForSeed` (Task 1), `POWERUP_KINDS` (Task 1).
- Produces:
  - `WorldConfig.challenge?: boolean` (default `false`)
  - `powerupCatalogExcluding(kind: PowerupKind): readonly SimpleSpawnType[]` em `@core/powerup`

- [ ] **Step 1: Escrever os testes que falham**

`tests/core/powerup/catalog-exclude.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { POWERUP_CATALOG, POWERUP_KINDS, powerupCatalogExcluding } from '@core/powerup';

describe('powerupCatalogExcluding', () => {
  it('remove exatamente o tipo banido', () => {
    for (const kind of POWERUP_KINDS) {
      const filtered = powerupCatalogExcluding(kind);
      expect(filtered).toHaveLength(POWERUP_CATALOG.length - 1);
      expect(filtered.some((t) => t.id === `powerup.${kind}`)).toBe(false);
    }
  });

  it('memoiza: mesma referência congelada em chamadas repetidas', () => {
    const a = powerupCatalogExcluding('shield');
    const b = powerupCatalogExcluding('shield');
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('preserva as refs das entradas restantes (mesma ordem do catálogo)', () => {
    const filtered = powerupCatalogExcluding('magnet');
    const expected = POWERUP_CATALOG.filter((t) => t.id !== 'powerup.magnet');
    expect(filtered.every((t, i) => t === expected[i])).toBe(true);
  });
});
```

`tests/core/sim/challenge-world.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';
import { challengeModifiersForSeed } from '@core/challenge';
import { POWERUP_KINDS, powerupKindForTag } from '@core/powerup';

const SEED = 'daily:2026-01-01';
const BASE: WorldConfig = {
  worldHeight: 180,
  startY: 90,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: SEED,
};

/** Roda a sim segurando flap em cadência fixa e devolve os kinds de power-up que spawnaram. */
function spawnedPowerupKinds(config: WorldConfig, steps: number): Set<string> {
  const w = createWorld(config);
  const seen = new Set<string>();
  for (let i = 0; i < steps; i++) {
    step(w, { flap: i % 6 === 0 });
    for (const p of w.powerups) {
      const kind = powerupKindForTag(p.tags[0] ?? '');
      if (kind !== null) seen.add(kind);
    }
    if (!w.alive) {
      w.alive = true; // sobrevive artificialmente: interessa só o stream de spawn
    }
  }
  return seen;
}

describe('createWorld em modo desafio', () => {
  it('aplica o clima forçado da seed e desliga o sequenciador de clima', () => {
    const mods = challengeModifiersForSeed(SEED);
    const w = createWorld({ ...BASE, challenge: true });
    expect(w.weather).toBe(mods.forcedWeather);
    expect(w.weatherGenerator).toBeNull();
  });

  it('mantém o clima constante ao longo da partida', () => {
    const mods = challengeModifiersForSeed(SEED);
    const w = createWorld({ ...BASE, challenge: true });
    for (let i = 0; i < 3000; i++) {
      step(w, { flap: i % 6 === 0 });
      w.alive = true;
    }
    expect(w.weather).toBe(mods.forcedWeather);
  });

  it('nunca spawna o power-up banido, mas continua spawnando os outros', () => {
    const mods = challengeModifiersForSeed(SEED);
    const seen = spawnedPowerupKinds({ ...BASE, challenge: true }, 6000);
    expect(seen.has(mods.bannedPowerup)).toBe(false);
    expect(seen.size).toBeGreaterThan(0);
    for (const k of seen) expect(POWERUP_KINDS).toContain(k as never);
  });

  it('weather:false continua vencendo (mundo sem clima) mesmo em desafio', () => {
    const w = createWorld({ ...BASE, challenge: true, weather: false });
    expect(w.weather).toBe('clear');
    expect(w.weatherGenerator).toBeNull();
  });

  it('sem a flag, o mundo é idêntico ao de antes (não-regressão)', () => {
    const a = createWorld({ ...BASE });
    const b = createWorld({ ...BASE, challenge: false });
    expect(cloneWorld(b)).toEqual(cloneWorld(a));
  });

  it('desafio difere do endless na MESMA seed', () => {
    const endless = createWorld({ ...BASE });
    const chall = createWorld({ ...BASE, challenge: true });
    expect(chall.weather === endless.weather && chall.weatherGenerator === endless.weatherGenerator)
      .toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/sim/challenge-world.test.ts tests/core/powerup/catalog-exclude.test.ts`
Expected: FAIL — `powerupCatalogExcluding` não existe; `challenge` não existe em `WorldConfig`.

- [ ] **Step 3: Campo na `WorldConfig`**

Em `src/core/sim/types.ts`, dentro de `WorldConfig`, depois de `trait?: DinoTrait;`:

```ts
  /**
   * Modo desafio (Diário/Semanal): `createWorld` deriva os modificadores da própria seed
   * (clima fixo + power-up banido) via `@core/challenge`. Default false.
   * Use `challengeWorldConfig(seed)` em vez de montar a config à mão.
   */
  challenge?: boolean;
```

- [ ] **Step 4: Catálogo filtrado memoizado**

Em `src/core/powerup/catalog.ts`, no fim do arquivo:

```ts
/** Cache por kind: uma array congelada por power-up banido ⇒ zero alocação por createWorld
 *  e referência estável para as comparações estruturais dos testes de determinismo. */
const CATALOG_WITHOUT = new Map<PowerupKind, readonly SimpleSpawnType[]>();

/** Catálogo de power-ups sem o `kind` dado (modificador de desafio). Ref memoizada. */
export function powerupCatalogExcluding(kind: PowerupKind): readonly SimpleSpawnType[] {
  const cached = CATALOG_WITHOUT.get(kind);
  if (cached !== undefined) return cached;
  const filtered = Object.freeze(POWERUP_CATALOG.filter((t) => t.id !== `powerup.${kind}`));
  CATALOG_WITHOUT.set(kind, filtered);
  return filtered;
}
```

Exportar `powerupCatalogExcluding` em `src/core/powerup/index.ts` (junto de `POWERUP_CATALOG`).

- [ ] **Step 5: Aplicar em `createWorld`**

Em `src/core/sim/world.ts`: importar `challengeModifiersForSeed` de `@core/challenge` e
`powerupCatalogExcluding` de `@core/powerup`; dar ao builder de power-ups um catálogo opcional:

```ts
function buildPowerupSpawner(
  seed: string,
  worldHeight: number,
  override?: Partial<SpawnConfig>,
  catalog: readonly SpawnType[] = POWERUP_CATALOG,
): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_POWERUP_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('powerups'), config, catalog, 'collectible');
}
```

(importe `SpawnType` como type de `@core/spawn`.)

Dentro de `createWorld`, trocar o bloco de power-ups/clima por:

```ts
  // Modo desafio: as regras vêm da PRÓPRIA seed (idênticas p/ todos; o verificador recomputa).
  const mods = config.challenge === true && config.seed !== undefined
    ? challengeModifiersForSeed(config.seed)
    : null;
  const powerupSpawner =
    config.seed === undefined
      ? null
      : buildPowerupSpawner(
          config.seed,
          c.worldHeight,
          config.powerupSpawn,
          mods === null ? undefined : powerupCatalogExcluding(mods.bannedPowerup),
        );
  const weatherEnabled = config.weather ?? true;
  // Clima forçado ⇒ constante toda a partida, sem sequenciador (sem drift, sem saques).
  const weatherGenerator =
    config.seed === undefined || !weatherEnabled || mods !== null ? null : buildWeatherGenerator(config.seed);
  const forcedWeather = weatherEnabled && mods !== null ? mods.forcedWeather : 'clear';
```

e no objeto devolvido trocar `weather: 'clear',` por `weather: forcedWeather,`.

- [ ] **Step 6: Rodar e ver passar (incluindo a não-regressão)**

Run: `npx vitest run tests/core tests/determinism && npx tsc --noEmit`
Expected: PASS. Os 4 goldens de `tests/determinism/replay.determinism.test.ts` continuam nos
valores atuais — se algum mudou, o caminho não-desafio foi alterado: corrija em vez de re-pinar.

- [ ] **Step 7: Commit**

```bash
git add src/core/sim/types.ts src/core/sim/world.ts src/core/powerup tests/core/sim/challenge-world.test.ts tests/core/powerup/catalog-exclude.test.ts
git commit -m "feat(9.9): createWorld aplica clima forçado e power-up banido em modo desafio"
```

---

### Task 3: Determinismo — golden de modo desafio

**Files:**
- Modify: `tests/determinism/replay.determinism.test.ts`
- Create: `tests/determinism/challenge.determinism.test.ts`

**Interfaces:**
- Consumes: `challengeWorldConfig` (Task 1), `WorldConfig.challenge` (Task 2), `simulate`/
  `buildTimeline`/`hashState` de `@core/replay`.
- Produces: pinos dourados do modo desafio (contrato público de reprodutibilidade).

- [ ] **Step 1: Escrever os testes**

Em `tests/determinism/replay.determinism.test.ts`, adicionar ao array `SCENARIOS` (mantendo os 4
existentes e seus valores):

```ts
  {
    name: 'modo desafio — mods derivados da seed',
    config: { ...BASE, seed: 'daily:2026-01-01', challenge: true },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'PREENCHER_NA_1A_EXECUCAO',
  },
```

`tests/determinism/challenge.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { challengeModifiersForSeed, challengeWorldConfig } from '@core/challenge';
import { createWorld } from '@core/sim';

const TL = buildTimeline(1200, (i) => i % 6 === 0);

describe('determinismo do modo desafio', () => {
  it('mesma seed + mesma timeline ⇒ mesmo hash final', () => {
    const cfg = challengeWorldConfig('daily:2026-02-14');
    expect(hashState(simulate(cfg, TL))).toBe(hashState(simulate(cfg, TL)));
  });

  it('desafio ≠ endless na mesma seed (os mods realmente mudam a partida)', () => {
    const seed = 'daily:2026-02-14';
    const chall = hashState(simulate(challengeWorldConfig(seed), TL));
    const endless = hashState(simulate({ seed, trait: 'none' }, TL));
    expect(chall).not.toBe(endless);
  });

  it('seeds de desafio diferentes ⇒ hashes diferentes', () => {
    const a = hashState(simulate(challengeWorldConfig('daily:2026-02-14'), TL));
    const b = hashState(simulate(challengeWorldConfig('daily:2026-02-15'), TL));
    expect(a).not.toBe(b);
  });

  it('os modificadores da seed são os aplicados pelo mundo', () => {
    const seed = 'weekly:2026-W07';
    const mods = challengeModifiersForSeed(seed);
    const w = createWorld(challengeWorldConfig(seed));
    expect(w.weather).toBe(mods.forcedWeather);
    expect(w.weatherGenerator).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e capturar o golden**

Run: `npx vitest run tests/determinism`
Expected: FAIL só no cenário novo, com `expected 'PREENCHER_NA_1A_EXECUCAO' to be '<hash>'`.
Copiar o hash **recebido** (32 hex) para o campo `golden`. Rodar 2× para confirmar estabilidade.

- [ ] **Step 3: Rodar a bateria completa de determinismo**

Run: `npm run test:determinism`
Expected: PASS, todos os cenários (os 4 antigos com os valores originais).

- [ ] **Step 4: Commit**

```bash
git add tests/determinism/replay.determinism.test.ts tests/determinism/challenge.determinism.test.ts
git commit -m "test(9.9): golden de modo desafio + pinos de determinismo dos modificadores"
```

---

### Task 4: Wiring — fábrica de partida, verificadores e storage

**Files:**
- Modify: `src/render/matchFactory.ts`, `src/services/replay/verify.ts`,
  `src/services/replay/storage.ts`, `src/services/online/verifyChallenge.ts`
- Regenerate: `supabase/functions/verify-challenge/_verify.bundle.js` (via `npm run build:edge`)
- Test: `tests/render/matchFactory.test.ts` (se existir, estender; senão criar),
  `tests/services/replay/verify-challenge-config.test.ts`

**Interfaces:**
- Consumes: `challengeWorldConfig` (Task 1).
- Produces: invariante "as três construções de mundo de desafio usam a mesma config".

- [ ] **Step 1: Escrever os testes que falham**

`tests/services/replay/verify-challenge-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { challengeWorldConfig } from '@core/challenge';
import { verifyReplay } from '@services/replay';
import { verifyChallengeSubmission } from '@services/online/verifyChallenge';

const SEED = 'daily:2026-03-03';
const FLAPS: readonly boolean[] = Array.from({ length: 900 }, (_, i) => i % 6 === 0);
const TL = buildTimeline(FLAPS.length, (i) => FLAPS[i] === true);
const FINAL = simulate(challengeWorldConfig(SEED), TL);

describe('verificadores usam a config de desafio (com modificadores)', () => {
  it('verifyReplay valida um replay simulado em modo desafio', () => {
    const v = verifyReplay({
      mode: 'daily', seed: SEED, timeline: [...FLAPS], finalHash: hashState(FINAL),
      score: FINAL.score, distance: FINAL.distance, food: FINAL.food,
      nearMisses: FINAL.nearMisses, achievedAt: 0,
    });
    expect(v.valid).toBe(true);
  });

  it('verifyReplay rejeita hash de simulação SEM modificadores', () => {
    const noMods = hashState(simulate({ seed: SEED, trait: 'none' }, TL));
    const v = verifyReplay({
      mode: 'daily', seed: SEED, timeline: [...FLAPS], finalHash: noMods,
      score: FINAL.score, distance: FINAL.distance, food: FINAL.food,
      nearMisses: FINAL.nearMisses, achievedAt: 0,
    });
    expect(v.valid).toBe(false);
  });

  it('verifyChallengeSubmission concorda com verifyReplay', () => {
    const v = verifyChallengeSubmission({
      seed: SEED, timeline: [...FLAPS], finalHash: hashState(FINAL),
      score: FINAL.score, distance: FINAL.distance, food: FINAL.food, nearMisses: FINAL.nearMisses,
    });
    expect(v.valid).toBe(true);
  });
});
```

> **Nota para o implementador:** ajuste os campos do objeto `StoredReplay` aos exigidos por
> `src/services/replay/store.ts` (leia o tipo antes de escrever o teste; não invente campos).

Teste de acordo da fábrica — em `tests/render/matchFactory.test.ts` (criar se não existir):

```ts
import { describe, it, expect } from 'vitest';
import { createMatchFactory } from '@render/matchFactory';
import { challengeWorldConfig } from '@core/challenge';
import type { WorldConfig, WorldState } from '@core/sim';

function deps(captured: WorldConfig[]) {
  return {
    randomEndlessSeed: () => 'endless:AAAAAAA',
    dailyChallengeSeed: () => 'daily:2026-03-03',
    weeklyChallengeSeed: () => 'weekly:2026-W10',
    activeTrait: () => 'none' as const,
    createWorld: (c: WorldConfig): WorldState => {
      captured.push(c);
      return {} as WorldState;
    },
  };
}

describe('createMatchFactory — modo desafio', () => {
  it('daily usa exatamente challengeWorldConfig(seed)', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('daily', deps(captured))();
    expect(captured[0]).toEqual(challengeWorldConfig('daily:2026-03-03'));
  });

  it('weekly usa exatamente challengeWorldConfig(seed)', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('weekly', deps(captured))();
    expect(captured[0]).toEqual(challengeWorldConfig('weekly:2026-W10'));
  });

  it('endless NÃO liga a flag de desafio', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('endless', deps(captured))();
    expect(captured[0]?.challenge).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/render/matchFactory.test.ts tests/services/replay`
Expected: FAIL — a fábrica passa `{seed, trait:'none'}` sem `challenge`; `verifyReplay` recomputa
sem modificadores.

- [ ] **Step 3: Trocar as três construções pela config canônica**

`src/render/matchFactory.ts` — no ramo daily/weekly:

```ts
  const seedLabel = mode === 'daily' ? deps.dailyChallengeSeed() : deps.weeklyChallengeSeed();
  // Config canônica ÚNICA (mesma usada por verifyReplay e pela Edge Function anti-cheat).
  return () => ({ world: deps.createWorld(challengeWorldConfig(seedLabel)), seedLabel });
```

(importar `challengeWorldConfig` de `@core/challenge` e atualizar o doc-comment do módulo para
mencionar os modificadores derivados da seed.)

`src/services/replay/verify.ts` — trocar a linha do `simulate`:

```ts
  const world = simulate(challengeWorldConfig(replay.seed), timeline);
```

`src/services/online/verifyChallenge.ts` — idem:

```ts
  const world = simulate(challengeWorldConfig(sub.seed), timeline);
```

Atualizar os dois doc-comments: a re-sim usa `{seed, trait:'none', challenge:true}` e os
modificadores são recomputados da seed.

- [ ] **Step 4: Aposentar os replays antigos**

`src/services/replay/storage.ts`:

```ts
// v3 (9.9): modo desafio aplica modificadores derivados da seed ⇒ os `finalHash` gravados
// antes de 9.9 não recomputam. O bump aposenta os replays antigos em vez de reportá-los inválidos.
export const STORAGE_KEY = 'jurassicrun.replays.v3';
```

- [ ] **Step 5: Regenerar o bundle da Edge Function**

Run: `npm run build:edge`
Expected: "edge bundle escrito."; `git diff --stat supabase/functions/verify-challenge/_verify.bundle.js` mostra o arquivo alterado (deve conter `challengeModifiersForSeed`; confira com
`grep -c challengeModifiersForSeed supabase/functions/verify-challenge/_verify.bundle.js`).

- [ ] **Step 6: Rodar tudo**

Run: `npx vitest run tests/render tests/services tests/online tests/determinism && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/render/matchFactory.ts src/services/replay/verify.ts src/services/replay/storage.ts src/services/online/verifyChallenge.ts supabase/functions/verify-challenge/_verify.bundle.js tests/render/matchFactory.test.ts tests/services/replay/verify-challenge-config.test.ts
git commit -m "feat(9.9): partida e verificadores de desafio usam a config canônica com modificadores"
```

---

### Task 5: i18n + view-model puro do briefing

**Files:**
- Create: `src/app/challenge/brief.ts`
- Modify: `src/i18n/locales/en.json`, `pt-BR.json`, `es.json`, `fr.json`, `de.json`, `it.json`,
  `ja.json`, `ko.json`, `zh.json`, `hi.json`
- Test: `tests/app/challenge/brief.test.ts`

**Interfaces:**
- Consumes: `challengeModifiersForSeed` (Task 1); `LeaderboardEntry` de `@services/leaderboard`;
  `CentralEntry` de `@services/leaderboard`.
- Produces:
  - `type ChallengeRule = { kind: 'weather'; valueKey: string } | { kind: 'bannedPowerup'; valueKey: string } | { kind: 'trait'; valueKey: string }`
  - `interface ChallengeBriefView { seed: string; periodLabel: string; yourBest: number | null; worldBest: number | null; rules: readonly ChallengeRule[] }`
  - `buildChallengeBrief(input: { seed: string; localEntries: readonly { seed: string; score: number }[]; centralEntries: readonly { seed: string; score: number }[] }): ChallengeBriefView`

- [ ] **Step 1: Escrever o teste que falha**

`tests/app/challenge/brief.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildChallengeBrief } from '@app/challenge/brief';
import { challengeModifiersForSeed } from '@core/challenge';

const SEED = 'daily:2026-07-29';

describe('buildChallengeBrief', () => {
  it('extrai o rótulo do período da seed canônica', () => {
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.seed).toBe(SEED);
    expect(v.periodLabel).toBe('2026-07-29');
  });

  it('sem tentativas ⇒ recordes nulos', () => {
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.yourBest).toBeNull();
    expect(v.worldBest).toBeNull();
  });

  it('usa o melhor score DESTA seed, ignorando outras', () => {
    const v = buildChallengeBrief({
      seed: SEED,
      localEntries: [
        { seed: 'daily:2026-07-28', score: 999 },
        { seed: SEED, score: 120 },
      ],
      centralEntries: [
        { seed: SEED, score: 500 },
        { seed: 'daily:2026-07-28', score: 4000 },
      ],
    });
    expect(v.yourBest).toBe(120);
    expect(v.worldBest).toBe(500);
  });

  it('regras refletem os modificadores da seed + traço travado', () => {
    const mods = challengeModifiersForSeed(SEED);
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.rules).toEqual([
      { kind: 'weather', valueKey: `weather.${mods.forcedWeather}` },
      { kind: 'bannedPowerup', valueKey: `powerup.${mods.bannedPowerup}.name` },
      { kind: 'trait', valueKey: 'trait.none.name' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/challenge/brief.test.ts`
Expected: FAIL — módulo `@app/challenge/brief` não existe.

- [ ] **Step 3: Implementar o view-model**

`src/app/challenge/brief.ts`:

```ts
import { challengeModifiersForSeed } from '@core/challenge';

/** Entrada de placar reduzida ao que o briefing precisa (local ou central). */
export interface BriefScore {
  readonly seed: string;
  readonly score: number;
}

/** Regra vigente do desafio. Carrega CHAVES i18n, nunca texto pronto (REGRA 4). */
export type ChallengeRule =
  | { readonly kind: 'weather'; readonly valueKey: string }
  | { readonly kind: 'bannedPowerup'; readonly valueKey: string }
  | { readonly kind: 'trait'; readonly valueKey: string };

/** View-model do briefing: tudo que a tela mostra, sem tocar em DOM/serviços. */
export interface ChallengeBriefView {
  readonly seed: string;
  readonly periodLabel: string;
  readonly yourBest: number | null;
  readonly worldBest: number | null;
  readonly rules: readonly ChallengeRule[];
}

/** Melhor score da seed dada; null se não houver tentativa. */
function bestFor(entries: readonly BriefScore[], seed: string): number | null {
  let best: number | null = null;
  for (const e of entries) {
    if (e.seed !== seed) continue;
    if (best === null || e.score > best) best = e.score;
  }
  return best;
}

/**
 * Monta o briefing de um desafio. PURA: recebe os placares já lidos dos serviços e deriva as
 * regras da própria seed — a mesma função que a simulação usa ⇒ a tela nunca mente sobre as
 * regras.
 */
export function buildChallengeBrief(input: {
  readonly seed: string;
  readonly localEntries: readonly BriefScore[];
  readonly centralEntries: readonly BriefScore[];
}): ChallengeBriefView {
  const { seed, localEntries, centralEntries } = input;
  const mods = challengeModifiersForSeed(seed);
  const colon = seed.indexOf(':');
  return {
    seed,
    periodLabel: colon >= 0 ? seed.slice(colon + 1) : seed,
    yourBest: bestFor(localEntries, seed),
    worldBest: bestFor(centralEntries, seed),
    rules: [
      { kind: 'weather', valueKey: `weather.${mods.forcedWeather}` },
      { kind: 'bannedPowerup', valueKey: `powerup.${mods.bannedPowerup}.name` },
      { kind: 'trait', valueKey: 'trait.none.name' },
    ],
  };
}
```

- [ ] **Step 4: Chaves i18n nos 10 locales**

Adicionar em **cada** `src/i18n/locales/*.json` o bloco `challenge` (chaves idênticas em todos;
traduzir os valores). Inglês como referência:

```json
  "challenge": {
    "brief": {
      "titleDaily": "Daily Challenge",
      "titleWeekly": "Weekly Challenge",
      "subtitle": "Same seed and same rules for everyone.",
      "seed": "Seed",
      "yourBest": "Your best",
      "worldBest": "World best",
      "none": "—",
      "rules": "Today's rules",
      "ruleWeather": "Weather locked: {{value}}",
      "ruleBannedPowerup": "Banned power-up: {{value}}",
      "ruleTrait": "Dino trait: {{value}}",
      "play": "Play"
    }
  }
```

Português (pt-BR): `"titleDaily": "Desafio Diário"`, `"titleWeekly": "Desafio Semanal"`,
`"subtitle": "Mesma semente e mesmas regras para todos."`, `"seed": "Semente"`,
`"yourBest": "Seu recorde"`, `"worldBest": "Recorde mundial"`, `"rules": "Regras de hoje"`,
`"ruleWeather": "Clima travado: {{value}}"`, `"ruleBannedPowerup": "Power-up proibido: {{value}}"`,
`"ruleTrait": "Traço do dino: {{value}}"`, `"play": "Jogar"`.

Traduzir os mesmos campos em es, fr, de, it, ja, ko, zh, hi (use a skill `add-locale` como
referência de estilo/terminologia já adotada nos outros blocos do arquivo).

- [ ] **Step 5: Rodar os testes (inclui a guarda de paridade i18n)**

Run: `npx vitest run tests/app/challenge tests/i18n && npx tsc --noEmit`
Expected: PASS — paridade das 10 línguas verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/challenge/brief.ts src/i18n/locales tests/app/challenge/brief.test.ts
git commit -m "feat(9.9): view-model puro do briefing de desafio + chaves i18n nos 10 locales"
```

---

### Task 6: Tela de briefing + roteamento

**Files:**
- Create: `src/app/screens/ChallengeBrief.tsx`, `src/app/screens/ChallengeScreen.tsx`
- Modify: `src/app/screens/PlayScreen.tsx` (prop `onExit`), `src/app/App.tsx`,
  `src/app/styles/global.css`
- Test: `tests/app/challengeScreen.test.tsx` (siga o padrão dos testes de tela existentes em
  `tests/app/` — mesma forma de render/limpeza)

**Interfaces:**
- Consumes: `buildChallengeBrief`, `ChallengeBriefView` (Task 5); `leaderboardService`
  (`daily`/`weekly`/`centralDaily`/`centralWeekly`); `dailyChallengeSeed`/`weeklyChallengeSeed`
  de `@render/seedSource`; `MatchMode` de `@render/matchFactory`.
- Produces: `ChallengeScreen({ mode }: { mode: 'daily' | 'weekly' })`;
  `PlayScreen` aceita `onExit?: () => void`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/app/challengeScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'preact';
import { ChallengeBrief } from '@app/screens/ChallengeBrief';
import { buildChallengeBrief } from '@app/challenge/brief';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

describe('ChallengeBrief', () => {
  it('mostra seed, as 3 regras e o botão de jogar', () => {
    const view = buildChallengeBrief({
      seed: 'daily:2026-07-29',
      localEntries: [{ seed: 'daily:2026-07-29', score: 42 }],
      centralEntries: [],
    });
    render(<ChallengeBrief mode="daily" view={view} onPlay={() => {}} onBack={() => {}} />, host);
    expect(host.textContent).toContain('2026-07-29');
    expect(host.querySelectorAll('.challenge-brief__rule')).toHaveLength(3);
    expect(host.querySelector('[data-testid="challenge-play"]')).not.toBeNull();
  });

  it('chama onPlay ao clicar em Jogar', () => {
    let played = 0;
    const view = buildChallengeBrief({ seed: 'weekly:2026-W31', localEntries: [], centralEntries: [] });
    render(<ChallengeBrief mode="weekly" view={view} onPlay={() => (played += 1)} onBack={() => {}} />, host);
    host.querySelector<HTMLButtonElement>('[data-testid="challenge-play"]')?.click();
    expect(played).toBe(1);
  });

  it('sem recorde mostra o placeholder de vazio', () => {
    const view = buildChallengeBrief({ seed: 'daily:2026-07-29', localEntries: [], centralEntries: [] });
    render(<ChallengeBrief mode="daily" view={view} onPlay={() => {}} onBack={() => {}} />, host);
    expect(host.querySelector('[data-testid="challenge-yourbest"]')?.textContent).toContain('—');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/challengeScreen.test.tsx`
Expected: FAIL — `@app/screens/ChallengeBrief` não existe.

- [ ] **Step 3: Implementar a apresentação**

`src/app/screens/ChallengeBrief.tsx`:

```tsx
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import type { ChallengeBriefView, ChallengeRule } from '../challenge/brief';

const RULE_LABEL: Record<ChallengeRule['kind'], string> = {
  weather: 'challenge.brief.ruleWeather',
  bannedPowerup: 'challenge.brief.ruleBannedPowerup',
  trait: 'challenge.brief.ruleTrait',
};

function scoreText(value: number | null): string {
  return value === null ? i18n.t('challenge.brief.none') : String(Math.floor(value));
}

export function ChallengeBrief({
  mode, view, onPlay, onBack,
}: {
  mode: 'daily' | 'weekly';
  view: ChallengeBriefView;
  onPlay: () => void;
  onBack: () => void;
}): VNode {
  return (
    <div class="challenge-brief">
      <h1 class="challenge-brief__title">
        {i18n.t(mode === 'daily' ? 'challenge.brief.titleDaily' : 'challenge.brief.titleWeekly')}
      </h1>
      <p class="challenge-brief__subtitle">{i18n.t('challenge.brief.subtitle')}</p>

      <dl class="challenge-brief__stats">
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.seed')}</dt>
          <dd data-testid="challenge-seed">{view.periodLabel}</dd>
        </div>
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.yourBest')}</dt>
          <dd data-testid="challenge-yourbest">{scoreText(view.yourBest)}</dd>
        </div>
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.worldBest')}</dt>
          <dd data-testid="challenge-worldbest">{scoreText(view.worldBest)}</dd>
        </div>
      </dl>

      <h2 class="challenge-brief__rules-title">{i18n.t('challenge.brief.rules')}</h2>
      <ul class="challenge-brief__rules">
        {view.rules.map((rule) => (
          <li class="challenge-brief__rule" key={rule.kind}>
            {i18n.t(RULE_LABEL[rule.kind], { value: i18n.t(rule.valueKey) })}
          </li>
        ))}
      </ul>

      <div class="challenge-brief__actions">
        <button class="btn" data-testid="challenge-play" onClick={onPlay}>
          {i18n.t('challenge.brief.play')}
        </button>
        <button class="btn btn--ghost" onClick={onBack}>
          {i18n.t('nav.back')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implementar a casca com estado e o `onExit` do PlayScreen**

`src/app/screens/ChallengeScreen.tsx`:

```tsx
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import { back } from '../router';
import { leaderboardService } from '@services/leaderboard';
import { dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import { buildChallengeBrief } from '../challenge/brief';
import { ChallengeBrief } from './ChallengeBrief';
import { PlayScreen } from './PlayScreen';

/**
 * Desafio Diário/Semanal: briefing primeiro, jogo depois. A seed é capturada 1× por montagem
 * (a partida e o briefing falam do MESMO período) e "Voltar" no jogo retorna ao briefing.
 */
export function ChallengeScreen({ mode }: { mode: 'daily' | 'weekly' }): VNode {
  const [seed] = useState(() => (mode === 'daily' ? dailyChallengeSeed() : weeklyChallengeSeed()));
  const [playing, setPlaying] = useState(false);

  if (playing) return <PlayScreen mode={mode} onExit={() => setPlaying(false)} />;

  const view = buildChallengeBrief({
    seed,
    localEntries: mode === 'daily' ? leaderboardService.daily.value : leaderboardService.weekly.value,
    centralEntries:
      mode === 'daily' ? leaderboardService.centralDaily.value : leaderboardService.centralWeekly.value,
  });
  return (
    <ChallengeBrief mode={mode} view={view} onPlay={() => setPlaying(true)} onBack={() => back()} />
  );
}
```

Em `src/app/screens/PlayScreen.tsx`, trocar a assinatura e os dois usos de `back()`:

```tsx
export function PlayScreen({
  mode = 'endless',
  onExit,
}: {
  mode?: MatchMode;
  /** Saída da tela: default volta no router; o desafio usa para retornar ao briefing. */
  onExit?: () => void;
}) {
  const exit = onExit ?? back;
```

…e usar `onClick={() => exit()}` no botão de voltar e `onQuit={() => exit()}` no
`GameOverOverlay`.

Em `src/app/App.tsx`: importar `ChallengeScreen` e trocar os dois casos:

```tsx
    case 'daily':
      return <ChallengeScreen mode="daily" />;
    ...
    case 'weekly':
      return <ChallengeScreen mode="weekly" />;
```

- [ ] **Step 5: Estilos**

Em `src/app/styles/global.css`, ao lado dos blocos das outras telas, adicionar estilos para
`.challenge-brief`, `.challenge-brief__title`, `.challenge-brief__subtitle`,
`.challenge-brief__stats`, `.challenge-brief__stat`, `.challenge-brief__rules-title`,
`.challenge-brief__rules`, `.challenge-brief__rule`, `.challenge-brief__actions`, usando os
tokens/variáveis e o padrão de painel já existentes no arquivo (não introduzir cores cruas nem
fontes novas; layout centralizado, funcionando em retrato e paisagem).

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/app && npx tsc --noEmit && npx eslint .`
Expected: PASS / sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/ChallengeBrief.tsx src/app/screens/ChallengeScreen.tsx src/app/screens/PlayScreen.tsx src/app/App.tsx src/app/styles/global.css tests/app/challengeScreen.test.tsx
git commit -m "feat(9.9): tela de briefing de desafio (recorde + regras da seed) antes da partida"
```

---

### Task 7: Fechamento — determinismo, verificação e docs

**Files:**
- Modify: `docs/roadmap/PHASE-09-structural-improvements.md` (marcar 9.9 `[x]`), `CLAUDE.md`
  ("Estado atual": métricas de testes/determinismo, Fase 9 concluída, resumo do item)

- [ ] **Step 1: Bateria completa**

Run: `npm run test:determinism` → PASS
Run: `npm test` → PASS (anotar o total de testes)
Run: `npm run check` → sem erros
Run: `git diff --stat main` → conferir que só os arquivos do item mudaram

- [ ] **Step 2: Auditoria de determinismo**

Rodar a skill `verify-determinism` e o subagente `determinism-guardian` sobre o diff de
`src/core/` (esperado: nenhuma API proibida, nenhuma mutação de estado global, nenhum campo novo
não hasheado).

- [ ] **Step 3: Atualizar docs**

Marcar os 4 checkboxes do item 9.9 no arquivo da fase e atualizar o "Estado atual" do `CLAUDE.md`:
Fase 9 concluída (9.1–9.9), nº de testes e de testes de determinismo corretos, e uma linha
descrevendo 9.9 (modificadores puros por seed + config canônica única + briefing).

- [ ] **Step 4: Commit + integração**

```bash
git add docs/roadmap/PHASE-09-structural-improvements.md CLAUDE.md
git commit -m "docs(9.9): fecha o item e atualiza o estado do projeto"
```

Integrar no `main` (pré-autorizado): PR + merge automático se houver remote GitHub e `gh`;
senão `git merge --no-ff` local e apagar a branch de feature.

## Self-Review

- **Cobertura da spec:** modificadores por seed (T1), aplicação em `createWorld` (T2), goldens de
  desafio (T3), verificadores + bundle + storage (T4), i18n + view-model (T5), briefing e
  roteamento (T6), fechamento/determinismo/docs (T7). Todos os itens de "Aceite" têm task.
- **Sem placeholders:** o único valor a preencher é o hash golden, que **por definição** só existe
  após a 1ª execução — o passo diz como capturá-lo.
- **Consistência de tipos:** `ChallengeModifiers.forcedWeather/bannedPowerup`,
  `challengeModifiersForSeed`, `challengeWorldConfig`, `POWERUP_KINDS`,
  `powerupCatalogExcluding`, `buildChallengeBrief`/`ChallengeBriefView`/`ChallengeRule`,
  `PlayScreen.onExit` — mesmos nomes em todas as tasks que os consomem.
