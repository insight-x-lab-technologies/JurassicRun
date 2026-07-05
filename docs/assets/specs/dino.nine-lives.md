# Asset Spec — dino.nine-lives

> Roster do Ninho (4.4): traço `startLife` (1 carga de vida extra inicial, como o power-up
> `powerup.extraLife`). Preço 350, matiz `0` (vermelho).

## Identidade
- **id:** `dino.nine-lives`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(0, 60%, 45%)` (avatar do
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
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#b82e2e` (vermelho-carmesim, `hsl(0,60%,45%)` — matiz do roster), barriga
  `#f7dcdc`, crista `#6b1414`, contorno `#2b0808`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "nove vidas" (sorte/resiliência) — pequena marca de "coração extra"
  (ícone de coração vermelho-vivo com contorno branco) discreta na base da asa, sugerindo a
  vida de reserva. Combina com `dino.phoenix` (mesmo traço `startLife`, tema mais "flamejante").

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a resilient cartoon pterodactyl facing right, mid-flap,
> flat vector style with bold dark outline and simple cel shading, crimson-red body (#b82e2e),
> pale pink belly (#f7dcdc), a small bright red heart-shaped charm with white outline near the
> base of the wing, transparent background, centered, no text, no ground shadow. Provide a
> 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(0, 60%, 45%)`; ícone de coração/vida-extra legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
