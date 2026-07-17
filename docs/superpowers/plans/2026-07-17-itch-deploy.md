# 7.4 — Deploy itch.io Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar o build estático da PWA para itch.io (HTML5), com script de empacotamento local, workflow CI opcional gated por secret, e docs — sem tocar `src/core/`.

**Architecture:** Reusa `resolveBasePath` (7.3), que já faz passthrough de `BASE_PATH=./`. Um script node zipa o conteúdo de `dist/` com `index.html` na raiz (requisito itch HTML5). Workflow butler é inerte sem `BUTLER_API_KEY` (offline-first). Docs cobrem manual + automatizado + limitação PWA.

**Tech Stack:** Node (ESM script, molde `build-edge.mjs`), `zip` do sistema, GitHub Actions, butler.

## Global Constraints

- `src/core/` **NÃO tocado** ⇒ determinismo 67 inalterado.
- Sem strings i18n novas.
- `jurassicrun-itch.zip` é saída de build ⇒ ignorado no git.
- Base relativa itch = `BASE_PATH=./` (passthrough já em `src/pwa/base.ts`, não alterar).
- Zip deve ter `index.html` na **raiz** (conteúdo de `dist/`, não a pasta).

---

### Task 1: Script de empacotamento local + npm script + gitignore

**Files:**
- Create: `scripts/package-itch.mjs`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm script `package:itch` → `jurassicrun-itch.zip` na raiz do repo.

- [ ] **Step 1:** Criar `scripts/package-itch.mjs`:

```js
#!/usr/bin/env node
// Empacota o build estático para upload no itch.io (jogo HTML5).
// Roda `npm run build` com BASE_PATH=./ (assets relativos, ver src/pwa/base.ts) e
// zipa o CONTEÚDO de dist/ com index.html na raiz do zip (requisito do player itch).
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'dist');
const zipPath = join(repoRoot, 'jurassicrun-itch.zip');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });

console.log('[package-itch] build com BASE_PATH=./');
run('npm', ['run', 'build'], { env: { ...process.env, BASE_PATH: './' } });

if (!existsSync(distDir)) {
  console.error('[package-itch] dist/ não encontrado após o build');
  process.exit(1);
}

if (existsSync(zipPath)) rmSync(zipPath);

console.log('[package-itch] zipando conteúdo de dist/ (index.html na raiz)');
// -r recursivo, -X sem metadados extra de plataforma; cwd=dist ⇒ index.html no topo do zip.
run('zip', ['-r', '-X', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });

console.log(`[package-itch] pronto: ${zipPath}`);
```

- [ ] **Step 2:** Adicionar em `package.json` scripts: `"package:itch": "node scripts/package-itch.mjs"`.

- [ ] **Step 3:** Adicionar em `.gitignore`: `jurassicrun-itch.zip`.

- [ ] **Step 4:** Verificar (build real): `BASE_PATH não deve vazar` — rodar `npm run package:itch`; esperar `jurassicrun-itch.zip` criado.

Run: `npm run package:itch && unzip -l jurassicrun-itch.zip | head -20`
Expected: sucesso; `index.html` listado sem prefixo `dist/`.

- [ ] **Step 5:** Verificar base relativa: `grep -o 'src="[^"]*"' dist/index.html` deve mostrar caminho relativo (`./assets/…` ou `assets/…`), nunca `/JurassicRun/` nem `/assets/`.

- [ ] **Step 6:** Commit.

```bash
git add scripts/package-itch.mjs package.json .gitignore
git commit -m "feat(7.4): script package:itch (build BASE_PATH=./ + zip HTML5)"
```

---

### Task 2: Workflow CI opcional (butler), gated por secret

**Files:**
- Create: `.github/workflows/itch.yml`

**Interfaces:**
- Consumes: `secrets.BUTLER_API_KEY`, `vars.ITCH_TARGET`.

- [ ] **Step 1:** Criar `.github/workflows/itch.yml`:

```yaml
name: Deploy to itch.io

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  butler-push:
    runs-on: ubuntu-latest
    # Inerte sem o secret configurado (offline-first): só roda quando BUTLER_API_KEY existe.
    if: ${{ secrets.BUTLER_API_KEY != '' }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          BASE_PATH: './'

      - name: Install butler
        run: |
          curl -L -o butler.zip https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default
          unzip butler.zip
          chmod +x butler
          ./butler -V

      - name: Push to itch.io
        env:
          BUTLER_API_KEY: ${{ secrets.BUTLER_API_KEY }}
        run: ./butler push dist "${{ vars.ITCH_TARGET }}:html5"
```

- [ ] **Step 2:** Validar YAML: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/itch.yml'))"`.
Expected: sem erro.

- [ ] **Step 3:** Commit.

```bash
git add .github/workflows/itch.yml
git commit -m "feat(7.4): workflow itch.io butler push (gated por BUTLER_API_KEY)"
```

---

### Task 3: Docs de deploy itch.io

**Files:**
- Modify: `docs/deploy/README.md`

- [ ] **Step 1:** Acrescentar seção `## itch.io` ao final de `docs/deploy/README.md` com:
  - Criar página do jogo: Kind = HTML, marcar "This file will be played in the browser",
    viewport recomendada (fullscreen ou 640×360 = 16:9 do campo 320×180).
  - Caminho manual: `npm run package:itch` → subir `jurassicrun-itch.zip` no dashboard.
  - Caminho automatizado: gerar API key no itch → adicionar `BUTLER_API_KEY` (secret) e
    `ITCH_TARGET` (variable, ex.: `usuario/jurassicrun`) → publicar via tag `v*` ou
    `workflow_dispatch`.
  - Limitação PWA: itch embute em iframe sandbox de subdomínio aleatório ⇒ SW pode não
    registrar; jogo roda igual (precache offline é bônus do Pages, não requisito no itch);
    base `./` garante assets resolvendo sob qualquer path.

- [ ] **Step 2:** Verificar link/menção: `grep -i itch docs/deploy/README.md` retorna a seção.

- [ ] **Step 3:** Commit.

```bash
git add docs/deploy/README.md
git commit -m "docs(7.4): instruções de deploy itch.io (manual + butler + limitação PWA)"
```

---

### Fechamento (após as 3 tasks)

- [ ] Marcar 7.4 `[x]` em `docs/roadmap/PHASE-07-pwa-and-deploy.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md` (7.4 concluído; Fase 7 restante = 7.5 futuro).
- [ ] `npm test` + `npm run check` verdes (evidência).
- [ ] Merge em `main` via PR (gh autenticado).

## Self-Review

- **Spec coverage:** empacotamento local (Task 1), CI gated (Task 2), docs+limitação PWA (Task 3), verificação por build (Task 1 steps 4-5 + fechamento). ✓
- **Placeholders:** nenhum; código completo em cada step. ✓
- **Type consistency:** `package:itch`, `jurassicrun-itch.zip`, `BASE_PATH=./`, `ITCH_TARGET`/`BUTLER_API_KEY` consistentes entre tasks e spec. ✓
