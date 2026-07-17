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

O jogo pode ser publicado no **itch.io** como jogo **HTML5** (rodado no browser). O build
usa `BASE_PATH=./` (base relativa) para funcionar sob o path/subdomínio arbitrário do itch.

### Criar a página do jogo (uma vez, manual)

No dashboard do itch.io, **Create new project**:

- **Kind of project:** HTML.
- Após subir os arquivos, marque **"This file will be played in the browser"** no upload.
- **Viewport dimensions:** fullscreen, ou 640×360 (mantém o 16:9 do campo lógico 320×180).

### Caminho manual (upload do zip)

```bash
npm run package:itch
```

Gera `jurassicrun-itch.zip` na raiz do repo — com `index.html` na **raiz do zip** (requisito
do player HTML5 do itch). Suba esse zip no dashboard do projeto.

### Caminho automatizado (butler via CI)

O workflow `.github/workflows/itch.yml` faz o push com o [butler](https://itch.io/docs/butler/)
em push de tag `v*` ou por `workflow_dispatch`. Ele é **inerte até ser configurado**
(offline-first): só roda quando a repository variable `ITCH_TARGET` existe.

Para habilitar, no repositório:

1. Gere uma **API key** em https://itch.io/user/settings/api-keys.
2. **Settings → Secrets and variables → Actions:**
   - Secret `BUTLER_API_KEY` = a API key.
   - Variable `ITCH_TARGET` = `usuario/jurassicrun` (o slug do projeto no itch).
3. Publique criando uma tag `v*` (ex.: `git tag v1.0.0 && git push --tags`) ou pela aba
   **Actions → Deploy to itch.io → Run workflow**.

O butler publica no canal `html5` e cuida de versionamento/patches incrementais.

### Limitação PWA conhecida

O itch.io embute o jogo em um **iframe sandbox** de subdomínio aleatório
(`html-classic.itch.zone`); o **service worker pode não registrar** ali. O jogo roda
normalmente — o precache offline é um bônus da instalação PWA (via GitHub Pages), não um
requisito para jogar no itch. A base relativa (`./`) garante que todos os assets resolvem
sob qualquer path.
