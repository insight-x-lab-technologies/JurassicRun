# Asset Spec — ui.icons

## Identidade
- **id (base):** `ui.icons` — conjunto de 10 ícones de navegação/ação
- **Categoria:** UI / chrome (Tier 1) — ícones de linha dourada
- **Substitui o placeholder:** glyphs/emoji ou ícones neutros do CSS nas telas de menu.

## Conjunto (ids concretos)

| id | Glyph descrito | Onde aparece |
|----|----------------|--------------|
| `icon.daily` | sol radiante | Home → Desafio Diário |
| `icon.weekly` | calendário/pergaminho | Home → Desafio Semanal |
| `icon.nest` | láurea sobre ninho | Home/nav → Ninho |
| `icon.shop` | cesta | Home/nav → Loja |
| `icon.expansions` | folha/globo estilizado | Home/nav → Expansões |
| `icon.leaderboard` | pódio (3 degraus) | Home/nav → Placar |
| `icon.settings` | engrenagem | Home/nav → Configurações |
| `icon.share` | nós de compartilhar (3 pontos ligados) | Home → Compartilhar |
| `icon.donate` | coração na palma da mão | Home → Doação |
| `icon.back` | seta para a esquerda | telas → Voltar |

## Especificação técnica
- **Dimensões alvo (px):** 64 × 64 (@1x; @2x = 128 × 128), grade uniforme, um por id.
- **Pivô / âncora:** centro; área de toque mínima garantida por CSS (≥44px).
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui-icons`.
- **Formato de exportação:** PNG com alpha, transparente.
- **Margens/padding seguros:** 6px em volta do glyph (não encostar na borda de 64px).

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** ícone dourado (`#c9a227`/`#f2d878`) de linha/preenchimento, emblema heráldico,
  silhueta clara e legível a 64px, sem cor fora da faixa dourada (hover/ativo é CSS). Consistência
  de peso de traço entre os 10 (como os ícones dourados de `ref/ref_Home.png`).
- **Coerência:** todos com o mesmo grid óptico, mesmo peso de traço, mesma iluminação.

## Prompt para geração por IA
Template compartilhado (trocar `<GLYPH>` pela coluna da tabela):
> "Single golden heraldic UI icon of <GLYPH>, flat gold line-and-fill style (#c9a227 with #f2d878
> highlights), dark fantasy AAA game menu icon, consistent stroke weight, centered on a 64x64
> optical grid, transparent background, no text, no background scenery."

Exemplos: `<GLYPH>` = "a radiant sun" (daily), "a calendar scroll" (weekly), "a laurel wreath over
a nest" (nest), "a woven basket" (shop), "a stylized leaf/globe" (expansions), "a three-step
podium" (leaderboard), "a gear" (settings), "three connected share nodes" (share), "a heart in an
open palm" (donate), "a left-pointing arrow" (back).

## Checklist de aceite
- [ ] 10 ícones, grade 64×64 uniforme, fundo transparente.
- [ ] Peso de traço e iluminação consistentes entre os 10.
- [ ] Só faixa dourada (sem variantes coloridas embutidas).
- [ ] Empacotados no atlas `ui-icons`; os 10 ids no `asset-registry.md` = `spec`.
