# Design — Derivação de seeds (item 1.2)

> Fase 1 — Núcleo determinístico headless. Item 1.2 do
> `docs/roadmap/PHASE-01-deterministic-core.md`.

## Objetivo

Produzir, de forma **pura e determinística**, a **seed canônica** (string) de cada modo de
jogo, que é então passada para `createRng` (que já faz o hashing estável via `xmur3`):

- **Endless** — seed aleatória gerada **fora do core**, normalizada para um token exibível.
- **Diária** — `"daily:" + dataUTC(YYYY-MM-DD)`.
- **Semanal** — `"weekly:" + anoISO + "-W" + semanaISO`.

Isto cumpre exatamente o contrato em `docs/architecture/DETERMINISM.md` (regra 3).

## Princípio-chave: derivação produz *string*, não hash

`createRng(seed: string)` já hasheia internamente (`hashSeed`/`xmur3`). Portanto este módulo
**não** hasheia nada — só monta a **string canônica** com namespace por modo. Mantém-se um
único caminho de hashing no projeto (sem duplicar `xmur3`). Consumidor faz:

```ts
const rng = createRng(dailySeed({ year: 2026, month: 6, day: 28 })); // "daily:2026-06-28"
```

## Fronteira de determinismo (decisão importante)

`Date` é **proibido** em `src/core/`. Logo o core opera sobre uma representação de calendário
**pura** (`CalendarDate = { year, month, day }`, UTC), nunca sobre `Date`.

A conversão "relógio de parede → `CalendarDate` UTC" é IO e pertence a uma camada de serviço
**fora do core**. Ela **não** faz parte deste item: o *modo* Diário/Semanal (com relógio real,
fuso UTC e rollover) é da Fase 5 (ver rastreabilidade do ROADMAP: "1 (seeds/core), 5
(modo+local)"). Aqui entregamos apenas a matemática pura + derivação. Mantém o item enxuto e
100% testável sem mocks de tempo.

## Módulo: `src/core/seed/`

Já existe o diretório (`.gitkeep`). Dois arquivos + barrel.

### `calendar.ts` — calendário puro e semana ISO-8601

Tipos:
- `interface CalendarDate { year: number; month: number; day: number }` — `month` 1–12, `day` 1–31, UTC.
- `interface IsoWeek { weekYear: number; week: number }` — ano de numeração ISO + semana 1–53.

Funções puras (só aritmética inteira — sem `Date`, sem float sensível):
- `isLeapYear(year: number): boolean`
- `ordinalDay(date: CalendarDate): number` — dia do ano, 1–366.
- `dayOfWeek(date: CalendarDate): number` — ISO: 1=segunda … 7=domingo (algoritmo de Sakamoto, inteiro).
- `isoWeekOf(date: CalendarDate): IsoWeek` — semana ISO-8601 e seu *week-numbering year*
  (trata semana pertencente ao ano anterior/seguinte: semanas 52/53 e a virada de ano).
- `formatCalendarDate(date: CalendarDate): string` → `"YYYY-MM-DD"` (zero-padded).
- `formatIsoWeek(week: IsoWeek): string` → `"YYYY-Www"` (ex.: `"2026-W26"`, week zero-padded a 2).

### `seed.ts` — derivação da seed canônica

- `type SeedMode = 'endless' | 'daily' | 'weekly'`
- `dailySeed(date: CalendarDate): string` → `"daily:" + formatCalendarDate(date)`
- `weeklySeed(date: CalendarDate): string` → `"weekly:" + formatIsoWeek(isoWeekOf(date))`
- `endlessSeed(token: string): string` → `"endless:" + token` (namespacing; evita colisão com daily/weekly)
- `randomEndlessToken(value: number): string` — formata um `uint32` (fornecido **de fora**,
  da camada não-core via `Math.random`/crypto) num código curto, legível e compartilhável
  (Crockford base32, 7 chars, sem dígitos ambíguos). É o identificador exibível do Endless.

### `index.ts` — barrel

Reexporta `calendar.ts` e `seed.ts`. Adicionar `export * from './seed'` ao não existir; o
`src/core` permanece sem importar DOM/Phaser/IO.

## Geração do Endless (fora do core)

A aleatoriedade do Endless é externa (proibida em core). Fluxo:
`value = (Math.random()*2**32)>>>0` **na camada de app/serviço** → `randomEndlessToken(value)`
→ `endlessSeed(token)` → `createRng(...)`. O token é o que aparece no HUD e o jogador pode
copiar/recolar para rejogar a mesma corrida. (HUD é Fase 2; aqui só a função pura.)

## Testes (Vitest)

Determinismo / reprodutibilidade (em `tests/determinism/` quando provam o contrato; unit em
`tests/core/seed/`):

1. **Mesma data ⇒ mesma seed** (daily e weekly): idempotência.
2. **Datas diferentes ⇒ seeds diferentes** (daily): dias adjacentes geram strings distintas.
3. **Semana ISO**: vetores golden conhecidos, incluindo bordas:
   - 2026-06-28 (domingo) → `2026-W26`.
   - 2021-01-01 (sexta) → `2020-W53` (pertence ao ano anterior).
   - 2024-12-30 (segunda) → `2025-W01` (pertence ao ano seguinte).
   - 2020-12-31 → `2020-W53`; 2016-01-01 → `2015-W53`.
   - Dias da mesma semana ISO ⇒ mesma `weeklySeed` (seg–dom).
4. **Formato**: zero-padding correto (`2026-01-05` → `2026-W02`; semana 1 dígito → `W0n`).
5. **`dayOfWeek`/`isLeapYear`/`ordinalDay`**: vetores conhecidos.
6. **Endless**: `randomEndlessToken` é determinístico (mesmo `value` ⇒ mesmo token); tokens
   distintos para `value` distintos; charset Crockford válido; `endlessSeed` faz round-trip
   (token exibido → mesma seed → mesmo `createRng().state`).
7. **Integração com Rng**: `createRng(dailySeed(d))` reproduz a mesma sequência em duas
   execuções; modos diferentes na mesma data ⇒ estados iniciais distintos (namespacing).
8. **Proibição** (já coberto pelo guard global): nenhum `Date`/`Math.random` em `src/core/seed/`.

## Definição de pronto

- `npm run check` limpo, `npm test` verde, `npm run test:determinism` verde.
- Cobertura alta em `src/core/seed/`. Item 1.2 marcado `[x]`; `CLAUDE.md` "Estado atual"
  atualizado. Branch de feature integrada ao `main`.

## Fora de escopo (YAGNI / fases seguintes)

- Conversão `Date`→`CalendarDate` UTC e relógio real (Fase 5 — modo Diário/Semanal).
- HUD/exibição da seed, copiar/colar (Fase 2).
- Seed customizada digitada pelo jogador (trivial via `endlessSeed`, mas sem UI agora).
