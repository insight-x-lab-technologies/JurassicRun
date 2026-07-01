# Registro de Assets — JurassicRun

Índice de **toda** imagem trocável do jogo. Cada uma deve ter um arquivo de especificação em
`docs/assets/specs/<id>.md` (use a skill `create-asset-spec`). O `id` aqui é a mesma chave
usada no manifesto de assets do render.

> Status: `placeholder` (geométrico) | `spec` (especificada) | `art` (PNG pronto no atlas).

## Personagens (pterodáctilos)
| id | descrição | status | spec |
|----|-----------|--------|------|
| `dino.default` | pterodáctilo inicial | placeholder | `specs/dino.default.md` (exemplo) |
| `dino.shielded` | nasce com escudo | placeholder | — |
| `dino.magnet` | ímã permanente | placeholder | — |
| `dino.double` | moedas 2x | placeholder | — |
| `dino.triple` | moedas 3x | placeholder | — |
| ... (até ~10) | | | |

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
| `powerup.shield` | escudo | placeholder | — |
| `powerup.extralife` | vida extra | placeholder | — |
| `powerup.slowmo` | câmera lenta | placeholder | — |
| `powerup.magnet` | ímã | placeholder | — |
| `powerup.double` | moeda dobrada | placeholder | — |

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

> Mantenha esta tabela em dia a cada novo asset (a skill `create-asset-spec` faz isso).
