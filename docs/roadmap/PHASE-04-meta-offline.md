# Fase 4 — Meta offline (perfis, ninho, loja, UI, i18n, áudio)

**Objetivo:** todo o "redor" do jogo funcionando offline: telas, perfis locais, economia,
ninho, loja in-game, expansões, troféus, configurações, 10 idiomas e áudio.

## Itens

### 4.1 App shell e navegação (Preact)
- [x] Router de telas + design tokens responsivos.

### 4.2 Perfis de jogador (local)
- [x] Primeiro acesso pede nome.
- [x] Criar/trocar jogador ativo. (ID global fica na Fase 6.)
- [x] Tela de Perfil (acessível pelo avatar — wiring da barra de topo em 4.3).

### 4.3 Home
- [x] Topo: nome ativo, avatar (→ Perfil), total de moedas, nº de troféus, nível máx Endless.
      (Stats via seam `getHomeStats` com placeholders 0/0/Lv1 — fontes reais em 4.5/4.7.)
- [x] Menu: Novo Jogo (Endless), Desafio Diário, Desafio Semanal, Configurações, Leaderboard,
      Ninho, Loja, Expansões, Doação (stub → 4.6/ADR-0004), Compartilhar (Web Share + clipboard).

### 4.4 Ninho / Hangar
- [x] ~10 pterodáctilos com traços (escudo nato, ímã permanente, moeda 2x/3x, etc.).
- [x] Comprar com comida (moeda); selecionar ativo. Traços entram na simulação de forma
      determinística (parte do estado inicial da partida). (Compra passa por um seam de carteira
      `getCoinBalance`/`spendCoins` com saldo 0 por ora ⇒ só o starter grátis; a carteira real
      liga no 4.5. Seleção + traço-na-simulação totalmente funcionais.)

### 4.5 Economia persistente + Loja (in-game)
- [x] Carteira de moedas persistida; comprar dinos/itens com moeda. (Comida coletada vira
      moedas 1:1 no Game Over; carteira global `src/services/wallet/` reativa+persistida; o
      Ninho passou a debitar de verdade — deixou de ser browse-only.)
- [x] Loja: comprar moedas (placeholder honor-system). **Expansões movidas para o 4.6** (item
      dedicado com `EntitlementsService`); a Loja mostra "Expansions arrive soon".

### 4.6 Entitlements + Expansões
- [x] `EntitlementsService` (honor-system/Ko-Fi agora; gateway plugável depois — ADR-0004).
      (`src/services/entitlements/` puro×casca: catalog/provider/store/storage/service reativo.
      Provider `honorSystemProvider` é o seam de ADR-0004. Botão de Doação do Home ligado a uma
      URL Ko-Fi placeholder.)
- [x] Tela de Expansões: selecionar expansão ativa (cosmética). (Catálogo classic/volcano/glacier;
      desbloqueio honor-system; seam `activeExpansion` p/ o render da Fase 8 — efeito visual real
      é Fase 8, como os traços do Ninho.)

### 4.7 Troféus / conquistas
- [x] `TrophyService` + catálogo de conquistas. (Top-3 diário → Fase 5/6.)
      (`src/services/trophy/` puro×casca: catalog/store/storage/service reativo. Conquistas
      desbloqueadas por predicado puro sobre um agregado vitalício de partidas — cumulativas
      via `total*`/`gamesPlayed`, partida-única via `best*`. Fiado ao game over via
      `MatchController.onGameOver` → `recordMatch`; religa o placeholder `trophies` do
      `getHomeStats`; tela de Troféus na rota `trophies` (chip 🏆 da Home navega). Catálogo de
      7 (placeholders, tuning Fase 8). Troféus globais → por-perfil na Fase 6.)

### 4.8 Configurações
- [x] Volume, música menu on/off, música gameplay on/off, idioma. (Serviço reativo
      `src/services/settings/` puro×casca — store/storage `jurassicrun.settings.v1`/service com
      signals — + `SettingsScreen`. Idioma tem efeito real imediato: troca AO VIVO via `App`
      assinar o sinal de idioma (fecha a seam de 4.1) + persiste; `settingsService.init()` aplica
      o idioma persistido no bootstrap. Volume e as 2 músicas são **seams persistidos** que o 4.10
      (Áudio) consumirá — nenhum áudio toca ainda, por design. `settings.*` nos 10 locales +
      `LANGUAGE_NATIVE_NAMES`.)

### 4.9 i18n completo (10 idiomas)
- [ ] Cobertura de todas as strings em en, es, pt-BR, fr, it, de, ja, zh, hi.

### 4.10 Áudio
- [ ] Música de menu, música de gameplay, SFX de botões. Respeita configurações.

## Definição de pronto
- Todas as telas navegáveis e funcionais offline; i18n e áudio integrados; economia persiste.
