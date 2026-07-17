# Fase 7 — PWA, responsividade & deploy

**Objetivo:** instalável, offline e publicado. Responsividade validada em todos os alvos.

## Itens

### 7.1 PWA
- [x] `vite-plugin-pwa`: manifest (ícones, nome, cor, orientação), service worker com cache
      de assets para jogar offline.
- [x] Instalável em Android/desktop; testar prompt de instalação.
      _Concluído: manifest puro testável (`src/pwa/manifest.ts`), SW `generateSW`/`autoUpdate`
      com precache (inclui chunk Phaser via `maximumFileSizeToCacheInBytes:4MB`), ícones
      placeholder 192/512/maskable gerados por `scripts/gen-icons.mjs` (encoder PNG puro
      node, zero dep) + asset-spec `pwa-icon` (arte real = Fase 8). `base` de subdiretório
      fica p/ 7.3 (plugin deriva scope/start_url). Prompt de instalação real depende do
      deploy HTTPS (7.3) — validado por build (`dist/manifest.webmanifest`+`sw.js`+ícones)._

### 7.2 Responsividade (transversal, finalizada aqui)
- [x] Desktop, tablet, celular; retrato e paisagem; vários tamanhos.
- [x] Canvas do jogo escala/letterbox corretamente; UI respeita safe-areas.
      _Concluído: campo lógico fixo 320×180 escala/letterbox via `Scale.FIT` (barras na cor
      do tema); dica de girar não-bloqueante (`shouldSuggestRotate` puro + hook `matchMedia`,
      `pointer-events:none`) em celular retrato; telas roláveis sem clip em paisagem curta
      (`#app` altura fixa 100dvh + `.screen`/`.home__menu` `safe center`); zero scroll
      horizontal; safe-areas via `env()`. Fix descoberto na validação: o container do canvas
      precisava de dimensão definida (`absolute; inset:0`) senão o FIT media altura colapsada
      e não escalava. Validado por Playwright (retrato 390×219, paisagem 693×390, desktop
      1440×810 16:9)._

### 7.3 Deploy GitHub Pages
- [x] GitHub Actions: build + publish em Pages. Base path correto para subdiretório.
      _Concluído: `base` do Vite dirigido por env var `BASE_PATH` (helper puro testável
      `resolveBasePath`, `src/pwa/base.ts`) — default `/` (dev/testes), `/JurassicRun/`
      (Pages, normalizado com barras), `./`/`..` relativo passthrough (itch.io 7.4).
      Workflow `.github/workflows/deploy.yml` (configure-pages/upload-pages-artifact/
      deploy-pages, seta `BASE_PATH=/JurassicRun/` no build, push em main +
      workflow_dispatch). Build local com base absoluta verificado: assets/manifest/SW
      prefixados por `/JurassicRun/`, `start_url`/`scope` corretos. Doc `docs/deploy/
      README.md`. **Pré-req manual do usuário: Settings → Pages → Source = GitHub
      Actions** (não automatizável). `src/core/` intocado, determinismo 67._

### 7.4 Deploy itch.io
- [ ] Empacotar build estático; publicar no itch.io.

### 7.5 Futuro (fora do MVP, registrado)
- [ ] Wrappers para lojas Google/Samsung/Huawei/Microsoft (TWA/Capacitor) — avaliar depois.

## Definição de pronto
- Jogo instalável e jogável offline, publicado no GitHub Pages e no itch.io, responsivo.
