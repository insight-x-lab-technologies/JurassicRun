# Asset Spec — dino.prospector

> Roster do Ninho (4.4): traço `magnet` (ímã sempre ativo, como o power-up `powerup.magnet`
> permanente — mesmo traço de `dino.lodestone`, tema/paleta diferente). Preço 400, matiz `120`
> (verde).

## Identidade
- **id:** `dino.prospector`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(120, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default` — o traço `magnet` (`magnetAlways: true` em
  `TRAIT_CATALOG`) é só física de atração de coletáveis no core; a arte não muda a hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#2eb82e` (verde-mata, `hsl(120,60%,45%)` — matiz do roster), barriga
  `#dcf7dc`, acentos terrosos/metálicos (veio de minério) `#8a6a3a`, contorno `#0d2b0d`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "garimpeiro/prospector" — pequena bandoleira estilo saco-de-garimpo
  cruzando o peito e veios metálicos dourado-opaco na asa (minério ainda não refinado, ao
  contrário do polido de `dino.lodestone`). Combina com `dino.lodestone` (mesmo traço `magnet`,
  paleta e tema diferentes: mineração bruta vs. ímã refinado).

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a rugged cartoon pterodactyl facing right, mid-flap, flat
> vector style with bold dark outline and simple cel shading, forest-green body (#2eb82e), pale
> green belly (#dcf7dc), a small canvas prospector satchel strap crossing the chest and dull
> raw-ore veins (#8a6a3a) on the wing, transparent background, centered, no text, no ground
> shadow. Provide a 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(120, 60%, 45%)`; bandoleira/veios de minério legíveis em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
