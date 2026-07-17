# Asset Spec — dino.aegis

> Roster do Ninho (4.4): traço `headStart` (escudo de graça nos primeiros `180` steps da
> partida, como o power-up `powerup.shield` no início). Preço 300, matiz `210` (azul-aço).

## Identidade
- **id:** `dino.aegis`
- **Categoria:** personagem
- **Substitui o placeholder geométrico:** círculo/chip sólido `hsl(210, 60%, 45%)` (avatar do
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
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples.
- **Paleta:** corpo `#2e73b8` (azul-aço, `hsl(210,60%,45%)` — matiz do roster), barriga
  `#dcebf7`, placas de armadura estilizadas em azul-acinzentado `#7a94ab`, contorno `#0d2436`.
- **Iluminação/ângulo:** vista lateral 2D, voltado para a direita, luz superior suave.
- **Coerência:** tema "égide/escudo" — pequenas placas de armadura estilizadas no peito
  (formato de brasão/escudo losangular) sugerindo proteção; leve brilho azulado nas bordas
  (referência à bolha de escudo do power-up). Combina com `dino.guardian` (mesmo traço
  `headStart`, tema mais "pesado/couraçado").

## Prompt para geração por IA
> "Side-view 2D game sprite sheet of an armored cartoon pterodactyl facing right, mid-flap,
> flat vector style with bold dark outline and simple cel shading, steel-blue body (#2e73b8),
> pale blue belly (#dcebf7), small stylized diamond-shield armor plates on the chest
> (blue-gray #7a94ab) with a subtle blue rim-glow, transparent background, centered, no text,
> no ground shadow. Provide a 6-frame wing-flap animation in a horizontal strip."

## Checklist de aceite
- [ ] Fundo transparente; voltado para a direita.
- [ ] Pivô central; asas estendidas fora da hitbox.
- [ ] 6 frames de flap consistentes; empacotado no atlas `dinos`.
- [ ] Paleta bate com `hsl(210, 60%, 45%)`; placas de escudo no peito legíveis em 256×192.
- [ ] 60fps preservado; `asset-registry.md` atualizado para `art`.
