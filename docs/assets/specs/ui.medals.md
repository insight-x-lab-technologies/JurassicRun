# Asset Spec — ui.medals

## Identidade
- **id (base):** `ui.medals` — cobre `ui.medal.gold`, `ui.medal.silver`, `ui.medal.bronze`
- **Categoria:** UI / chrome (Tier 1) — medalhas rankeadas do leaderboard
- **Substitui o placeholder:** número de posição sem ornamento (só texto CSS).

## Variantes

| id | Metal | Cor | Uso |
|----|-------|-----|-----|
| `ui.medal.gold` | ouro | `#c9a227` / `#f2d878` | 1º lugar |
| `ui.medal.silver` | prata | `#c8d0d8` / `#eef2f7` | 2º lugar |
| `ui.medal.bronze` | bronze | `#b06a2c` / `#e0a060` | 3º lugar |

## Especificação técnica
- **Dimensões alvo (px):** 96 × 96 (@1x; @2x = 192 × 192), por variante.
- **Pivô / âncora:** centro; à esquerda de cada linha rankeada.
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha, 3 variantes.
- **Margens/padding seguros:** 6px; a láurea não toca a borda.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** disco de medalha com coroa de louros em volta e um numeral central (1/2/3), como em
  `ref/ref_LeaderBoard.png`. Diferem só pelo metal.
- **Coerência:** mesma forma/láurea nas 3; só a cor do metal muda. O numeral pode ser embutido ou
  deixado para o CSV/CSS (preferir embutido para fidelidade ao concept).

## Prompt para geração por IA
- **gold:** "Circular ranked medal with a laurel wreath and a large central number '1', polished
  gold (#c9a227 with #f2d878 highlights), dark fantasy AAA game leaderboard style, transparent
  background, centered, no extra text."
- **silver:** mesma descrição, número '2', prata (#c8d0d8 / #eef2f7).
- **bronze:** mesma descrição, número '3', bronze (#b06a2c / #e0a060).

## Checklist de aceite
- [ ] 3 variantes com láurea idêntica; só o metal muda.
- [ ] Numeral 1/2/3 legível; fundo transparente.
- [ ] Metais coerentes com o Style Bible; `asset-registry.md` = `spec` para os 3 ids.
