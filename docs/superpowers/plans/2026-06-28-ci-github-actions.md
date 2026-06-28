# CI skeleton (GitHub Actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um workflow de CI no GitHub Actions que roda typecheck+lint, testes e a bateria de determinismo a cada PR e a cada push no `main`.

**Architecture:** Um único arquivo `.github/workflows/ci.yml` com um job `ci` em `ubuntu-latest`. Instala Node 22 com cache de npm, roda `npm ci` e executa em sequência `npm run check`, `npm test`, `npm run test:determinism`. Como não há "código" executável, a verificação é: YAML válido, scripts referenciados existem, e os três comandos passam localmente com um `npm ci` limpo (prova de que o CI passaria).

**Tech Stack:** GitHub Actions, `actions/checkout@v4`, `actions/setup-node@v4`, Node 22, npm, Vitest, ESLint, TypeScript.

## Global Constraints

- Workflow roda em `pull_request` E `push` em `branches: [main]` (cobre PR e o fluxo de merge local no tronco).
- Node version: `22`.
- Install determinístico: `npm ci` (lockfile `package-lock.json` é rastreado).
- Ordem dos gates: `npm run check` → `npm test` → `npm run test:determinism`.
- `permissions: contents: read` (menor privilégio).
- `concurrency` agrupado por `${{ github.workflow }}-${{ github.ref }}` com `cancel-in-progress: true`.
- Ações fixadas em major version (`@v4`).
- Sem deploy (fica na Fase 7).

---

### Task 1: Workflow de CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `check`, `test`, `test:determinism` de `package.json` (já existentes).
- Produces: workflow `CI` que serve de gate. Nada depende dele em código.

- [ ] **Step 1: Escrever o workflow**

Criar `.github/workflows/ci.yml` com exatamente:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run check

      - run: npm test

      - run: npm run test:determinism
```

- [ ] **Step 2: Validar a sintaxe YAML**

Run (Python disponível no ambiente):
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
```
Expected: imprime `YAML OK` sem traceback. (Se `python3`/`yaml` indisponível, validar com Node: `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"` e revisão manual de indentação.)

- [ ] **Step 3: Conferir que os scripts referenciados existem**

Run:
```bash
node -e "const s=require('./package.json').scripts; for (const k of ['check','test','test:determinism']) if(!s[k]) throw new Error('missing script: '+k); console.log('scripts OK')"
```
Expected: imprime `scripts OK`.

- [ ] **Step 4: Provar que o CI passaria — rodar os gates localmente com install limpo**

Run:
```bash
npm ci
npm run check
npm test
npm run test:determinism
```
Expected: todos terminam com exit 0; testes verdes; sem erros de tsc/eslint.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(phase0): adicionar workflow GitHub Actions (check + test + determinism)"
```

---

### Close-out (após Task 1 aprovada na review)

- [ ] Marcar item `0.5` como `[x]` em `docs/roadmap/PHASE-00-foundations.md`.
- [ ] Atualizar o campo "Estado atual" do `CLAUDE.md`: Fase 0 concluída (0.5 fechado); próximo é Fase 1.
- [ ] Commit dessas atualizações de docs.
- [ ] Review final da branch + integração no `main` (merge local `--no-ff`, pois não há `gh`).

## Self-Review

- **Spec coverage:** workflow (Task 1) cobre triggers, Node 22, `npm ci`, os três gates, concurrency, permissions, versões fixadas. Verificação (YAML válido, scripts existem, comandos passam) → Steps 2-4. Close-out cobre marcar 0.5 e atualizar CLAUDE.md. Sem gaps.
- **Placeholder scan:** nenhum TBD/TODO; conteúdo completo do YAML e dos comandos presentes.
- **Type consistency:** N/A (sem tipos); nomes de scripts conferem com `package.json`.
