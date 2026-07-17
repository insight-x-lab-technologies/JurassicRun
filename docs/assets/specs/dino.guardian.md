# Asset Spec — dino.guardian

> Roster do Ninho (4.4): traço `headStart` (escudo de graça nos primeiros `180` steps da
> partida — mesmo traço de `dino.aegis`, tema/paleta diferente). Preço 450, matiz `240`
> (índigo).

## Identidade
- **id:** `dino.guardian`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(240, 60%, 45%)` (avatar do
  Ninho) sobre o triângulo vermelho de `dino.default`.

## Especificação técnica
- **Dimensões alvo (px):** 256 × 192 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro do corpo — idêntico a `dino.default`.
- **Hitbox lógica associada:** elipse/cápsula ~70% da largura e ~55% da altura, centrada no
  corpo. Igual à hitbox de `dino.default` — o traço `headStart` (`startShieldSteps: 180` em
  `TRAIT_CATALOG`) só concede invulnerabilidade temporária no core; a arte não muda a hitbox.
- **Animação:** `flap` (6 frames, 12 fps), `glide` (1 frame), `hit` (2 frames)
- **Atlas de destino:** `dinos`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 8px de respiro nas 4 bordas do frame.

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples — mais
  "couraçado"/pesado que `dino.aegis` (preço mais alto ⇒ visual mais robusto).
- **Paleta:** corpo `#2e2eb8` (índigo, `hsl(240,60%,45%)` — matiz do roster), barriga `#dcdcf7`,
  placas de armadura completas em prata-fosco `#9494b8`, contorno `#0d0d2b`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "guardião" — placas de armadura estilizada cobrindo peito e dorso (mais
  cobertura que o brasão discreto de `dino.aegis`), leve brilho índigo nas bordas das placas
  (referência à bolha de escudo). É a versão "topo de linha" do eixo escudo-inicial do roster
  (paralelo a `dino.midas`/`dino.phoenix` nos outros eixos).

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of a heavily armored guardian cartoon pterodactyl facing
> right, mid-flap, flat vector style with bold dark outline and simple cel shading, deep indigo
> body (#2e2eb8), pale lavender belly (#dcdcf7), matte silver armor plates covering the chest
> and back (#9494b8) with a subtle indigo rim-glow along the plate edges, transparent
> background, centered, no text, no ground shadow. Provide a 6-frame wing-flap animation in a
> horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(240, 60%, 45%)`; armadura visivelmente mais robusta que
      `dino.aegis`, legível em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
