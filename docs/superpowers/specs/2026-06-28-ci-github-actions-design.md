# Spec — CI skeleton (GitHub Actions) — item 0.5

> Fase 0, item 0.5. Workflow de Integração Contínua que protege o tronco rodando
> typecheck, lint, testes e a bateria de determinismo a cada PR e a cada push no `main`.

## Objetivo

Garantir que nenhuma mudança quebre as quatro garantias do projeto sem ser detectada:
typecheck estrito, lint (inclui a regra anti-não-determinismo do ESLint), suíte de testes
e a bateria de determinismo. O gate roda automaticamente no CI do GitHub.

Fora de escopo: deploy (GitHub Pages fica na Fase 7), matriz de SO/Node, cobertura,
caching avançado, badges no README.

## Decisões

- **Arquivo:** `.github/workflows/ci.yml` (um único workflow, nome `CI`).
- **Triggers:**
  - `pull_request` → qualquer PR (exigência literal do item 0.5).
  - `push` em `main` → como a integração padrão deste projeto é **merge local no `main`**
    (não há `gh`/PR garantido), o push no tronco precisa ser validado para manter `main`
    sempre verde.
- **Runner:** `ubuntu-latest`. Um único job `ci`.
- **Node:** 22 (alinhado ao ambiente de dev, `node v22.x`), via `actions/setup-node@v4`
  com `cache: 'npm'` (lockfile `package-lock.json` rastreado).
- **Install:** `npm ci` (determinístico, exige lockfile — presente).
- **Passos de verificação, nesta ordem:**
  1. `npm run check` — `tsc --noEmit` + `eslint .` (a regra ESLint anti-não-determinismo
     é parte do lint).
  2. `npm test` — `vitest run` (suíte completa, já inclui `tests/determinism`).
  3. `npm run test:determinism` — `vitest run tests/determinism`, mantido como **gate
     explícito** de determinismo por rastreabilidade do roadmap. A redundância com (2) é
     intencional e de custo trivial; documenta a intenção de "determinismo é inegociável".
- **`concurrency`:** agrupa por workflow + ref e cancela execuções em andamento
  (`cancel-in-progress: true`) para não desperdiçar runners em pushes rápidos.
- **`permissions`:** `contents: read` (menor privilégio; CI só lê o código).
- **Versões de ações:** fixadas em major (`actions/checkout@v4`, `actions/setup-node@v4`).

## Estrutura do workflow

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

## Verificação (definição de pronto)

Não há como executar o runner do GitHub Actions localmente sem um push. Validamos por:

1. **Sintaxe YAML** do arquivo parseia sem erro (validador local: Python `yaml` ou Node).
2. **Comandos referenciados existem** em `package.json` (`check`, `test`, `test:determinism`).
3. **Os comandos passam localmente** com `npm ci` limpo — prova de que o CI passaria:
   `npm run check`, `npm test`, `npm run test:determinism` todos verdes.
4. Marcar 0.5 como `[x]` em `PHASE-00-foundations.md` e fechar a Fase 0 no "Estado atual"
   do `CLAUDE.md`.

## Riscos

- **`gh` ausente:** integração será merge local `--no-ff` no `main`, não PR. O trigger
  `push: main` cobre a validação do tronco nesse fluxo.
- **Host SSH custom (`github-jurassicrun`):** push depende da chave; se falhar, a entrega
  fica como commit local no `main` e relato o bloqueio (sem travar o item).
