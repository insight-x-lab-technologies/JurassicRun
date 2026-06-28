# Fase 4 — Meta offline (perfis, ninho, loja, UI, i18n, áudio)

**Objetivo:** todo o "redor" do jogo funcionando offline: telas, perfis locais, economia,
ninho, loja in-game, expansões, troféus, configurações, 10 idiomas e áudio.

## Itens

### 4.1 App shell e navegação (Preact)
- [ ] Router de telas + design tokens responsivos.

### 4.2 Perfis de jogador (local)
- [ ] Primeiro acesso pede nome.
- [ ] Criar/trocar jogador ativo. (ID global fica na Fase 6.)
- [ ] Tela de Perfil (acessível pelo avatar).

### 4.3 Home
- [ ] Topo: nome ativo, avatar, total de moedas, nº de troféus, nível máx Endless.
- [ ] Menu: Novo Jogo (Endless), Desafio Diário, Desafio Semanal, Configurações, Leaderboard,
      Ninho, Loja, Expansões, Doação (Ko-Fi/BMC), Compartilhar (WhatsApp/IG/TikTok/E-mail/URL).

### 4.4 Ninho / Hangar
- [ ] ~10 pterodáctilos com traços (escudo nato, ímã permanente, moeda 2x/3x, etc.).
- [ ] Comprar com comida (moeda); selecionar ativo. Traços entram na simulação de forma
      determinística (parte do estado inicial da partida).

### 4.5 Economia persistente + Loja (in-game)
- [ ] Carteira de moedas persistida; comprar dinos/itens com moeda.
- [ ] Loja: comprar moedas (placeholder honor-system) e expansões.

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
