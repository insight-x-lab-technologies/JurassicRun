# Fase 13 — Ads & portais web

**Objetivo:** primeira receita real. Seam de anúncios plugável + flavors de build por distribuição
+ submissão aos portais de jogos HTML5 (CrazyGames primeiro), que trazem o tráfego que um hobby
sem marketing não tem. Rewarded ads viram fonte de moeda/revive; interstitial com política educada.

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.

## Premissas (NÃO violar)

- `src/core/` **intocado**. Ads são casca/serviço; nenhum ad interrompe simulação em andamento.
- **Offline/standalone-first:** sem provider configurado, TODO placement é no-op invisível — o
  jogo continua idêntico ao de hoje. Nada de tela quebrada por adblocker (detectar falha e seguir).
- **Política dos portais manda no flavor:** nos builds de portal, links externos (Ko-Fi, GitHub,
  share por URL externa) somem ou viram variante permitida. Checar o guideline vigente de cada
  portal na spec do item — regras mudam.
- Economia: recompensa de rewarded calibrada contra o ganho médio por partida (não inflacionar).

## Itens

### 13.1 Seam `AdsProvider` + flavors de build
- [ ] Interface `AdsProvider`: `isRewardedAvailable()`, `showRewarded(): 'rewarded'|'dismissed'|
      'error'`, `showInterstitial()`, hooks de lifecycle (`loadingStart/Stop`,
      `gameplayStart/Stop`, `happytime`). Molde: provider de entitlements (ADR-0004).
- [ ] Flavor por env/`define` (`DIST_FLAVOR`: `standalone|crazygames|poki|play`), molde
      `BASE_PATH` (7.3). Flavor escolhe provider (SDK carregado dinamicamente só no flavor dele)
      e gate de links externos.
- [ ] Default `standalone` = provider no-op ⇒ builds atuais byte-equivalentes em comportamento.

**Toca:** serviço novo, `vite.config.ts`, pontos de link externo. **Aceite:** build standalone
sem mudança visível; build de flavor troca provider e esconde Ko-Fi; teste do gate por flavor.

### 13.2 Rewarded placements
- [ ] Placements: **revive grátis** (alternativa ao de moedas do 11.5), **dobrar moedas** do Game
      Over, **2× recompensa diária** (11.1). Todos condicionados a `isRewardedAvailable()` —
      botão nem aparece sem provider.
- [ ] `dismissed`/`error` ⇒ sem recompensa, sem punição, UI volta limpa.
- [ ] Telemetria (11.7): `ad_rewarded_shown/completed` por placement.

**Toca:** overlays de morte/GameOver/Home, serviço de ads, carteira, i18n. **Aceite:** recompensa
só após `rewarded`; sem provider a UI é a da Fase 11; áudio muta durante o ad e volta.

### 13.3 Política de interstitial
- [ ] Função pura `shouldShowInterstitial(state)`: nunca em partida, nunca antes da 1ª partida da
      sessão, a cada N game overs (começar N=3), intervalo mínimo em segundos, cooldown pós-
      rewarded. Tuning na spec.
- [ ] Mute/pause de áudio via `AudioEngine` durante o ad; retomada limpa.
- [ ] Testes da política pura (tabela de casos).

**Toca:** serviço de ads, fluxo de Game Over, áudio. **Aceite:** política provada por teste;
jogador de primeira sessão não vê interstitial; frequência respeitada.

### 13.4 Portal-readiness (QA técnico)
- [ ] Orçamento de load: chunk inicial mínimo, atlases por tema em lazy-load, medir bytes até
      primeiro frame jogável (meta na spec; portais penalizam load lento).
- [ ] Barra de progresso de carregamento ligada ao loader do Phaser + eventos `loadingStart/Stop`
      do SDK.
- [ ] Checklist de QA de portal versionado em `docs/` (pausa/mute em ad, sem link externo, roda
      em iframe, sem localStorage estourado, portrait+landscape — 10.9 já cobre).

**Toca:** build/split de chunks, tela de load, docs. **Aceite:** métricas de load medidas por
NÚMERO e dentro da meta; checklist completo verde no build de flavor.

### 13.5 Submissão CrazyGames
- [ ] Integrar o SDK HTML5 deles no flavor `crazygames` (init, ads, happytime/celebrate nos
      momentos certos: recorde, troféu, pódio).
- [ ] **Ação do usuário:** criar conta de dev no portal. Submeter, responder o QA deles, iterar.
- [ ] Rev-share/termos documentados em `docs/` para decisão consciente.

**Toca:** provider novo, build flavor, docs. **Aceite:** build passa no QA do portal; jogo
publicado (ou feedback de rejeição documentado e endereçado).

### 13.6 Portais adicionais (Poki, GameDistribution, …)
- [ ] Reusar o seam: um provider por portal aceito. Poki primeiro (SDK próprio + playtest
      automático deles). Submeter onde o rev-share compensar.
- [ ] Best-effort: portal que recusar não bloqueia a fase.

**Toca:** providers novos. **Aceite:** ≥1 portal adicional submetido; recusas documentadas.

### 13.7 H5 Games Ads no PWA standalone
- [ ] Ad Placement API (AdSense for Games) como provider do flavor `standalone`, mapeada no seam
      (`adBreak` rewarded/interstitial). **Gated pela aprovação do AdSense** (ação do usuário;
      pode ser negada sem tráfego — best-effort declarado).

**Toca:** provider novo. **Aceite:** com aprovação, ads servem no PWA; sem aprovação, no-op
limpo (invariante da fase).

## Ordem de execução

13.1 → 13.3 → 13.2 → 13.4 → 13.5 → 13.6 → 13.7. Seam e política primeiro (puros, testáveis),
depois placements, depois o funil de submissões.

## Definição de pronto (fase)

- `check` + suíte inteira verdes; core intocado; build standalone comporta-se como antes.
- Jogo submetido ao CrazyGames (aceito ou com plano de correção); rewarded funcionando em pelo
  menos 1 distribuição real; telemetria de ads coletando.
