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
- [ ] Desktop, tablet, celular; retrato e paisagem; vários tamanhos.
- [ ] Canvas do jogo escala/letterbox corretamente; UI respeita safe-areas.

### 7.3 Deploy GitHub Pages
- [ ] GitHub Actions: build + publish em Pages. Base path correto para subdiretório.

### 7.4 Deploy itch.io
- [ ] Empacotar build estático; publicar no itch.io.

### 7.5 Futuro (fora do MVP, registrado)
- [ ] Wrappers para lojas Google/Samsung/Huawei/Microsoft (TWA/Capacitor) — avaliar depois.

## Definição de pronto
- Jogo instalável e jogável offline, publicado no GitHub Pages e no itch.io, responsivo.
