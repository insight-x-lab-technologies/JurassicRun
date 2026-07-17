# Asset Spec — dino.goldbeak

> Roster do Ninho (4.4): traço `doubleFood` (comida em dobro por coletável, como o power-up
> `powerup.doubleCoin` permanente). Preço 150, matiz `45` (dourado).

## Identidade
- **id:** `dino.goldbeak`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(45, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default` — o traço `doubleFood` (`foodMultiplier: 2` em
  `TRAIT_CATALOG`) é só economia no core; a arte não muda a hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#b8952e` (dourado-terroso, `hsl(45,60%,45%)` — matiz do roster), barriga
  `#f7ecd2`, bico e crista em dourado brilhante `#f0c94a`, contorno `#3a2c0d`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "moeda dobrada" — bico com acabamento metálico/dourado (como moeda
  polida) e um pequeno brilho/glint no formato de moeda perto da asa. Combina com
  `dino.harvester` (mesmo traço `doubleFood`, paleta diferente) e antecede `dino.midas`
  (versão "3x" mais lendária).

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a cartoon pterodactyl facing right, mid-flap, flat vector
> style with bold dark outline and simple cel shading, warm golden-ochre body (#b8952e), pale
> cream belly (#f7ecd2), a shiny polished-gold beak and crest (#f0c94a) with a subtle coin-glint
> sparkle near the wing, transparent background, centered, no text, no ground shadow. Provide a
> 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(45, 60%, 45%)`; bico/glint dourado legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
