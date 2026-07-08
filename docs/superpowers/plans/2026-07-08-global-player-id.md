# 6.2 — ID global de jogador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao dispositivo uma identidade global via Supabase Auth anônimo
(`players.id = auth.uid()`), vinculada ao perfil local ativo (nome/avatar), degradando
graciosamente offline.

**Architecture:** Padrão puro×casca (molde de wallet/trophy/settings) em `src/services/online/`.
Config e lógica de estado são puras/testáveis; o cliente Supabase real é uma casca não-testada
atrás de uma interface `OnlineClient` (seam de IO). Serviço reativo com sinais
`globalPlayerId`/`status`; init async não-bloqueante.

**Tech Stack:** TypeScript estrito, `@preact/signals`, `@supabase/supabase-js` (nova dep),
Vitest, i18next.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67 inalterado** (nenhum re-pin de goldens).
- TypeScript estrito; sem `any` sem justificativa.
- Nenhuma string visível hardcoded — tudo via chaves i18next nos **10 locales** (REGRA 4).
- `src/core/` proíbe `Math.random`/`Date.now`; este item **não** vive no core (casca pode usar IO).
- Schema Postgres: `SUPABASE_SCHEMA = 'jurassicrun'`; tabela `players` colunas
  `['id','name','avatar','created_at']` (de `src/services/online/schema.ts`).
- Offline-first: sem config OU falha de rede ⇒ jogo 100% local, sem exceção propagada.

---

### Task 1: Config puro + dependência Supabase

**Files:**
- Modify: `package.json` (adiciona `@supabase/supabase-js`)
- Create: `src/services/online/config.ts`
- Test: `tests/online/config.test.ts`

**Interfaces:**
- Produces: `OnlineConfig = { url: string; anonKey: string }`;
  `parseOnlineConfig(env: Record<string, unknown>): OnlineConfig | null`;
  `onlineConfig(): OnlineConfig | null`.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @supabase/supabase-js`
Expected: adiciona a `dependencies`; `package-lock.json` atualizado.

- [ ] **Step 2: Escrever o teste que falha** — `tests/online/config.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseOnlineConfig } from '@services/online/config';

describe('parseOnlineConfig', () => {
  it('devolve config quando url e anonKey estão presentes', () => {
    expect(
      parseOnlineConfig({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'key123',
      }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'key123' });
  });

  it('devolve null quando falta a url', () => {
    expect(parseOnlineConfig({ VITE_SUPABASE_ANON_KEY: 'key123' })).toBeNull();
  });

  it('devolve null quando falta a anonKey', () => {
    expect(parseOnlineConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
  });

  it('devolve null quando um valor é string vazia', () => {
    expect(
      parseOnlineConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'key123' }),
    ).toBeNull();
  });

  it('devolve null quando um valor não é string', () => {
    expect(
      parseOnlineConfig({ VITE_SUPABASE_URL: 123, VITE_SUPABASE_ANON_KEY: 'key123' }),
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/online/config.test.ts`
Expected: FAIL — módulo `config` inexistente.

- [ ] **Step 4: Implementar** — `src/services/online/config.ts`

```ts
/** Configuração do cliente Supabase, derivada do ambiente Vite. */
export interface OnlineConfig {
  readonly url: string;
  readonly anonKey: string;
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Puro: extrai a config de um objeto env-like. Devolve `null` (⇒ modo offline)
 * quando qualquer uma das chaves obrigatórias falta ou não é string não-vazia.
 */
export function parseOnlineConfig(env: Record<string, unknown>): OnlineConfig | null {
  const url = env['VITE_SUPABASE_URL'];
  const anonKey = env['VITE_SUPABASE_ANON_KEY'];
  if (!nonEmptyString(url) || !nonEmptyString(anonKey)) return null;
  return { url, anonKey };
}

/** Casca: lê o ambiente Vite (`import.meta.env`). */
export function onlineConfig(): OnlineConfig | null {
  return parseOnlineConfig(import.meta.env as unknown as Record<string, unknown>);
}
```

- [ ] **Step 5: Rodar o teste (deve passar)**

Run: `npx vitest run tests/online/config.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/services/online/config.ts tests/online/config.test.ts
git commit -m "feat(6.2): dependência supabase-js + config online pura"
```

---

### Task 2: Seam do cliente online (`OnlineClient` + memory + real)

**Files:**
- Create: `src/services/online/client.ts`
- Test: `tests/online/client.test.ts`

**Interfaces:**
- Consumes: `OnlineConfig` (Task 1); `SUPABASE_SCHEMA` de `@services/online/schema`.
- Produces:
  - `interface OnlineClient { signInAnonymously(): Promise<string>; upsertPlayer(p: OnlinePlayer): Promise<void>; }`
  - `interface OnlinePlayer { readonly id: string; readonly name: string; readonly avatar: string; }`
  - `memoryOnlineClient(opts?: { uid?: string; failSignIn?: boolean }): OnlineClient & { readonly upserts: OnlinePlayer[]; readonly signInCount: number; }`
  - `createSupabaseClient(config: OnlineConfig): OnlineClient` (casca real, não testada por unidade).

- [ ] **Step 1: Escrever o teste que falha** — `tests/online/client.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';

describe('memoryOnlineClient', () => {
  it('signInAnonymously resolve com o uid e conta chamadas', async () => {
    const c = memoryOnlineClient({ uid: 'uid-1' });
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(c.signInCount).toBe(2);
  });

  it('signInAnonymously rejeita quando failSignIn', async () => {
    const c = memoryOnlineClient({ failSignIn: true });
    await expect(c.signInAnonymously()).rejects.toThrow();
  });

  it('upsertPlayer registra os players enviados', async () => {
    const c = memoryOnlineClient();
    await c.upsertPlayer({ id: 'uid-1', name: 'Rex', avatar: '120' });
    expect(c.upserts).toEqual([{ id: 'uid-1', name: 'Rex', avatar: '120' }]);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/online/client.test.ts`
Expected: FAIL — módulo `client` inexistente.

- [ ] **Step 3: Implementar** — `src/services/online/client.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA, TABLES } from './schema';
import type { OnlineConfig } from './config';

export interface OnlinePlayer {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
}

export interface OnlineClient {
  /** Garante uma sessão anônima; resolve com o `auth.uid()`. */
  signInAnonymously(): Promise<string>;
  /** Upsert do row `players` do jogador atual. */
  upsertPlayer(player: OnlinePlayer): Promise<void>;
}

export interface MemoryOnlineClient extends OnlineClient {
  readonly upserts: OnlinePlayer[];
  readonly signInCount: number;
}

/** Spy determinístico p/ testes: sem rede. */
export function memoryOnlineClient(
  opts: { uid?: string; failSignIn?: boolean } = {},
): MemoryOnlineClient {
  const uid = opts.uid ?? 'memory-uid';
  const upserts: OnlinePlayer[] = [];
  let signInCount = 0;
  return {
    upserts,
    get signInCount() {
      return signInCount;
    },
    async signInAnonymously() {
      signInCount += 1;
      if (opts.failSignIn === true) throw new Error('sign-in falhou (memory)');
      return uid;
    },
    async upsertPlayer(player) {
      upserts.push(player);
    },
  };
}

/**
 * Casca real (não testada por unidade — molde de WebAudioEngine/localStorage*):
 * embrulha `@supabase/supabase-js`. Reusa a sessão anônima persistida antes de
 * criar uma nova, p/ não multiplicar usuários anônimos a cada boot.
 */
export function createSupabaseClient(config: OnlineConfig): OnlineClient {
  const supabase = createClient(config.url, config.anonKey, {
    db: { schema: SUPABASE_SCHEMA },
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return {
    async signInAnonymously() {
      const existing = await supabase.auth.getSession();
      const sessionUser = existing.data.session?.user;
      if (sessionUser) return sessionUser.id;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error !== null) throw error;
      const user = data.user;
      if (user === null) throw new Error('sign-in anônimo sem usuário');
      return user.id;
    },
    async upsertPlayer(player) {
      const { error } = await supabase
        .from(TABLES.players)
        .upsert({ id: player.id, name: player.name, avatar: player.avatar });
      if (error !== null) throw error;
    },
  };
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/online/client.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/services/online/client.ts tests/online/client.test.ts
git commit -m "feat(6.2): seam OnlineClient (memory spy + casca supabase real)"
```

---

### Task 3: `OnlineService` reativo

**Files:**
- Create: `src/services/online/index.ts`
- Test: `tests/online/online.service.test.ts`

**Interfaces:**
- Consumes: `OnlineConfig`/`parseOnlineConfig` (Task 1); `OnlineClient`/`memoryOnlineClient`
  (Task 2); `profileService`/`avatarFor` de `@services/profile`.
- Produces: `onlineService` singleton com
  `globalPlayerId: ReadonlySignal<string | null>`,
  `status: ReadonlySignal<OnlineStatus>` (`'offline'|'connecting'|'online'|'error'`),
  `init(deps?: { client?: OnlineClient | null; config?: OnlineConfig | null; profile?: ProfileLike }): Promise<void>`.
  `ProfileLike = { activeProfile: ReadonlySignal<Profile | null> }`.

**Notas de implementação:**
- `init` recebe deps injetáveis (default: `config = onlineConfig()`,
  `client = config ? createSupabaseClient(config) : null`, `profile = profileService`).
- Se `config`/`client` nulo ⇒ status `offline` e retorna sem sign-in.
- Senão status `connecting`; `await client.signInAnonymously()`; on success seta id + status
  `online` + `syncActiveProfile()`; catch ⇒ status `error` (id `null`, engole o erro).
- `syncActiveProfile()`: só quando `online` e há perfil ativo; monta `avatar` = `String(hue)`
  de `avatarFor(profile)`; **guarda de dedup** por assinatura `id|name|avatar` (não faz
  upsert redundante); best-effort (catch engole erro de rede sem mudar status).
- No sucesso do init, monta um `effect` que assina `profile.activeProfile` e chama
  `syncActiveProfile()`. `init` reentrante: descarta o `effect` anterior (molde `AudioService`).

- [ ] **Step 1: Escrever o teste que falha** — `tests/online/online.service.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import { onlineService } from '@services/online';
import { memoryOnlineClient } from '@services/online/client';
import type { Profile } from '@services/profile';

function fakeProfile(p: Profile | null) {
  const s = signal<Profile | null>(p);
  const view: { activeProfile: ReadonlySignal<Profile | null> } = {
    activeProfile: computed(() => s.value),
  };
  return { s, view };
}

const rex: Profile = { id: 'p1', name: 'Rex', createdAt: 0 };

describe('OnlineService', () => {
  beforeEach(async () => {
    // reset entre testes: init offline zera os sinais
    await onlineService.init({ config: null, client: null });
  });

  it('sem config ⇒ status offline, id null, sem sign-in', async () => {
    const client = memoryOnlineClient();
    await onlineService.init({ config: null, client });
    expect(onlineService.status.value).toBe('offline');
    expect(onlineService.globalPlayerId.value).toBeNull();
    expect(client.signInCount).toBe(0);
  });

  it('com config ⇒ online, id = uid, 1 upsert do perfil ativo', async () => {
    const client = memoryOnlineClient({ uid: 'uid-9' });
    const { view } = fakeProfile(rex);
    await onlineService.init({
      config: { url: 'u', anonKey: 'k' },
      client,
      profile: view,
    });
    expect(onlineService.status.value).toBe('online');
    expect(onlineService.globalPlayerId.value).toBe('uid-9');
    expect(client.upserts).toHaveLength(1);
    expect(client.upserts[0]).toMatchObject({ id: 'uid-9', name: 'Rex' });
  });

  it('trocar de perfil ⇒ re-upsert; sem mudança ⇒ sem upsert redundante', async () => {
    const client = memoryOnlineClient({ uid: 'uid-9' });
    const { s, view } = fakeProfile(rex);
    await onlineService.init({ config: { url: 'u', anonKey: 'k' }, client, profile: view });
    expect(client.upserts).toHaveLength(1);
    s.value = { id: 'p2', name: 'Ptera', createdAt: 0 };
    expect(client.upserts).toHaveLength(2);
    s.value = { id: 'p2', name: 'Ptera', createdAt: 0 }; // mesma assinatura
    expect(client.upserts).toHaveLength(2);
  });

  it('sign-in falha ⇒ status error, id null, não lança', async () => {
    const client = memoryOnlineClient({ failSignIn: true });
    const { view } = fakeProfile(rex);
    await onlineService.init({ config: { url: 'u', anonKey: 'k' }, client, profile: view });
    expect(onlineService.status.value).toBe('error');
    expect(onlineService.globalPlayerId.value).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/online/online.service.test.ts`
Expected: FAIL — módulo `index` inexistente.

- [ ] **Step 3: Implementar** — `src/services/online/index.ts`

```ts
import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import { profileService, avatarFor, type Profile } from '@services/profile';
import { onlineConfig, type OnlineConfig } from './config';
import {
  createSupabaseClient,
  type OnlineClient,
  type OnlinePlayer,
} from './client';

export type OnlineStatus = 'offline' | 'connecting' | 'online' | 'error';

interface ProfileLike {
  readonly activeProfile: ReadonlySignal<Profile | null>;
}

export interface OnlineInitDeps {
  config?: OnlineConfig | null;
  client?: OnlineClient | null;
  profile?: ProfileLike;
}

function signatureOf(p: OnlinePlayer): string {
  return `${p.id}|${p.name}|${p.avatar}`;
}

class OnlineService {
  private readonly _id = signal<string | null>(null);
  private readonly _status = signal<OnlineStatus>('offline');
  private client: OnlineClient | null = null;
  private profile: ProfileLike = profileService;
  private lastSignature: string | null = null;
  private disposeEffect: (() => void) | null = null;

  readonly globalPlayerId: ReadonlySignal<string | null> = computed(() => this._id.value);
  readonly status: ReadonlySignal<OnlineStatus> = computed(() => this._status.value);

  async init(deps: OnlineInitDeps = {}): Promise<void> {
    // Reentrante: descarta a assinatura de perfil anterior.
    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this._id.value = null;
    this.lastSignature = null;

    const config =
      deps.config !== undefined ? deps.config : onlineConfig();
    const client =
      deps.client !== undefined
        ? deps.client
        : config !== null
          ? createSupabaseClient(config)
          : null;
    this.profile = deps.profile ?? profileService;
    this.client = client;

    if (config === null || client === null) {
      this._status.value = 'offline';
      return;
    }

    this._status.value = 'connecting';
    try {
      const uid = await client.signInAnonymously();
      this._id.value = uid;
      this._status.value = 'online';
      this.syncActiveProfile();
      // Re-sincroniza ao trocar/renomear o perfil ativo.
      this.disposeEffect = effect(() => {
        // lê o sinal p/ assinar; a lógica de dedup evita upsert redundante
        void this.profile.activeProfile.value;
        this.syncActiveProfile();
      });
    } catch {
      this._id.value = null;
      this._status.value = 'error';
    }
  }

  private syncActiveProfile(): void {
    if (this._status.value !== 'online') return;
    const id = this._id.value;
    if (id === null) return;
    const active = this.profile.activeProfile.value;
    if (active === null) return;
    const { hue } = avatarFor(active);
    const player: OnlinePlayer = { id, name: active.name, avatar: String(hue) };
    const sig = signatureOf(player);
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;
    void this.client?.upsertPlayer(player).catch(() => {
      // best-effort: falha de rede não derruba o status nem propaga
    });
  }
}

export const onlineService = new OnlineService();
export type { OnlineConfig } from './config';
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/online/online.service.test.ts`
Expected: PASS (4 testes).

Nota: o `effect` dispara `syncActiveProfile` uma vez ao ser criado (após o upsert inicial),
mas a guarda `lastSignature` evita um 2º upsert com a mesma assinatura ⇒ o teste do connect
vê exatamente 1 upsert.

- [ ] **Step 5: Commit**

```bash
git add src/services/online/index.ts tests/online/online.service.test.ts
git commit -m "feat(6.2): OnlineService reativo (sign-in anônimo + sync do perfil, offline-first)"
```

---

### Task 4: i18n + UI de status na ProfileScreen + fiação no bootstrap

**Files:**
- Modify: `src/locales/*.json` (10 arquivos) — via skill `add-locale`
- Modify: `src/app/screens/ProfileScreen.tsx`
- Modify: `src/app/main.tsx`
- Test: `tests/i18n/locales.test.ts` (paridade — já existente, deve continuar verde)

**Interfaces:**
- Consumes: `onlineService.status`/`globalPlayerId` (Task 3).

- [ ] **Step 1: Adicionar chaves i18n via skill**

Invoque a skill `add-locale` para adicionar, nos **10 locales**, as chaves:
- `online.title` (ex.: en `"Online"`)
- `online.status.offline` (en `"Offline"`)
- `online.status.connecting` (en `"Connecting…"`)
- `online.status.online` (en `"Online"`)
- `online.status.error` (en `"Connection error"`)
- `online.globalId` (en `"Global ID"`) — rótulo

Traduções nativas por locale. Garanta paridade (o teste `tests/i18n/locales.test.ts` cobre).

- [ ] **Step 2: Rodar a guarda de i18n (deve passar)**

Run: `npx vitest run tests/i18n`
Expected: PASS — paridade e scanner de hardcoded verdes com as novas chaves.

- [ ] **Step 3: Adicionar o bloco de status na `ProfileScreen`**

Em `src/app/screens/ProfileScreen.tsx`, importe o serviço e leia os sinais no topo do
componente (assinatura reativa), e renderize um bloco read-only **após** o
`profile-header`:

```tsx
// no topo do arquivo:
import { onlineService } from '@services/online';

// dentro de ProfileScreen(), junto às outras leituras de sinais:
const onlineStatus = onlineService.status.value;
const globalId = onlineService.globalPlayerId.value;

// no JSX, logo após o bloco `{active !== null && (...)}`:
<div class="online-status" data-testid="online-status">
  <span class="online-status__label">{i18n.t('online.title')}</span>
  <span class="online-status__value">{i18n.t(`online.status.${onlineStatus}`)}</span>
  {globalId !== null && (
    <span class="online-status__id">
      {i18n.t('online.globalId')}: {globalId.slice(0, 8)}
    </span>
  )}
</div>
```

Nota de tipo: `i18n.t(\`online.status.${onlineStatus}\`)` — `onlineStatus` é a união
`OnlineStatus`, então a chave é sempre uma das 4 existentes (sem risco de chave ausente).

- [ ] **Step 4: Fiar o init no bootstrap** — `src/app/main.tsx`

Após `profileService.init();` (o perfil precisa existir p/ emprestar nome/avatar), adicione:

```ts
import { onlineService } from '@services/online';
// ...
profileService.init();
void onlineService.init(); // fire-and-forget, não-bloqueante
```

- [ ] **Step 5: Verificar typecheck + suíte cheia**

Run: `npm run check && npm test`
Expected: `check` limpo; todos os testes verdes (incluindo os 12 novos de `online`).

- [ ] **Step 6: Commit**

```bash
git add src/locales src/app/screens/ProfileScreen.tsx src/app/main.tsx
git commit -m "feat(6.2): status online + ID global na ProfileScreen + i18n 10 locales + fiação"
```

---

## Verificação final (antes de fechar o item)

- [ ] `npm run check` limpo.
- [ ] `npm test` verde.
- [ ] `npm run test:determinism` — **67 inalterado** (core intocado).
- [ ] (Se `.env` configurado) smoke Playwright: `ProfileScreen` mostra status `online` + ID;
      sem `.env`, mostra `offline` e o jogo funciona igual.
- [ ] Marcar 6.2 `[x]` em `docs/roadmap/PHASE-06-online-supabase.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md`.
