# Asset Spec — dino.harvester

> Roster do Ninho (4.4): traço `doubleFood` (comida em dobro por coletável — mesmo traço de
> `dino.goldbeak`, tema/paleta diferente). Preço 220, matiz `90` (verde-amarelado).

## Identidade
- **id:** `dino.harvester`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(90, 60%, 45%)` (avatar do
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
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#73b82e` (verde-amarelado/oliva, `hsl(90,60%,45%)` — matiz do roster),
  barriga `#eef7dc`, acentos "trigo maduro" `#d9b34a`, contorno `#1f2b0d`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "colheita/fartura" — pequeno feixe de trigo/espigas estilizado marcado
  na asa (tom `#d9b34a`), sugerindo abundância de comida. Combina com `dino.goldbeak` (mesmo
  traço `doubleFood`, tema "moeda polida" em vez de "colheita").

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a cartoon pterodactyl facing right, mid-flap, flat vector
> style with bold dark outline and simple cel shading, olive-green body (#73b82e), pale
> yellow-green belly (#eef7dc), a small stylized wheat-sheaf marking (#d9b34a) on the wing,
> transparent background, centered, no text, no ground shadow. Provide a 6-frame wing-flap
> animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(90, 60%, 45%)`; marca de trigo/colheita legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
