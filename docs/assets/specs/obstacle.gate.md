# Asset Spec — obstacle.gate

## Identidade
- **id:** `obstacle.gate`
- **Categoria:** obstáculo (9.8 — novo, `CompositeSpawnType`, 2 peças)
- **Substitui o placeholder geométrico:** 2 retângulos primitivos marrom-escuro (cor `0x6b5a44`) —
  um preso ao teto, outro ao chão — que hoje desenham as hitboxes exatas.

## Especificação técnica
- **Peças (par chão+teto que estreita a passagem):** `makePieces` (`src/core/spawn/catalog.ts`)
  emite **2 peças `aabb` no mesmo `dx=0`** (mesma coluna x): uma encostada no teto, outra encostada
  no chão, com uma **fresta (gap) de 38–52 unidades** entre elas. Cada braço tem no mínimo 12
  unidades (`GATE_ARM_MIN`) para o par nunca degenerar num obstáculo só. **As duas peças
  compartilham a mesma tag/id `obstacle.gate`** — o core não as distingue logicamente (mesmo
  tratamento de colisão para ambas).
- **Dimensões alvo (px):** 80 × 640 (@1x para mobile, referente à peça mais alta possível do range;
  exportar também @2x). Como a arte é composta por segmentos (ver abaixo), a altura exportada é a
  da tira `cap`/`body`/`base`, não de uma imagem única de tamanho fixo.
- **Pivô / âncora:** cada peça encosta na sua borda (teto ou chão) — não há um pivô único
  compartilhado; são duas instâncias independentes do mesmo asset visual.
- **Hitbox lógica associada:** aabb, `halfW = 5` fixo (**10 de largura por braço**); `halfH`
  variável — depende da fresta sorteada e de onde ela cai dentro do campo (a soma das duas alturas
  + a fresta preenche a faixa útil vertical). Definida no core; a arte NUNCA a altera. **Campo
  lógico fixo:** `worldHeight=180`, `yMargin=8` ⇒ faixa útil `y ∈ [8,172]` — este tuning
  (`GATE_GAP_MIN/MAX`, `GATE_ARM_MIN`) é **ABSOLUTO**, calibrado só para esse campo.
- **Animação:** nenhuma por ora — placeholder estático (`kind:'primitive'`, sem `idle` no
  manifesto). Se ganhar idle cosmético no futuro (ex.: leve trepidação de pedra), aplicar o mesmo
  cuidado de sangria do 9.4 (a folga da animação nunca pode ultrapassar a margem full-bleed da
  arte, senão descobre a hitbox).
- **Composição — ⚠️ ponto de atenção (achado de review):** `GameScene.sizeFor` (`src/render/
  GameScene.ts`) **cacheia o `displaySize` por `typeId`** — assume implicitamente que instâncias do
  mesmo tipo têm tamanho "parecido" (o que já vale, por aproximação, para `boulder`/`stalactite`,
  cujo range de proporção é estreito). **Isso não vale para `obstacle.gate`:** as duas peças
  emitidas no mesmo spawn compartilham a tag e têm **alturas muito diferentes uma da outra**, e
  cada uma varia livremente de spawn a spawn. Se a arte real entrar como **1 sprite por tag**
  (o caminho hoje usado por `boulder`), o tamanho da primeira peça desenhada fica cacheado e é
  reaplicado à segunda peça (e às peças de spawns seguintes com fresta diferente) ⇒ a arte deixa de
  cobrir a hitbox, violando a REGRA 2. **Duas saídas, na ordem de preferência:**
  1. **Recomendado — tratar como SEGMENTADO** (precedente 9.2, igual `tree`/`vine`): 3 frames
     `cap`/`body`/`base` montados como `cap + N×body + base`. O caminho segmentado do render
     (`layoutSegments`) recalcula a altura **por instância**, então não sofre do cache de
     `sizeFor` — a composição por segmentos passa por cima do problema em vez de precisar de tags
     novas. `cap` = topo do objeto, `base` = fundo (convenção geométrica do render, não de
     ancoragem — a peça de teto usa `cap` como a ponta fundida na rocha do teto e `base` como a
     ponta solta perto da fresta; a peça de chão usa `cap` como a ponta solta perto da fresta e
     `base` como a ponta cravada no chão. Ambas usam o MESMO conjunto de frames — é o mesmo asset
     visual desenhado nas duas orientações da coluna).
  2. **Insuficiente sozinha — tags próprias por peça:** dar tags distintas no core (ex.:
     `obstacle.gate.ceiling` / `obstacle.gate.floor`, do mesmo jeito que `rock_arch` já separa
     `leg`/`span`) resolveria a diferença ENTRE as duas peças de um mesmo spawn, mas **não**
     resolve a variação de altura de uma mesma peça ENTRE spawns diferentes (ex.: a peça de teto
     pode medir 12 unidades num spawn e 130 unidades no seguinte) — ainda precisaria de
     segmentação por cima. Por isso a opção 1 é a única que resolve o problema por completo.
  Fonte (quando a arte entrar): `public/art/themes/<tema>/obstacles/<tema>_obstacle.gate.segments.png`.
- **Variação por tema:** mesma proporção/abertura nos 3 temas; muda só o material (madeira/pedra
  travada, coerente com o resto dos obstáculos do tema).
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2**
> (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem
> detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com
  `dino.default`).
- **Paleta:** madeira/pedra escura `#6b5a44`, sombra `#4a3d2e`, contorno `#2a2018`, realce `#8a7458`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave.
- **Coerência:** portal/pilar rústico de pack inicial — lê como uma "porta estreita" natural no
  cenário, não como arquitetura trabalhada.

## Prompt para geração por IA
> "Vertically tileable side-view 2D game sprite set (cap/body/base strip) of a rough stone-and-wood
> pillar segment, used both hanging from a cave ceiling and rising from the ground to form a narrow
> passage, flat cartoon vector style, bold dark outline, simple cel shading, weathered dark wood and
> stone, transparent background, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; peça preenche a largura da hitbox (10 unidades) sem sobra nem vão.
- [ ] Se segmentado (recomendado): 3 células iguais, `body` tileável na vertical; cobertura sem vão
      nem sobreposição tanto na peça de teto quanto na de chão, em qualquer fresta sorteada
      (38–52 unidades).
- [ ] Mesmo conjunto de frames funciona coerente nas duas orientações (encostado no teto / encostado
      no chão).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
