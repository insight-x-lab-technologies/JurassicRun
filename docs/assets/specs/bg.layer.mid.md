# Asset Spec — bg.layer.mid

## Identidade
- **id:** `bg.layer.mid`
- **Categoria:** fundo (parallax, camada média)
- **Substitui o placeholder geométrico:** linha de triângulos (colinas) verde poeirento
  `0x4f7a5a`, tile 120×180, pico 35px, base a 18px do fundo, `scrollFactor 0.4`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~480×360 (@2x); tilear sem costura.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** bordas laterais casadas para tilear.

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Camada de parallax in-game (Tier 1.5): silhueta neutra que aceita o tint de daynight; alinhar ao mundo pintado sem cor saturada que brigue com o tint.
- **Estilo:** silhueta chapada, contraste médio (mais perto que `far`).
- **Paleta:** verde poeirento `0x4f7a5a`.
- **Iluminação/ângulo:** vista lateral 2D.
- **Coerência:** entre `bg.layer.far` (atrás) e `bg.layer.near` (à frente).

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game background layer of rolling hills
> silhouette, flat dusty green color (#4f7a5a), medium contrast, transparent background above
> the hills, no text, prehistoric jungle setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite). A arte real (Fase 8) deve funcionar como silhueta neutra que
aceita tint multiplicativo; evite cores saturadas embutidas que briguem com o tint.
