# Asset Spec — expansion.covers

## Identidade
- **id (base):** `expansion.covers` — cobre `expansion.classic`, `expansion.volcano`, `expansion.glacier`
- **Categoria:** UI / capa de expansão (Tier 1)
- **Substitui o placeholder:** cards de expansão só com cor/texto (tela de Expansões, 4.6).

## Variantes

| id | Tema | Estado típico na tela |
|----|------|-----------------------|
| `expansion.classic` | jungle canyon diurno | ATIVA (default) |
| `expansion.volcano` | terras ardentes / lava | DESBLOQUEAR |
| `expansion.glacier` | gelo / aurora | DESBLOQUEAR |

## Especificação técnica
- **Dimensões alvo (px):** 512 × 640 (@1x retrato; @2x = 1024 × 1280). PNG **opaco**.
- **Pivô / âncora:** preenche o card retangular (`cover`, centro).
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui` (ou imagem solta por card; não é hot path).
- **Formato de exportação:** PNG/WebP alta qualidade (sem alpha).
- **Margens/padding seguros:** o rótulo (Clássica/Vulcão/Geleira) e o botão ficam por cima via
  CSS na metade inferior — manter essa faixa mais escura/limpa.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** vinheta vertical pintada de cada bioma com um pterodáctilo em pose heróica, como os
  3 cards de `ref/ref_Expansões.png`. Podem ser crops verticais dos `bg.screen.*` correspondentes,
  mas com foco/composição própria de card.
- **Coerência:** os 3 cards compartilham enquadramento vertical e tratamento; só o bioma muda.
  Metade inferior mais escura para o texto/botão.

## Prompt para geração por IA
- **classic:** "Vertical painted game expansion card art of a prehistoric jungle canyon with a
  pterodactyl perched heroically, daytime, dark fantasy AAA style, darker lower third for a
  title and button overlay, portrait 4:5, no text, no UI."
- **volcano:** mesma composição vertical, bioma de lava/terras ardentes.
- **glacier:** mesma composição vertical, bioma de gelo com aurora.

## Checklist de aceite
- [ ] Retrato 4:5, opaco; terço inferior mais escuro (texto/botão legível).
- [ ] As 3 capas coerentes; bioma bate com o `bg.screen` correspondente.
- [ ] Coerente com o Style Bible; os 3 ids no `asset-registry.md` = `spec`.
