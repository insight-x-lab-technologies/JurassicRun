# Asset Spec — bg.layer.far

## Identidade
- **id:** `bg.layer.far`
- **Categoria:** fundo (parallax, camada distante)
- **Substitui o placeholder geométrico:** linha de triângulos (cordilheira) azul-acinzentada
  `0x6b7a8f`, tile 160×180, pico 55px, base a 40px do fundo, `scrollFactor 0.2`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~640×360 (@2x de 320×180) ou faixa
  de silhueta com alfa; deve tilear sem costura visível.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), tile ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha (fundo transparente ⇒ camadas atrás aparecem).
- **Margens/padding seguros:** bordas esquerda/direita devem casar para tilear.

## Direção de arte
- **Estilo:** silhueta chapada, sem detalhe interno; sensação de distância (baixo contraste).
- **Paleta:** azul-acinzentado enevoado `0x6b7a8f`.
- **Iluminação/ângulo:** vista lateral 2D; atmosfera enevoada (mais claro = mais longe).
- **Coerência:** camada mais distante; deve ficar atrás de `bg.layer.mid`/`near`.

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game background layer of a distant mountain
> ridge silhouette, flat hazy blue-grey color (#6b7a8f), low contrast to convey distance,
> transparent background above the ridge, no text, no foreground detail, prehistoric jungle
> setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
