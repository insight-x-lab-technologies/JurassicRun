# Asset Spec — dino.midas

> Roster do Ninho (4.4): traço `tripleFood` (comida em triplo por coletável — o mais valioso
> multiplicador do roster). Preço 500, matiz `50` (dourado radiante).

## Identidade
- **id:** `dino.midas`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(50, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default` — o traço `tripleFood` (`foodMultiplier: 3` em
  `TRAIT_CATALOG`) é só economia no core; a arte não muda a hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples — mais
  "lendário"/ornamentado que `dino.goldbeak` (o traço é mais raro e mais caro).
- **Paleta:** corpo inteiro banhado a ouro `#b8a12e` (`hsl(50,60%,45%)` — matiz do roster),
  barriga `#fff6d8`, veios/penas com gradiente dourado-brilhante `#ffe066`, contorno `#3a3008`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave com leve
  brilho especular (rim-light) nas bordas das asas para reforçar o acabamento "metal precioso".
- **Coerência:** referência ao mito de "Rei Midas" (tudo vira ouro) — o corpo TODO é dourado
  (não só o bico como em `dino.goldbeak`), com pequenas linhas de brilho nas pontas das penas.
  É a versão "topo de linha" do eixo comida-multiplicada do roster.

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a legendary cartoon pterodactyl facing right, mid-flap,
> flat vector style with bold dark outline and simple cel shading, entire body plated in
> radiant gold (#b8a12e) with brighter gold highlights (#ffe066) along the wing edges like a
> rim-light shimmer, warm cream belly (#fff6d8), transparent background, centered, no text, no
> ground shadow. Provide a 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(50, 60%, 45%)`; corpo inteiro dourado, visivelmente mais "premium"
      que `dino.goldbeak`.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
