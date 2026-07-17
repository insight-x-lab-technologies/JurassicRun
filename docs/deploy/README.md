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
