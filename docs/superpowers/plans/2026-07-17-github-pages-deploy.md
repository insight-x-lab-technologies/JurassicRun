# GitHub Pages Deploy (7.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o build da PWA no GitHub Pages via GitHub Actions com base path
correto (`/JurassicRun/`), sem quebrar dev local nem o futuro deploy relativo do itch.io.

**Architecture:** `base` do Vite dirigido por env var `BASE_PATH` (default `/`), resolvido
por um módulo puro testável `resolveBasePath`; o workflow do Pages seta
`BASE_PATH=/JurassicRun/` no build e publica via `actions/deploy-pages`.

**Tech Stack:** Vite 8, vite-plugin-pwa, GitHub Actions (configure-pages / upload-pages-artifact
/ deploy-pages), Vitest.

## Global Constraints

- `src/core/` **não é tocado** ⇒ determinismo **67 inalterado**.
- Padrão puro×casca: lógica em módulo puro testável; `vite.config.ts` é casca (sem teste
  de unidade), molde de `src/pwa/manifest.ts`.
- TypeScript estrito, sem `any` sem justificativa.
- Sem strings de UI novas ⇒ REGRA 4 (i18n) não se aplica (metadados de deploy/infra).
- Um commit por task na branch de feature.

---

### Task 1: `resolveBasePath` puro + wiring no vite.config

**Files:**
- Create: `src/pwa/base.ts`
- Create: `src/pwa/base.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `resolveBasePath(env: Record<string, string | undefined>): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/pwa/base.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBasePath } from './base';

describe('resolveBasePath', () => {
  it('default para "/" quando BASE_PATH ausente', () => {
    expect(resolveBasePath({})).toBe('/');
  });

  it('default para "/" quando BASE_PATH vazio', () => {
    expect(resolveBasePath({ BASE_PATH: '' })).toBe('/');
  });

  it('normaliza absoluto sem barras para ter as duas', () => {
    expect(resolveBasePath({ BASE_PATH: 'JurassicRun' })).toBe('/JurassicRun/');
  });

  it('adiciona barra final quando falta', () => {
    expect(resolveBasePath({ BASE_PATH: '/JurassicRun' })).toBe('/JurassicRun/');
  });

  it('mantém absoluto já bem-formado', () => {
    expect(resolveBasePath({ BASE_PATH: '/JurassicRun/' })).toBe('/JurassicRun/');
  });

  it('passa base relativa "./" inalterada (itch.io)', () => {
    expect(resolveBasePath({ BASE_PATH: './' })).toBe('./');
  });

  it('passa base relativa "." inalterada', () => {
    expect(resolveBasePath({ BASE_PATH: '.' })).toBe('.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pwa/base.test.ts`
Expected: FAIL — `resolveBasePath` não existe.

- [ ] **Step 3: Implementar**

```ts
// src/pwa/base.ts

/**
 * Resolve o `base` do Vite a partir de uma env var `BASE_PATH`, permitindo o mesmo
 * build servir de raízes diferentes (GitHub Pages em `/JurassicRun/`, itch.io em base
 * relativa `./`) sem fixar nada no vite.config. Módulo puro (molde de manifest.ts) ⇒
 * testável sem rodar o build.
 *
 * - Ausente/vazio ⇒ `'/'` (dev local e testes).
 * - Base relativa (`.`, `./`, `./algo`) ⇒ retornada como veio (caso legítimo do Vite
 *   para hospedagem em path arbitrário, ex.: itch.io).
 * - Base absoluta ⇒ normalizada com barra inicial e final (evita o footgun de assets
 *   404 quando falta a barra final).
 */
export function resolveBasePath(env: Record<string, string | undefined>): string {
  const raw = env.BASE_PATH?.trim();
  if (!raw) return '/';
  if (raw === '.' || raw.startsWith('./')) return raw;
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/pwa/base.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Ligar no vite.config.ts**

Modificar `vite.config.ts` para consumir o helper:

```ts
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/pwa/manifest';
import { resolveBasePath } from './src/pwa/base';

export default defineConfig({
  base: resolveBasePath(process.env),
  plugins: [
    tsconfigPaths(),
    VitePWA(pwaOptions),
  ],
  // Vite 8 usa rolldown/oxc (não esbuild) para o transform de JSX; `esbuild.jsx` não
  // existe mais no tipo (o pacote `esbuild` nem é dependência). Equivalente em oxc:
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
});
```

- [ ] **Step 6: Verificar build local com base absoluta**

Run: `BASE_PATH=/JurassicRun/ npm run build`
Expected: build OK; `dist/index.html` referencia assets sob `/JurassicRun/`
(ex.: `/JurassicRun/assets/…`, `/JurassicRun/registerSW.js`), e
`dist/manifest.webmanifest` existe. Verificar:
`grep -o "/JurassicRun/[^\"']*" dist/index.html | head` retorna caminhos prefixados.

- [ ] **Step 7: Verificar que dev/default segue em "/"**

Run: `npm run build` (sem env)
Expected: `dist/index.html` referencia assets sob `/assets/…` (sem prefixo).

- [ ] **Step 8: Commit**

```bash
git add src/pwa/base.ts src/pwa/base.test.ts vite.config.ts
git commit -m "feat(7.3): base path do Vite dirigido por BASE_PATH (resolveBasePath puro)"
```

---

### Task 2: Workflow de deploy do GitHub Pages + docs

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `docs/deploy/README.md`

**Interfaces:**
- Consumes: `BASE_PATH` (Task 1) — o workflow o seta no passo de build.

- [ ] **Step 1: Criar o workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          BASE_PATH: /JurassicRun/

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Validar sintaxe YAML**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/deploy.yml','utf8');if(!/deploy-pages@v4/.test(s)||!/BASE_PATH: \/JurassicRun\//.test(s))process.exit(1);console.log('ok')"`
Expected: `ok` (sanity de que o arquivo tem as âncoras esperadas). YAML mal-indentado
seria rejeitado pelo GitHub; aqui só confirmamos as strings-chave.

- [ ] **Step 3: Escrever a doc de deploy**

```markdown
# Deploy — JurassicRun

## GitHub Pages (produção)

O jogo é publicado automaticamente no **GitHub Pages** a cada push em `main`, pelo
workflow `.github/workflows/deploy.yml`.

- URL: https://insight-x-lab-technologies.github.io/JurassicRun/
- O build roda com `BASE_PATH=/JurassicRun/` (subdiretório do repo de projeto), resolvido
  por `resolveBasePath` (`src/pwa/base.ts`) e aplicado ao `base` do Vite. Os caminhos de
  asset e o `scope`/`start_url` da PWA saem corretos para o subdiretório.
- Publicação via `actions/upload-pages-artifact` + `actions/deploy-pages` (Pages servido
  por Actions, não pela branch `gh-pages` legada).

### Pré-requisito (uma vez, manual)

Em **Settings → Pages** do repositório, defina **Source = GitHub Actions**. Sem isso, o job
`deploy` falha com erro de Pages não habilitado. Não é automatizável pelo agente (requer
acesso ao dashboard).

### Publicação manual

O workflow também aceita `workflow_dispatch` — dá para re-publicar pela aba **Actions** sem
um novo commit.

## Base path e outros alvos

`BASE_PATH` controla o `base` do Vite:

- ausente/`/` ⇒ dev local e testes (default);
- `/JurassicRun/` ⇒ GitHub Pages;
- `./` (relativo) ⇒ hospedagem em path arbitrário, como o **itch.io** (item 7.4).

## itch.io

_Documentado em 7.4._
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml docs/deploy/README.md
git commit -m "feat(7.3): workflow de deploy GitHub Pages + doc"
```

---

## Fechamento (após as tasks)

- [ ] `npm run check` e `npm test` verdes.
- [ ] Determinismo 67 inalterado (`npm run test:determinism`) — item não toca `src/core/`,
      mas confirmar por evidência.
- [ ] Marcar 7.3 `[x]` em `docs/roadmap/PHASE-07-pwa-and-deploy.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md`.
- [ ] Review final da branch (subagente `reviewer`).
- [ ] Merge no `main` (`--no-ff`; `gh` não autenticado ⇒ merge local, como em 7.2).

## Self-Review

- **Cobertura da spec:** base via env (Task 1) ✓; `resolveBasePath` testado (Task 1) ✓;
  vite.config consome (Task 1) ✓; workflow (Task 2) ✓; doc + pré-req Pages (Task 2) ✓;
  determinismo (Fechamento) ✓.
- **Placeholders:** nenhum — todo código presente.
- **Consistência de tipos:** `resolveBasePath(env)` idêntico em teste, impl e vite.config.
```
