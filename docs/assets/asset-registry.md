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
| `icon.coin` `icon.trophy` `icon.settings` ... | ícones de UI | placeholder | — |
| `logo.app` | logotipo do jogo | placeholder | — |
| `pwa-icon` | ícone de instalação PWA (192/512/maskable-512) | spec | `specs/pwa-icon.md` |

> Mantenha esta tabela em dia a cada novo asset (a skill `create-asset-spec` faz isso).
