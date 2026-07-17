# Asset Spec — dino.lodestone

> Roster do Ninho (4.4): traço `magnet` (ímã sempre ativo, como o power-up `powerup.magnet`
> permanente). Preço 250, matiz `280` (roxo).

## Identidade
- **id:** `dino.lodestone`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(280, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default`/`dino.starter` — o traço `magnet` (`magnetAlways:
  true` em `TRAIT_CATALOG`) é só física de atração de coletáveis no core; a arte não muda a
  hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#8a2eb8` (roxo, `hsl(280,60%,45%)` — matiz do roster), barriga `#ecd9f7`,
  crista/acentos metálicos prateados `#c9c9d6`, contorno `#2a1233`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "ímã" — pequeno amuleto em formato de ferradura-ímã (pontas prateadas)
  preso no peito/pescoço; linhas metálicas sutis nas asas sugerindo campo magnético. Combina
  com `dino.prospector` (mesmo traço `magnet`, paleta diferente).

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a cartoon pterodactyl facing right, mid-flap, flat vector
> style with bold dark outline and simple cel shading, deep purple body (#8a2eb8), pale lilac
> belly (#ecd9f7), a small silver horseshoe-magnet charm around its neck, subtle metallic-gray
> magnetic field lines on the wings, transparent background, centered, no text, no ground
> shadow. Provide a 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(280, 60%, 45%)`; amuleto de ímã visível e legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
