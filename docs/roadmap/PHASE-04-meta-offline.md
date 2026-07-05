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
- [ ] `EntitlementsService` (honor-system/Ko-Fi agora; gateway plugável depois — ADR-0004).
- [ ] Tela de Expansões: selecionar expansão ativa (cosmética).

### 4.7 Troféus / conquistas
- [ ] `TrophyService` + catálogo de conquistas. (Top-3 diário → Fase 5/6.)

### 4.8 Configurações
- [ ] Volume, música menu on/off, música gameplay on/off, idioma.

### 4.9 i18n completo (10 idiomas)
- [ ] Cobertura de todas as strings em en, es, pt-BR, fr, it, de, ja, zh, hi.

### 4.10 Áudio
- [ ] Música de menu, música de gameplay, SFX de botões. Respeita configurações.

## Definição de pronto
- Todas as telas navegáveis e funcionais offline; i18n e áudio integrados; economia persiste.
