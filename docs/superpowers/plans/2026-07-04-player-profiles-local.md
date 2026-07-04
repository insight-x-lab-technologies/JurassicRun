# Player Profiles (local) — 4.2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identidade local do jogador: primeiro acesso pede nome; criar/trocar/renomear jogador ativo; tela de Perfil real; persistência local.

**Architecture:** Padrão puro×casca. `src/services/profile/store.ts` (núcleo puro: modelo + operações + validação, sem IO/DOM/aleatoriedade). `src/services/profile/storage.ts` (adapter `localStorage` injetável + fallback in-memory). `src/services/profile/index.ts` (`ProfileService`: sinais `@preact/signals`, geração de id/tempo, persistência). UI em `src/app/screens/` (Onboarding via gate no `App`; ProfileScreen na rota `profile`). i18n nos 10 locales.

**Tech Stack:** TypeScript estrito, Preact + `@preact/signals` + `preact/hooks`, i18next (`@services/i18n`), Vitest (`node` + `happy-dom`), `crypto.randomUUID`, `localStorage`.

## Global Constraints

- **REGRA 1 (determinismo):** NÃO tocar `src/core/`. `Date.now()`/`crypto.randomUUID()` só na casca (`index.ts`/`storage.ts`), nunca no `store.ts` puro. Determinismo do core permanece 64 verde.
- **REGRA 4 (i18n):** nenhuma string visível hardcoded; toda chave nova nos 10 locales (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`); `tests/i18n/locales.test.ts` verde.
- **TypeScript estrito:** sem `any` sem justificativa. `npm run check` limpo.
- **Aliases:** `@services/*`→`src/services/*`, `@app/*`→`src/app/*`, `@i18n/*`→`src/i18n/*`.
- **Nome:** normalizar (trim + colapso de espaços), não-vazio, `NAME_MAX = 20`. Duplicatas permitidas.
- **Chave de storage:** `jurassicrun.profiles.v1`, payload `{ version: 1, profiles, activeId }`.
- **Testes de componente:** header `// @vitest-environment happy-dom`, `render`/`resetToHome` como em `tests/app/App.test.tsx`.
- **Commits:** um por task, mensagem `feat(4.2): …` / `test(4.2): …`.

---

### Task 1: Núcleo puro `store.ts` (modelo + validação + operações + avatar)

**Files:**
- Create: `src/services/profile/store.ts`
- Test: `tests/services/profile/store.test.ts`

**Interfaces:**
- Consumes: nada (módulo-folha puro).
- Produces:
  - `interface Profile { readonly id: string; readonly name: string; readonly createdAt: number }`
  - `interface ProfileState { readonly profiles: readonly Profile[]; readonly activeId: string | null }`
  - `type NameError = 'empty' | 'tooLong'`
  - `type NameValidation = { ok: true; name: string } | { ok: false; error: NameError }`
  - `const NAME_MAX = 20`
  - `function emptyState(): ProfileState`
  - `function normalizeName(raw: string): string`
  - `function validateName(raw: string): NameValidation`
  - `function createProfile(state: ProfileState, id: string, name: string, createdAt: number): { state: ProfileState; profile: Profile }`
  - `function setActive(state: ProfileState, id: string): ProfileState`
  - `function renameProfile(state: ProfileState, id: string, name: string): ProfileState`
  - `function activeProfile(state: ProfileState): Profile | null`
  - `function avatarFor(profile: Profile): { initial: string; hue: number }`

- [ ] **Step 1: Write the failing test**

Create `tests/services/profile/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  emptyState,
  normalizeName,
  validateName,
  createProfile,
  setActive,
  renameProfile,
  activeProfile,
  avatarFor,
  NAME_MAX,
  type ProfileState,
} from '@services/profile/store';

describe('profile store — validação e normalização', () => {
  it('normalizeName faz trim e colapsa espaços internos', () => {
    expect(normalizeName('  Rex   the   King ')).toBe('Rex the King');
  });

  it('validateName rejeita vazio/só espaços', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'empty' });
    expect(validateName('')).toEqual({ ok: false, error: 'empty' });
  });

  it('validateName rejeita nome longo demais (após normalizar)', () => {
    const long = 'x'.repeat(NAME_MAX + 1);
    expect(validateName(long)).toEqual({ ok: false, error: 'tooLong' });
  });

  it('validateName aceita e devolve o nome normalizado', () => {
    expect(validateName('  Ptero  ')).toEqual({ ok: true, name: 'Ptero' });
  });
});

describe('profile store — operações', () => {
  it('emptyState é vazio e sem ativo', () => {
    expect(emptyState()).toEqual({ profiles: [], activeId: null });
  });

  it('createProfile adiciona e torna o novo o ativo', () => {
    const { state, profile } = createProfile(emptyState(), 'id-1', 'Rex', 1000);
    expect(profile).toEqual({ id: 'id-1', name: 'Rex', createdAt: 1000 });
    expect(state.profiles).toEqual([profile]);
    expect(state.activeId).toBe('id-1');
  });

  it('createProfile preserva perfis anteriores e move o ativo para o novo', () => {
    const a = createProfile(emptyState(), 'id-1', 'A', 1).state;
    const b = createProfile(a, 'id-2', 'B', 2).state;
    expect(b.profiles.map((p) => p.id)).toEqual(['id-1', 'id-2']);
    expect(b.activeId).toBe('id-2');
  });

  it('setActive troca o ativo; no-op para id inexistente', () => {
    const base = createProfile(createProfile(emptyState(), 'id-1', 'A', 1).state, 'id-2', 'B', 2).state;
    expect(setActive(base, 'id-1').activeId).toBe('id-1');
    expect(setActive(base, 'nope').activeId).toBe('id-2');
  });

  it('renameProfile troca o nome; no-op para id inexistente', () => {
    const base = createProfile(emptyState(), 'id-1', 'A', 1).state;
    expect(renameProfile(base, 'id-1', 'Novo').profiles[0]!.name).toBe('Novo');
    expect(renameProfile(base, 'nope', 'X')).toEqual(base);
  });

  it('activeProfile devolve o ativo ou null', () => {
    expect(activeProfile(emptyState())).toBeNull();
    const s = createProfile(emptyState(), 'id-1', 'A', 1).state;
    expect(activeProfile(s)?.id).toBe('id-1');
  });
});

describe('profile store — avatarFor', () => {
  it('inicial é a 1ª letra maiúscula do nome', () => {
    expect(avatarFor({ id: 'id-1', name: 'rex', createdAt: 1 }).initial).toBe('R');
  });

  it('hue é determinístico por id e fica em [0,360)', () => {
    const p: Profile = { id: 'abc', name: 'Rex', createdAt: 1 } as const;
    const h1 = avatarFor(p).hue;
    const h2 = avatarFor({ ...p, name: 'Outro' }).hue; // hue depende do id, não do nome
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThan(360);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/profile/store.test.ts`
Expected: FAIL (módulo `@services/profile/store` não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/services/profile/store.ts`:

```ts
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
}

export interface ProfileState {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
}

export type NameError = 'empty' | 'tooLong';
export type NameValidation = { ok: true; name: string } | { ok: false; error: NameError };

export const NAME_MAX = 20;

export function emptyState(): ProfileState {
  return { profiles: [], activeId: null };
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validateName(raw: string): NameValidation {
  const name = normalizeName(raw);
  if (name.length === 0) return { ok: false, error: 'empty' };
  if (name.length > NAME_MAX) return { ok: false, error: 'tooLong' };
  return { ok: true, name };
}

export function createProfile(
  state: ProfileState,
  id: string,
  name: string,
  createdAt: number,
): { state: ProfileState; profile: Profile } {
  const profile: Profile = { id, name, createdAt };
  return {
    state: { profiles: [...state.profiles, profile], activeId: id },
    profile,
  };
}

export function setActive(state: ProfileState, id: string): ProfileState {
  if (!state.profiles.some((p) => p.id === id)) return state;
  return { ...state, activeId: id };
}

export function renameProfile(state: ProfileState, id: string, name: string): ProfileState {
  if (!state.profiles.some((p) => p.id === id)) return state;
  return {
    ...state,
    profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
  };
}

export function activeProfile(state: ProfileState): Profile | null {
  if (state.activeId === null) return null;
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}

export function avatarFor(profile: Profile): { initial: string; hue: number } {
  const initial = profile.name.trim().charAt(0).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < profile.id.length; i++) {
    h = (h * 31 + profile.id.charCodeAt(i)) >>> 0;
  }
  return { initial, hue: h % 360 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/profile/store.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run check`
Expected: sem erros.

```bash
git add src/services/profile/store.ts tests/services/profile/store.test.ts
git commit -m "feat(4.2): núcleo puro de perfis (modelo, validação, operações, avatar)"
```

---

### Task 2: Casca de persistência `storage.ts` (localStorage + memory)

**Files:**
- Create: `src/services/profile/storage.ts`
- Test: `tests/services/profile/storage.test.ts`

**Interfaces:**
- Consumes (Task 1): `ProfileState`, `emptyState` from `@services/profile/store`.
- Produces:
  - `interface ProfileStorage { load(): ProfileState; save(state: ProfileState): void }`
  - `const STORAGE_KEY = 'jurassicrun.profiles.v1'`
  - `function memoryProfileStorage(initial?: ProfileState): ProfileStorage`
  - `function localStorageProfileStorage(): ProfileStorage`

- [ ] **Step 1: Write the failing test**

Create `tests/services/profile/storage.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryProfileStorage,
  localStorageProfileStorage,
  STORAGE_KEY,
} from '@services/profile/storage';
import { emptyState, createProfile, type ProfileState } from '@services/profile/store';

function sample(): ProfileState {
  return createProfile(emptyState(), 'id-1', 'Rex', 1000).state;
}

describe('memoryProfileStorage', () => {
  it('round-trip: save depois load devolve o mesmo estado', () => {
    const s = memoryProfileStorage();
    s.save(sample());
    expect(s.load()).toEqual(sample());
  });

  it('load inicial (sem save) é emptyState', () => {
    expect(memoryProfileStorage().load()).toEqual(emptyState());
  });
});

describe('localStorageProfileStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip via localStorage sob a chave versionada', () => {
    const s = localStorageProfileStorage();
    s.save(sample());
    expect(s.load()).toEqual(sample());
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(1);
  });

  it('chave ausente ⇒ emptyState', () => {
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('JSON inválido ⇒ emptyState (não lança)', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('forma inválida (profiles não-array) ⇒ emptyState', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles: 'x', activeId: null }));
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('perfil malformado (campos do tipo errado) ⇒ emptyState', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, profiles: [{ id: 1, name: 'x', createdAt: 'y' }], activeId: null }),
    );
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/profile/storage.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/services/profile/storage.ts`:

```ts
import { emptyState, type Profile, type ProfileState } from './store';

export interface ProfileStorage {
  load(): ProfileState;
  save(state: ProfileState): void;
}

export const STORAGE_KEY = 'jurassicrun.profiles.v1';

export function memoryProfileStorage(initial: ProfileState = emptyState()): ProfileStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'number'
  );
}

function parseState(raw: string): ProfileState {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) return emptyState();
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.profiles) || !d.profiles.every(isProfile)) return emptyState();
  const profiles = d.profiles as Profile[];
  const activeId =
    typeof d.activeId === 'string' && profiles.some((p) => p.id === d.activeId)
      ? d.activeId
      : null;
  return { profiles, activeId };
}

export function localStorageProfileStorage(): ProfileStorage {
  return {
    load(): ProfileState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return emptyState();
        return parseState(raw);
      } catch {
        return emptyState();
      }
    },
    save(state: ProfileState): void {
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

Run: `npx vitest run tests/services/profile/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run check`
Expected: sem erros.

```bash
git add src/services/profile/storage.ts tests/services/profile/storage.test.ts
git commit -m "feat(4.2): persistência de perfis (localStorage versionado + memory + parse robusto)"
```

---

### Task 3: `ProfileService` reativo `index.ts` (sinais + wiring)

**Files:**
- Create: `src/services/profile/index.ts`
- Test: `tests/services/profile/service.test.ts`

**Interfaces:**
- Consumes: Task 1 (`store`), Task 2 (`storage`).
- Produces (singleton `profileService`):
  - `profiles: ReadonlySignal<readonly Profile[]>`
  - `activeProfile: ReadonlySignal<Profile | null>`
  - `init(storage?: ProfileStorage): void`
  - `create(rawName: string): boolean`
  - `switchTo(id: string): void`
  - `renameActive(rawName: string): boolean`
  - `validateName(raw: string): NameValidation` (reexport puro)
  - also re-export `avatarFor`, `type Profile`, `type NameError`.

**Nota de teste:** o `crypto.randomUUID` da casca dá ids distintos; testes verificam apenas que há um id (string não-vazia) e que a persistência foi chamada (via `memoryProfileStorage` injetado + leitura de `load()`).

- [ ] **Step 1: Write the failing test**

Create `tests/services/profile/service.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('ProfileService', () => {
  beforeEach(() => {
    profileService.init(memoryProfileStorage(emptyState()));
  });

  it('começa sem perfis e sem ativo', () => {
    expect(profileService.profiles.value).toEqual([]);
    expect(profileService.activeProfile.value).toBeNull();
  });

  it('create adiciona, ativa e devolve true; gera id e createdAt', () => {
    expect(profileService.create('Rex')).toBe(true);
    expect(profileService.profiles.value).toHaveLength(1);
    const active = profileService.activeProfile.value!;
    expect(active.name).toBe('Rex');
    expect(typeof active.id).toBe('string');
    expect(active.id.length).toBeGreaterThan(0);
    expect(typeof active.createdAt).toBe('number');
  });

  it('create com nome inválido devolve false e não muta', () => {
    expect(profileService.create('   ')).toBe(false);
    expect(profileService.profiles.value).toEqual([]);
  });

  it('create normaliza o nome', () => {
    profileService.create('  Ptero  Two ');
    expect(profileService.activeProfile.value!.name).toBe('Ptero Two');
  });

  it('switchTo troca o ativo', () => {
    profileService.create('A');
    const idA = profileService.activeProfile.value!.id;
    profileService.create('B');
    profileService.switchTo(idA);
    expect(profileService.activeProfile.value!.name).toBe('A');
  });

  it('renameActive renomeia o ativo e devolve true; inválido devolve false', () => {
    profileService.create('A');
    expect(profileService.renameActive('Novo')).toBe(true);
    expect(profileService.activeProfile.value!.name).toBe('Novo');
    expect(profileService.renameActive('  ')).toBe(false);
    expect(profileService.activeProfile.value!.name).toBe('Novo');
  });

  it('persiste: um novo service com o mesmo storage recarrega o estado', () => {
    const storage = memoryProfileStorage(emptyState());
    profileService.init(storage);
    profileService.create('Rex');
    // reinicializa a partir do mesmo storage
    profileService.init(storage);
    expect(profileService.profiles.value).toHaveLength(1);
    expect(profileService.activeProfile.value!.name).toBe('Rex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/profile/service.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/services/profile/index.ts`:

```ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  emptyState,
  activeProfile as pickActive,
  createProfile,
  setActive,
  renameProfile,
  validateName,
  avatarFor,
  type Profile,
  type ProfileState,
  type NameValidation,
} from './store';
import {
  localStorageProfileStorage,
  memoryProfileStorage,
  type ProfileStorage,
} from './storage';

class ProfileService {
  private storage: ProfileStorage = memoryProfileStorage();
  private readonly _state = signal<ProfileState>(emptyState());

  readonly profiles: ReadonlySignal<readonly Profile[]> = computed(
    () => this._state.value.profiles,
  );
  readonly activeProfile: ReadonlySignal<Profile | null> = computed(() =>
    pickActive(this._state.value),
  );

  init(storage: ProfileStorage = localStorageProfileStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  create(rawName: string): boolean {
    const v = validateName(rawName);
    if (!v.ok) return false;
    const id = crypto.randomUUID();
    const { state } = createProfile(this._state.value, id, v.name, Date.now());
    this.commit(state);
    return true;
  }

  switchTo(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  renameActive(rawName: string): boolean {
    const id = this._state.value.activeId;
    if (id === null) return false;
    const v = validateName(rawName);
    if (!v.ok) return false;
    this.commit(renameProfile(this._state.value, id, v.name));
    return true;
  }

  validateName(raw: string): NameValidation {
    return validateName(raw);
  }

  private commit(state: ProfileState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const profileService = new ProfileService();
export { avatarFor };
export type { Profile, NameError, NameValidation } from './store';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/profile/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run check`
Expected: sem erros.

```bash
git add src/services/profile/index.ts tests/services/profile/service.test.ts
git commit -m "feat(4.2): ProfileService reativo (sinais, id/tempo na casca, persistência)"
```

---

### Task 4: i18n — chaves de onboarding/perfil nos 10 locales

**Files:**
- Modify: `src/i18n/locales/en.json`, `es.json`, `pt-BR.json`, `fr.json`, `it.json`, `de.json`, `ja.json`, `zh.json`, `ko.json`, `hi.json`
- Test: `tests/i18n/locales.test.ts` (existente — deve continuar verde; valida paridade de chaves)

**Interfaces:**
- Produces: os namespaces `onboarding.*` e `profile.*` (consumidos pelas Tasks 5 e 6).

Adicionar a CADA um dos 10 arquivos os dois blocos abaixo (traduzidos no idioma do arquivo). Coloque-os após o bloco `screen`, mantendo o JSON válido. Abaixo o conteúdo `en` e `pt-BR`; para os demais idiomas, traduza os valores mantendo as MESMAS chaves.

`en.json` (adicionar):
```json
  "onboarding": {
    "title": "Welcome",
    "prompt": "What should we call you?",
    "placeholder": "Your name",
    "start": "Start",
    "error": {
      "empty": "Please enter a name.",
      "tooLong": "Name is too long (max 20)."
    }
  },
  "profile": {
    "rename": "Rename",
    "save": "Save",
    "players": "Players",
    "active": "Active",
    "newPlayer": "New player",
    "create": "Create"
  },
```

`pt-BR.json` (adicionar):
```json
  "onboarding": {
    "title": "Bem-vindo",
    "prompt": "Como podemos te chamar?",
    "placeholder": "Seu nome",
    "start": "Começar",
    "error": {
      "empty": "Digite um nome.",
      "tooLong": "Nome longo demais (máx. 20)."
    }
  },
  "profile": {
    "rename": "Renomear",
    "save": "Salvar",
    "players": "Jogadores",
    "active": "Ativo",
    "newPlayer": "Novo jogador",
    "create": "Criar"
  },
```

Traduções sugeridas para os demais (mesmas chaves; ajuste natural do idioma):
- **es:** title "Bienvenido", prompt "¿Cómo te llamamos?", placeholder "Tu nombre", start "Empezar", error.empty "Escribe un nombre.", error.tooLong "Nombre demasiado largo (máx. 20).", profile.rename "Renombrar", save "Guardar", players "Jugadores", active "Activo", newPlayer "Nuevo jugador", create "Crear".
- **fr:** "Bienvenue", "Comment devons-nous t'appeler ?", "Ton nom", "Commencer", "Veuillez saisir un nom.", "Nom trop long (max 20).", "Renommer", "Enregistrer", "Joueurs", "Actif", "Nouveau joueur", "Créer".
- **it:** "Benvenuto", "Come ti chiamiamo?", "Il tuo nome", "Inizia", "Inserisci un nome.", "Nome troppo lungo (max 20).", "Rinomina", "Salva", "Giocatori", "Attivo", "Nuovo giocatore", "Crea".
- **de:** "Willkommen", "Wie sollen wir dich nennen?", "Dein Name", "Los", "Bitte gib einen Namen ein.", "Name zu lang (max. 20).", "Umbenennen", "Speichern", "Spieler", "Aktiv", "Neuer Spieler", "Erstellen".
- **ja:** "ようこそ", "お名前を教えてください", "名前", "はじめる", "名前を入力してください。", "名前が長すぎます（最大20文字）。", "名前を変更", "保存", "プレイヤー", "使用中", "新しいプレイヤー", "作成".
- **zh:** "欢迎", "怎么称呼你？", "你的名字", "开始", "请输入名字。", "名字太长（最多20个字符）。", "重命名", "保存", "玩家", "使用中", "新玩家", "创建".
- **ko:** "환영합니다", "어떻게 불러드릴까요?", "이름", "시작", "이름을 입력하세요.", "이름이 너무 깁니다 (최대 20자).", "이름 변경", "저장", "플레이어", "사용 중", "새 플레이어", "만들기".
- **hi:** "स्वागत है", "हम आपको क्या कहें?", "आपका नाम", "शुरू करें", "कृपया एक नाम दर्ज करें।", "नाम बहुत लंबा है (अधिकतम 20).", "नाम बदलें", "सहेजें", "खिलाड़ी", "सक्रिय", "नया खिलाड़ी", "बनाएँ".

- [ ] **Step 1: Editar os 10 locales**

Adicionar os blocos `onboarding` e `profile` a cada arquivo (traduzidos), mantendo JSON válido.

- [ ] **Step 2: Rodar o teste de paridade i18n**

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: PASS (todas as chaves presentes em todos os locales).

- [ ] **Step 3: Typecheck + commit**

Run: `npm run check`
Expected: sem erros.

```bash
git add src/i18n/locales/
git commit -m "feat(4.2): chaves i18n de onboarding/perfil nos 10 locales"
```

---

### Task 5: `OnboardingScreen` + gate de primeiro acesso no `App`

**Files:**
- Create: `src/app/screens/OnboardingScreen.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/main.tsx` (chamar `profileService.init()` antes do `render`)
- Modify: `src/app/styles/global.css` (classes de formulário/erro)
- Test: `tests/app/onboarding.test.tsx`

**Interfaces:**
- Consumes: `profileService` (Task 3), i18n keys `onboarding.*` (Task 4).
- Produces: `function OnboardingScreen(): VNode`; `App` passa a renderizar onboarding quando `activeProfile.value === null`.

- [ ] **Step 1: Write the failing test**

Create `tests/app/onboarding.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { resetToHome } from '@app/router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('Onboarding (primeiro acesso)', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    profileService.init(memoryProfileStorage(emptyState()));
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('sem perfil, o App mostra o onboarding (não a Home)', () => {
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('onboarding.prompt'));
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });

  it('submeter nome válido cria o perfil e revela a Home', () => {
    render(<App />, container);
    const input = container.querySelector('input')!;
    input.value = 'Rex';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = container.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    render(<App />, container);
    expect(profileService.activeProfile.value?.name).toBe('Rex');
    expect(container.textContent).toContain(i18n.t('nav.play'));
  });

  it('nome vazio mostra erro e não cria perfil', () => {
    render(<App />, container);
    const form = container.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('onboarding.error.empty'));
    expect(profileService.activeProfile.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/onboarding.test.tsx`
Expected: FAIL (`OnboardingScreen`/gate não existem).

- [ ] **Step 3: Implement `OnboardingScreen`**

Create `src/app/screens/OnboardingScreen.tsx`:

```tsx
import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import { profileService, type NameError } from '@services/profile';

export function OnboardingScreen(): VNode {
  const [name, setName] = useState('');
  const [error, setError] = useState<NameError | null>(null);

  function submit(e: Event): void {
    e.preventDefault();
    const v = profileService.validateName(name);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    profileService.create(v.name);
  }

  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('onboarding.title')}</h1>
      <p>{i18n.t('onboarding.prompt')}</p>
      <form class="form" onSubmit={submit}>
        <input
          class="form__input"
          type="text"
          value={name}
          placeholder={i18n.t('onboarding.placeholder')}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            setError(null);
          }}
        />
        {error !== null && <p class="form__error">{i18n.t(`onboarding.error.${error}`)}</p>}
        <button class="btn" type="submit">
          {i18n.t('onboarding.start')}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Wire the gate in `App.tsx`**

Modify `src/app/App.tsx` — add import and gate at the top of `App`:

```tsx
import { route, type Screen } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { profileService } from '@services/profile';
import type { VNode } from 'preact';

// … screenFor mantém-se igual …

export function App(): VNode {
  if (profileService.activeProfile.value === null) {
    return <OnboardingScreen />;
  }
  return screenFor(route.value);
}
```

- [ ] **Step 5: Init the service in `main.tsx`**

Modify `src/app/main.tsx` — after `i18n.init()`, before `render`:

```tsx
import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { App } from './App';

async function bootstrap(): Promise<void> {
  await i18n.init();
  profileService.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const root = document.getElementById('app');
  if (root === null) throw new Error('#app não encontrado');
  render(<App />, root);
}

void bootstrap();
```

- [ ] **Step 6: Add form CSS**

Append to `src/app/styles/global.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
  width: min(100%, 20rem);
}

.form__input {
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-surface-2);
  border: 1px solid var(--color-surface-2);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  min-height: 44px;
}

.form__input:focus {
  outline: 2px solid var(--color-primary);
}

.form__error {
  color: var(--color-danger);
  margin: 0;
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/app/onboarding.test.tsx tests/app/App.test.tsx`
Expected: PASS (App.test continua verde — mas veja a nota abaixo sobre inicializar o service nele).

**Nota crítica:** `tests/app/App.test.tsx` renderiza o `App` sem inicializar `profileService`, então após esta task o gate mostraria onboarding e quebraria os asserts de Home. Editar `tests/app/App.test.tsx` para, no `beforeEach`, dar um perfil ativo:

```tsx
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';
// … no beforeEach, após i18n.init() e resetToHome():
profileService.init(memoryProfileStorage(emptyState()));
profileService.create('Tester');
```

- [ ] **Step 8: Full check + commit**

Run: `npm run check && npx vitest run tests/app/`
Expected: sem erros; testes de app verdes.

```bash
git add src/app/screens/OnboardingScreen.tsx src/app/App.tsx src/app/main.tsx src/app/styles/global.css tests/app/onboarding.test.tsx tests/app/App.test.tsx
git commit -m "feat(4.2): onboarding de primeiro acesso + gate no App"
```

---

### Task 6: `ProfileScreen` (mostrar ativo, trocar, criar, renomear)

**Files:**
- Create: `src/app/screens/ProfileScreen.tsx`
- Modify: `src/app/App.tsx` (rota `profile` → `<ProfileScreen/>`)
- Modify: `src/app/styles/global.css` (avatar + lista de perfis)
- Test: `tests/app/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `profileService`, `avatarFor` (Task 3), i18n keys `profile.*`/`nav.back` (Task 4).
- Produces: `function ProfileScreen(): VNode`; `App` mapeia `case 'profile'` para ela.

- [ ] **Step 1: Write the failing test**

Create `tests/app/profile-screen.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { ProfileScreen } from '@app/screens/ProfileScreen';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('ProfileScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    profileService.init(memoryProfileStorage(emptyState()));
    profileService.create('Rex');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra o nome do jogador ativo', () => {
    render(<ProfileScreen />, container);
    expect(container.textContent).toContain('Rex');
    expect(container.textContent).toContain(i18n.t('profile.active'));
  });

  it('criar um novo jogador o adiciona e o torna ativo', () => {
    render(<ProfileScreen />, container);
    const createInput = container.querySelector<HTMLInputElement>('[data-testid="create-input"]')!;
    createInput.value = 'Ptero';
    createInput.dispatchEvent(new Event('input', { bubbles: true }));
    container
      .querySelector<HTMLFormElement>('[data-testid="create-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    render(<ProfileScreen />, container);
    expect(profileService.profiles.value).toHaveLength(2);
    expect(profileService.activeProfile.value!.name).toBe('Ptero');
  });

  it('tocar um perfil não-ativo troca o ativo', () => {
    profileService.create('Ptero'); // Ptero vira ativo
    render(<ProfileScreen />, container);
    // botão de troca do perfil 'Rex' (o não-ativo)
    const rexBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Rex') && b.hasAttribute('data-switch'),
    )!;
    rexBtn.dispatchEvent(new Event('click', { bubbles: true }));
    render(<ProfileScreen />, container);
    expect(profileService.activeProfile.value!.name).toBe('Rex');
  });

  it('renomear atualiza o nome do ativo', () => {
    render(<ProfileScreen />, container);
    const renameInput = container.querySelector<HTMLInputElement>('[data-testid="rename-input"]')!;
    renameInput.value = 'RexII';
    renameInput.dispatchEvent(new Event('input', { bubbles: true }));
    container
      .querySelector<HTMLFormElement>('[data-testid="rename-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    render(<ProfileScreen />, container);
    expect(profileService.activeProfile.value!.name).toBe('RexII');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/profile-screen.test.tsx`
Expected: FAIL (`ProfileScreen` não existe).

- [ ] **Step 3: Implement `ProfileScreen`**

Create `src/app/screens/ProfileScreen.tsx`:

```tsx
import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { profileService, avatarFor, type Profile } from '@services/profile';

function Avatar({ profile }: { profile: Profile }): VNode {
  const { initial, hue } = avatarFor(profile);
  return (
    <span class="avatar" style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}>
      {initial}
    </span>
  );
}

export function ProfileScreen(): VNode {
  const active = profileService.activeProfile.value;
  const profiles = profileService.profiles.value;
  const [renameValue, setRenameValue] = useState(active?.name ?? '');
  const [createValue, setCreateValue] = useState('');

  function submitRename(e: Event): void {
    e.preventDefault();
    profileService.renameActive(renameValue);
  }

  function submitCreate(e: Event): void {
    e.preventDefault();
    if (profileService.create(createValue)) setCreateValue('');
  }

  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('screen.profile')}</h1>

      {active !== null && (
        <div class="profile-header">
          <Avatar profile={active} />
          <span>{active.name}</span>
        </div>
      )}

      <form class="form" data-testid="rename-form" onSubmit={submitRename}>
        <input
          class="form__input"
          data-testid="rename-input"
          type="text"
          value={renameValue}
          onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
        />
        <button class="btn" type="submit">
          {i18n.t('profile.save')}
        </button>
      </form>

      <h2>{i18n.t('profile.players')}</h2>
      <ul class="profile-list">
        {profiles.map((p) => (
          <li
            key={p.id}
            class={
              'profile-list__item' +
              (p.id === active?.id ? ' profile-list__item--active' : '')
            }
          >
            <Avatar profile={p} />
            {p.id === active?.id ? (
              <>
                <span>{p.name}</span>
                <span class="profile-list__badge">{i18n.t('profile.active')}</span>
              </>
            ) : (
              <button
                class="btn btn--ghost"
                data-switch
                onClick={() => profileService.switchTo(p.id)}
              >
                {p.name}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form class="form" data-testid="create-form" onSubmit={submitCreate}>
        <input
          class="form__input"
          data-testid="create-input"
          type="text"
          value={createValue}
          placeholder={i18n.t('profile.newPlayer')}
          onInput={(e) => setCreateValue((e.target as HTMLInputElement).value)}
        />
        <button class="btn" type="submit">
          {i18n.t('profile.create')}
        </button>
      </form>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Wire the route in `App.tsx`**

Modify `src/app/App.tsx` — import `ProfileScreen` and replace the `profile` case:

```tsx
import { ProfileScreen } from './screens/ProfileScreen';
// … dentro do switch:
    case 'profile':
      return <ProfileScreen />;
```

- [ ] **Step 5: Add avatar + list CSS**

Append to `src/app/styles/global.css`:

```css
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  flex: none;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-lg);
}

.profile-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: min(100%, 20rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.profile-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.profile-list__item--active {
  outline: 2px solid var(--color-primary);
}

.profile-list__badge {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/app/profile-screen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full check + commit**

Run: `npm run check && npx vitest run tests/app/`
Expected: sem erros; app verde.

```bash
git add src/app/screens/ProfileScreen.tsx src/app/App.tsx src/app/styles/global.css tests/app/profile-screen.test.tsx
git commit -m "feat(4.2): tela de Perfil (ativo, trocar, criar, renomear)"
```

---

### Task 7: Verificação final da branch

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: todos verdes (incluindo `tests/i18n/locales.test.ts` e a bateria de determinismo — 64 intactos, core não tocado).

- [ ] **Step 2: Typecheck/lint**

Run: `npm run check`
Expected: limpo.

- [ ] **Step 3: Determinismo explícito**

Run: `npm run test:determinism`
Expected: 64 verdes (core intocado).

- [ ] **Step 4: Verificação visual (Playwright, opcional mas recomendado)**

Rodar o dev server; confirmar: (a) primeiro load (localStorage limpo) mostra onboarding; (b) digitar nome → Home; (c) reload → NÃO pede nome de novo (persistiu); (d) navegar a Perfil → mostra ativo, criar/trocar/renomear funcionam; (e) sem scroll horizontal (retrato+paisagem).

---

## Self-Review

**Spec coverage:**
- Primeiro acesso pede nome → Task 5 (gate + OnboardingScreen). ✅
- Criar/trocar jogador ativo → Task 3 (`create`/`switchTo`) + Task 6 (UI). ✅
- Tela de Perfil → Task 6. ✅
- Persistência local versionada + fallback → Task 2. ✅
- i18n 10 locales → Task 4. ✅
- Renomear (afordância) → Task 3 (`renameActive`) + Task 6. ✅
- Avatar placeholder derivado → Task 1 (`avatarFor`) + Task 6. ✅
- Core intocado / determinismo → Task 7 verifica. ✅

**Placeholder scan:** sem TODO/TBD; todo passo tem código/comando concretos. As traduções não-en/pt dos demais idiomas são valores sugeridos concretos (não placeholders). ✅

**Type consistency:** `ProfileState`, `Profile`, `NameValidation`, `NameError`, `ProfileStorage`, `profileService.{create,switchTo,renameActive,validateName,profiles,activeProfile}`, `avatarFor` — nomes consistentes entre Tasks 1→3→5/6. ✅

**Ordem de dependência:** 1 (store) → 2 (storage) → 3 (service) → 4 (i18n) → 5 (onboarding, precisa de 3+4) → 6 (profile screen, precisa de 3+4) → 7 (verificação). ✅
