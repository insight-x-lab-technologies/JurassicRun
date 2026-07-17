# Asset Spec — ui.header.emblem

## Identidade
- **id:** `ui.header.emblem`
- **Categoria:** UI / chrome (Tier 1) — divisor/crista de header
- **Substitui o placeholder:** título de tela sem ornamento (só texto CSS).

## Especificação técnica
- **Dimensões alvo (px):** 640 × 160 (@1x; @2x = 1280 × 320)
- **Pivô / âncora:** centro; posicionado acima do título de cada tela (Ninho, Placar, Expansões).
- **Hitbox lógica associada:** nenhuma.
- **Animação:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** 16px; asas do emblema não podem tocar a borda.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** crista simétrica de pterodáctilo dourado com asas abertas + ornamento em diamante
  central e filetes laterais que se afinam (o divisor visto acima de todos os headers dos
  concepts, ex.: `ref/ref_LeaderBoard.png`, `ref/ref_GameOver.png`).
- **Paleta:** ouro `#c9a227`/`#f2d878`/`#8a6d1b`; gravado.
- **Coerência:** simétrico no eixo vertical; leve o suficiente para não competir com o título.

## Prompt para geração por IA
> "Symmetric ornate golden heraldic emblem of a pterodactyl with spread wings and a central
> diamond ornament, thin tapering filigree extending sideways, engraved metallic gold (#c9a227
> with #f2d878 highlights), dark fantasy AAA game header divider, transparent background, no text,
> horizontally centered and symmetric."

## Checklist de aceite
- [ ] Fundo transparente; emblema simétrico.
- [ ] Ouro coerente com o Style Bible; asas não tocam a borda.
- [ ] Empacotado no atlas `ui`; entrada no `asset-registry.md` = `spec`.
