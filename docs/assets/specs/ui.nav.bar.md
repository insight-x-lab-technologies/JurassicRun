# Asset Spec — ui.nav.bar

## Identidade
- **id:** `ui.nav.bar`
- **Categoria:** UI / chrome (Tier 1) — fundo da barra de navegação inferior
- **Substitui o placeholder:** barra inferior estilizada por CSS (Ninho e telas com nav inferior).

## Especificação técnica
- **Dimensões alvo (px):** 1280 × 96 (@1x; @2x = 2560 × 192). Renderizado por 9-slice horizontal.
- **9-slice (insets, @1x):** 64px nas pontas esquerda/direita fixas; o miolo horizontal estica
  para qualquer largura de viewport. Altura fixa.
- **Pivô / âncora:** ancorada ao rodapé, largura total.
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha (borda superior dourada; corpo escuro semi-opaco).
- **Margens/padding seguros:** os itens de nav ficam por cima via CSS; a arte é só o fundo.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** faixa de vidro escuro com uma borda superior dourada ornamentada e leve vinheta,
  como a barra inferior de `ref/ref_Ninho.png`.
- **Paleta:** vidro escuro `#0e1116`→`#1a1f2b` + fio dourado `#c9a227` no topo.
- **Coerência:** discreta; os ícones (`ui.icons`) e rótulos é que aparecem.

## Prompt para geração por IA
> "Horizontal bottom navigation bar background for a dark fantasy game menu, dark semi-opaque
> glass strip with an ornate golden top edge and subtle vignette, designed for 9-slice horizontal
> scaling (fixed ornamented ends, stretchable middle), transparent above the bar, no text, no
> icons."

## Checklist de aceite
- [ ] 9-slice horizontal válido; estica para larguras variadas sem deformar as pontas.
- [ ] Borda superior dourada; corpo escuro semi-opaco.
- [ ] Coerente com o Style Bible; `asset-registry.md` = `spec`.
