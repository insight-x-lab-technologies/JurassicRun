# Asset Spec — obstacle.rock_arch

## Identidade
- **id lógico do spawn:** `obstacle.rock_arch`
- **Categoria:** obstáculo (9.8 — `CompositeSpawnType`, 3 peças; adiado desde o item 1.4 por ser
  não-convexo — resolvido no core como 3 hitboxes convexas separadas)
- **ids de asset (2, um por peça reaproveitada):** `obstacle.rock_arch.leg` (pernas, a mesma arte
  espelhada nos dois lados) e `obstacle.rock_arch.span` (trave superior)
- **Substitui o placeholder geométrico:** 3 retângulos primitivos cor de pedra (`0x7a6a55`) — 2
  pernas + 1 trave — que hoje desenham as hitboxes exatas.

## Especificação técnica
- **Peças:** `makePieces` (`src/core/spawn/catalog.ts`) emite, nesta ordem de `dx` crescente
  (importante para o stream de spawn, não para a arte):
  1. **perna esquerda** — `aabb(halfW=5, halfH=legH/2)`, `dx=-18`, apoiada no chão. Tag
     `obstacle.rock_arch.leg`.
  2. **trave** — `aabb(halfW=23, halfH=4)` (**46 × 8** de largura × altura), `dx=0`, encostada no
     topo das duas pernas. Tag `obstacle.rock_arch.span`.
  3. **perna direita** — `aabb(halfW=5, halfH=legH/2)`, `dx=+18`, apoiada no chão. Tag
     `obstacle.rock_arch.leg` (mesma tag da esquerda — é a mesma arte, só espelhada).
  `legH` (altura da perna = altura do "buraco" por onde o dino passa) varia **34–50** a cada
  instância. As pernas ficam em `dx = ∓18` (36 unidades de vão entre os eixos das duas pernas).
- **Dimensões alvo (px), por peça:**
  - `obstacle.rock_arch.leg`: 80 × 400 (@1x, referente ao topo do range `legH=50`; exportar @2x).
  - `obstacle.rock_arch.span`: 368 × 64 (@1x — 46×8 unidades de mundo, fixo, sem variação).
- **Pivô / âncora:**
  - `leg`: base centralizada (encosta no chão).
  - `span`: base centralizada (encosta no topo das pernas) — a trave não toca o teto, só une as
    duas pernas por cima.
- **Hitbox lógica associada:** ver "Peças" acima. Definida no core; a arte NUNCA a altera.
- **Animação:** nenhuma por ora — placeholder estático (`kind:'primitive'` nas duas tags, sem
  `idle` no manifesto).
- **Composição — ⚠️ ponto de atenção (achado de review), mesmo mecanismo do `obstacle.gate`:**
  `GameScene.sizeFor` cacheia o `displaySize` **por `typeId`** (aqui, por tag: `leg` e `span` já
  são tags separadas no core, o que resolve a diferença ENTRE perna e trave). **Mas a altura da
  perna (`legH`) varia 34–50 entre spawns diferentes** (razão ≈1,47, comparável à de
  `obstacle.vine`, que já exigiu segmentação) — a tag própria **não** resolve essa variação
  instância-a-instância: se `leg` entrar como 1 sprite (caminho de `boulder`), o tamanho da
  primeira perna desenhada fica cacheado e é reaplicado às pernas de spawns seguintes com `legH`
  diferente, deixando de cobrir a hitbox (viola a REGRA 2). **Recomendado:** tratar
  `obstacle.rock_arch.leg` como **SEGMENTADO** (precedente 9.2): 3 frames `cap`/`body`/`base`
  montados como `cap + N×body + base`, cujo layout (`layoutSegments`) recalcula a altura por
  instância e não sofre do cache de `sizeFor`. `cap` = topo da perna (encontro com a trave),
  `base` = fundo (apoio no chão). A **trave (`span`)** tem dimensão FIXA (46×8, sem variação entre
  spawns) — não precisa de segmentação; pode continuar como **1 sprite único**, igual
  `boulder`/`stalactite`, sem o risco acima (não há segunda instância com tamanho diferente para o
  cache colidir).
  Fontes (quando a arte entrar):
  `public/art/themes/<tema>/obstacles/<tema>_obstacle.rock_arch.leg.segments.png` (tira 3 células) e
  `public/art/themes/<tema>/obstacles/<tema>_obstacle.rock_arch.span.chromakey.png` (1 sprite).
- **Variação por tema:** mesma proporção nos 3 temas; muda só material (rocha comum/basalto/gelo).
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha (`leg` segmentado) / chroma-key (`span` 1 sprite), @1x
  e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2**
> (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem
> detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com
  `dino.default`).
- **Paleta:** pedra `#7a6a55`, sombra `#5a4d3d`, contorno `#3a3024`, realce `#9a8a70` (mesma família
  de `stalactite`/`boulder`, mais quente).
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave.
- **Coerência:** arco de pedra jurássico de pack inicial — as duas pernas devem casar visualmente
  com a trave (mesma textura/tom) para o conjunto ler como um único arco.

## Prompt para geração por IA
> Perna (`leg`, tira cap/body/base):
> "Vertically tileable side-view 2D game sprite strip (cap/body/base) of a weathered stone pillar
> leg rising from the ground, part of a larger rock archway, flat cartoon vector style, bold dark
> outline, simple cel shading, transparent background, no text, no shadow."
>
> Trave (`span`, 1 sprite):
> "Side-view 2D game sprite of a horizontal stone archway lintel/span connecting two rock pillars,
> flat cartoon vector style, bold dark outline, simple cel shading, transparent background,
> centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente.
- [ ] `leg`: se segmentado (recomendado), 3 células iguais, `body` tileável na vertical, cobertura
      sem vão nem sobreposição para qualquer `legH` sorteado (34–50 unidades); as duas pernas usam
      o MESMO frame set, só espelhado.
- [ ] `span`: proporção 46×8 (razão ≈5,75:1), preenchendo a hitbox fixa sem margem interna.
- [ ] Os dois assets (`leg`/`span`) casam em tom/textura para ler como um arco único.
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
