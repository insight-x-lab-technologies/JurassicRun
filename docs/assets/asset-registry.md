# Registro de Assets — JurassicRun

Índice de **toda** imagem trocável do jogo. Cada uma deve ter um arquivo de especificação em
`docs/assets/specs/<id>.md` (use a skill `create-asset-spec`). O `id` aqui é a mesma chave
usada no manifesto de assets do render.

> Status: `placeholder` (geométrico) | `spec` (especificada) | `art` (PNG pronto no atlas).

## Personagens (pterodáctilos)
| id | descrição | status | spec |
|----|-----------|--------|------|
| `dino.default` | pterodáctilo inicial (render em jogo) | placeholder | `specs/dino.default.md` (exemplo) |
| `dino.starter` | roster do Ninho (4.4): sem traço | spec | `specs/dino.starter.md` |
| `dino.lodestone` | roster do Ninho (4.4): traço `magnet` | spec | `specs/dino.lodestone.md` |
| `dino.goldbeak` | roster do Ninho (4.4): traço `doubleFood` | spec | `specs/dino.goldbeak.md` |
| `dino.midas` | roster do Ninho (4.4): traço `tripleFood` | spec | `specs/dino.midas.md` |
| `dino.nine-lives` | roster do Ninho (4.4): traço `startLife` | spec | `specs/dino.nine-lives.md` |
| `dino.aegis` | roster do Ninho (4.4): traço `headStart` | spec | `specs/dino.aegis.md` |
| `dino.prospector` | roster do Ninho (4.4): traço `magnet` | spec | `specs/dino.prospector.md` |
| `dino.harvester` | roster do Ninho (4.4): traço `doubleFood` | spec | `specs/dino.harvester.md` |
| `dino.phoenix` | roster do Ninho (4.4): traço `startLife` | spec | `specs/dino.phoenix.md` |
| `dino.guardian` | roster do Ninho (4.4): traço `headStart` | spec | `specs/dino.guardian.md` |

## Obstáculos (formatos variados)
| id | descrição | status | spec |
|----|-----------|--------|------|
| `obstacle.rock_arch` | arco de pedra | placeholder | — |
| `obstacle.tree` | árvore | spec | `specs/obstacle.tree.md` |
| `obstacle.vine` | cipó/coluna vegetal | spec | `specs/obstacle.vine.md` |
| `obstacle.boulder` | pedregulho flutuante | spec | `specs/obstacle.boulder.md` |
| `obstacle.stalactite` | estalactite | spec | `specs/obstacle.stalactite.md` |

## Coletáveis / power-ups
| id | descrição | status | spec |
|----|-----------|--------|------|
| `bird.coin` | pássaro-moeda (comida) | spec | `specs/bird.coin.md` |
| `powerup.shield` | escudo (invulnerabilidade temporária) | spec | `specs/powerup.shield.md` |
| `powerup.extraLife` | vida extra (carga que revive) | spec | `specs/powerup.extraLife.md` |
| `powerup.magnet` | ímã (atrai coletáveis) | spec | `specs/powerup.magnet.md` |
| `powerup.doubleCoin` | moeda dobrada (comida em dobro) | spec | `specs/powerup.doubleCoin.md` |
| `powerup.slowMo` | câmera lenta (efeito temporário) | spec | `specs/powerup.slowMo.md` |

## Fundos / parallax
| id | descrição | status | spec |
|----|-----------|--------|------|
| `bg.layer.far` | montanhas distantes (parallax) | spec | `specs/bg.layer.far.md` |
| `bg.layer.mid` | colinas médias (parallax) | spec | `specs/bg.layer.mid.md` |
| `bg.layer.near` | samambaias próximas (parallax) | spec | `specs/bg.layer.near.md` |

## Clima / tempo do dia (overlays)
| id | descrição | status | spec |
|----|-----------|--------|------|
| `weather.rain` / `storm` / `wind` / `snow` | overlays de clima | placeholder | — |
| `daytime.morning` / `afternoon` / `night` | paletas/iluminação | placeholder | — |

## UI / ícones
| id | descrição | status | spec |
|----|-----------|--------|------|
| `icon.coin` `icon.trophy` ... | ícones de HUD | placeholder | — |
| `logo.app` | logotipo do jogo (wordmark ornamentado "JurassicRun") | spec | `specs/logo.app.md` |
| `pwa-icon` | ícone de instalação PWA (192/512/maskable-512) | spec | `specs/pwa-icon.md` |

## UI / chrome (Fase 8 — look AAA)
> Molduras/botões/ícones de menu. Ver `docs/assets/ART-DIRECTION.md` (Style Bible). Tier 1.
| id | descrição | status | spec |
|----|-----------|--------|------|
| `ui.panel.frame` | moldura de painel/card (9-slice) | spec | `specs/ui.panel.frame.md` |
| `ui.button.primary` | botão CTA azul-glow (9-slice) | spec | `specs/ui.button.md` |
| `ui.button.secondary` | botão escuro borda dourada (9-slice) | spec | `specs/ui.button.md` |
| `ui.header.emblem` | crista de pterodáctilo (divisor de header) | spec | `specs/ui.header.emblem.md` |
| `ui.statchip.frame` | moldura dos stat-chips do topo (9-slice) | spec | `specs/ui.statchip.frame.md` |
| `ui.medal.gold` | medalha de 1º lugar | spec | `specs/ui.medals.md` |
| `ui.medal.silver` | medalha de 2º lugar | spec | `specs/ui.medals.md` |
| `ui.medal.bronze` | medalha de 3º lugar | spec | `specs/ui.medals.md` |
| `ui.nav.bar` | fundo da barra de nav inferior (9-slice) | spec | `specs/ui.nav.bar.md` |
| `icon.daily` `icon.weekly` `icon.nest` `icon.shop` `icon.expansions` `icon.leaderboard` `icon.settings` `icon.share` `icon.donate` `icon.back` | conjunto de 10 ícones de nav (dourados) | spec | `specs/ui.icons.md` |

## Fundos de tela (Fase 8 — Tier 1, pintados)
> Trocados pela expansão ativa (seam `activeExpansion`, 4.6).
| id | descrição | status | spec |
|----|-----------|--------|------|
| `bg.screen.classic` | fundo de menu — jungle canyon (default) | spec | `specs/bg.screen.md` |
| `bg.screen.volcano` | fundo de menu — terras ardentes (expansão Vulcão) | spec | `specs/bg.screen.md` |
| `bg.screen.glacier` | fundo de menu — gelo/aurora (expansão Geleira) | spec | `specs/bg.screen.md` |
| `expansion.classic` | capa de card — Clássica | spec | `specs/expansion.covers.md` |
| `expansion.volcano` | capa de card — Vulcão | spec | `specs/expansion.covers.md` |
| `expansion.glacier` | capa de card — Geleira | spec | `specs/expansion.covers.md` |

## Packs look&feel (8.3 — sistema de reskin trocável)
> Um **pack** é um bundle cosmético trocável do jogo inteiro. É keyed pela **expansão ativa**
> (seam `activeExpansion`, 4.6): `classic`/`volcano`/`glacier` são os packs, unlock por
> honor-system agora (gateway na 8.4). 100% render/app ⇒ NÃO toca `src/core/` (determinismo
> intacto). Trocar look = editar dados de pack, nunca a lógica (REGRA 2).
>
> **Formato** (`LookPack`, `src/render/packs.ts`):
> - `theme` — custom properties CSS aplicadas em `:root` (reskin dos menus DOM, tema reativo em
>   `src/app/theme.ts`). Defaults do `classic` vivem em `src/app/styles/tokens.css`.
> - `dayNight` — as 4 paletas do mundo (céu/chão/teto/tint de parallax). A **seleção** entre elas
>   continua derivada da seed (dia/noite 3.3) ⇒ pack (escolha do jogador) e dia/noite (justiça de
>   leaderboard) são ortogonais: `paleta = pack.dayNight[timeOfDayForSeed(seed)]`.
> - `parallax` — cor de cada camada de silhueta (regeneradas por pack; chave de textura inclui o
>   `packId`).
> - `entityTint` — tint multiplicativo dos sprites de entidade (0xffffff = neutro, `classic`).
>
> **`classic` = look atual, zero regressão** (reexporta `DAY_NIGHT_PALETTES`/`PARALLAX_LAYERS`/
> tokens padrão). `volcano` (quente) e `glacier` (frio) são recolors placeholder coerentes com o
> Style Bible; refinados quando a arte AAA chegar.
>
> **Ponto de extensão (REGRA 2):** atlas/áudio/locale **próprios por pack** ainda não têm campo —
> hoje todos os packs apontam para o atlas `entities` e as faixas procedurais, recolorindo por
> tint/paleta. Um pack futuro com arte própria entra adicionando os arquivos (atlas PNG/JSON, sons,
> locale JSON) e apontando o pack para eles, sem tocar consumidores. Sem código morto até lá.

> Mantenha esta tabela em dia a cada novo asset (a skill `create-asset-spec` faz isso).
