# Asset Spec — dino.default (EXEMPLO)

> Exemplo de referência de como preencher um asset-spec. O pterodáctilo inicial.

## Identidade
- **id:** `dino.default`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** polígono triangular vermelho (~64×48) representando
  o pterodáctilo de perfil.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo (ponto de rotação ao subir/descer)
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo (NÃO inclui asas estendidas). Definida no core; a arte não a altera.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#cc5544`, barriga `#f0c0a0`, crista `#3a8fb0`, contorno `#3a1f1a`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** define o "look" base do pack jurássico inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a friendly cartoon pterodactyl facing right, mid-flap,
> flat vector style with bold dark outline and simple cel shading, warm red body, cream belly,
> teal head crest, transparent background, centered, no text, no ground shadow. Provide a
> 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
