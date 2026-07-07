# Modo Desafio (Diário/Semanal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar jogáveis os modos Desafio Diário (seed do dia UTC) e Semanal (seed da semana ISO), com a seed do desafio no HUD, reaproveitando o Endless existente.

**Architecture:** Padrão puro × casca. A conversão relógio→`CalendarDate` UTC (adiada da Fase 1) e as seeds de desafio entram em `src/render/seedSource.ts`. Uma fábrica de partida pura por modo (`matchFactory.ts`) mapeia modo→seed/trait. A fiação (`startGame`, `PlayScreen`, `App`) passa o modo. **`src/core/` não é tocado** ⇒ determinismo 67 intacto.

**Tech Stack:** TypeScript estrito, Vitest, Preact/signals, Phaser (casca), aliases `@core`/`@render`/`@services`.

## Global Constraints

- `src/core/` é intocado neste item; nenhuma fonte proibida (`Math.random`/`Date`/`performance.now`) entra em `src/core/`. `Date` é permitido em `src/render/` (casca), como já ocorre em `seedSource`/`match`.
- TypeScript estrito; sem `any` sem justificativa. Sem strings visíveis hardcoded (nenhuma nova neste item).
- Determinismo: mesma seed + inputs ⇒ mesmo estado. A bateria `npm run test:determinism` deve continuar verde sem re-pin.
- Commits pequenos, um por task, na branch `feat/5.1-challenge-mode`. Mensagens terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Verificação por task: `npm run check` limpo e `npm test` verde.

---

### Task 1: Derivação relógio→seed de desafio (`seedSource.ts`)

**Files:**
- Modify: `src/render/seedSource.ts`
- Test: `tests/render/seedSource.test.ts`

**Interfaces:**
- Consumes: `@core/seed` → `dailySeed(date: CalendarDate): string`, `weeklySeed(date: CalendarDate): string`, `type CalendarDate`.
- Produces:
  - `utcCalendarDateFromMs(ms: number): CalendarDate` (pura)
  - `dailyChallengeSeedForMs(ms: number): string` (pura)
  - `weeklyChallengeSeedForMs(ms: number): string` (pura)
  - `dailyChallengeSeed(): string` (casca, lê `Date.now()`)
  - `weeklyChallengeSeed(): string` (casca, lê `Date.now()`)

- [ ] **Step 1: Write the failing test** — acrescente ao final de `tests/render/seedSource.test.ts`:

```ts
import {
  utcCalendarDateFromMs,
  dailyChallengeSeedForMs,
  weeklyChallengeSeedForMs,
} from '@render/seedSource';

describe('utcCalendarDateFromMs', () => {
  it('converte epoch ms → CalendarDate em UTC', () => {
    // 2026-07-07T00:00:00Z
    expect(utcCalendarDateFromMs(Date.UTC(2026, 6, 7))).toEqual({ year: 2026, month: 7, day: 7 });
    // meio-dia UTC não muda o dia
    expect(utcCalendarDateFromMs(Date.UTC(2026, 6, 7, 12, 0, 0))).toEqual({
      year: 2026,
      month: 7,
      day: 7,
    });
    // virada de ano: 2025-12-31T23:59:59Z
    expect(utcCalendarDateFromMs(Date.UTC(2025, 11, 31, 23, 59, 59))).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describe('dailyChallengeSeedForMs / weeklyChallengeSeedForMs', () => {
  it('compõem a seed canônica do dia/semana em UTC', () => {
    const ms = Date.UTC(2026, 6, 7); // terça, 2026-07-07 → ISO 2026-W28
    expect(dailyChallengeSeedForMs(ms)).toBe('daily:2026-07-07');
    expect(weeklyChallengeSeedForMs(ms)).toBe('weekly:2026-W28');
  });

  it('borda de semana ISO: 2027-01-01 pertence à semana 53 de 2026', () => {
    const ms = Date.UTC(2027, 0, 1); // sexta → ISO 2026-W53
    expect(dailyChallengeSeedForMs(ms)).toBe('daily:2027-01-01');
    expect(weeklyChallengeSeedForMs(ms)).toBe('weekly:2026-W53');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/seedSource.test.ts`
Expected: FAIL — `utcCalendarDateFromMs is not a function` (export inexistente).

- [ ] **Step 3: Write minimal implementation** — em `src/render/seedSource.ts`, ajuste o import e acrescente as funções:

```ts
import { type CalendarDate, dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

// ... (endlessSeedFromUint32 e randomEndlessSeed existentes permanecem) ...

/** Parte PURA: epoch ms → CalendarDate em UTC (usa os getters UTC de Date; determinística). */
export function utcCalendarDateFromMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Parte PURA: epoch ms → seed canônica do Desafio Diário (`daily:AAAA-MM-DD` UTC). */
export function dailyChallengeSeedForMs(ms: number): string {
  return dailySeed(utcCalendarDateFromMs(ms));
}

/** Parte PURA: epoch ms → seed canônica do Desafio Semanal (`weekly:AAAA-Www` ISO/UTC). */
export function weeklyChallengeSeedForMs(ms: number): string {
  return weeklySeed(utcCalendarDateFromMs(ms));
}

/** Casca: seed do Desafio Diário de HOJE (relógio UTC). Fora do core (permitido). */
export function dailyChallengeSeed(): string {
  return dailyChallengeSeedForMs(Date.now());
}

/** Casca: seed do Desafio Semanal desta semana (relógio UTC). Fora do core (permitido). */
export function weeklyChallengeSeed(): string {
  return weeklyChallengeSeedForMs(Date.now());
}
```

(O import de `@core/seed` já traz `endlessSeed`/`randomEndlessToken`; apenas adicione `type CalendarDate, dailySeed, weeklySeed`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/seedSource.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/render/seedSource.ts tests/render/seedSource.test.ts
git commit -m "feat(5.1): seeds de desafio diário/semanal do relógio UTC (fora do core)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Fábrica de partida por modo (`matchFactory.ts`)

**Files:**
- Create: `src/render/matchFactory.ts`
- Test: `tests/render/matchFactory.test.ts`
- (Referência de tipos: `src/render/match.ts` exporta `MatchInit`; `src/core/sim` exporta `WorldState`, `WorldConfig`, `createWorld`; `@core/dino` exporta `DinoTrait`.)

**Interfaces:**
- Consumes: `MatchInit` de `@render/match`; `WorldState`, `WorldConfig` de `@core/sim`; `DinoTrait` de `@core/dino`.
- Produces:
  - `type MatchMode = 'endless' | 'daily' | 'weekly'`
  - `interface MatchFactoryDeps { randomEndlessSeed: () => string; dailyChallengeSeed: () => string; weeklyChallengeSeed: () => string; activeTrait: () => DinoTrait; createWorld: (config: WorldConfig) => WorldState }`
  - `createMatchFactory(mode: MatchMode, deps: MatchFactoryDeps): () => MatchInit`

- [ ] **Step 1: Write the failing test** — crie `tests/render/matchFactory.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMatchFactory, type MatchFactoryDeps } from '@render/matchFactory';
import type { WorldConfig, WorldState } from '@core/sim';

// createWorld fake: devolve um WorldState-marcador carregando a config recebida.
function fakeDeps(overrides: Partial<MatchFactoryDeps> = {}): MatchFactoryDeps {
  let endlessN = 0;
  return {
    randomEndlessSeed: () => `endless:R${endlessN++}`,
    dailyChallengeSeed: vi.fn(() => 'daily:2026-07-07'),
    weeklyChallengeSeed: vi.fn(() => 'weekly:2026-W28'),
    activeTrait: () => 'magnet',
    createWorld: (config: WorldConfig) => ({ __config: config }) as unknown as WorldState,
    ...overrides,
  };
}

describe('createMatchFactory', () => {
  it('endless: sorteia nova seed a cada chamada e usa o trait ativo', () => {
    const factory = createMatchFactory('endless', fakeDeps());
    const a = factory();
    const b = factory();
    expect(a.seedLabel).toBe('endless:R0');
    expect(b.seedLabel).toBe('endless:R1');
    expect((a.world as unknown as { __config: WorldConfig }).__config).toEqual({
      seed: 'endless:R0',
      trait: 'magnet',
    });
  });

  it('daily: captura a seed 1× (restart replaya) e força trait none', () => {
    const deps = fakeDeps();
    const factory = createMatchFactory('daily', deps);
    const a = factory();
    const b = factory();
    expect(a.seedLabel).toBe('daily:2026-07-07');
    expect(b.seedLabel).toBe('daily:2026-07-07'); // mesma seed no restart
    expect(deps.dailyChallengeSeed).toHaveBeenCalledTimes(1); // resolvida só na criação
    expect((a.world as unknown as { __config: WorldConfig }).__config).toEqual({
      seed: 'daily:2026-07-07',
      trait: 'none',
    });
  });

  it('weekly: captura a seed 1× e força trait none', () => {
    const deps = fakeDeps();
    const factory = createMatchFactory('weekly', deps);
    expect(factory().seedLabel).toBe('weekly:2026-W28');
    expect(factory().seedLabel).toBe('weekly:2026-W28');
    expect(deps.weeklyChallengeSeed).toHaveBeenCalledTimes(1);
    expect((factory().world as unknown as { __config: WorldConfig }).__config.trait).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/matchFactory.test.ts`
Expected: FAIL — módulo `@render/matchFactory` inexistente.

- [ ] **Step 3: Write minimal implementation** — crie `src/render/matchFactory.ts`:

```ts
import type { WorldConfig, WorldState } from '@core/sim';
import type { DinoTrait } from '@core/dino';
import type { MatchInit } from './match';

export type MatchMode = 'endless' | 'daily' | 'weekly';

export interface MatchFactoryDeps {
  /** Casca: novo seed Endless aleatório por chamada. */
  randomEndlessSeed: () => string;
  /** Casca: seed do Desafio Diário de hoje (UTC). */
  dailyChallengeSeed: () => string;
  /** Casca: seed do Desafio Semanal desta semana (UTC). */
  weeklyChallengeSeed: () => string;
  /** Trait do dino ativo do Ninho (usado só no Endless). */
  activeTrait: () => DinoTrait;
  createWorld: (config: WorldConfig) => WorldState;
}

/**
 * Fábrica de `MatchInit` por modo (PURA dado `deps`).
 * - endless: nova seed aleatória por (re)start; trait = dino ativo.
 * - daily/weekly: seed do desafio capturada 1× aqui (restart replaya a mesma);
 *   trait forçado a 'none' (corrida justa e reproduzível só por seed+inputs).
 */
export function createMatchFactory(mode: MatchMode, deps: MatchFactoryDeps): () => MatchInit {
  if (mode === 'endless') {
    return () => {
      const seedLabel = deps.randomEndlessSeed();
      return { world: deps.createWorld({ seed: seedLabel, trait: deps.activeTrait() }), seedLabel };
    };
  }
  const seedLabel = mode === 'daily' ? deps.dailyChallengeSeed() : deps.weeklyChallengeSeed();
  return () => ({ world: deps.createWorld({ seed: seedLabel, trait: 'none' }), seedLabel });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/matchFactory.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/render/matchFactory.ts tests/render/matchFactory.test.ts
git commit -m "feat(5.1): fábrica de partida por modo (endless/daily/weekly)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Fiar o modo na UI (`startGame`, `PlayScreen`, `App`)

**Files:**
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/screens/PlayScreen.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/app/App.challenge.test.tsx` (novo smoke)

**Interfaces:**
- Consumes: `createMatchFactory`, `type MatchMode` de `@render/matchFactory`; `dailyChallengeSeed`, `weeklyChallengeSeed`, `randomEndlessSeed` de `@render/seedSource`.
- Produces: `startGame(container, mode?)` com `mode: MatchMode = 'endless'`; `PlayScreen` aceita `{ mode?: MatchMode }`.

- [ ] **Step 1: Refatore `startGame` para usar a fábrica e aceitar o modo** — substitua o corpo de `src/app/game/startGame.ts`:

```ts
import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController } from '@render/match';
import { createMatchFactory, type MatchMode } from '@render/matchFactory';
import { randomEndlessSeed, dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';
import { nestService } from '@services/nest';
import { walletService, coinsForFood } from '@services/wallet';
import { trophyService } from '@services/trophy';

/**
 * Monta o jogo Phaser no `container` no `mode` dado (endless por default) e devolve um
 * `stop()` que o destrói e remove os listeners.
 */
export function startGame(container: HTMLElement, mode: MatchMode = 'endless'): () => void {
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset();

  const factory = createMatchFactory(mode, {
    randomEndlessSeed,
    dailyChallengeSeed,
    weeklyChallengeSeed,
    activeTrait: () => nestService.activeTrait(),
    createWorld,
  });

  const match = new MatchController(flap, factory, {
    onNewMatch: () => flap.reset(),
    onGameOver: (w) => {
      walletService.earn(coinsForFood(w.food));
      trophyService.recordMatch({
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        score: w.score,
      });
    },
  });

  const game = createGame(container, match, { pause });
  const cleanupControls = bindGameControls(window, {
    flap,
    pause,
    onFlap: () => match.notifyFlap(),
    onRestart: () => match.restart(),
    isDead: () => match.phase === 'dead',
  });

  return () => {
    cleanupControls();
    game.destroy(true);
  };
}
```

- [ ] **Step 2: Faça `PlayScreen` aceitar e propagar o modo** — em `src/app/screens/PlayScreen.tsx`, substitua a assinatura/effect:

```tsx
import { useLayoutEffect, useRef } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';
import type { MatchMode } from '@render/matchFactory';

export function PlayScreen({ mode = 'endless' }: { mode?: MatchMode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      stop = startGame(el, mode);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode]);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
    </div>
  );
}
```

- [ ] **Step 3: Roteie `daily`/`weekly` para o jogo** — em `src/app/App.tsx`, troque os três casos:

```tsx
    case 'play':
      return <PlayScreen mode="endless" />;
    case 'profile':
      return <ProfileScreen />;
    case 'daily':
      return <PlayScreen mode="daily" />;
    case 'weekly':
      return <PlayScreen mode="weekly" />;
```

(Remova o import agora não usado `PlaceholderScreen` **apenas se** não houver outro caso usando-o — `leaderboard` ainda usa `PlaceholderScreen`, então **mantenha** o import.)

- [ ] **Step 4: Write the smoke test** — crie `tests/app/App.challenge.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { navigate, resetToHome } from '@app/router';
import { profileService } from '@services/profile';

// startGame é dinâmico e monta Phaser; interceptamos para o smoke não subir WebGL.
vi.mock('@app/game/startGame', () => ({ startGame: vi.fn(() => () => {}) }));

describe('App — rotas de desafio', () => {
  beforeEach(() => {
    resetToHome();
    profileService.init(); // garante um perfil ativo (ou onboarding); ver nota abaixo
  });

  it('renderiza a PlayScreen (canvas) nas rotas daily e weekly', async () => {
    // pré-condição: um perfil ativo para passar do onboarding
    if (profileService.activeProfile.value === null) profileService.create('Tester');

    const host = document.createElement('div');
    navigate('daily');
    render(<App />, host);
    await Promise.resolve();
    expect(host.querySelector('.play-screen__canvas')).not.toBeNull();

    navigate('weekly');
    render(<App />, host);
    await Promise.resolve();
    expect(host.querySelector('.play-screen__canvas')).not.toBeNull();

    render(null, host); // cleanup
  });
});
```

Nota de ambiente (do 4.1/4.2): testes de componente usam `happy-dom`; `@preact/signals`
pode não flushar num `render` síncrono — por isso o `await Promise.resolve()`. Se
`profileService.init()`/`create` já foi feito por outro teste no mesmo processo, o guard
`if (... === null)` evita erro. Ajuste o import do `resetToHome` se o nome exportado no
router diferir (verifique `src/app/router/router.ts`).

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/app/App.challenge.test.tsx && npm run check`
Expected: PASS + typecheck limpo. Se o smoke de App for instável no ambiente de signals,
reduza-o a asserção de que `screenFor('daily')`/`screenFor('weekly')` produzem um VNode de
`PlayScreen` (importe `PlayScreen` e cheque `vnode.type === PlayScreen` e `vnode.props.mode`).

- [ ] **Step 6: Full suite**

Run: `npm test`
Expected: verde (todos os testes).

- [ ] **Step 7: Commit**

```bash
git add src/app/game/startGame.ts src/app/screens/PlayScreen.tsx src/app/App.tsx tests/app/App.challenge.test.tsx
git commit -m "feat(5.1): rotas Diário/Semanal lançam o jogo com a seed do desafio

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após as 3 tasks)

- [ ] `npm run check` limpo.
- [ ] `npm test` verde.
- [ ] `npm run test:determinism` verde (salvaguarda — nenhuma mudança em `src/core/`).
- [ ] Verificação visual (Playwright, opcional mas recomendada): Home → "Diário" → HUD mostra `Seed: daily:AAAA-MM-DD`; morte + restart mantém a mesma seed; "Semanal" mostra `weekly:AAAA-Www`.
- [ ] Marcar 5.1 como `[x]` em `docs/roadmap/PHASE-05-challenges-local.md` e atualizar "Estado atual" no `CLAUDE.md`.

## Self-review (cobertura da spec)

- Seed diária/semanal UTC → Task 1 (`daily/weeklyChallengeSeedForMs` + casca). ✅
- HUD mostra a seed do desafio → já renderiza `seedLabel`; Task 3 garante que o `seedLabel` do desafio chega ao HUD via `MatchController`. ✅
- Trait fixado em 'none' nos desafios (reprodutibilidade 5.4) → Task 2. ✅
- Seed capturada 1× / restart replaya → Task 2 (teste `toHaveBeenCalledTimes(1)`). ✅
- Endless inalterado (nova seed + trait ativo) → Task 2 + Task 3. ✅
- Core intocado / determinismo intacto → nenhuma task toca `src/core/`; verificação final roda a bateria. ✅
- Regra rankeável "melhor tentativa" → documentada na spec; implementação em 5.2 (fora de escopo). ✅
