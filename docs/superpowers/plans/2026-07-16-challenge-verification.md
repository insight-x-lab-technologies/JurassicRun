# Verificação de desafio (anti-cheat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um jogador só recebe "verificado" num desafio (Diário/Semanal) quando o servidor re-simula sua timeline submetida e confirma que reproduz o estado final (hash) e os campos de score declarados.

**Architecture:** Verificação = função pura `verifyChallengeSubmission` (única fonte da verdade, importa só `@core/replay`). Bundlada em ESM autocontido para uma Edge Function Deno (service_role) que marca `verified=true` em `challenge_entries`. O cliente passa a submeter `challenge_entries` (reusa `buildReplayPayload`); o leaderboard central exibe ✓ cruzando o conjunto verificado.

**Tech Stack:** TypeScript estrito, Vitest, `@preact/signals`, `@supabase/supabase-js`, Deno (Edge Function), esbuild (bundle).

## Global Constraints

- `src/core/` **NÃO é tocado** (só importado read-only). Determinismo permanece **67**.
- Determinismo (REGRA 1): sem `Math.random`/`Date.now`/`performance.now` em `src/core/`.
- i18n (REGRA 4): nenhuma string visível hardcoded; toda chave nos 10 locales em `src/i18n/locales/*.json` (`en,es,pt-BR,fr,it,de,ja,zh,ko,hi`). Paridade garantida por `tests/i18n/locales.test.ts` + scanner AST `tests/i18n/no-hardcoded-strings.test.ts`.
- Performance (REGRA 3): sem trabalho por frame; verificação em cold path (servidor/game-over).
- Offline-first: sem `.env`/Supabase ⇒ jogo 100% local, sem selo, sem exceção propagada.
- TS estrito, sem `any` sem justificativa. Commits pequenos, um por task. `npm run check` + `npm test` limpos.
- Verificação re-simula `simulate({ seed, trait: 'none' }, timeline)` — DEVE bater com `createMatchFactory`/`verifyReplay` (dificuldade/clima nos defaults).

---

### Task 1: Verificação pura `verifyChallengeSubmission`

**Files:**
- Create: `src/services/online/verifyChallenge.ts`
- Test: `tests/online/verifyChallenge.test.ts`

**Interfaces:**
- Consumes: `simulate`, `hashState` de `@core/replay`; `InputTimeline` de `@core/replay`.
- Produces:
  ```ts
  export interface ChallengeSubmission {
    readonly seed: string;
    readonly timeline: readonly boolean[];
    readonly score: number;
    readonly distance: number;
    readonly food: number;
    readonly nearMisses: number;
    readonly finalHash: string;
  }
  export interface ChallengeVerification {
    readonly valid: boolean;
    readonly expectedHash: string;
    readonly hashMatches: boolean;
    readonly fieldsMatch: boolean;
  }
  export function verifyChallengeSubmission(sub: ChallengeSubmission): ChallengeVerification;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/online/verifyChallenge.test.ts
import { describe, expect, it } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyChallengeSubmission, type ChallengeSubmission } from '@services/online/verifyChallenge';

const SEED = 'daily:2026-07-16';

/** Constrói uma submissão fiel re-simulando de verdade. */
function faithful(seed = SEED): ChallengeSubmission {
  const frames = buildTimeline(600, (i) => i % 3 === 0); // InputFrame[]; pattern é (i)=>boolean
  const world = simulate({ seed, trait: 'none' }, frames);
  return {
    seed,
    timeline: frames.map((f) => f.flap),
    score: world.score,
    distance: world.distance,
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
  };
}

describe('verifyChallengeSubmission', () => {
  it('aceita uma submissão fiel', () => {
    const v = verifyChallengeSubmission(faithful());
    expect(v.valid).toBe(true);
    expect(v.hashMatches).toBe(true);
    expect(v.fieldsMatch).toBe(true);
  });

  it('rejeita hash adulterado (timeline não bate)', () => {
    const v = verifyChallengeSubmission({ ...faithful(), finalHash: 'deadbeef'.repeat(4) });
    expect(v.hashMatches).toBe(false);
    expect(v.valid).toBe(false);
  });

  it('rejeita coluna de score inflada mesmo com hash correto', () => {
    const base = faithful();
    const v = verifyChallengeSubmission({ ...base, score: base.score + 9999 });
    expect(v.hashMatches).toBe(true);   // hash é da re-sim, não das colunas
    expect(v.fieldsMatch).toBe(false);
    expect(v.valid).toBe(false);
  });

  it('rejeita timeline divergente (leva a outro estado final)', () => {
    const base = faithful();
    const tampered = base.timeline.map((flap, i) => (i % 50 === 0 ? !flap : flap));
    const v = verifyChallengeSubmission({ ...base, timeline: tampered });
    expect(v.valid).toBe(false); // hash e/ou campos divergem
  });

  it('expectedHash é o hash da re-sim (determinístico)', () => {
    const s = faithful();
    expect(verifyChallengeSubmission(s).expectedHash).toBe(s.finalHash);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/online/verifyChallenge.test.ts`
Expected: FAIL — `verifyChallengeSubmission` não existe (`Failed to resolve import`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/online/verifyChallenge.ts
import { simulate, hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';

/** Submissão de desafio a verificar (Diário/Semanal). challenge_entries não tem `level`. */
export interface ChallengeSubmission {
  readonly seed: string;
  readonly timeline: readonly boolean[]; // 1 flap por step
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string;
}

export interface ChallengeVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // hash recomputado pela re-sim
  readonly hashMatches: boolean; // timeline reproduz o estado final declarado
  readonly fieldsMatch: boolean; // colunas de score batem com a re-sim
}

/**
 * Re-simula {seed, trait:'none'} + timeline e valida integridade. Único ponto da verdade do
 * anti-cheat, importado tanto pelo Vitest quanto pela Edge Function (via bundle). Puro:
 * depende só de @core/replay. hashMatches prova a timeline; fieldsMatch prova que as colunas
 * não foram infladas independentemente do hash. Ambos são necessários.
 */
export function verifyChallengeSubmission(sub: ChallengeSubmission): ChallengeVerification {
  const timeline: InputTimeline = sub.timeline.map((flap) => ({ flap }));
  const world = simulate({ seed: sub.seed, trait: 'none' }, timeline);
  const expectedHash = hashState(world);
  const hashMatches = expectedHash === sub.finalHash;
  const fieldsMatch =
    world.score === sub.score &&
    world.distance === sub.distance &&
    world.food === sub.food &&
    world.nearMisses === sub.nearMisses;
  return { valid: hashMatches && fieldsMatch, expectedHash, hashMatches, fieldsMatch };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/online/verifyChallenge.test.ts`
Expected: PASS (5 testes). `buildTimeline(length, pattern)` recebe `pattern: (i:number)=>boolean` (ver `src/core/replay/timeline.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/services/online/verifyChallenge.ts tests/online/verifyChallenge.test.ts
git commit -m "feat(6.4): verificação pura de submissão de desafio (re-sim + hash + campos)"
```

---

### Task 2: Bundle ESM portável + guarda de equivalência

**Files:**
- Modify: `package.json` (devDep `esbuild` + script `build:edge`)
- Create: `scripts/build-edge.mjs`
- Create (gerado, commitado): `supabase/functions/verify-challenge/_verify.bundle.js`
- Test: `tests/online/edge-bundle.test.ts`

**Interfaces:**
- Consumes: `verifyChallengeSubmission` de `@services/online/verifyChallenge` (Task 1).
- Produces: `supabase/functions/verify-challenge/_verify.bundle.js` exportando `verifyChallengeSubmission` (ESM), consumido pela Edge Function (Task 3).

- [ ] **Step 1: Adicionar esbuild e script**

Run: `npm i -D esbuild`

Edite `package.json` `scripts`, adicione:
```json
"build:edge": "node scripts/build-edge.mjs"
```

- [ ] **Step 2: Escrever o build script**

```js
// scripts/build-edge.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  entryPoints: [path.join(root, 'src/services/online/verifyChallenge.ts')],
  outfile: path.join(root, 'supabase/functions/verify-challenge/_verify.bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  alias: { '@core': path.join(root, 'src/core') },
  banner: { js: '// GERADO por scripts/build-edge.mjs — NÃO editar à mão. Rode `npm run build:edge`.' },
});
console.log('edge bundle escrito.');
```

- [ ] **Step 3: Gerar o bundle**

Run: `npm run build:edge`
Expected: cria `supabase/functions/verify-challenge/_verify.bundle.js` (ESM autocontido, sem imports bare).

- [ ] **Step 4: Escrever a guarda de equivalência**

```ts
// tests/online/edge-bundle.test.ts
import { describe, expect, it } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyChallengeSubmission as fromSource, type ChallengeSubmission } from '@services/online/verifyChallenge';
// @ts-expect-error bundle JS gerado sem tipos
import { verifyChallengeSubmission as fromBundle } from '../../supabase/functions/verify-challenge/_verify.bundle.js';

function sample(seed: string): ChallengeSubmission {
  const frames = buildTimeline(400, (i) => i % 3 === 0);
  const w = simulate({ seed, trait: 'none' }, frames);
  return {
    seed, timeline: frames.map((f) => f.flap),
    score: w.score, distance: w.distance, food: w.food, nearMisses: w.nearMisses,
    finalHash: hashState(w),
  };
}

describe('edge bundle é fiel à fonte (guarda de staleness)', () => {
  it('exporta a função de verificação', () => {
    expect(typeof fromBundle).toBe('function');
  });

  it('produz resultado idêntico à fonte em casos fiéis e adulterados', () => {
    const cases: ChallengeSubmission[] = [
      sample('daily:2026-07-16'),
      sample('weekly:2026-W29'),
      { ...sample('daily:2026-07-17'), score: 123456 },        // campo inflado
      { ...sample('daily:2026-07-18'), finalHash: '0'.repeat(32) }, // hash adulterado
    ];
    for (const c of cases) {
      expect(fromBundle(c)).toEqual(fromSource(c));
    }
  });
});
```

- [ ] **Step 5: Rodar a guarda**

Run: `npm test -- tests/online/edge-bundle.test.ts`
Expected: PASS. Se falhar por bundle desatualizado, rode `npm run build:edge` e repita. (A divergência fonte↔bundle é exatamente o que a guarda detecta.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/build-edge.mjs supabase/functions/verify-challenge/_verify.bundle.js tests/online/edge-bundle.test.ts
git commit -m "build(6.4): bundle ESM portável do verificador p/ Deno + guarda de equivalência"
```

---

### Task 3: Edge Function `verify-challenge` (casca Deno) + docs

**Files:**
- Create: `supabase/functions/verify-challenge/index.ts`
- Create: `supabase/functions/verify-challenge/deno.json`
- Create/Modify: `supabase/functions/README.md`

**Interfaces:**
- Consumes: `verifyChallengeSubmission` do bundle (`./_verify.bundle.js`); `SUPABASE_SCHEMA`/`TABLES` conceituais (hardcode `'jurassicrun'`/`'challenge_entries'` no Deno — sem alias TS lá).
- Produces: HTTP endpoint que marca `verified=true` nos `challenge_entries` fiéis. Não é testada por unidade (casca, molde da SQL de 6.1).

- [ ] **Step 1: Escrever a Edge Function**

```ts
// supabase/functions/verify-challenge/index.ts
// Edge Function (Deno). Re-simula (seed, timeline) de challenge_entries não-verificados
// e marca verified=true nos fiéis. Só o service_role passa pelo trigger lock_verified.
// NÃO testada por unidade (casca) — a lógica vive em _verify.bundle.js (guarda em Vitest).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyChallengeSubmission } from './_verify.bundle.js';

const SCHEMA = 'jurassicrun';
const TABLE = 'challenge_entries';
const BATCH = 100;

interface Row {
  id: number; seed: string; timeline: boolean[];
  score: number; distance: number; food: number; near_misses: number; final_hash: string;
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(url, key, { db: { schema: SCHEMA } });

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, seed, timeline, score, distance, food, near_misses, final_hash')
    .eq('verified', false)
    .limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const rows = (data ?? []) as Row[];
  let verified = 0;
  for (const r of rows) {
    const result = verifyChallengeSubmission({
      seed: r.seed,
      timeline: Array.isArray(r.timeline) ? r.timeline : [],
      score: r.score, distance: r.distance, food: r.food, nearMisses: r.near_misses,
      finalHash: r.final_hash,
    });
    if (result.valid) {
      const upd = await supabase.from(TABLE).update({ verified: true }).eq('id', r.id);
      if (!upd.error) verified += 1;
    }
  }
  return new Response(JSON.stringify({ checked: rows.length, verified }), {
    headers: { 'content-type': 'application/json' },
  });
});
```

- [ ] **Step 2: Escrever `deno.json` da função**

```json
{
  "imports": {}
}
```

(Vazio: o bundle é local e o supabase-js vem por URL esm.sh. Presente p/ o Supabase CLI reconhecer a função como Deno.)

- [ ] **Step 3: Documentar deploy (não posso aplicar — pré-req do usuário, molde 6.1)**

Crie/edite `supabase/functions/README.md`:

```markdown
# Edge Functions — JurassicRun

## verify-challenge (item 6.4 — anti-cheat)

Re-simula `(seed, timeline)` de `challenge_entries` não-verificados e marca `verified=true`
nos fiéis (hash do estado final + colunas de score batem com a re-sim). Só o `service_role`
passa pelo trigger `lock_verified`, então a função roda com a service_role key.

O verificador é o bundle `_verify.bundle.js`, gerado de `src/services/online/verifyChallenge.ts`
por `npm run build:edge` (guarda de equivalência em `tests/online/edge-bundle.test.ts`).
**Regenere o bundle e re-deploy sempre que `src/core/` ou o verificador mudar.**

### Deploy (pré-requisito do usuário)
```bash
npm run build:edge                          # (re)gera _verify.bundle.js
supabase functions deploy verify-challenge  # requer supabase CLI + login no projeto
```
As env `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo runtime
das Edge Functions (não precisa `secrets set` para elas).

### Invocação
Idempotente (só processa `verified=false`). Rode por HTTP após submissões, ou agende:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verify-challenge" -H "Authorization: Bearer $ANON_KEY"
```
Opcional: agendar via `pg_cron`/Scheduled Functions do dashboard (ex.: a cada 5 min).
```

- [ ] **Step 4: Verificar typecheck do repo (a função Deno é ignorada pelo tsc do app)**

Run: `npm run check`
Expected: PASS. Confirme que `supabase/functions/**` está fora do `include`/`tsconfig` do app (usa imports `https://` que o tsc do app não resolve). Se o `tsc` tentar compilar a função, adicione `supabase` ao `exclude` do `tsconfig.json`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/verify-challenge/index.ts supabase/functions/verify-challenge/deno.json supabase/functions/README.md tsconfig.json
git commit -m "feat(6.4): Edge Function verify-challenge (service_role marca verified) + docs de deploy"
```

---

### Task 4: Cliente submete `challenge_entries` + busca verificados + fiação

**Files:**
- Modify: `src/services/online/client.ts` (tipo + interface + memory spy + casca real)
- Modify: `src/services/online/index.ts` (delegadores `OnlineService`)
- Modify: `src/app/game/startGame.ts` (fiação no `onGameOver`)
- Test: `tests/online/onlineService.challenge.test.ts` (ou estenda um teste de online existente)

**Interfaces:**
- Consumes: `StoredReplay` de `@services/replay` (payload de 5.4); `onlineService` sinais `online`/`globalPlayerId`.
- Produces:
  ```ts
  // client.ts
  export interface OnlineChallengeInput {
    readonly playerId: string;
    readonly mode: 'daily' | 'weekly';
    readonly seed: string;
    readonly score: number; readonly distance: number; readonly food: number; readonly nearMisses: number;
    readonly timeline: readonly boolean[];
    readonly finalHash: string;
  }
  // OnlineClient (novo):
  submitChallengeEntry(input: OnlineChallengeInput): Promise<void>;
  fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]>;
  // OnlineService (novo):
  submitChallengeEntry(input: Omit<OnlineChallengeInput, 'playerId'>): Promise<void>;
  fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]>;
  ```

- [ ] **Step 1: Estender o seam do cliente — teste primeiro**

```ts
// tests/online/onlineService.challenge.test.ts
import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';
import { OnlineService } from '@services/online';
import { signal } from '@preact/signals';

function fakeProfile() {
  return { activeProfile: signal({ id: 'p1', name: 'Rex', createdAt: 0 }) };
}
const config = { url: 'x', anonKey: 'y' };

const entry = {
  mode: 'daily' as const, seed: 'daily:2026-07-16',
  score: 10, distance: 20, food: 3, nearMisses: 1,
  timeline: [true, false, true], finalHash: 'abc',
};

describe('OnlineService.submitChallengeEntry', () => {
  it('anexa o uid e delega ao cliente quando online', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    await svc.submitChallengeEntry(entry);
    expect(client.submittedChallenges).toEqual([{ ...entry, playerId: 'uid-1' }]);
  });

  it('é no-op offline (não lança)', async () => {
    const client = memoryOnlineClient();
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: fakeProfile() });
    await expect(svc.submitChallengeEntry(entry)).resolves.toBeUndefined();
    expect(client.submittedChallenges).toEqual([]);
  });

  it('fetchVerifiedPlayers delega e devolve os ids', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1', verifiedPlayers: ['uid-9'] });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    expect(await svc.fetchVerifiedPlayers('daily', 'daily:2026-07-16')).toEqual(['uid-9']);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- tests/online/onlineService.challenge.test.ts`
Expected: FAIL — `submitChallengeEntry`/`submittedChallenges`/`verifiedPlayers` não existem.

- [ ] **Step 3: Estender `client.ts`**

Adicione o tipo e a interface (após `OnlineScoreRow`):
```ts
export interface OnlineChallengeInput {
  readonly playerId: string;
  readonly mode: 'daily' | 'weekly';
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly timeline: readonly boolean[];
  readonly finalHash: string;
}
```
No `interface OnlineClient`, adicione:
```ts
  /** Upsert de um replay de desafio verificável (1 por player+seed). */
  submitChallengeEntry(input: OnlineChallengeInput): Promise<void>;
  /** player_ids com challenge_entry verificado nesse modo+seed. */
  fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]>;
```
No `interface MemoryOnlineClient`, adicione:
```ts
  readonly submittedChallenges: OnlineChallengeInput[];
```
No `memoryOnlineClient(opts)`: amplie `opts` para `{ uid?; failSignIn?; scores?; verifiedPlayers?: string[] }`, adicione `const submittedChallenges: OnlineChallengeInput[] = [];`, exponha-o no objeto e implemente:
```ts
    async submitChallengeEntry(input) {
      submittedChallenges.push(input);
    },
    async fetchVerifiedPlayers() {
      return opts.verifiedPlayers ?? [];
    },
```
Na casca `createSupabaseClient`, adicione ao objeto retornado:
```ts
    async submitChallengeEntry(input) {
      const { error } = await supabase
        .from(TABLES.challengeEntries)
        .upsert(
          {
            player_id: input.playerId, mode: input.mode, seed: input.seed,
            score: input.score, distance: input.distance, food: input.food,
            near_misses: input.nearMisses, timeline: input.timeline, final_hash: input.finalHash,
          },
          { onConflict: 'player_id,seed' },
        );
      if (error !== null) throw error;
    },
    async fetchVerifiedPlayers(mode, seed) {
      const { data, error } = await supabase
        .from(TABLES.challengeEntries)
        .select('player_id')
        .eq('mode', mode)
        .eq('seed', seed)
        .eq('verified', true);
      if (error !== null) throw error;
      return ((data ?? []) as { player_id: string }[]).map((r) => r.player_id);
    },
```

- [ ] **Step 4: Estender `OnlineService` (`index.ts`)**

Importe o tipo:
```ts
import { createSupabaseClient, type OnlineClient, type OnlinePlayer, type OnlineScoreInput, type OnlineScoreRow, type OnlineMode, type OnlineChallengeInput } from './client';
```
Adicione métodos (junto de `submitScore`/`fetchScores`):
```ts
  async submitChallengeEntry(input: Omit<OnlineChallengeInput, 'playerId'>): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    try {
      await this.client.submitChallengeEntry({ ...input, playerId: id });
    } catch {
      // best-effort
    }
  }

  async fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]> {
    if (this._status.value !== 'online' || this.client === null) return [];
    try {
      return await this.client.fetchVerifiedPlayers(mode, seed);
    } catch {
      return [];
    }
  }
```
E no rodapé de re-export de tipos, acrescente `OnlineChallengeInput`.

- [ ] **Step 5: Rodar — deve passar**

Run: `npm test -- tests/online/onlineService.challenge.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Fiar a submissão no `startGame.onGameOver`**

Em `src/app/game/startGame.ts`, adicione o import:
```ts
import { onlineService } from '@services/online';
```
No fim do `onGameOver`, depois do bloco `if (replay) replayService.record(replay);`, adicione:
```ts
      if (replay && (mode === 'daily' || mode === 'weekly')) {
        void onlineService.submitChallengeEntry({
          mode,
          seed: replay.seed,
          score: replay.score,
          distance: replay.distance,
          food: replay.food,
          nearMisses: replay.nearMisses,
          timeline: replay.timeline,
          finalHash: replay.finalHash,
        });
      }
```
(`replay` é `StoredReplay`; para daily/weekly seus campos casam `OnlineChallengeInput` sem `playerId`. O `mode` já está narrowado pelo guard.)

- [ ] **Step 7: Verificar tudo**

Run: `npm run check && npm test -- tests/online`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/services/online/client.ts src/services/online/index.ts src/app/game/startGame.ts tests/online/onlineService.challenge.test.ts
git commit -m "feat(6.4): cliente submete challenge_entries + busca verificados; fiação no game-over"
```

---

### Task 5: Selo ✓ no leaderboard central (campo + seam + serviço + UI + i18n)

**Files:**
- Modify: `src/services/leaderboard/central.ts` (`CentralEntry.verified`)
- Modify: `src/services/leaderboard/online.ts` (`LeaderboardOnline.fetchVerifiedPlayers` + memory)
- Modify: `src/services/leaderboard/index.ts` (`refreshMode` cruza verificados)
- Modify: `src/app/online/leaderboardAdapter.ts` (delega ao `onlineService`)
- Modify: `src/app/screens/LeaderboardScreen.tsx` (renderiza ✓)
- Modify: `src/i18n/locales/*.json` (10 arquivos — chave `leaderboard.verified`)
- Test: `tests/leaderboard/central.test.ts` (verified default) + `tests/leaderboard/service.central.test.ts` (cruzamento)

**Interfaces:**
- Consumes: `OnlineScoreRow`; `toCentralEntries`; `LeaderboardOnline` (Task 4 `fetchVerifiedPlayers` no `onlineService`).
- Produces: `CentralEntry.verified: boolean`; `LeaderboardOnline.fetchVerifiedPlayers(mode, seed)`.

- [ ] **Step 1: Teste do campo `verified` (default false) + cruzamento no serviço**

Verifique os nomes reais em `tests/leaderboard/` e siga o padrão. Novo/estendido:
```ts
// tests/leaderboard/service.central.test.ts
import { describe, expect, it } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

const seed = 'daily:2026-07-16';
const row = (playerId: string, score: number): OnlineScoreRow => ({
  playerId, mode: 'daily', seed, score, distance: 0, food: 0, nearMisses: 0, level: 1,
  playerName: playerId, playerAvatar: '0', createdAt: 1,
});

describe('LeaderboardService marca entradas centrais verificadas', () => {
  it('daily: verified=true só p/ jogadores no conjunto verificado', async () => {
    const online = memoryLeaderboardOnline({
      online: true,
      rows: { daily: [row('a', 50), row('b', 40)] },
      seeds: { daily: seed, weekly: 'weekly:x' },
      verified: { daily: ['a'] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    // dispara refresh na borda offline->online já em init (online=true); aguarda microtasks
    await Promise.resolve(); await Promise.resolve();
    const central = svc.centralDaily.value;
    expect(central.find((e) => e.playerId === 'a')?.verified).toBe(true);
    expect(central.find((e) => e.playerId === 'b')?.verified).toBe(false);
  });

  it('endless: sempre verified=false (sem replay)', async () => {
    const online = memoryLeaderboardOnline({
      online: true, rows: { endless: [row('a', 50)] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await Promise.resolve(); await Promise.resolve();
    expect(svc.centralEndless.value[0]?.verified).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- tests/leaderboard/service.central.test.ts`
Expected: FAIL — `verified` não existe em `CentralEntry`/`memoryLeaderboardOnline` sem `verified`/`fetchVerifiedPlayers`.

- [ ] **Step 3: `central.ts` — adicionar `verified`**

Em `CentralEntry` adicione `readonly verified: boolean;`. Em `entryOf`, adicione `verified: false,` (default; o serviço sobrescreve os verificados). Mantém `toCentralEntries` intacto no resto.

- [ ] **Step 4: `online.ts` — estender seam + memory**

Na interface `LeaderboardOnline`, adicione:
```ts
  fetchVerifiedPlayers(mode: LeaderboardMode, seed: string): Promise<readonly string[]>;
```
Em `memoryLeaderboardOnline(opts)`: amplie `opts` com `verified?: Partial<Record<LeaderboardMode, readonly string[]>>` e implemente:
```ts
    async fetchVerifiedPlayers(mode) {
      return opts.verified?.[mode] ?? [];
    },
```

- [ ] **Step 5: `index.ts` (`LeaderboardService.refreshMode`) — cruzar verificados**

Substitua o corpo de `refreshMode` a partir de `const rows = ...`:
```ts
    const rows = await o.fetchScores(mode, seed);
    let entries = toCentralEntries(rows);
    if ((mode === 'daily' || mode === 'weekly') && seed !== undefined) {
      const verifiedIds = new Set(await o.fetchVerifiedPlayers(mode, seed));
      entries = entries.map((e) => ({ ...e, verified: verifiedIds.has(e.playerId) }));
    }
    this._central.value = { ...this._central.value, [mode]: entries };
```

- [ ] **Step 6: `leaderboardAdapter.ts` — delegar**

Em `OnlineScoresLike`, adicione:
```ts
  fetchVerifiedPlayers(mode: LeaderboardMode, seed: string): Promise<readonly string[]>;
```
No objeto retornado por `createLeaderboardOnline`, adicione:
```ts
    fetchVerifiedPlayers(mode, seed) {
      return svc.fetchVerifiedPlayers(mode, seed);
    },
```
(`onlineService.fetchVerifiedPlayers` existe da Task 4; o cast `as OnlineScoresLike` cobre.)

- [ ] **Step 7: Rodar — serviço deve passar**

Run: `npm test -- tests/leaderboard/service.central.test.ts`
Expected: PASS.

- [ ] **Step 8: i18n — chave `leaderboard.verified` nos 10 locales**

Use a skill `add-locale` se disponível; senão edite manualmente `src/i18n/locales/{en,es,pt-BR,fr,it,de,ja,zh,ko,hi}.json` adicionando dentro do objeto `leaderboard` a chave `"verified"` com tradução nativa curta de "Verified" (rótulo do selo/aria). Ex.: en `"Verified"`, pt-BR `"Verificado"`, es `"Verificado"`, fr `"Vérifié"`, it `"Verificato"`, de `"Verifiziert"`, ja `"確認済み"`, zh `"已验证"`, ko `"검증됨"`, hi `"सत्यापित"`. Pares idênticos ao `en` (nenhum aqui) exigiriam allowlist — não é o caso.

- [ ] **Step 9: UI — renderizar ✓ em `CentralRow`**

Em `src/app/screens/LeaderboardScreen.tsx`, dentro de `CentralRow`, após o `<span class="leaderboard__player">…</span>`, adicione:
```tsx
      {entry.verified && (
        <span class="leaderboard__verified" title={i18n.t('leaderboard.verified')} aria-label={i18n.t('leaderboard.verified')}>✓</span>
      )}
```

- [ ] **Step 10: Verificar tudo (inclui paridade i18n + scanner AST)**

Run: `npm run check && npm test`
Expected: PASS — inclui `tests/i18n/locales.test.ts` (paridade) e `tests/i18n/no-hardcoded-strings.test.ts` (o ✓ é conteúdo emoji/símbolo decorativo dentro de `t()`-labelled span; se o scanner reclamar do literal `✓`, envolva com aria/title via `t()` como acima — o texto visível é só o glifo, que o scanner ignora como não-alfabético).

- [ ] **Step 11: Commit**

```bash
git add src/services/leaderboard/central.ts src/services/leaderboard/online.ts src/services/leaderboard/index.ts src/app/online/leaderboardAdapter.ts src/app/screens/LeaderboardScreen.tsx src/i18n/locales tests/leaderboard/service.central.test.ts
git commit -m "feat(6.4): selo verificado no leaderboard central (cruzamento + UI + i18n)"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run check` limpo.
- [ ] `npm test` verde (novos testes de verifyChallenge, edge-bundle, online challenge, leaderboard central; i18n paridade + scanner).
- [ ] `npm run test:determinism` — **67 inalterado** (core intocado; verifyChallenge só importa `@core/replay`).
- [ ] `npm run build:edge` roda e o bundle está commitado e fresco (guarda verde).
- [ ] Review final da branch (subagent `reviewer`).

## Self-review (cobertura da spec)

- Verificação pura → Task 1. ✅
- Bundle Deno + guarda → Task 2. ✅
- Edge Function + docs deploy → Task 3. ✅
- Cliente submete challenge_entries → Task 4. ✅
- Selo verificado (fetchVerifiedPlayers + UI + i18n) → Task 5. ✅
- Determinismo 67 / core intocado → constraint global + verificação final. ✅
- Offline-first (no-op sem online) → Task 4 (delegadores guardados) + Task 5 (centralAvailable). ✅
- Adiados (auto-invocação, best-attempt upsert, Endless, gate) → documentados na spec, fora do plano. ✅
