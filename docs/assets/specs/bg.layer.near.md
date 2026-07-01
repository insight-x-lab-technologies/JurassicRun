# Asset Spec — bg.layer.near

## Identidade
- **id:** `bg.layer.near`
- **Categoria:** fundo (parallax, camada próxima)
- **Substitui o placeholder geométrico:** linha de triângulos estreitos (samambaias/vegetação)
  verde escuro `0x2f5233`, tile 64×180, pico 50px, base a 6px do fundo, `scrollFactor 0.7`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~256×360 (@2x); tilear sem costura.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** bordas laterais casadas; enraíza atrás da linha do solo.

## Direção de arte
- **Estilo:** silhueta chapada, maior contraste (camada mais próxima).
- **Paleta:** verde escuro `0x2f5233`.
- **Iluminação/ângulo:** vista lateral 2D.
- **Coerência:** camada mais à frente das três; fica atrás da faixa de chão.

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game foreground foliage layer, silhouettes of
> tall ferns and jungle plants, flat dark green color (#2f5233), higher contrast, transparent
> background above the foliage, no text, prehistoric jungle setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
