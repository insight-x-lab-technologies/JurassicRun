# Fase 8 — Arte AAA & packs look&feel

**Objetivo:** substituir os placeholders geométricos por arte PNG gerada por IA, sem perder
performance, e habilitar packs cosméticos compráveis.

## Itens

### 8.1 Produção de arte a partir das asset-specs
- [x] Gerar imagens via IA seguindo `docs/assets/specs/*` e `asset-registry.md`. _(Usuário gerou
      todos os PNGs em `public/art/`; 11 entidades in-game validadas e integradas.)_
- [x] Empacotar em texture atlases. _(Entidades in-game empacotadas; Tier-1/UI/fundos pendentes.)_
      _**Parte in-game CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec
      `docs/superpowers/specs/2026-07-19-real-entity-art-and-theme-atlas-design.md`, plano
      `docs/superpowers/plans/2026-07-19-real-entity-art-and-theme-atlas.md`). As 11 entidades in-game
      (Tier 2) passaram do atlas placeholder procedural para **arte real** gerada pelo usuário:
      `scripts/gen-atlas.mjs` foi reescrito de gerador-de-shapes para **empacotador de PNGs reais**
      (decoder PNG próprio + `encodePng`, zero dep) que faz trim/slice/downscale/shelf-pack de
      `public/art/final/` → `public/atlas/entities.{png,json}` (JSONHash, 512×522, 17 frames incl.
      **dino de 6 frames de flap** `dino.default.0..5` + alias). O **dino agora é animado** (`Sprite`
      + anim `dino.flap` 12fps no `GameScene`). Criado o **seam de atlas por tema**
      (`LookPack.atlas?`/`atlasRefFor`, `preload` carrega o atlas do pack ativo) para sets de arte
      alternativos futuros trocarem sem tocar consumidores (REGRA 2). Registro: 11 ids `spec`→`art`
      + guarda de fonte. Precache do SW corrigido (`globIgnores` da arte-fonte: 61MB→1.9MB). Playwright
      (build de produção): entidades reais renderizam, **p50 16,7ms/60fps, 0 frames >50ms**, atlas
      único ⇒ batching. Execução SDD por subagentes (4 tasks + review por task + review final opus
      **"READY TO MERGE"**, 0 Critical/Important; 5 Minors → backlog). **Resta em 8.1 (rodada futura):**
      Tier-1 (logo/UI 9-slice/ícones/medalhas/fundos de tela por bioma/parallax real) + os 10 dinos do
      Ninho; mover a arte-fonte p/ fora de `publicDir`; fiar `ref.key` no pipeline de render quando um
      pack tiver atlas próprio._

      _**Tier-1 rodada A CONCLUÍDA** (fundos de tela + painéis 9-slice + logo; `src/core/` intocado, det 67;
      spec `docs/superpowers/specs/2026-07-19-tier1-A-backgrounds-and-panels-design.md`, plano `.../plans/
      2026-07-19-tier1-A-backgrounds-and-panels.md`). Novo `scripts/gen-ui.mjs` **processa** a arte-fonte
      (`public/art/final`) em runtime PNGs pequenos em **`public/ui/`** (trim+downscale, reusa decoder/`cropResize`
      de `gen-atlas`; precacheados, fora do `art/`). `LookPack.bgScreen` + `theme.ts` setam `--bg-screen`/`--ui-panel`
      (URLs com `BASE_URL`) por expansão ativa ⇒ **fundo pintado por bioma, troca AO VIVO**; `.screen`/`.home` (não
      `.play-screen`) sobre **painel 9-slice** (`border-image ... fill` = centro translúcido ⇒ menus legíveis);
      **logo** na Home. Playwright (build prod, retrato+paisagem): logo + painel + fundo classic/volcano/glacier
      com troca ao vivo, sem scroll horizontal, play sem painel. Execução SDD por subagentes (3 tasks + review por
      task). **Resta:** rodadas **B** (botões 9-slice/ícones de nav/statchip/emblema), **C** (medalhas/capas/dinos
      do Ninho), **D** (parallax real `bg.layers.png`); **otimizar peso** dos fundos (precache 1,9→8MB — RGBA
      uncompressed ~6MB; reduzir maxDim/comprimir)._

      _**Tier-1 rodada B CONCLUÍDA** (botões 9-slice + ícones de nav; `src/core/` intocado, det 67; spec
      `docs/superpowers/specs/2026-07-19-tier1-B-buttons-and-icons-design.md`, plano `.../plans/2026-07-19-
      tier1-B-buttons-and-icons.md`). `gen-ui.mjs` ganhou **grid-slice uniforme** (`grid:{cols,rows,names}`):
      `ui.buttons`(1×2→`button.primary/secondary`) e `ui.icons`(5×2→10 `icon.<rota>`, row-major = spec).
      `theme.ts` seta `--ui-button`/`--ui-button-ghost`; `.btn`/`.btn--ghost` viram `border-image ... fill`;
      cada item do menu na Home ganha `<img class="nav-icon">` (decorativo). Fundos maxDim 1280→900 ⇒
      **precache 8→5,5MB**. Playwright: New Game azul + botões ghost dourados + 9 ícones corretos; **alemão
      @360px sem overflow** (Important do review refutado). **Resta rodada C** (`ui.remaining`=emblema/statchip/
      nav-bar/medalhas rects não-uniformes + capas + 10 dinos do Ninho) **e D** (parallax real)._

      _Parte de especificação CONCLUÍDA (docs-only, `src/` intocado, determinismo 67):
      Style Bible `docs/assets/ART-DIRECTION.md` (paleta/materiais/tipografia/iconografia +
      regra dos dois tiers), catálogo de specs prontas-para-IA dos assets novos que os
      concepts de `ref/` introduzem (logo, UI chrome: painel/botões/header/statchip/medalhas/
      barra-de-nav/10 ícones; fundos de tela classic/volcano/glacier trocados pela expansão
      ativa + capas de expansão), realinhamento dos 24 specs existentes ao Style Bible,
      registro atualizado e guarda de paridade registro↔spec (`tests/assets/`). Migração
      concept→atual documentada em `docs/superpowers/specs/2026-07-17-art-direction-migration-
      design.md`: telas de menu são re-skin ~1:1 via tokens CSS; Game Over ganha 2 campos
      (Clima + badge recorde) em UI futura; HUD-fantasia do concept de gameplay (habilidades/
      minimapa/objetivos) REJEITADO por violar o flap-only determinístico. Nome mantido
      "JurassicRun". **Resta:** gerar as imagens (usuário, IA externa) + empacotar em atlases._

### 8.2 Trocar manifesto geométrico → sprite
- [x] Atualizar entradas do manifesto para `kind: "sprite"`. **Sem** tocar core/hitboxes.
- [x] Validar 60fps com atlases (budget de draw calls, culling, pooling).
      _CONCLUÍDO (`src/core/` intocado, determinismo 67; spec `docs/superpowers/specs/2026-07-17-
      sprite-pipeline-design.md`, plano `docs/superpowers/plans/2026-07-17-sprite-pipeline.md`).
      As 11 entidades in-game (Tier 2) passaram a renderizar por sprites de um **texture atlas
      placeholder** gerado proceduralmente (`scripts/gen-atlas.mjs`, encoder PNG puro reusando
      `gen-icons`; `public/atlas/entities.{png,json}` — JSONHash, frames = ids do manifesto). O
      manifesto virou `kind:'sprite'`; `GameScene` carrega o atlas no `preload` e desenha via
      **pool de `Image`** (alocação-zero no hot path, culling preservado, fallback primitivo
      mantido). Arte AAA real (8.1-restante) entra só trocando PNG/JSON do atlas (REGRA 2).
      Evidência Playwright: sprites do atlas renderizam; **p50 16,7ms (60fps), 0 frames >50ms**
      (sem jank; a média sub-60 é o cap de vsync do headless, não o jogo); **6 draw calls/frame**
      = batching (1 textura de atlas). Parallax/fundos e packs seguem fora de escopo (8.1/8.3)._

### 8.3 Packs look&feel
- [x] Formato de pack (atlases + sons + fundos + overrides de manifesto + locales opcionais).
- [x] Carregamento dinâmico de pack; troca em runtime; gameplay/determinismo inalterados.
      _CONCLUÍDO (`src/core/` intocado, determinismo **67**; spec `docs/superpowers/specs/2026-07-18-
      look-and-feel-packs-design.md`, plano `docs/superpowers/plans/2026-07-18-look-and-feel-packs.md`).
      **Decisão: pack ≡ expansão ativa** — reusa o seam `activeExpansion` (4.6) em vez de serviço
      paralelo; `classic`/`volcano`/`glacier` são os packs (unlock honor-system agora, gateway 8.4).
      Módulo puro `src/render/packs.ts` (`LookPack {theme, dayNight, parallax, entityTint}`;
      `classic` reexporta os valores atuais ⇒ zero regressão; `packForId` fallback). Tema CSS reativo
      `src/app/theme.ts` (effect assina `activeExpansion` → `applyPackTheme` seta custom properties em
      `:root` ⇒ reskin AO VIVO dos menus; `tokens.css` guarda os defaults + novo `--color-gold`).
      `GameScene` lê o pack ativo para paleta dia/noite (`pack.dayNight[timeOfDayForSeed(seed)]` ⇒
      seleção segue derivada da seed, ortogonal ao pack), cores de parallax (chave de textura inclui
      `packId`) e tint de entidade (`setTint`; cacheado em `appliedEntityTint` na transição ⇒
      alocação-zero por frame, REGRA 3). **Recolor procedural** (sem arte nova): atlas/áudio/locale
      próprios por pack são o **ponto de extensão** documentado (REGRA 2) — arte real entra trocando os
      arquivos. Verificação Playwright: troca de tema CSS ao vivo (classic #4ea1ff→volcano #ff7a3c) +
      persistência; canvas recolorido (classic céu creme + parallax cinza-verde vs volcano céu
      vermelho + parallax basalto). Sem strings i18n novas (nomes de expansão já existem)._

### 8.4 Monetização real (gateway plugável)
- [x] Implementar provider real de entitlements por trás da interface (ADR-0004):
      compra de packs/moedas via gateway (ex.: Ko-Fi shop/Stripe) + validação (Edge Function).
- [x] Manter honor-system como fallback.
      _CONCLUÍDO (`src/core/` intocado, determinismo **67**; spec `docs/superpowers/specs/2026-07-18-
      monetization-gateway-design.md`, plano `docs/superpowers/plans/2026-07-18-monetization-gateway.md`).
      **Decisão de produto: Ko-Fi + código de resgate single-use** (não Stripe — fora do ethos
      hobby-sem-custo). Fluxo: compra/doação no Ko-Fi (externo) gera um código; jogador cola na Loja/
      Expansões; Edge Function `redeem-code` (Deno, service_role, claim atômico single-use contra
      `jurassicrun.redemption_codes`, guard por `redeemed_at is null`) valida e devolve o SKU; cliente
      aplica LOCAL (moedas→`walletService.earn`; expansão→`entitlementsService.grantAndSelect`, bypassa
      o provider honor-system que fica só de fallback). Peças puro×casca: catálogo SKU puro (`sku.ts`,
      fonte única dos coin packs), seam `RedemptionGateway` (`available` reativo + doubles), casca
      `OnlineClient.redeemCode` (`functions.invoke`) + delegador best-effort, `PurchaseService` (aplica
      SKU, nunca lança, SKU desconhecido do servidor ⇒ error sem aplicar), adapter, `RedeemCodeForm`.
      **Honor-system = fallback:** botões de crédito/unlock grátis aparecem SÓ quando o gateway está
      offline (`!purchaseService.available`); online ⇒ campo de código. **Offline-first:** sem `.env` ⇒
      `available=false` ⇒ UI honor-system ⇒ jogo idêntico. Migração append-only (arquivo NOVO
      `20260718000000_redemption_codes.sql`, não edita o `20260708` já-aplicado; deny-by-default, só
      service_role). i18n `purchase.*`/`expansions.locked` nos 10 locales. Execução SDD por subagentes
      (7 tasks + review por task + review final opus **"READY TO MERGE"**; 1 Important pós-review-final
      corrigido: guard de uso-único trocado de `redeemed_by` p/ `redeemed_at`). Suíte verde (`check`
      limpo, **721 testes**, determinismo **67**). **Pré-req do usuário (não automatizável, igual
      Supabase 6.x):** aplicar a migração `redemption_codes`; `supabase functions deploy redeem-code`;
      criar conta Ko-Fi e inserir `(code, sku)` em `redemption_codes` ao fulfillar pedidos; `.env`
      preenchido. **Adiados/backlog:** Ko-Fi Webhook auto-grant; geração automática de códigos/painel
      admin; Stripe/cartão direto; reembolso; auditoria de `redeemed_by` quando o JWT falha (SKU ainda
      entregue); entitlements/wallet por-perfil (hoje globais). **Fase 8 essencialmente fechada** (resta
      só 8.1 arte AAA real, gerada externamente pelo usuário + empacotada em atlas)._

## Definição de pronto
- Jogo com arte AAA a 60fps; ao menos 1 pack alternativo funcional; compra de pack plugável.
