# Roadmap — JurassicRun

Desenvolvimento em fases. Cada fase tem um arquivo `PHASE-XX-*.md` com backlog detalhado.
Regra: uma fase deve deixar o jogo num estado coerente e testado antes da próxima.

| Fase | Tema | Arquivo |
|------|------|---------|
| 0 | Fundações (docs, infra SDD, tooling, CI skeleton) | `PHASE-00-foundations.md` |
| 1 | Núcleo determinístico headless | `PHASE-01-deterministic-core.md` |
| 2 | Vertical slice jogável Endless (1º milestone) | `PHASE-02-endless-vertical-slice.md` |
| 3 | Power-ups & clima | `PHASE-03-powerups-and-weather.md` |
| 4 | Meta offline (perfis, ninho, loja, i18n, áudio, UI) | `PHASE-04-meta-offline.md` |
| 5 | Desafios & leaderboards locais | `PHASE-05-challenges-local.md` |
| 6 | Online (Supabase) | `PHASE-06-online-supabase.md` |
| 7 | PWA, responsividade & deploy | `PHASE-07-pwa-and-deploy.md` |
| 8 | Arte AAA & packs look&feel | `PHASE-08-art-and-packs.md` |

## Rastreabilidade: requisito → fase

Garante que **nada** do escopo ficou de fora.

| Requisito | Fase(s) |
|-----------|---------|
| Side-scroller 2D, flap do pterodáctilo | 1, 2 |
| Obstáculos de formatos variados (hitbox desacoplada) | 1, 2 |
| Pássaros-moeda (comida) | 1, 2 |
| Parallax multicamadas | 2 |
| Dificuldade crescente, reinicia a cada partida | 1, 2 |
| Power-ups (escudo, vida extra, câmera lenta, ímã, 2x, …) | 3 |
| Ninho com ~10 pterodáctilos e traços | 4 |
| Desafio Diário/Semanal determinístico | 1 (seeds/core), 5 (modo+local), 6 (central) |
| Troféus/conquistas; top-3 diário ganha troféu | 4 (sistema), 5 (top-3 local), 6 (central) |
| 10 idiomas | 0 (scaffold i18n), 4 (cobertura completa) |
| Trilha sonora menu/gameplay + SFX botões | 4 |
| HUD (distância, comida, fps, nível, velocidade, seed) | 2 |
| Tempo do dia (cosmético) + clima (afeta gameplay) | 3 |
| Menu inicial (todas as opções) | 4 |
| Configurações (volume, música, idioma) | 4 |
| Tela de Expansões (selecionar ativa) | 4 |
| Loja (moedas, expansões) | 4 (in-game), 8 (gateway real plugável) |
| Leaderboard (Endless/Diário/Semanal) | 5 (local), 6 (central) |
| Primeiro acesso pede nome | 4 |
| Home topo (nome, avatar, moedas, troféus, nível máx) + trocar/criar jogador | 4 (local), 6 (ID global) |
| Tela de Perfil | 4 |
| Game Over overlay com estatísticas (inclui near-miss) | 2 (básico), 3+ (campos extras) |
| Responsivo desktop/tablet/celular, retrato+paisagem | 7 (transversal, validado desde 2) |
| PWA instalável | 7 |
| Deploy GitHub Pages → itch.io | 7 |
| Lojas Google/Samsung/Huawei/Microsoft | futuro (pós-7, fora do MVP) |
| Geométrico substituível por PNG sem perda de fps | 0 (arquitetura), 8 (execução) |
| Packs look&feel compráveis | 8 |
| Compartilhar (WhatsApp/IG/TikTok/E-mail/URL) | 4 |
| Doação (Ko-Fi/BuyMeACoffee) | 4 |
| Asset-specs para geração por IA | 0 (template+registro), contínuo |
| Entitlements (honor-system agora, gateway depois) | 4 (abstração), 8 (gateway real) |

## Definição de "pronto" por fase

Cada item de fase só fecha com: testes passando (`npm test`), typecheck limpo
(`npm run check`), e — se tocou core — testes de determinismo verdes. Ver `docs/WORKFLOW.md`.
