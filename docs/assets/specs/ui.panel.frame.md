# Asset Spec — ui.panel.frame

## Identidade
- **id:** `ui.panel.frame`
- **Categoria:** UI / chrome (Tier 1) — moldura de painel/card
- **Substitui o placeholder:** `background: var(--color-surface)` + `border-radius` do CSS atual.

## Especificação técnica
- **Dimensões alvo (px):** 512 × 512 (@1x; exportar @2x = 1024 × 1024). Renderizado esticado por 9-slice.
- **Pivô / âncora:** N/A (esticado para preencher o container).
- **9-slice (insets, @1x):** 48px em cada uma das 4 bordas são a ornamentação fixa (cantos e
  filigrana); a região central 416 × 416 estica sem deformar os cantos. Bordas laterais/verticais
  esticam só num eixo.
- **Hitbox lógica associada:** nenhuma.
- **Animação:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha (centro semi-translúcido; molduras opacas).
- **Margens/padding seguros:** a arte deve caber inteira nos 512×512 sem sangrar.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** painel de vidro escuro semi-translúcido (`#0e1116`→`#1a1f2b` a ~85% de opacidade)
  com moldura dourada ornamentada nos 4 cantos e filigrana fina nas bordas (como os painéis de
  `ref/ref_GameOver.png` e `ref/ref_Ninho.png`).
- **Paleta:** vidro escuro + ouro `#c9a227`/`#f2d878`/`#8a6d1b`.
- **Coerência:** cantos ornamentados idênticos entre si (9-slice); centro liso para receber texto.

## Prompt para geração por IA
> "Dark translucent glass UI panel with ornate golden filigree border and decorated corners,
> dark fantasy AAA game menu frame, designed for 9-slice scaling (detailed fixed corners, plain
> stretchable flat center), semi-transparent dark center, transparent background outside the
> frame, no text, square."

## Checklist de aceite
- [ ] 9-slice válido: cantos (48px) não esticam; centro liso estica sem artefato.
- [ ] Centro semi-translúcido; fora da moldura transparente.
- [ ] Ouro coerente com o Style Bible.
- [ ] Empacotado no atlas `ui`; entrada no `asset-registry.md` = `spec`.
