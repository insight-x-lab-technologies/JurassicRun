# Entitlements + Expansões (4.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o `EntitlementsService` (honor-system, provider plugável) + a tela de Expansões (desbloquear/selecionar expansão cosmética ativa) + ligar o botão de Doação do Home.

**Architecture:** Novo serviço global `src/services/entitlements/` no padrão puro×casca (catalog/provider/store/storage puros × service reativo com `@preact/signals`), molde de `services/wallet` e `services/nest`. Tela `ExpansionsScreen` no molde de `NestScreen`. Doação = módulo fino injetável `src/app/home/donate.ts`. **`src/core/` NÃO é tocado** ⇒ determinismo 67 intacto (expansões são cosméticas por ADR-0003; o efeito visual real é a Fase 8, aqui só o seam `activeExpansion`).

**Tech Stack:** TypeScript estrito, Preact + `@preact/signals`, Vitest (+ happy-dom p/ testes de componente), i18next (10 locales), Vite (rolldown-vite).

## Global Constraints

- **Determinismo:** nada em `src/core/`; nenhuma mudança em `WorldState`/`hashState`/RNG. (CLAUDE.md REGRA 1.)
- **i18n:** nenhuma string visível hardcoded; toda chave nova entra nos **10 locales** com paridade (teste `tests/i18n/locales.test.ts`). (REGRA 4.)
- **Padrão puro×casca:** lógica pura sem IO/`Date`/`Math.random`/`localStorage`; IO só na casca injetável. Serviços são singletons reativos com `init(storage?)`.
- **TS estrito:** sem `any` sem justificativa; `exactOptionalPropertyTypes` ligado (só definir chaves opcionais quando existem).
- **Aliases:** `@core/*`, `@services/*`, `@app/*`, `@i18n/*`.
- **Commits:** um por task, mensagem descritiva, terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verificação:** cada task fecha com `npx vitest run <arquivos>` verde; a task final roda `npm run check` + `npm test`.

---

### Task 1: Catálogo de expansões + provider honor-system

**Files:**
- Create: `src/services/entitlements/catalog.ts`
- Create: `src/services/entitlements/provider.ts`
- Test: `tests/services/entitlements/catalog.test.ts`
- Test: `tests/services/entitlements/provider.test.ts`

**Interfaces:**
- Produces: `ExpansionTier`, `ExpansionDef {id,tier,nameKey,descKey,hue}`, `DEFAULT_EXPANSION_ID`, `EXPANSION_CATALOG`, `expansionById(id)`; `UnlockOutcome`, `EntitlementProvider {requestUnlock(id):UnlockOutcome}`, `honorSystemProvider`.

- [ ] **Step 1: Write the failing tests**

`tests/services/entitlements/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  EXPANSION_CATALOG,
  DEFAULT_EXPANSION_ID,
  expansionById,
} from '@services/entitlements/catalog';

describe('expansion catalog', () => {
  it('tem ids únicos', () => {
    const ids = EXPANSION_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inclui a expansão default como free', () => {
    const def = expansionById(DEFAULT_EXPANSION_ID);
    expect(def).toBeDefined();
    expect(def!.tier).toBe('free');
  });

  it('as demais expansões são premium', () => {
    for (const e of EXPANSION_CATALOG) {
      if (e.id !== DEFAULT_EXPANSION_ID) expect(e.tier).toBe('premium');
    }
  });

  it('expansionById devolve undefined para id desconhecido', () => {
    expect(expansionById('nope')).toBeUndefined();
  });

  it('cada expansão tem chaves i18n de nome e descrição', () => {
    for (const e of EXPANSION_CATALOG) {
      expect(e.nameKey).toBe(`expansion.${e.id}.name`);
      expect(e.descKey).toBe(`expansion.${e.id}.desc`);
    }
  });
});
```

`tests/services/entitlements/provider.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { honorSystemProvider } from '@services/entitlements/provider';

describe('honorSystemProvider', () => {
  it('concede o desbloqueio de qualquer id (honor-system)', () => {
    expect(honorSystemProvider.requestUnlock('volcano')).toBe('granted');
    expect(honorSystemProvider.requestUnlock('qualquer')).toBe('granted');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/entitlements/catalog.test.ts tests/services/entitlements/provider.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implement catalog + provider**

`src/services/entitlements/catalog.ts`:
```ts
export type ExpansionTier = 'free' | 'premium';

/** Definição de meta de uma expansão cosmética (ADR-0003). Arte real = Fase 8. */
export interface ExpansionDef {
  readonly id: string;
  readonly tier: ExpansionTier;
  readonly nameKey: string; // chave i18n do nome
  readonly descKey: string; // chave i18n da descrição
  readonly hue: number;     // matiz do card placeholder, até a arte da Fase 8
}

export const DEFAULT_EXPANSION_ID = 'classic';

/** Catálogo de expansões. `classic` é o look atual (free); demais são premium placeholders. */
export const EXPANSION_CATALOG: readonly ExpansionDef[] = Object.freeze([
  { id: 'classic', tier: 'free',    nameKey: 'expansion.classic.name', descKey: 'expansion.classic.desc', hue: 200 },
  { id: 'volcano', tier: 'premium', nameKey: 'expansion.volcano.name', descKey: 'expansion.volcano.desc', hue: 12  },
  { id: 'glacier', tier: 'premium', nameKey: 'expansion.glacier.name', descKey: 'expansion.glacier.desc', hue: 190 },
]);

export function expansionById(id: string): ExpansionDef | undefined {
  return EXPANSION_CATALOG.find((e) => e.id === id);
}
```

`src/services/entitlements/provider.ts`:
```ts
/** Resultado de uma solicitação de desbloqueio a um provider. */
export type UnlockOutcome = 'granted' | 'declined';

/**
 * Seam de monetização (ADR-0004). v1 = honor-system (concede na hora, sem cobrança).
 * Um gateway real (Ko-Fi/Stripe + validação) troca a implementação SEM tocar consumidores.
 */
export interface EntitlementProvider {
  requestUnlock(id: string): UnlockOutcome;
}

export const honorSystemProvider: EntitlementProvider = {
  requestUnlock: () => 'granted',
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/entitlements/catalog.test.ts tests/services/entitlements/provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entitlements/catalog.ts src/services/entitlements/provider.ts tests/services/entitlements/catalog.test.ts tests/services/entitlements/provider.test.ts
git commit -m "feat(4.6): catálogo de expansões + provider honor-system (seam ADR-0004)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Estado puro dos entitlements (`store.ts`)

**Files:**
- Create: `src/services/entitlements/store.ts`
- Test: `tests/services/entitlements/store.test.ts`

**Interfaces:**
- Consumes: `EXPANSION_CATALOG`, `DEFAULT_EXPANSION_ID`, `expansionById` (Task 1).
- Produces: `EntitlementsState {unlocked:readonly string[], activeId:string}`, `UnlockResult`, `initialEntitlementsState()`, `isUnlocked(state,id)`, `unlock(state,id):{state,result}`, `setActive(state,id):EntitlementsState`.

- [ ] **Step 1: Write the failing test**

`tests/services/entitlements/store.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  initialEntitlementsState,
  isUnlocked,
  unlock,
  setActive,
} from '@services/entitlements/store';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';

describe('entitlements store', () => {
  it('inicia com a expansão default desbloqueada e ativa', () => {
    const s = initialEntitlementsState();
    expect(s.unlocked).toEqual([DEFAULT_EXPANSION_ID]);
    expect(s.activeId).toBe(DEFAULT_EXPANSION_ID);
    expect(isUnlocked(s, DEFAULT_EXPANSION_ID)).toBe(true);
  });

  it('unlock adiciona a expansão e é imutável', () => {
    const s = initialEntitlementsState();
    const { state, result } = unlock(s, 'volcano');
    expect(result).toBe('ok');
    expect(state.unlocked).toContain('volcano');
    expect(s.unlocked).not.toContain('volcano'); // original intacto
    expect(state.activeId).toBe(DEFAULT_EXPANSION_ID); // unlock NÃO ativa
  });

  it('unlock é idempotente', () => {
    const s = unlock(initialEntitlementsState(), 'volcano').state;
    const { state, result } = unlock(s, 'volcano');
    expect(result).toBe('alreadyUnlocked');
    expect(state).toBe(s);
  });

  it('unlock de id fora do catálogo é unknown', () => {
    const s = initialEntitlementsState();
    const { state, result } = unlock(s, 'nope');
    expect(result).toBe('unknown');
    expect(state).toBe(s);
  });

  it('setActive só ativa expansão desbloqueada', () => {
    const s = initialEntitlementsState();
    expect(setActive(s, 'volcano')).toBe(s); // não desbloqueada ⇒ no-op
    const unlocked = unlock(s, 'volcano').state;
    const active = setActive(unlocked, 'volcano');
    expect(active.activeId).toBe('volcano');
    expect(active.unlocked).toEqual(unlocked.unlocked);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/entitlements/store.test.ts`
Expected: FAIL (`store` não existe).

- [ ] **Step 3: Implement `store.ts`**

`src/services/entitlements/store.ts`:
```ts
import { DEFAULT_EXPANSION_ID, expansionById } from './catalog';

export interface EntitlementsState {
  readonly unlocked: readonly string[]; // sempre inclui DEFAULT_EXPANSION_ID
  readonly activeId: string;            // sempre um id desbloqueado
}

export type UnlockResult = 'ok' | 'alreadyUnlocked' | 'unknown';

export function initialEntitlementsState(): EntitlementsState {
  return { unlocked: [DEFAULT_EXPANSION_ID], activeId: DEFAULT_EXPANSION_ID };
}

export function isUnlocked(state: EntitlementsState, id: string): boolean {
  return state.unlocked.includes(id);
}

/** Desbloqueia uma expansão do catálogo. Idempotente. NÃO ativa. Imutável. */
export function unlock(
  state: EntitlementsState,
  id: string,
): { state: EntitlementsState; result: UnlockResult } {
  if (expansionById(id) === undefined) return { state, result: 'unknown' };
  if (isUnlocked(state, id)) return { state, result: 'alreadyUnlocked' };
  return { state: { ...state, unlocked: [...state.unlocked, id] }, result: 'ok' };
}

/** Ativa uma expansão desbloqueada; no-op (retorna o mesmo estado) se não estiver. */
export function setActive(state: EntitlementsState, id: string): EntitlementsState {
  if (!isUnlocked(state, id)) return state;
  return { ...state, activeId: id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/entitlements/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entitlements/store.ts tests/services/entitlements/store.test.ts
git commit -m "feat(4.6): estado puro dos entitlements (unlock/setActive imutáveis)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Persistência (`storage.ts`)

**Files:**
- Create: `src/services/entitlements/storage.ts`
- Test: `tests/services/entitlements/storage.test.ts`

**Interfaces:**
- Consumes: `EntitlementsState`, `initialEntitlementsState` (Task 2); `DEFAULT_EXPANSION_ID`, `expansionById` (Task 1).
- Produces: `EntitlementsStorage {load,save}`, `STORAGE_KEY`, `memoryEntitlementsStorage(initial?)`, `localStorageEntitlementsStorage()`.

- [ ] **Step 1: Write the failing test**

`tests/services/entitlements/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryEntitlementsStorage,
  localStorageEntitlementsStorage,
  STORAGE_KEY,
} from '@services/entitlements/storage';
import { initialEntitlementsState } from '@services/entitlements/store';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';

describe('entitlements storage', () => {
  it('memory faz round-trip', () => {
    const s = memoryEntitlementsStorage();
    s.save({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
    expect(s.load().activeId).toBe('volcano');
  });

  describe('localStorage', () => {
    beforeEach(() => localStorage.clear());

    it('sem valor devolve o estado inicial', () => {
      expect(localStorageEntitlementsStorage().load()).toEqual(initialEntitlementsState());
    });

    it('faz round-trip real', () => {
      const store = localStorageEntitlementsStorage();
      store.save({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
      expect(store.load()).toEqual({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
    });

    it('JSON inválido cai no estado inicial', () => {
      localStorage.setItem(STORAGE_KEY, '{corrompido');
      expect(localStorageEntitlementsStorage().load()).toEqual(initialEntitlementsState());
    });

    it('filtra ids desconhecidos e garante o DEFAULT', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: ['fantasma', 'volcano'], activeId: 'fantasma' }));
      const s = localStorageEntitlementsStorage().load();
      expect(s.unlocked).toContain(DEFAULT_EXPANSION_ID);
      expect(s.unlocked).toContain('volcano');
      expect(s.unlocked).not.toContain('fantasma');
    });

    it('activeId não-desbloqueado resolve para o DEFAULT', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: [DEFAULT_EXPANSION_ID], activeId: 'volcano' }));
      expect(localStorageEntitlementsStorage().load().activeId).toBe(DEFAULT_EXPANSION_ID);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/entitlements/storage.test.ts`
Expected: FAIL (`storage` não existe).

- [ ] **Step 3: Implement `storage.ts`** (molde de `src/services/nest/storage.ts`)

`src/services/entitlements/storage.ts`:
```ts
import { initialEntitlementsState, type EntitlementsState } from './store';
import { DEFAULT_EXPANSION_ID, expansionById } from './catalog';

export interface EntitlementsStorage {
  load(): EntitlementsState;
  save(state: EntitlementsState): void;
}

export const STORAGE_KEY = 'jurassicrun.entitlements.v1';

export function memoryEntitlementsStorage(
  initial: EntitlementsState = initialEntitlementsState(),
): EntitlementsStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function sanitize(unlocked: readonly string[], activeId: unknown): EntitlementsState {
  // só ids conhecidos; DEFAULT sempre desbloqueado; activeId resolve p/ um desbloqueado.
  const known = unlocked.filter((id) => expansionById(id) !== undefined);
  const set = new Set<string>([DEFAULT_EXPANSION_ID, ...known]);
  const unlockedArr = [...set];
  const active =
    typeof activeId === 'string' && unlockedArr.includes(activeId) ? activeId : DEFAULT_EXPANSION_ID;
  return { unlocked: unlockedArr, activeId: active };
}

function parseState(raw: string): EntitlementsState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return initialEntitlementsState();
    const d = data as Record<string, unknown>;
    const unlocked = Array.isArray(d.unlocked)
      ? d.unlocked.filter((x): x is string => typeof x === 'string')
      : [];
    return sanitize(unlocked, d.activeId);
  } catch {
    return initialEntitlementsState();
  }
}

export function localStorageEntitlementsStorage(): EntitlementsStorage {
  return {
    load(): EntitlementsState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialEntitlementsState() : parseState(raw);
      } catch {
        return initialEntitlementsState();
      }
    },
    save(state: EntitlementsState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/entitlements/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entitlements/storage.ts tests/services/entitlements/storage.test.ts
git commit -m "feat(4.6): persistência de entitlements (localStorage v1, parseState robusto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `EntitlementsService` reativo + wiring no bootstrap

**Files:**
- Create: `src/services/entitlements/index.ts`
- Modify: `src/app/main.tsx` (adicionar `entitlementsService.init()`)
- Test: `tests/services/entitlements/service.test.ts`

**Interfaces:**
- Consumes: tudo de Tasks 1–3.
- Produces: `entitlementsService` singleton com `unlockedIds:ReadonlySignal<readonly string[]>`, `activeExpansion:ReadonlySignal<ExpansionDef>`, `init(storage?,provider?)`, `unlock(id):UnlockResult`, `select(id):void`. Reexporta `EXPANSION_CATALOG`, `DEFAULT_EXPANSION_ID`, `expansionById`, `isUnlocked`, tipos.

- [ ] **Step 1: Write the failing test**

`tests/services/entitlements/service.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';
import type { EntitlementProvider } from '@services/entitlements/provider';

const decliningProvider: EntitlementProvider = { requestUnlock: () => 'declined' };

describe('EntitlementsService', () => {
  beforeEach(() => {
    entitlementsService.init(memoryEntitlementsStorage());
  });

  it('inicia com a expansão default ativa e desbloqueada', () => {
    expect(entitlementsService.activeExpansion.value.id).toBe(DEFAULT_EXPANSION_ID);
    expect(entitlementsService.unlockedIds.value).toEqual([DEFAULT_EXPANSION_ID]);
  });

  it('unlock concede via provider, muta o sinal e persiste', () => {
    const storage = memoryEntitlementsStorage();
    entitlementsService.init(storage);
    expect(entitlementsService.unlock('volcano')).toBe('ok');
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(storage.load().unlocked).toContain('volcano');
  });

  it('unlock com provider que declina não muta o estado', () => {
    entitlementsService.init(memoryEntitlementsStorage(), decliningProvider);
    expect(entitlementsService.unlock('volcano')).toBe('unknown');
    expect(entitlementsService.unlockedIds.value).not.toContain('volcano');
  });

  it('select de expansão desbloqueada muda a ativa e persiste', () => {
    const storage = memoryEntitlementsStorage();
    entitlementsService.init(storage);
    entitlementsService.unlock('volcano');
    entitlementsService.select('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
    expect(storage.load().activeId).toBe('volcano');
  });

  it('select de expansão não desbloqueada é no-op', () => {
    entitlementsService.init(memoryEntitlementsStorage());
    entitlementsService.select('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe(DEFAULT_EXPANSION_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/entitlements/service.test.ts`
Expected: FAIL (`@services/entitlements` sem `index`).

- [ ] **Step 3: Implement `index.ts`** (molde de `src/services/nest/index.ts`)

`src/services/entitlements/index.ts`:
```ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialEntitlementsState,
  unlock as unlockState,
  setActive,
  type EntitlementsState,
  type UnlockResult,
} from './store';
import { expansionById, DEFAULT_EXPANSION_ID, type ExpansionDef } from './catalog';
import {
  localStorageEntitlementsStorage,
  memoryEntitlementsStorage,
  type EntitlementsStorage,
} from './storage';
import { honorSystemProvider, type EntitlementProvider } from './provider';

class EntitlementsService {
  private storage: EntitlementsStorage = memoryEntitlementsStorage();
  private provider: EntitlementProvider = honorSystemProvider;
  private readonly _state = signal<EntitlementsState>(initialEntitlementsState());

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(
    () => this._state.value.unlocked,
  );
  /** SEAM da Fase 8: o render lê a expansão ativa daqui. Sempre um ExpansionDef válido. */
  readonly activeExpansion: ReadonlySignal<ExpansionDef> = computed(
    () => expansionById(this._state.value.activeId) ?? expansionById(DEFAULT_EXPANSION_ID)!,
  );

  init(
    storage: EntitlementsStorage = localStorageEntitlementsStorage(),
    provider: EntitlementProvider = honorSystemProvider,
  ): void {
    this.storage = storage;
    this.provider = provider;
    this._state.value = storage.load();
  }

  /** Solicita o desbloqueio via provider; só aplica/persiste em 'granted'. */
  unlock(id: string): UnlockResult {
    if (this.provider.requestUnlock(id) !== 'granted') return 'unknown';
    const { state, result } = unlockState(this._state.value, id);
    if (result === 'ok') this.commit(state);
    return result;
  }

  select(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  private commit(state: EntitlementsState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const entitlementsService = new EntitlementsService();
export { EXPANSION_CATALOG, DEFAULT_EXPANSION_ID, expansionById } from './catalog';
export type { ExpansionDef, ExpansionTier } from './catalog';
export { isUnlocked, type EntitlementsState, type UnlockResult } from './store';
```

Nota sobre `select` no-op: `setActive` devolve o **mesmo** objeto de estado quando o id não está
desbloqueado; `commit` reatribui o mesmo valor ao sinal (sem efeito observável) e re-salva o mesmo
estado (idempotente). Aceito — espelha `nestService.select`.

- [ ] **Step 4: Wire no bootstrap**

Em `src/app/main.tsx`, importe e inicialize junto dos demais serviços:
```ts
import { entitlementsService } from '@services/entitlements';
```
E dentro de `bootstrap()`, após `walletService.init();`:
```ts
  entitlementsService.init();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/services/entitlements/`
Expected: PASS (todos os arquivos da pasta).

- [ ] **Step 6: Commit**

```bash
git add src/services/entitlements/index.ts src/app/main.tsx tests/services/entitlements/service.test.ts
git commit -m "feat(4.6): EntitlementsService reativo (unlock via provider, seam activeExpansion) + init

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Chaves i18n de Expansões (10 locales)

**Files:**
- Modify: `src/i18n/locales/{en,es,pt-BR,fr,it,de,ja,zh,ko,hi}.json`
- Test (existente, gate): `tests/i18n/locales.test.ts`

**Interfaces:**
- Produces: chaves `expansions.{title,active,select,unlock,honorNote,back}` e
  `expansion.{classic,volcano,glacier}.{name,desc}` em todos os 10 locales (paridade com `en`).

- [ ] **Step 1: Invoke the `add-locale` skill** com as chaves abaixo (fonte `en`), que gera/valida os 10 idiomas. Bloco `en` a inserir (nível superior do JSON, ao lado de `nest`/`shop`):

```json
  "expansions": {
    "title": "Expansions",
    "active": "Active",
    "select": "Select",
    "unlock": "Unlock",
    "honorNote": "Honor system — unlock instantly, no payment. Please consider supporting the game with a donation.",
    "back": "Back"
  },
  "expansion": {
    "classic": { "name": "Classic", "desc": "The original look." },
    "volcano": { "name": "Volcano", "desc": "A fiery volcanic theme." },
    "glacier": { "name": "Glacier", "desc": "An icy glacier theme." }
  }
```

Traduza `title/active/select/unlock/honorNote/back` e os `name/desc` de cada expansão nativamente
em es, pt-BR, fr, it, de, ja, zh, ko, hi (o nome próprio da expansão pode ser transliterado/mantido
quando fizer sentido). **Não** deixar nenhuma chave só em inglês.

- [ ] **Step 2: Run the locales parity test**

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: PASS (paridade de chaves em todos os locales).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n(4.6): chaves de Expansões (expansions.* + expansion.<id>.*) nos 10 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Tela de Expansões + rota

**Files:**
- Create: `src/app/screens/ExpansionsScreen.tsx`
- Modify: `src/app/App.tsx` (case `expansions` → `<ExpansionsScreen />`)
- Test: `tests/app/expansions-screen.test.tsx`

**Interfaces:**
- Consumes: `entitlementsService`, `EXPANSION_CATALOG`, `isUnlocked`, `ExpansionDef` (Task 4); chaves i18n (Task 5).

- [ ] **Step 1: Write the failing test** (molde de `tests/app/nest-screen.test.tsx`)

`tests/app/expansions-screen.test.tsx`:
```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { ExpansionsScreen } from '@app/screens/ExpansionsScreen';
import { i18n } from '@services/i18n';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('ExpansionsScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    entitlementsService.init(memoryEntitlementsStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ExpansionsScreen />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra o selo Ativo na expansão default e botão Unlock nas premium', () => {
    expect(container.querySelector('[data-testid="expansion-active-classic"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="expansion-unlock-volcano"]')).not.toBeNull();
  });

  it('unlock (honor-system) troca o card para Select', async () => {
    click(container.querySelector('[data-testid="expansion-unlock-volcano"]'));
    await Promise.resolve(); // flush do signal (gotcha happy-dom)
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(container.querySelector('[data-testid="expansion-select-volcano"]')).not.toBeNull();
  });

  it('select ativa a expansão desbloqueada', async () => {
    entitlementsService.unlock('volcano');
    render(<ExpansionsScreen />, container);
    click(container.querySelector('[data-testid="expansion-select-volcano"]'));
    await Promise.resolve();
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/expansions-screen.test.tsx`
Expected: FAIL (`ExpansionsScreen` não existe).

- [ ] **Step 3: Implement `ExpansionsScreen.tsx`** (molde de `NestScreen.tsx`)

`src/app/screens/ExpansionsScreen.tsx`:
```tsx
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import {
  entitlementsService,
  EXPANSION_CATALOG,
  isUnlocked,
  type ExpansionDef,
} from '@services/entitlements';

function ExpansionCard({
  exp,
  active,
  unlocked,
}: {
  exp: ExpansionDef;
  active: boolean;
  unlocked: boolean;
}): VNode {
  return (
    <li class="expansion-card" data-testid={`expansion-card-${exp.id}`}>
      <div
        class="expansion-card__avatar"
        aria-hidden="true"
        style={{ backgroundColor: `hsl(${exp.hue}, 60%, 45%)` }}
      />
      <h2 class="expansion-card__name">{i18n.t(exp.nameKey)}</h2>
      <p class="expansion-card__desc">{i18n.t(exp.descKey)}</p>
      {active ? (
        <span class="expansion-card__badge" data-testid={`expansion-active-${exp.id}`}>
          {i18n.t('expansions.active')}
        </span>
      ) : unlocked ? (
        <button
          type="button"
          class="btn btn--ghost"
          data-testid={`expansion-select-${exp.id}`}
          onClick={() => entitlementsService.select(exp.id)}
        >
          {i18n.t('expansions.select')}
        </button>
      ) : (
        <button
          type="button"
          class="btn"
          data-testid={`expansion-unlock-${exp.id}`}
          onClick={() => entitlementsService.unlock(exp.id)}
        >
          {i18n.t('expansions.unlock')}
        </button>
      )}
    </li>
  );
}

export function ExpansionsScreen(): VNode {
  const activeId = entitlementsService.activeExpansion.value.id;
  const unlocked = entitlementsService.unlockedIds.value;

  return (
    <div class="screen expansions">
      <h1 class="screen__title">{i18n.t('expansions.title')}</h1>

      <ul class="expansions__grid">
        {EXPANSION_CATALOG.map((exp) => (
          <ExpansionCard
            key={exp.id}
            exp={exp}
            active={exp.id === activeId}
            unlocked={isUnlocked({ unlocked, activeId }, exp.id)}
          />
        ))}
      </ul>

      <p class="expansions__note">{i18n.t('expansions.honorNote')}</p>
      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('expansions.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Wire a rota** em `src/app/App.tsx`:

Adicione o import:
```tsx
import { ExpansionsScreen } from './screens/ExpansionsScreen';
```
E troque o `case 'expansions'`:
```tsx
    case 'expansions':
      return <ExpansionsScreen />;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/app/expansions-screen.test.tsx tests/app/App.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/screens/ExpansionsScreen.tsx src/app/App.tsx tests/app/expansions-screen.test.tsx
git commit -m "feat(4.6): tela de Expansões (unlock honor-system + select ativa) + rota

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Doação — ligar o botão do Home

**Files:**
- Create: `src/app/home/donate.ts`
- Modify: `src/app/screens/HomeScreen.tsx` (habilita o botão de doação)
- Test: `tests/app/home/donate.test.ts`

**Interfaces:**
- Produces: `DONATE_URL`, `DonateDeps {openUrl?}`, `openDonation(deps?)`, `defaultDonateDeps()`.

- [ ] **Step 1: Write the failing test** (molde de `tests/app/home/share.test.ts`)

`tests/app/home/donate.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { openDonation, DONATE_URL } from '@app/home/donate';

describe('openDonation', () => {
  it('abre a URL de doação via openUrl injetado', () => {
    const openUrl = vi.fn();
    openDonation({ openUrl });
    expect(openUrl).toHaveBeenCalledWith(DONATE_URL);
  });

  it('engole erro do openUrl (best-effort, não propaga)', () => {
    const openUrl = vi.fn(() => {
      throw new Error('bloqueado');
    });
    expect(() => openDonation({ openUrl })).not.toThrow();
  });

  it('no-op quando não há openUrl', () => {
    expect(() => openDonation({})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/home/donate.test.ts`
Expected: FAIL (`donate` não existe).

- [ ] **Step 3: Implement `donate.ts`** (molde fino de `home/share.ts`)

`src/app/home/donate.ts`:
```ts
/**
 * URL de doação (Ko-Fi/BuyMeACoffee). PLACEHOLDER — trocar pelo handle real antes do deploy
 * (Fase 7). Honor-system / ADR-0004.
 */
export const DONATE_URL = 'https://ko-fi.com/jurassicrun';

export interface DonateDeps {
  readonly openUrl?: (url: string) => void;
}

/** Abre a página de doação. Best-effort: engole erro (a UI segue viva). Deps injetáveis. */
export function openDonation(deps: DonateDeps = defaultDonateDeps()): void {
  const { openUrl } = deps;
  if (!openUrl) return;
  try {
    openUrl(DONATE_URL);
  } catch {
    // popup bloqueado / ambiente sem window; doação é best-effort.
  }
}

/** Casca: abre em nova aba com noopener. Não usar em teste. */
export function defaultDonateDeps(): DonateDeps {
  if (typeof window === 'undefined') return {};
  return { openUrl: (url) => window.open(url, '_blank', 'noopener') };
}
```

- [ ] **Step 4: Habilitar o botão no `HomeScreen.tsx`**

Adicione o import:
```tsx
import { openDonation, defaultDonateDeps } from '../home/donate';
```
Substitua o botão de doação (hoje `disabled` com `title` "em breve") por:
```tsx
          <button
            class="btn btn--ghost"
            data-testid="home-donate"
            onClick={() => openDonation(defaultDonateDeps())}
          >
            {i18n.t('nav.donate')}
          </button>
```
(Remova o comentário de stub e os atributos `disabled`/`title` daquele botão.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/app/home/donate.test.ts tests/app/home.test.tsx`
Expected: PASS (o teste do Home não asserta `disabled`, então continua verde).

- [ ] **Step 6: Commit**

```bash
git add src/app/home/donate.ts src/app/screens/HomeScreen.tsx tests/app/home/donate.test.ts
git commit -m "feat(4.6): botão de Doação do Home abre a URL (openDonation injetável, honor-system)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final da feature

**Files:** nenhum novo (gate de qualidade).

- [ ] **Step 1: Typecheck + lint completo**

Run: `npm run check`
Expected: limpo (sem erros de `tsc`/ESLint; o guard anti-não-determinismo continua verde pois `src/core/` não foi tocado).

- [ ] **Step 2: Suíte completa**

Run: `npm test`
Expected: verde (todos os testes, incluindo os novos de entitlements/expansions/donate e a paridade de locales).

- [ ] **Step 3: Determinismo (prova, não porque há risco)**

Run: `npm run test:determinism`
Expected: 67 testes de determinismo verdes, inalterados (`src/core/` intocado).

- [ ] **Step 4: Marcar item e atualizar memória do projeto**

- Em `docs/roadmap/PHASE-04-meta-offline.md`, marque os dois checkboxes do 4.6 como `[x]`.
- Em `CLAUDE.md`, atualize o campo "Estado atual": adicione o parágrafo do 4.6 concluído e ajuste
  "Próximo" para **4.7 (Troféus / conquistas)**.

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap/PHASE-04-meta-offline.md CLAUDE.md
git commit -m "docs(4.6): marca Entitlements+Expansões concluído + atualiza Estado atual (próximo 4.7)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notas de execução

- **Ordem:** Tasks 1→4 são o serviço (dependências lineares). Task 5 (i18n) antes da Task 6 (a
  tela usa as chaves; a paridade de locales é o gate). Task 7 é independente (pode ir em paralelo
  com 5/6, mas mantida sequencial p/ simplicidade). Task 8 fecha.
- **Determinismo:** nenhuma task toca `src/core/`. A Task 8 roda `verify-determinism` como prova.
- **Gotcha signals+happy-dom** (recorrente): em teste de componente, após um evento DOM que dispara
  atualização de sinal, use `await Promise.resolve()` antes de assertar o DOM re-renderizado.
- **CSS:** as classes `expansion-card*`/`expansions*` seguem os design tokens existentes; se faltar
  estilo, reusar as regras de `.nest`/`.dino-card` (cosmético, não bloqueia lógica/testes).
```

