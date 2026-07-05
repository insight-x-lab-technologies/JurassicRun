# Asset Spec — dino.phoenix

> Roster do Ninho (4.4): traço `startLife` (1 carga de vida extra inicial — mesmo traço de
> `dino.nine-lives`, tema/paleta diferente). Preço 600 (o mais caro do roster), matiz `20`
> (laranja-fogo).

## Identidade
- **id:** `dino.phoenix`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(20, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default` — o traço `startLife` (`startExtraLives: 1` em
  `TRAIT_CATALOG`) só concede uma carga de revive no core; a arte não muda a hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame (atenção às pontas da
  "chama" da cauda, que não podem ser cortadas).

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples, mais
  ornamentado que `dino.nine-lives` (preço mais alto do roster ⇒ visual mais lendário).
- **Paleta:** corpo `#b85c2e` (laranja-fogo, `hsl(20,60%,45%)` — matiz do roster), barriga
  `#fbe3d2`, gradiente de "chama" nas penas da cauda/pontas de asa em amarelo-laranja `#ffb347`,
  contorno `#3a1a0a`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave, com leve
  brilho quente (glow) nas pontas de pena que remetem a chamas.
- **Coerência:** tema "fênix" (renascer das cinzas ⇒ vida extra) — penas da cauda estilizadas
  como labaredas, pequenas partículas de brasa/faísca perto das pontas das asas. É a versão
  "lendária" do eixo vida-extra do roster (paralelo a `dino.midas` no eixo comida).

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a legendary phoenix-like cartoon pterodactyl facing right,
> mid-flap, flat vector style with bold dark outline and simple cel shading, fiery orange body
> (#b85c2e), pale peach belly (#fbe3d2), tail feathers and wingtips styled like stylized
> flames fading to bright amber (#ffb347) with a few small ember sparkle particles,
> transparent background, centered, no text, no ground shadow. Provide a 6-frame wing-flap
> animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox (labaredas da cauda incluídas na margem de
      padding, não na hitbox).
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(20, 60%, 45%)`; motivo de chama/fênix legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
