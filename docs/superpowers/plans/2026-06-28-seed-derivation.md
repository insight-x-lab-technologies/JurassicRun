# Seed Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derivar de forma pura e determinística a seed canônica (string) de cada modo — Endless (exibível), Diária (dataUTC), Semanal (semana ISO-8601) — para alimentar `createRng`.

**Architecture:** Novo módulo `src/core/seed/` em TS puro. `calendar.ts` faz a matemática de calendário/semana ISO sobre um `CalendarDate { year, month, day }` (sem `Date`). `seed.ts` monta a string canônica com namespace por modo (`daily:` / `weekly:` / `endless:`); o hashing continua sendo responsabilidade de `createRng` (caminho único). A conversão relógio→`CalendarDate` é fora de escopo (Fase 5).

**Tech Stack:** TypeScript estrito, Vitest. Alias `@core/*` → `src/core/*`.

## Global Constraints

- `src/core/` é TS puro: PROIBIDO `Math.random()`, `Date`, `Date.now()`, `performance.now()`, DOM/IO, imports de `phaser`/`preact`. (Guard duplo: ESLint + `tests/determinism/no-forbidden-apis.determinism.test.ts`.)
- Só aritmética inteira nas funções de calendário (sem float sensível).
- TypeScript estrito, sem `any` sem justificativa.
- Testes importam via alias `@core/...` (ex.: `import { dailySeed } from '@core/seed'`).
- Um commit por task. Mensagens de commit terminam com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## File Structure

- Create `src/core/seed/calendar.ts` — tipos `CalendarDate`/`IsoWeek` + matemática pura (leap, ordinal, dia da semana ISO, semana ISO, formatação).
- Create `src/core/seed/seed.ts` — `SeedMode` + `dailySeed`/`weeklySeed`/`endlessSeed`/`randomEndlessToken`.
- Create `src/core/seed/index.ts` — barrel.
- Delete `src/core/seed/.gitkeep` (substituído por arquivos reais).
- Create `tests/core/seed/calendar.test.ts` — unit da matemática de calendário.
- Create `tests/core/seed/seed.test.ts` — unit da derivação + endless token.
- Create `tests/determinism/seed.determinism.test.ts` — reprodutibilidade e namespacing via `createRng`.

---

### Task 1: Calendar & ISO-week math (`calendar.ts`)

**Files:**
- Create: `src/core/seed/calendar.ts`
- Delete: `src/core/seed/.gitkeep`
- Test: `tests/core/seed/calendar.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface CalendarDate { year: number; month: number; day: number }` (month 1–12, day 1–31, UTC)
  - `interface IsoWeek { weekYear: number; week: number }`
  - `isLeapYear(year: number): boolean`
  - `ordinalDay(date: CalendarDate): number` (1–366)
  - `dayOfWeek(date: CalendarDate): number` (ISO: 1=Mon … 7=Sun)
  - `weeksInYear(year: number): number` (52 ou 53)
  - `isoWeekOf(date: CalendarDate): IsoWeek`
  - `formatCalendarDate(date: CalendarDate): string` → `"YYYY-MM-DD"`
  - `formatIsoWeek(week: IsoWeek): string` → `"YYYY-Www"`

- [ ] **Step 1: Write the failing test**

Create `tests/core/seed/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  ordinalDay,
  dayOfWeek,
  weeksInYear,
  isoWeekOf,
  formatCalendarDate,
  formatIsoWeek,
} from '@core/seed/calendar';

describe('isLeapYear', () => {
  it('reconhece anos bissextos e comuns', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });
});

describe('ordinalDay', () => {
  it('calcula o dia do ano', () => {
    expect(ordinalDay({ year: 2026, month: 1, day: 1 })).toBe(1);
    expect(ordinalDay({ year: 2026, month: 12, day: 31 })).toBe(365);
    expect(ordinalDay({ year: 2024, month: 12, day: 31 })).toBe(366); // bissexto
    expect(ordinalDay({ year: 2024, month: 3, day: 1 })).toBe(61); // pós-29/fev
  });
});

describe('dayOfWeek (ISO 1=seg..7=dom)', () => {
  it('bate com datas conhecidas', () => {
    expect(dayOfWeek({ year: 2026, month: 6, day: 28 })).toBe(7); // domingo
    expect(dayOfWeek({ year: 2021, month: 1, day: 1 })).toBe(5); // sexta
    expect(dayOfWeek({ year: 2024, month: 12, day: 30 })).toBe(1); // segunda
  });
});

describe('weeksInYear', () => {
  it('identifica anos de 53 semanas ISO', () => {
    expect(weeksInYear(2020)).toBe(53);
    expect(weeksInYear(2015)).toBe(53);
    expect(weeksInYear(2026)).toBe(53);
    expect(weeksInYear(2024)).toBe(52);
    expect(weeksInYear(2025)).toBe(52);
  });
});

describe('isoWeekOf', () => {
  it('calcula semana ISO com bordas de virada de ano', () => {
    expect(isoWeekOf({ year: 2026, month: 6, day: 28 })).toEqual({ weekYear: 2026, week: 26 });
    expect(isoWeekOf({ year: 2021, month: 1, day: 1 })).toEqual({ weekYear: 2020, week: 53 });
    expect(isoWeekOf({ year: 2024, month: 12, day: 30 })).toEqual({ weekYear: 2025, week: 1 });
    expect(isoWeekOf({ year: 2020, month: 12, day: 31 })).toEqual({ weekYear: 2020, week: 53 });
    expect(isoWeekOf({ year: 2016, month: 1, day: 1 })).toEqual({ weekYear: 2015, week: 53 });
  });

  it('dá a mesma semana para seg..dom da mesma semana', () => {
    const monday = isoWeekOf({ year: 2026, month: 6, day: 22 });
    const sunday = isoWeekOf({ year: 2026, month: 6, day: 28 });
    expect(monday).toEqual(sunday);
    expect(monday).toEqual({ weekYear: 2026, week: 26 });
  });
});

describe('formatadores', () => {
  it('formata data com zero-padding', () => {
    expect(formatCalendarDate({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
    expect(formatCalendarDate({ year: 2026, month: 12, day: 31 })).toBe('2026-12-31');
  });

  it('formata semana ISO com zero-padding', () => {
    expect(formatIsoWeek({ weekYear: 2026, week: 2 })).toBe('2026-W02');
    expect(formatIsoWeek({ weekYear: 2020, week: 53 })).toBe('2020-W53');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/seed/calendar.test.ts`
Expected: FAIL (não resolve `@core/seed/calendar`).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/seed/calendar.ts`:

```ts
// Matemática de calendário e semana ISO-8601, pura e portável.
// Só aritmética inteira: sem `Date`, sem float sensível.

export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1–12
  readonly day: number; // 1–31
}

export interface IsoWeek {
  readonly weekYear: number;
  readonly week: number; // 1–53
}

// Dias acumulados até o início de cada mês (ano comum).
const CUMULATIVE_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function ordinalDay(date: CalendarDate): number {
  let day = CUMULATIVE_DAYS[date.month - 1]! + date.day;
  if (date.month > 2 && isLeapYear(date.year)) day += 1;
  return day;
}

// Algoritmo de Sakamoto: retorna 0=domingo..6=sábado; remapeado para ISO 1=seg..7=dom.
const SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

export function dayOfWeek(date: CalendarDate): number {
  let y = date.year;
  if (date.month < 3) y -= 1;
  const w =
    (y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) +
      SAKAMOTO[date.month - 1]! +
      date.day) %
    7;
  return w === 0 ? 7 : w;
}

// Dia da semana (0=dom..6=sáb) de 31/dez do ano, via fórmula de Gauss.
function decemberDoomsday(year: number): number {
  return (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400)) % 7;
}

export function weeksInYear(year: number): number {
  return decemberDoomsday(year) === 4 || decemberDoomsday(year - 1) === 3 ? 53 : 52;
}

export function isoWeekOf(date: CalendarDate): IsoWeek {
  const dow = dayOfWeek(date);
  const week = Math.floor((ordinalDay(date) - dow + 10) / 7);
  if (week < 1) {
    const weekYear = date.year - 1;
    return { weekYear, week: weeksInYear(weekYear) };
  }
  if (week > weeksInYear(date.year)) {
    return { weekYear: date.year + 1, week: 1 };
  }
  return { weekYear: date.year, week };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export function formatCalendarDate(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

export function formatIsoWeek(week: IsoWeek): string {
  return `${pad(week.weekYear, 4)}-W${pad(week.week, 2)}`;
}
```

Then delete the placeholder: `git rm src/core/seed/.gitkeep`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/seed/calendar.test.ts`
Expected: PASS (todos os describes verdes).

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: limpo (sem erros de tipo/lint).

- [ ] **Step 6: Commit**

```bash
git add src/core/seed/calendar.ts tests/core/seed/calendar.test.ts
git rm -q src/core/seed/.gitkeep
git commit -m "feat(core/seed): calendário puro + semana ISO-8601

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Seed derivation & endless token (`seed.ts` + barrel)

**Files:**
- Create: `src/core/seed/seed.ts`
- Create: `src/core/seed/index.ts`
- Test: `tests/core/seed/seed.test.ts`

**Interfaces:**
- Consumes (de Task 1, em `@core/seed/calendar`): `CalendarDate`, `formatCalendarDate`, `isoWeekOf`, `formatIsoWeek`.
- Produces:
  - `type SeedMode = 'endless' | 'daily' | 'weekly'`
  - `dailySeed(date: CalendarDate): string` → `"daily:YYYY-MM-DD"`
  - `weeklySeed(date: CalendarDate): string` → `"weekly:YYYY-Www"`
  - `endlessSeed(token: string): string` → `"endless:<token>"`
  - `randomEndlessToken(value: number): string` (uint32 → 7 chars Crockford base32)
  - barrel `@core/seed` reexporta `calendar` e `seed`.

- [ ] **Step 1: Write the failing test**

Create `tests/core/seed/seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

describe('dailySeed', () => {
  it('monta a string canônica diária', () => {
    expect(dailySeed({ year: 2026, month: 6, day: 28 })).toBe('daily:2026-06-28');
    expect(dailySeed({ year: 2026, month: 1, day: 5 })).toBe('daily:2026-01-05');
  });

  it('mesma data ⇒ mesma seed; datas diferentes ⇒ seeds diferentes', () => {
    const a = dailySeed({ year: 2026, month: 6, day: 28 });
    const b = dailySeed({ year: 2026, month: 6, day: 28 });
    const c = dailySeed({ year: 2026, month: 6, day: 29 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('weeklySeed', () => {
  it('monta a string canônica semanal', () => {
    expect(weeklySeed({ year: 2026, month: 6, day: 28 })).toBe('weekly:2026-W26');
    expect(weeklySeed({ year: 2021, month: 1, day: 1 })).toBe('weekly:2020-W53');
  });

  it('dias da mesma semana ISO ⇒ mesma seed; semanas diferentes ⇒ diferentes', () => {
    const monday = weeklySeed({ year: 2026, month: 6, day: 22 });
    const sunday = weeklySeed({ year: 2026, month: 6, day: 28 });
    const nextWeek = weeklySeed({ year: 2026, month: 6, day: 29 });
    expect(monday).toBe(sunday);
    expect(monday).not.toBe(nextWeek);
  });
});

describe('endlessSeed', () => {
  it('faz namespacing do token', () => {
    expect(endlessSeed('K7P2QXM')).toBe('endless:K7P2QXM');
  });

  it('não colide com daily/weekly do mesmo texto', () => {
    expect(endlessSeed('2026-06-28')).not.toBe(dailySeed({ year: 2026, month: 6, day: 28 }));
  });
});

describe('randomEndlessToken', () => {
  it('é determinístico: mesmo value ⇒ mesmo token', () => {
    expect(randomEndlessToken(123456789)).toBe(randomEndlessToken(123456789));
  });

  it('tem 7 chars do charset Crockford (sem I,L,O,U)', () => {
    const token = randomEndlessToken(0xdeadbeef);
    expect(token).toHaveLength(7);
    expect(token).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{7}$/);
  });

  it('values distintos ⇒ tokens distintos', () => {
    expect(randomEndlessToken(0)).not.toBe(randomEndlessToken(1));
  });

  it('value 0 ⇒ token todo-zero', () => {
    expect(randomEndlessToken(0)).toBe('0000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/seed/seed.test.ts`
Expected: FAIL (não resolve `@core/seed` para `dailySeed` etc.).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/seed/seed.ts`:

```ts
// Derivação da seed canônica (string) por modo de jogo.
// NÃO hasheia: `createRng` (em @core/rng) já hasheia a string via xmur3.
// A aleatoriedade do Endless vem de FORA do core (Math.random/crypto na camada de app).

import { type CalendarDate, formatCalendarDate, formatIsoWeek, isoWeekOf } from './calendar';

export type SeedMode = 'endless' | 'daily' | 'weekly';

/** Seed canônica do Desafio Diário: `"daily:YYYY-MM-DD"` (data UTC). */
export function dailySeed(date: CalendarDate): string {
  return `daily:${formatCalendarDate(date)}`;
}

/** Seed canônica do Desafio Semanal: `"weekly:YYYY-Www"` (semana ISO-8601). */
export function weeklySeed(date: CalendarDate): string {
  return `weekly:${formatIsoWeek(isoWeekOf(date))}`;
}

/** Seed canônica do Endless a partir de um token exibível. */
export function endlessSeed(token: string): string {
  return `endless:${token}`;
}

// Crockford base32: sem I, L, O, U (evita ambiguidade visual).
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Formata um uint32 (gerado FORA do core) num token Endless de 7 chars,
 * legível e compartilhável. Determinístico: mesmo value ⇒ mesmo token.
 */
export function randomEndlessToken(value: number): string {
  let v = value >>> 0;
  let out = '';
  for (let i = 0; i < 7; i++) {
    out = CROCKFORD[v & 0x1f]! + out;
    v = Math.floor(v / 32);
  }
  return out;
}
```

Create `src/core/seed/index.ts`:

```ts
export * from './calendar';
export * from './seed';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/seed/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add src/core/seed/seed.ts src/core/seed/index.ts tests/core/seed/seed.test.ts
git commit -m "feat(core/seed): derivação de seed canônica (endless/diária/semanal)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Determinism integration with `createRng`

**Files:**
- Test: `tests/determinism/seed.determinism.test.ts`

**Interfaces:**
- Consumes: `dailySeed`, `weeklySeed`, `endlessSeed`, `randomEndlessToken` (de `@core/seed`); `createRng` (de `@core/rng`).
- Produces: nada (só testes — prova do contrato no CI via `test:determinism`).

- [ ] **Step 1: Write the failing test**

Create `tests/determinism/seed.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

function firstN(seed: string, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.nextUint32());
}

describe('seed derivation × Rng (determinismo)', () => {
  it('mesma data ⇒ mesma sequência do Rng', () => {
    const date = { year: 2026, month: 6, day: 28 } as const;
    expect(firstN(dailySeed(date), 8)).toEqual(firstN(dailySeed(date), 8));
  });

  it('modos diferentes na mesma data ⇒ estados iniciais distintos (namespacing)', () => {
    const date = { year: 2026, month: 6, day: 28 } as const;
    const daily = createRng(dailySeed(date)).state;
    const weekly = createRng(weeklySeed(date)).state;
    const endless = createRng(endlessSeed('2026-06-28')).state;
    expect(new Set([daily, weekly, endless]).size).toBe(3);
  });

  it('token Endless faz round-trip: token exibido ⇒ mesma seed ⇒ mesmo estado', () => {
    const token = randomEndlessToken(0xdeadbeef);
    const a = createRng(endlessSeed(token)).state;
    const b = createRng(endlessSeed(token)).state;
    expect(a).toBe(b);
  });

  it('dias diferentes ⇒ sequências diferentes', () => {
    const d1 = firstN(dailySeed({ year: 2026, month: 6, day: 28 }), 4);
    const d2 = firstN(dailySeed({ year: 2026, month: 6, day: 29 }), 4);
    expect(d1).not.toEqual(d2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/determinism/seed.determinism.test.ts`
Expected: FAIL antes de Task 1/2 estarem mergeadas; após elas, este teste deve PASSAR já no Step 1 (é integração de unidades existentes). Se passar de primeira, confirme que está exercitando o caminho certo rodando-o e lendo a saída.

- [ ] **Step 3: (sem implementação nova)**

Nenhum código de produção: este task só adiciona a prova de determinismo da integração. Se algum assert falhar, é bug real em Task 1/2 — corrija lá (systematic-debugging), não relaxe o teste.

- [ ] **Step 4: Run full determinism + check**

Run: `npm run test:determinism`
Expected: PASS (inclui a nova suíte).
Run: `npm run check`
Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add tests/determinism/seed.determinism.test.ts
git commit -m "test(core/seed): determinismo da derivação × createRng

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (após as 3 tasks)

- [ ] `npm test` — toda a suíte verde.
- [ ] `npm run check` — typecheck + lint limpos.
- [ ] `npm run test:determinism` — bateria de determinismo verde.
- [ ] Marcar item 1.2 como `[x]` em `docs/roadmap/PHASE-01-deterministic-core.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md`.
- [ ] Integrar branch `feat/1.2-seed-derivation` no `main` (PR + merge se houver remote `gh`; senão merge local `--no-ff`).
