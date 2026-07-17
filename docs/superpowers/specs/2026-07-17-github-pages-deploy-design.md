# 7.3 — Deploy GitHub Pages — Design

**Data:** 2026-07-17
**Item do roadmap:** 7.3 (Fase 7 — PWA, responsividade & deploy)
**Autor:** sessão autônoma (Claude)

## Objetivo

Publicar o build estático da PWA no **GitHub Pages** via **GitHub Actions**, com o
**base path correto** para o subdiretório do repositório de projeto. Ao final, um push em
`main` gera e publica o site automaticamente, e o jogo é jogável (e instalável) no ar.

## Contexto

- Remote: `insight-x-lab-technologies/JurassicRun` (repo de projeto, não user/org root).
  ⇒ GitHub Pages serve em `https://insight-x-lab-technologies.github.io/JurassicRun/`.
  ⇒ **base path = `/JurassicRun/`** (com barras nas duas pontas).
- 7.1 deixou o `base` de subdiretório explicitamente para 7.3 (`src/pwa/manifest.ts`:
  caminhos de ícone já são relativos; o `vite-plugin-pwa` deriva `scope`/`start_url` do
  `base` do Vite).
- `src/core/` **não é tocado** ⇒ determinismo **67 inalterado** (item puramente de infra).
- Único path absoluto no código: o entry `<script src="/src/app/main.tsx">` no
  `index.html`, que o Vite reescreve no build sob o `base`. Nenhum asset runtime usa path
  absoluto (grep confirmou); o router é em memória (sem rotas por URL) ⇒ o `base` só afeta
  carregamento de asset, que o Vite resolve.

## Decisão de arquitetura: `base` dirigido por env var

O jogo terá **dois alvos de deploy com bases conflitantes**: GitHub Pages precisa de
`/JurassicRun/` (absoluto); itch.io (7.4) serve de um path arbitrário em iframe e precisa
de base **relativa** (`./`). Fixar `/JurassicRun/` no `vite.config.ts` quebraria 7.4 e o
dev local.

**Solução:** o `base` do Vite vem de uma env var `BASE_PATH` (default `/`). O workflow do
Pages seta `BASE_PATH=/JurassicRun/` no passo de build. Dev local e testes ficam em `/`
(default) ⇒ sem regressão. 7.4 reusará o mesmo mecanismo com `BASE_PATH=./` (ou `''`).

### Peça pura testável: `resolveBasePath`

No padrão puro×casca do projeto (molde de `src/pwa/manifest.ts`), a lógica de resolução
vira um módulo puro testável, e o `vite.config.ts` (casca) só o consome:

- `src/pwa/base.ts` — `resolveBasePath(env: Record<string, string | undefined>): string`
  - Lê `env.BASE_PATH`. Ausente/vazio ⇒ retorna `'/'`.
  - Um path **relativo** (`.` ou `./` ou começa com `./`) é retornado **como veio** (para
    itch.io na 7.4): base relativa é um caso legítimo do Vite e não deve ganhar barras
    absolutas.
  - Um path **absoluto** é normalizado para ter **barra inicial e final** (`JurassicRun` ⇒
    `/JurassicRun/`; `/JurassicRun` ⇒ `/JurassicRun/`; `/JurassicRun/` ⇒ inalterado).
  - Isso guarda contra o footgun clássico do Vite: base absoluta sem barra final quebra a
    resolução relativa dos assets.
- `vite.config.ts` passa a `base: resolveBasePath(process.env)`.

**Por que testar isto:** um `base` malformado (sem barra final) publica um site com todos
os assets 404 — falha silenciosa que só aparece no ar. O teste unitário fixa o contrato de
normalização e a passagem-através do caso relativo.

## Workflow de deploy

`.github/workflows/deploy.yml` — deploy oficial do GitHub Pages (artifact + `deploy-pages`),
separado do `ci.yml` existente (que roda `check`/`test`/`test:determinism`).

```yaml
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

Notas:
- `npm run build` = `tsc --noEmit && vite build` ⇒ erro de tipo **falha o deploy**
  (o build não publica lixo). O `ci.yml` roda a suíte completa em paralelo.
- `concurrency: pages` + `cancel-in-progress: false` = pushes rápidos não se sobrescrevem
  no meio da publicação (padrão recomendado).
- `workflow_dispatch` permite re-publicar manualmente pelo dashboard.
- SPA sem rotas por URL ⇒ **não** precisa de `404.html`; o SW (`navigateFallback:
  index.html`) cobre navegação offline.

## Pré-requisito do usuário (não automatizável)

O agente **não tem** `gh` autenticado nem acesso ao dashboard. O usuário precisa, **uma
vez**, em **Settings → Pages** do repo, definir **Source = GitHub Actions** (Pages via
Actions, não a branch `gh-pages` legada). Sem isso, o job `deploy` falha com "Pages não
habilitado". Documentado em `docs/deploy/README.md`.

## Documentação

- `docs/deploy/README.md` — como funciona o deploy, a env var `BASE_PATH`, o pré-req de
  ativar Pages, e a URL final. Semente para a seção do itch.io em 7.4.

## Fora de escopo (adiado)

- Deploy no itch.io (7.4) — reusa `BASE_PATH` relativo.
- Domínio customizado (CNAME).
- Gate do deploy no verde do CI (hoje `build` roda `tsc`; a suíte completa é o `ci.yml` em
  paralelo — endurecer para `needs: ci` é backlog).
- Arte real dos ícones (Fase 8).

## Critério de pronto

- `resolveBasePath` implementado e testado (default `/`, normalização de absoluto,
  passagem de relativo).
- `vite.config.ts` consome `resolveBasePath(process.env)`.
- `.github/workflows/deploy.yml` criado.
- `npm run build` com `BASE_PATH=/JurassicRun/` produz `dist/` com assets prefixados por
  `/JurassicRun/` (index.html, manifest, SW registrado) — verificado localmente.
- `docs/deploy/README.md` escrito com o pré-req de ativar Pages.
- `npm run check` + `npm test` verdes; determinismo 67 inalterado.
- Item marcado `[x]` na fase; "Estado atual" do CLAUDE.md atualizado.
```
