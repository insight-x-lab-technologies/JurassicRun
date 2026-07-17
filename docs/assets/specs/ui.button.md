# Asset Spec — ui.button

## Identidade
- **id (base):** `ui.button` — cobre `ui.button.primary` e `ui.button.secondary`
- **Categoria:** UI / chrome (Tier 1) — botão
- **Substitui o placeholder:** botões estilizados por CSS (`--color-primary` / borda).

## Variantes e estados

| id | Papel | Look |
|----|-------|------|
| `ui.button.primary` | CTA principal ("Novo Jogo", "Desbloquear", "Reiniciar") | Vidro azul-glow gradiente `#2f6fe0`→`#5aa0ff`, brilho interno `#bcd8ff`, borda clara. |
| `ui.button.secondary` | Ação secundária ("Voltar", "Sair", nav) | Vidro escuro `#1a1f2b` com borda dourada `#c9a227`. |

Estados (por variante): **normal** (asset base), **pressed** (~8% mais escuro + brilho reduzido),
**disabled** (dessaturado, ~40% opacidade). Pressed/disabled podem ser derivados por CSS
(filter/opacity) — só o **normal** precisa ser gerado como PNG.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 72 (@1x; @2x = 512 × 144). Renderizado por 9-slice.
- **9-slice (insets, @1x):** 36px nas bordas esquerda/direita são as pontas ornamentadas fixas;
  o miolo horizontal estica. Bordas superior/inferior fixas (12px).
- **Pivô / âncora:** N/A (esticado à largura do label).
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha, por variante (normal).
- **Margens/padding seguros:** o glow do primary não pode sangrar além do frame.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- Botões chanfrados/octogonais como em `ref/ref_Home.png` e `ref/ref_GameOver.png`.
- Primary = vidro azul energizado com brilho; secondary = vidro escuro com fio dourado.

## Prompt para geração por IA
- **primary:** "Horizontal fantasy game UI button, beveled octagonal shape, glowing energized blue
  glass (gradient #2f6fe0 to #5aa0ff) with soft inner glow (#bcd8ff) and thin bright border,
  designed for 9-slice scaling (fixed ornamented ends, stretchable middle), transparent
  background, no text."
- **secondary:** "Horizontal fantasy game UI button, beveled octagonal shape, dark glass body
  (#1a1f2b) with a thin ornate golden border (#c9a227), designed for 9-slice scaling (fixed ends,
  stretchable middle), transparent background, no text."

## Checklist de aceite
- [ ] 9-slice horizontal válido (pontas fixas, miolo estica).
- [ ] Primary azul-glow / secondary borda dourada, ambos coerentes com o Style Bible.
- [ ] Glow não sangra fora do frame; fundo transparente.
- [ ] Ambos ids no `asset-registry.md` = `spec`.
