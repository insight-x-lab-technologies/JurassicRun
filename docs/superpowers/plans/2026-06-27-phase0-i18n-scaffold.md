# i18n Scaffold (Fase 0.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar i18next com 10 locales JSON (en default) e expor `t()` no app shell, sem strings hardcoded e sem impacto no determinismo.

**Architecture:** Locales JSON estáticos em `src/i18n/locales/`, agregados num módulo que conhece a lista de idiomas; um `I18nService` fino (`src/services/i18n.ts`) embrulha uma instância isolada do i18next e expõe `init/t/changeLanguage/getLanguage`; `main.ts` inicializa o serviço no bootstrap e usa `t()` para `document.title`/`<html lang>`.

**Tech Stack:** TypeScript estrito, i18next (puro, instância isolada), Vitest, Vite (import JSON nativo).

## Global Constraints

- **Determinismo:** nada disto entra em `src/core/`. i18n vive em `src/i18n/` e `src/services/`. A guarda anti-não-determinismo (ESLint + teste) deve continuar verde.
- **Sem string visível hardcoded:** toda string de usuário via chave i18next. `en` é a fonte da verdade.
- **10 idiomas, nesta ordem (en primeiro):** `en`, `es`, `pt-BR`, `fr`, `it`, `de`, `ja`, `zh`, `ko`, `hi`.
- **TS estrito:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` ativos. Sem `any` sem justificativa.
- **Paridade de chaves:** toda chave existe em todos os 10 locales.
- **Verificação:** `npm test` e `npm run check` verdes ao fim de cada task.

---

### Task 1: Locales JSON + agregador de recursos + suporte a import JSON

**Files:**
- Modify: `tsconfig.json` (adicionar `"resolveJsonModule": true`)
- Create: `src/i18n/locales/en.json`, `es.json`, `pt-BR.json`, `fr.json`, `it.json`, `de.json`, `ja.json`, `zh.json`, `ko.json`, `hi.json`
- Create: `src/i18n/locales/index.ts`
- Test: `tests/i18n/locales.test.ts`
- Remove: `src/i18n/.gitkeep` (a pasta passa a ter conteúdo)

**Interfaces:**
- Produces:
  - `SUPPORTED_LANGUAGES: readonly ['en','es','pt-BR','fr','it','de','ja','zh','ko','hi']`
  - `type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]`
  - `DEFAULT_LANGUAGE: 'en'`
  - `resources: Record<SupportedLanguage, { translation: Record<string, unknown> }>`

- [ ] **Step 1: Habilitar import de JSON no TypeScript**

Em `tsconfig.json`, dentro de `compilerOptions`, adicionar (após `"skipLibCheck": true,`):

```json
    "resolveJsonModule": true,
```

- [ ] **Step 2: Criar os 10 arquivos de locale com bootstrap mínimo**

`src/i18n/locales/en.json` (fonte da verdade):

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Loading…"
  }
}
```

`src/i18n/locales/es.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Cargando…"
  }
}
```

`src/i18n/locales/pt-BR.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Carregando…"
  }
}
```

`src/i18n/locales/fr.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Chargement…"
  }
}
```

`src/i18n/locales/it.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Caricamento…"
  }
}
```

`src/i18n/locales/de.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "Wird geladen…"
  }
}
```

`src/i18n/locales/ja.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "読み込み中…"
  }
}
```

`src/i18n/locales/zh.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "加载中…"
  }
}
```

`src/i18n/locales/ko.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "불러오는 중…"
  }
}
```

`src/i18n/locales/hi.json`:

```json
{
  "app": {
    "title": "JurassicRun",
    "loading": "लोड हो रहा है…"
  }
}
```

- [ ] **Step 3: Criar o agregador `src/i18n/locales/index.ts`**

```typescript
import en from './en.json';
import es from './es.json';
import ptBR from './pt-BR.json';
import fr from './fr.json';
import it from './it.json';
import de from './de.json';
import ja from './ja.json';
import zh from './zh.json';
import ko from './ko.json';
import hi from './hi.json';

export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'it',
  'de',
  'ja',
  'zh',
  'ko',
  'hi',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const resources: Record<SupportedLanguage, { translation: Record<string, unknown> }> = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  fr: { translation: fr },
  it: { translation: it },
  de: { translation: de },
  ja: { translation: ja },
  zh: { translation: zh },
  ko: { translation: ko },
  hi: { translation: hi },
};
```

- [ ] **Step 4: Remover o placeholder da pasta**

Run: `git rm src/i18n/.gitkeep`

- [ ] **Step 5: Escrever os testes que falham**

`tests/i18n/locales.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, resources } from '@i18n/locales/index';

// Coleta todos os key-paths "profundos" de um objeto aninhado.
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

describe('locales', () => {
  it('expõe exatamente os 10 idiomas, com en primeiro', () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      'en', 'es', 'pt-BR', 'fr', 'it', 'de', 'ja', 'zh', 'ko', 'hi',
    ]);
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('tem um recurso de tradução para cada idioma suportado', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      expect(resources[lng]?.translation).toBeTypeOf('object');
    }
  });

  it('todos os locales têm paridade de chaves com en', () => {
    const enKeys = keyPaths(resources.en.translation).sort();
    for (const lng of SUPPORTED_LANGUAGES) {
      const keys = keyPaths(resources[lng].translation).sort();
      expect(keys, `chaves de ${lng} divergem de en`).toEqual(enKeys);
    }
  });
});
```

- [ ] **Step 6: Rodar os testes e confirmar que falham**

Run: `npm test -- tests/i18n/locales.test.ts`
Expected: FAIL (módulo `@i18n/locales/index` ainda não resolvido / arquivos ausentes antes dos steps acima; após criá-los deve passar — se algum JSON divergir, o teste de paridade aponta).

- [ ] **Step 7: Rodar e confirmar que passam + check limpo**

Run: `npm test -- tests/i18n/locales.test.ts && npm run check`
Expected: PASS / sem erros de typecheck ou lint.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json src/i18n/ tests/i18n/locales.test.ts
git commit -m "feat(i18n): locales JSON dos 10 idiomas + agregador de recursos"
```

---

### Task 2: I18nService (wrapper i18next)

**Files:**
- Create: `src/services/i18n.ts`
- Test: `tests/i18n/service.test.ts`

**Interfaces:**
- Consumes: `resources`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `SupportedLanguage` de `@i18n/locales/index`.
- Produces (export const `i18n`):
  - `init(): Promise<void>` — idempotente
  - `t(key: string, options?: Record<string, unknown>): string`
  - `changeLanguage(lng: string): Promise<void>` — ignora idioma fora de `SUPPORTED_LANGUAGES`
  - `getLanguage(): string`
  - reexporta `SUPPORTED_LANGUAGES`

- [ ] **Step 1: Escrever os testes que falham**

`tests/i18n/service.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { i18n } from '@services/i18n';

describe('I18nService', () => {
  beforeEach(async () => {
    await i18n.init();
    await i18n.changeLanguage('en');
  });

  it('inicia em en e resolve uma chave', () => {
    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('app.title')).toBe('JurassicRun');
    expect(i18n.t('app.loading')).toBe('Loading…');
  });

  it('troca de idioma e resolve a chave traduzida', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.getLanguage()).toBe('pt-BR');
    expect(i18n.t('app.loading')).toBe('Carregando…');
  });

  it('ignora idioma não suportado', async () => {
    await i18n.changeLanguage('xx');
    expect(i18n.getLanguage()).toBe('en');
  });

  it('chave ausente retorna a própria key (fallbackLng configurado)', () => {
    // Paridade garante que nenhuma chave existe só em um locale, então o cenário
    // observável de "ausência" é a chave inexistente em todos: i18next devolve a key.
    expect(i18n.t('app.missing')).toBe('app.missing');
  });

  it('init é idempotente', async () => {
    await i18n.init();
    expect(i18n.t('app.title')).toBe('JurassicRun');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test -- tests/i18n/service.test.ts`
Expected: FAIL com "Cannot find module '@services/i18n'".

- [ ] **Step 3: Implementar o serviço**

`src/services/i18n.ts`:

```typescript
import i18next, { type i18n as I18nInstance } from 'i18next';
import {
  resources,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@i18n/locales/index';

function isSupported(lng: string): lng is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);
}

class I18nService {
  private instance: I18nInstance = i18next.createInstance();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.instance.init({
      resources,
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES as readonly string[] as string[],
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    this.initialized = true;
  }

  t(key: string, options?: Record<string, unknown>): string {
    return this.instance.t(key, options);
  }

  async changeLanguage(lng: string): Promise<void> {
    if (!isSupported(lng)) return;
    await this.instance.changeLanguage(lng);
  }

  getLanguage(): string {
    return this.instance.language;
  }

  readonly supportedLanguages = SUPPORTED_LANGUAGES;
}

export const i18n = new I18nService();
export { SUPPORTED_LANGUAGES };
```

- [ ] **Step 4: Rodar e confirmar que passam + check limpo**

Run: `npm test -- tests/i18n/service.test.ts && npm run check`
Expected: PASS / sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/services/i18n.ts tests/i18n/service.test.ts
git commit -m "feat(i18n): I18nService wrapper sobre instância isolada do i18next"
```

---

### Task 3: Wire i18n no app shell

**Files:**
- Modify: `src/app/main.ts`

**Interfaces:**
- Consumes: `i18n` de `@services/i18n`.

- [ ] **Step 1: Atualizar `src/app/main.ts`**

```typescript
import { render, h } from 'preact';
import { i18n } from '@services/i18n';

async function bootstrap(): Promise<void> {
  await i18n.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const root = document.getElementById('app');
  if (root) {
    // Shell vazio: a árvore de telas entra na Fase 4. Sem texto hardcoded — via i18n.
    render(h('div', { id: 'app-shell' }), root);
  }
}

void bootstrap();
```

- [ ] **Step 2: Rodar typecheck/lint + a suíte completa**

Run: `npm run check && npm test`
Expected: PASS / sem erros. (`main.ts` não tem teste unitário próprio; é coberto pelo typecheck e pela suíte verde.)

- [ ] **Step 3: Smoke do dev server (opcional, manual)**

Run: `npm run build`
Expected: build conclui sem erro (valida que o import de JSON e i18next empacotam).

- [ ] **Step 4: Commit**

```bash
git add src/app/main.ts
git commit -m "feat(i18n): inicializa i18n no bootstrap e usa t() no app shell"
```

---

### Task 4: Fechar a discrepância 9→10 nos docs

**Files:**
- Modify: `docs/conventions/CONVENTIONS.md` (linha da lista de idiomas)
- Modify: `docs/superpowers/specs/2026-06-27-jurassicrun-design.md` (item "10 idiomas")
- Modify: `.claude/skills/add-locale/SKILL.md` (lista + "outros 9 locales")

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: CONVENTIONS.md** — trocar a linha de idiomas para incluir `ko`:

De:
```
- Idioma default: inglês. Idiomas: en, es, pt-BR, fr, it, de, ja, zh, hi.
```
Para:
```
- Idioma default: inglês. Idiomas (10): en, es, pt-BR, fr, it, de, ja, zh, ko, hi.
```

- [ ] **Step 2: design master** — no item dos idiomas, incluir `ko`:

De:
```
- [ ] 10 idiomas (en default, es, pt-BR, fr, it, de, ja, zh, hi).
```
Para:
```
- [ ] 10 idiomas (en default, es, pt-BR, fr, it, de, ja, zh, ko, hi).
```

- [ ] **Step 3: skill add-locale** — atualizar a linha de idiomas suportados:

De:
```
Idiomas suportados: `en` (default), `es`, `pt-BR`, `fr`, `it`, `de`, `ja`, `zh`, `hi`.
```
Para:
```
Idiomas suportados (10): `en` (default), `es`, `pt-BR`, `fr`, `it`, `de`, `ja`, `zh`, `ko`, `hi`.
```

E no passo 2 da skill, "os outros 9 locales" continua correto (en + 9 = 10) — não alterar.

- [ ] **Step 4: Commit**

```bash
git add docs/conventions/CONVENTIONS.md docs/superpowers/specs/2026-06-27-jurassicrun-design.md .claude/skills/add-locale/SKILL.md
git commit -m "docs(i18n): adicionar coreano (ko) — fecha lista canônica de 10 idiomas"
```

---

## Fechamento (fora das tasks, feito pelo orquestrador)

- Marcar item 0.4 `[x]` em `docs/roadmap/PHASE-00-foundations.md` (as duas linhas: setup i18next + `t()` no shell).
- Atualizar "Estado atual" em `CLAUDE.md`.
- Rodar `npm test` + `npm run check` + `npm run test:determinism` finais (verification-before-completion).
- Review final da branch; merge `--no-ff` em `main` (sem remote GitHub no momento).
