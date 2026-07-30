# Design — Roadmap de monetização (Fases 11–16)

**Data:** 2026-07-30 · **Status:** aprovado pelo usuário
**Contexto:** jogo hobby, pré-lançamento, arte/dev 100% via agentes de IA, sem investimento em
profissionais. Objetivo: monetizar e diferenciar, equilibrando facilidade de desenvolvimento ×
potencial de retorno.

## Decisões de produto (travadas com o usuário)

| Tema | Decisão |
|------|---------|
| Canais de receita | **Todos os 4**, em camadas: portais web (CrazyGames/Poki, rev-share de ads) → Play Store (TWA + Play Billing) → Ko-Fi direto (já existe, 8.4) → rewarded ads no PWA (H5 Games Ads). |
| Retenção | Recompensa diária + streak, missões diárias, eventos temáticos. **Battle pass rejeitado** (não selecionado; custo alto sem base de jogadores). |
| Coin sinks | Cosméticos (skins/trails/ninho), gacha leve de ovos (**só moeda soft** — seguro para políticas de loja), consumível **revive** (julgamento delegado: incluído — sink clássico + gancho de rewarded ad). **Upgrades permanentes rejeitados**: quebram comparabilidade do leaderboard global (campo 320×180 travado por justiça). |
| Diferenciadores | Corrida fantasma, link de desafio compartilhável, torneios semanais, modo aventura (por último — mais caro; desenho barato: missão = seed + modificadores + objetivo-predicado, sem level design artesanal). |
| Ordem | **Estratégia A — retenção primeiro**: 11 Retenção → 12 Viral → 13 Ads+portais → 14 Play → 15 Live-ops → 16 Aventura. Razão: portais destacam jogo novo UMA vez; chegar com retenção pronta maximiza o pico único de lançamento. |

## Racional de ordenação

1. **Fase 11** cria o motivo de voltar (daily/quests) e o motivo de gastar (skins/ovos/revive).
   Sem isso, tráfego de portal vira churn e compra de moeda não faz sentido.
2. **Fase 12** é barata (reusa replay determinístico e share 4.x) e multiplica cada jogador
   adquirido. Fecha com **soft launch** no itch/Pages para medir retenção real (telemetria 11.7).
3. **Fase 13** é a primeira receita: seam de ads + flavors de build + submissão a portais.
4. **Fase 14** abre IAP real (Play Billing via Digital Goods API em TWA).
5. **Fase 15** sustenta retenção longa (eventos/torneios) quando já existe base.
6. **Fase 16** é o conteúdo evergreen ambicioso, por último.

## Invariantes preservadas

- `src/core/` intocado **exceto 11.5 (revive)** — único item core das 6 fases; ritual completo
  (re-pin se preciso, `verify-determinism`, `npm run build:edge`).
- Campo lógico 320×180 imutável; nenhum item mexe em física/spawn/dificuldade.
- Offline-first: ads/telemetria/torneio viram no-op sem rede/provider; jogo idêntico.
- i18n 10 idiomas para toda string nova; asset-spec para toda arte nova; pipeline contra
  placeholder (arte IA dropa depois).
- Hobby sem custo fixo: única despesa aceita = US$25 (taxa única Play Console, ação do usuário).

## Arquitetura transversal nova

- **Seam `AdsProvider`** (interstitial/rewarded/lifecycle), molde do provider de entitlements
  (ADR-0004). Implementações: no-op (default), CrazyGames SDK, Poki SDK, H5 Games Ads, futura
  AdMob se algum dia houver wrapper nativo.
- **Flavors de build** (`DIST_FLAVOR`: `standalone|crazygames|poki|play`): decide provider de ads
  e **esconde links externos/Ko-Fi nos portais** (política deles). Molde: `BASE_PATH` (7.3).
- **Telemetria anônima best-effort** (11.7) sobre o ID anônimo 6.2 — pré-requisito de qualquer
  decisão de tuning das fases 12+.

## Expectativa honesta de receita

Sem marketing pago: rev-share de portais rende dezenas a poucas centenas de US$/mês SE o jogo
performar; IAP só rende com base instalada. Retenção (11) e viralidade (12) são as alavancas que
mudam a curva — por isso vêm primeiro.

## Detalhe por fase

Vive nos arquivos `docs/roadmap/PHASE-11..16-*.md` (guarda-chuva de cada fase; cada item vira
spec própria na hora de implementar, padrão da Fase 10).
