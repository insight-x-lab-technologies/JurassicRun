# Asset Spec — dino.starter

> Roster do Ninho (4.4): pterodáctilo inicial, sem traço (`traitKind: 'none'`). Visualmente é o
> "look" neutro de referência do roster — mesma silhueta de `dino.default`, paleta própria.

## Identidade
- **id:** `dino.starter`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(200, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default` — o starter é o dino padrão jogável.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo (ponto de rotação ao subir/descer) — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo (NÃO inclui asas estendidas). Definida no core (`src/core/dino`, traço `none` =
  `TRAIT_CATALOG.none`, sem modificadores); o roster **não altera a hitbox de simulação** — só
  o cosmético. Igual para os 10 dinos deste registro.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame para não cortar as pontas
  das asas no atlas.

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples — mesmo
  estilo-base de `dino.default`.
- **Paleta:** corpo `#2e8ab8` (azul-petróleo, `hsl(200,60%,45%)` — matiz do roster), barriga
  `#dff2f8`, crista `#1f4f66`, contorno `#12222b`. Sem emblema/acessório: é o "neutro" contra o
  qual os outros 9 se diferenciam.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** referência de silhueta e proporção para todo o resto do roster; qualquer
  variação de traço reusa esta pose/anatomia, só troca paleta e pequenos acessórios.

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a friendly cartoon pterodactyl facing right, mid-flap,
> flat vector style with bold dark outline and simple cel shading, teal-blue body (#2e8ab8),
> pale cream belly (#dff2f8), dark teal head crest (#1f4f66), no accessories or emblems,
> transparent background, centered, no text, no ground shadow. Provide a 6-frame wing-flap
> animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(200, 60%, 45%)` (matiz do roster); sem acessórios/emblemas.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
