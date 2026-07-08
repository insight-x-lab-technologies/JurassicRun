# Troféu de pódio do Desafio Diário (5.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conceder um troféu `dailyPodium` quando a corrida de Desafio Diário fica no top-3 do leaderboard diário local.

**Architecture:** Estende o predicado puro do troféu de `(stats)=>boolean` para `(ctx)=>boolean` com `ctx={stats, dailyRank?}` (mesma unificação do 4.7). O `dailyRank` é derivado do leaderboard diário (nova função `rankOf`), transiente por partida, injetado na orquestração `onGameOver`. Nenhum arquivo de `src/core/` é tocado.

**Tech Stack:** TypeScript estrito, Vitest, `@preact/signals`, i18next (10 locales).

## Global Constraints

- **Determinismo:** NÃO tocar `src/core/`. Determinismo permanece **67**, sem re-pin de goldens.
- **i18n (REGRA 4):** nenhuma string visível hardcoded; chaves em todos os **10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`); paridade validada por `tests/i18n/locales.test.ts`.
- **TypeScript estrito** com `exactOptionalPropertyTypes`: propriedades opcionais como `dailyRank?` só podem receber valor definido — construir o objeto `extra` **condicionalmente**, nunca passar `{ dailyRank: undefined }`.
- **Imutabilidade:** funções de store puras, não mutam a entrada; devolvem a MESMA ref quando nada muda.
- **Escopo:** só o **Diário**. Endless/Semanal não ganham pódio.
- Comandos: `npm test` (Vitest), `npm run check` (typecheck+lint). Rodar da raiz do repo.

---

### Task 1: Leaderboard expõe o rank de uma seed

**Files:**
- Modify: `src/services/leaderboard/store.ts` (adicionar `rankOf`)
- Modify: `src/services/leaderboard/index.ts` (adicionar método `dailyRankForSeed`)
- Test: `tests/services/leaderboard/store.test.ts` (adicionar bloco `rankOf`)
- Test: `tests/services/leaderboard/index.test.ts` (adicionar teste `dailyRankForSeed`)

**Interfaces:**
- Produces:
  - `rankOf(list: readonly LeaderboardEntry[], seed: string): number | undefined` — posição 1-based da entrada com essa seed na lista (já ranqueada); `undefined` se ausente.
  - `LeaderboardService.dailyRankForSeed(seed: string): number | undefined` — `= rankOf(this._state.value.daily, seed)`.

- [ ] **Step 1: Escrever o teste que falha — `rankOf`**

Adicionar ao fim de `tests/services/leaderboard/store.test.ts`. Nota: no modo `daily`, a `insertPeriodic` dedup por seed e ranqueia por score desc, então a ordem reflete os melhores dias.

```ts
import { rankOf } from '@services/leaderboard/store';

describe('rankOf', () => {
  it('retorna a posição 1-based na lista diária ranqueada por score', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-05', score: 10 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-06', score: 30 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 20 }));
    // ranqueado: 07-06 (30) > 07-07 (20) > 07-05 (10)
    expect(rankOf(s.daily, 'daily:2026-07-06')).toBe(1);
    expect(rankOf(s.daily, 'daily:2026-07-07')).toBe(2);
    expect(rankOf(s.daily, 'daily:2026-07-05')).toBe(3);
  });

  it('retorna undefined para seed ausente', () => {
    const s = initialLeaderboardState();
    expect(rankOf(s.daily, 'daily:nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/services/leaderboard/store.test.ts`
Expected: FAIL — `rankOf` não exportado / não é função.

- [ ] **Step 3: Implementar `rankOf`**

Adicionar em `src/services/leaderboard/store.ts` (perto dos outros helpers exportados, ex.: após `recordMatch`):

```ts
/** Posição 1-based da entrada com essa seed na lista (já ranqueada); undefined se ausente. */
export function rankOf(list: readonly LeaderboardEntry[], seed: string): number | undefined {
  const idx = list.findIndex((e) => e.seed === seed);
  return idx === -1 ? undefined : idx + 1;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/services/leaderboard/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste que falha — `dailyRankForSeed`**

Adicionar em `tests/services/leaderboard/index.test.ts` (usa `memoryLeaderboardStorage` no `init`, como os testes vizinhos). Verificar o import de `memoryLeaderboardStorage` já presente no arquivo; se não, adicioná-lo de `@services/leaderboard/storage`.

```ts
describe('dailyRankForSeed', () => {
  it('reflete o rank da seed diária após recordMatch; undefined se ausente', () => {
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage());
    svc.recordMatch({ mode: 'daily', seed: 'daily:A', score: 10, distance: 0, food: 0, nearMisses: 0, level: 1, achievedAt: 1 });
    svc.recordMatch({ mode: 'daily', seed: 'daily:B', score: 50, distance: 0, food: 0, nearMisses: 0, level: 1, achievedAt: 2 });
    expect(svc.dailyRankForSeed('daily:B')).toBe(1);
    expect(svc.dailyRankForSeed('daily:A')).toBe(2);
    expect(svc.dailyRankForSeed('daily:missing')).toBeUndefined();
  });
});
```

(Se o arquivo `index.test.ts` já importa `LeaderboardService` e `memoryLeaderboardStorage`, reutilizar; senão adicionar os imports no topo.)

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test -- tests/services/leaderboard/index.test.ts`
Expected: FAIL — `dailyRankForSeed` não é função.

- [ ] **Step 7: Implementar `dailyRankForSeed`**

Em `src/services/leaderboard/index.ts`: importar `rankOf` do `./store` (juntar ao import existente de `./store`) e adicionar o método à classe:

```ts
/** Rank 1-based do recorde diário dessa seed; undefined se não houver. */
dailyRankForSeed(seed: string): number | undefined {
  return rankOf(this._state.value.daily, seed);
}
```

- [ ] **Step 8: Rodar e ver passar + suíte de leaderboard**

Run: `npm test -- tests/services/leaderboard`
Expected: PASS (todos).

- [ ] **Step 9: Commit**

```bash
git add src/services/leaderboard/store.ts src/services/leaderboard/index.ts tests/services/leaderboard/
git commit -m "feat(5.3): rankOf + dailyRankForSeed no leaderboard"
```

---

### Task 2: Troféu por contexto — predicado passa a receber `{stats, dailyRank?}` + troféu `dailyPodium`

**Files:**
- Modify: `src/services/trophy/store.ts` (novo `TrophyEvalContext`; `evaluate`/`recordMatch` recebem contexto)
- Modify: `src/services/trophy/catalog.ts` (condition passa a `(ctx)=>...`; adicionar `dailyPodium` + `PODIUM_RANK`)
- Test: `tests/services/trophy/store.test.ts` (ajustar chamadas de `evaluate` + novos testes de `dailyPodium`)

**Interfaces:**
- Consumes: nada de Task 1 (independente).
- Produces:
  - `TrophyEvalContext { readonly stats: TrophyStats; readonly dailyRank?: number }`
  - `TrophyDef.condition: (ctx: TrophyEvalContext) => boolean`
  - `evaluate(state: TrophyState, ctx: TrophyEvalContext): { state; newlyUnlocked }`
  - `recordMatch(state: TrophyState, m: MatchSummary, extra?: { readonly dailyRank?: number }): { state; newlyUnlocked }`
  - Catálogo com `{ id: 'dailyPodium', condition: (ctx) => ctx.dailyRank !== undefined && ctx.dailyRank <= PODIUM_RANK }`, `PODIUM_RANK = 3`.

- [ ] **Step 1: Escrever os testes que falham**

No `tests/services/trophy/store.test.ts`:

(a) O bloco `evaluate` existente chama `evaluate(st)` com 1 argumento — passará a exigir o contexto. Atualizar essas chamadas para passar o contexto a partir do próprio `st.stats`:

```ts
// dentro do describe('evaluate'):
const r1 = evaluate(st, { stats: st.stats });      // era evaluate(st)
...
const r2 = evaluate(r1.state, { stats: r1.state.stats });   // era evaluate(r1.state)
...
// no 2º teste:
expect(evaluate(st, { stats: st.stats }).newlyUnlocked).toEqual([]);
```

(b) Adicionar um novo `describe` para o pódio:

```ts
describe('dailyPodium (troféu por contexto)', () => {
  it('desbloqueia quando dailyRank ≤ 3', () => {
    for (const rank of [1, 2, 3]) {
      const r = recordMatch(initialTrophyState(), match({}), { dailyRank: rank });
      expect(r.newlyUnlocked).toContain('dailyPodium');
      expect(r.state.unlocked).toContain('dailyPodium');
    }
  });

  it('NÃO desbloqueia com dailyRank ≥ 4 nem sem contexto de rank', () => {
    expect(recordMatch(initialTrophyState(), match({}), { dailyRank: 4 }).newlyUnlocked)
      .not.toContain('dailyPodium');
    expect(recordMatch(initialTrophyState(), match({})).newlyUnlocked)
      .not.toContain('dailyPodium');
  });

  it('é idempotente (mesma ref quando já desbloqueado e nada mais muda)', () => {
    const first = recordMatch(initialTrophyState(), match({}), { dailyRank: 1 });
    // firstFlight também destrava na 1ª; jogar de novo top-3 não muda unlocked
    const second = recordMatch(first.state, match({}), { dailyRank: 1 });
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.state).toBe(first.state);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/services/trophy/store.test.ts`
Expected: FAIL — `evaluate` com 2 args e/ou `dailyPodium` inexistente; erro de tipo no `condition`.

- [ ] **Step 3: Implementar contexto no store**

Em `src/services/trophy/store.ts`:

1. Adicionar a interface (após `MatchSummary`):
```ts
/** Contexto de avaliação: agregado vitalício + fatos transientes da partida recém-terminada. */
export interface TrophyEvalContext {
  readonly stats: TrophyStats;
  readonly dailyRank?: number; // rank 1-based no leaderboard diário; ausente fora do Diário
}
```

2. Trocar a assinatura de `evaluate` para receber e usar o contexto:
```ts
export function evaluate(
  state: TrophyState, ctx: TrophyEvalContext,
): { state: TrophyState; newlyUnlocked: readonly string[] } {
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_CATALOG) {
    if (!state.unlocked.includes(def.id) && def.condition(ctx)) {
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length === 0) return { state, newlyUnlocked };
  return { state: { ...state, unlocked: [...state.unlocked, ...newlyUnlocked] }, newlyUnlocked };
}
```

3. Trocar `recordMatch` para montar o contexto e repassar o `dailyRank` condicionalmente (exactOptionalPropertyTypes):
```ts
export function recordMatch(
  state: TrophyState, m: MatchSummary, extra?: { readonly dailyRank?: number },
): { state: TrophyState; newlyUnlocked: readonly string[] } {
  const stats = foldMatch(state.stats, m);
  const ctx: TrophyEvalContext =
    extra?.dailyRank !== undefined ? { stats, dailyRank: extra.dailyRank } : { stats };
  return evaluate({ stats, unlocked: state.unlocked }, ctx);
}
```

- [ ] **Step 4: Implementar o catálogo por contexto**

Em `src/services/trophy/catalog.ts`:

1. Trocar o import de tipo e a assinatura do `condition`:
```ts
import type { TrophyEvalContext } from './store';

export interface TrophyDef {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly condition: (ctx: TrophyEvalContext) => boolean;
}

/** Rank máximo (inclusivo) que conta como pódio do Desafio Diário local. */
export const PODIUM_RANK = 3;
```

2. Reescrever cada `condition` para ler `ctx.stats.*` e adicionar `dailyPodium`:
```ts
export const TROPHY_CATALOG: readonly TrophyDef[] = Object.freeze([
  { id: 'firstFlight', nameKey: 'trophy.firstFlight.name', descKey: 'trophy.firstFlight.desc',
    condition: (c) => c.stats.gamesPlayed >= 1 },
  { id: 'centurion', nameKey: 'trophy.centurion.name', descKey: 'trophy.centurion.desc',
    condition: (c) => c.stats.bestDistance >= 1000 },
  { id: 'forager', nameKey: 'trophy.forager.name', descKey: 'trophy.forager.desc',
    condition: (c) => c.stats.totalFood >= 50 },
  { id: 'daredevil', nameKey: 'trophy.daredevil.name', descKey: 'trophy.daredevil.desc',
    condition: (c) => c.stats.bestNearMisses >= 10 },
  { id: 'marathoner', nameKey: 'trophy.marathoner.name', descKey: 'trophy.marathoner.desc',
    condition: (c) => c.stats.totalDistance >= 10000 },
  { id: 'highRoller', nameKey: 'trophy.highRoller.name', descKey: 'trophy.highRoller.desc',
    condition: (c) => c.stats.bestScore >= 5000 },
  { id: 'persistent', nameKey: 'trophy.persistent.name', descKey: 'trophy.persistent.desc',
    condition: (c) => c.stats.gamesPlayed >= 25 },
  { id: 'dailyPodium', nameKey: 'trophy.dailyPodium.name', descKey: 'trophy.dailyPodium.desc',
    condition: (c) => c.dailyRank !== undefined && c.dailyRank <= PODIUM_RANK },
]);
```
(`trophyById` inalterado.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- tests/services/trophy/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: sem erros (confirma que `evaluate`/`condition` casam em todo o repo; `index.ts` do trophy só repassa `extra`, ver Step 7).

- [ ] **Step 7: Repassar `extra` no serviço de troféu**

Em `src/services/trophy/index.ts`, atualizar `recordMatch` para aceitar e repassar `extra`:
```ts
recordMatch(m: MatchSummary, extra?: { readonly dailyRank?: number }): readonly string[] {
  const { state, newlyUnlocked } = recordMatchState(this._state.value, m, extra);
  this.commit(state);
  return newlyUnlocked;
}
```

- [ ] **Step 8: Rodar suíte de troféu + typecheck**

Run: `npm test -- tests/services/trophy && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 9: Commit**

```bash
git add src/services/trophy/ tests/services/trophy/
git commit -m "feat(5.3): predicado de troféu por contexto + troféu dailyPodium"
```

---

### Task 3: i18n do `dailyPodium` + fiação da orquestração

**Files:**
- Modify: `src/i18n/locales/*.json` (10 arquivos — chaves `trophy.dailyPodium.{name,desc}`)
- Modify: `src/app/game/startGame.ts` (reordenar + injetar `dailyRank`)

**Interfaces:**
- Consumes: `leaderboardService.dailyRankForSeed` (Task 1), `trophyService.recordMatch(m, extra)` (Task 2).

- [ ] **Step 1: Adicionar as chaves i18n nos 10 locales**

Usar a skill `add-locale` para `trophy.dailyPodium.name` e `trophy.dailyPodium.desc`. Valores nativos por idioma. Referência (en):
```json
"dailyPodium": {
  "name": "Daily Podium",
  "desc": "Finish top 3 on the local Daily Challenge."
}
```
Inserir o objeto `dailyPodium` dentro do objeto `trophy` de **cada** locale (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`), traduzido. Se a skill `add-locale` estiver indisponível, editar os 10 arquivos à mão e justificar quaisquer valores idênticos ao `en` na allowlist de `tests/i18n/locales.test.ts` (ex.: nomes próprios/cognatos).

- [ ] **Step 2: Verificar paridade i18n**

Run: `npm test -- tests/i18n`
Expected: PASS (paridade de chaves e placeholders nos 10 locales; sem hardcoded).

- [ ] **Step 3: Fiar a orquestração**

Em `src/app/game/startGame.ts`, dentro de `onGameOver`, **reordenar** (leaderboard antes do troféu) e injetar `dailyRank` só no modo `daily`:
```ts
onGameOver: (w) => {
  walletService.earn(coinsForFood(w.food));
  leaderboardService.recordMatch({
    mode,
    seed: match.seedLabel,
    score: w.score,
    distance: w.distance,
    food: w.food,
    nearMisses: w.nearMisses,
    level: w.level,
    achievedAt: Date.now(),
  });
  const dailyRank = mode === 'daily'
    ? leaderboardService.dailyRankForSeed(match.seedLabel)
    : undefined;
  trophyService.recordMatch(
    { distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score },
    dailyRank !== undefined ? { dailyRank } : undefined,
  );
},
```
(Remove a chamada antiga de `trophyService.recordMatch` que vinha antes do leaderboard.)

- [ ] **Step 4: Typecheck + suíte completa**

Run: `npm run check && npm test`
Expected: typecheck limpo; **todos** os testes verdes (contagem sobe pelos novos testes; determinismo **67 inalterado**).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/ src/app/game/startGame.ts
git commit -m "feat(5.3): i18n dailyPodium (10 locales) + injeta dailyRank no game over"
```

---

## Verificação final (após as 3 tasks)

- [ ] `npm run check` — typecheck + lint limpos.
- [ ] `npm test` — suíte inteira verde.
- [ ] `npm run test:determinism` (ou skill `verify-determinism`) — determinismo **67 inalterado** (cinturão; nenhum arquivo de `src/core/` foi tocado).
- [ ] Review final da branch (agente `reviewer`).
- [ ] Marcar 5.3 como `[x]` em `docs/roadmap/PHASE-05-challenges-local.md` e atualizar "Estado atual" do `CLAUDE.md`.

## Self-review (feito)

- **Cobertura da spec:** rankOf/dailyRankForSeed (Task 1); contexto+dailyPodium (Task 2); i18n+orquestração (Task 3). ✓
- **Placeholders:** nenhum — todo passo traz código/comando reais. ✓
- **Consistência de tipos:** `TrophyEvalContext`, `evaluate(state, ctx)`, `recordMatch(state, m, extra)`, `condition:(ctx)=>boolean`, `rankOf`, `dailyRankForSeed`, `PODIUM_RANK` coerentes entre tasks. ✓
- **Determinismo:** nenhuma task toca `src/core/`. ✓
