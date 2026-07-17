# Asset Spec — ui.statchip.frame

## Identidade
- **id:** `ui.statchip.frame`
- **Categoria:** UI / chrome (Tier 1) — moldura de stat-chip
- **Substitui o placeholder:** os 3 chips de stat (moedas/troféus/nível) estilizados por CSS.

## Especificação técnica
- **Dimensões alvo (px):** 192 × 64 (@1x; @2x = 384 × 128). Renderizado por 9-slice.
- **9-slice (insets, @1x):** 28px nas bordas esquerda/direita fixas (pontas ornamentadas), miolo
  horizontal estica; 12px superior/inferior fixos.
- **Pivô / âncora:** N/A (esticado ao conteúdo — ícone + número + rótulo).
- **Hitbox lógica associada:** nenhuma.
- **Atlas de destino:** `ui`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** deixar espaço interno à esquerda para o ícone do stat.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** pílula/tablet de vidro escuro com fina borda dourada e ponta esquerda para receber
  o ícone (moeda/troféu/gráfico), como os 3 chips do topo em `ref/ref_Home.png`.
- **Paleta:** vidro escuro `#1a1f2b` + fio dourado `#c9a227`.
- **Coerência:** discreto; o valor (âmbar `#ffcf5c`) e o ícone é que chamam atenção.

## Prompt para geração por IA
> "Small horizontal fantasy UI stat chip frame, dark glass tablet with a thin golden border and a
> rounded slot on the left for an icon, designed for 9-slice scaling (fixed ornamented ends,
> stretchable middle), transparent background, no text."

## Checklist de aceite
- [ ] 9-slice horizontal válido; slot de ícone à esquerda.
- [ ] Vidro escuro + fio dourado coerente com o Style Bible.
- [ ] Fundo transparente; empacotado no atlas `ui`; `asset-registry.md` = `spec`.
