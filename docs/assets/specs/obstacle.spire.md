# Asset Spec — obstacle.spire

## Identidade
- **id:** `obstacle.spire`
- **Categoria:** obstáculo (9.8 — novo, `SimpleSpawnType`)
- **Substitui o placeholder geométrico:** retângulo primitivo cinza-azulado (cor `0x8a8f98`) que
  hoje desenha a hitbox exata — cobertura perfeita por construção, à espera da arte real.

## Especificação técnica
- **Dimensões alvo (px):** 96 × 480 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro — âncora `floating` (flutua entre chão e teto; não encosta em nenhum
  dos dois, ao contrário de `tree`/`stalactite`). O jogador decide se passa por cima ou por baixo.
- **Hitbox lógica associada:** aabb estreita e alta — `halfW` 4–6, `halfH` 24–34, i.e. **8–12 de
  largura × 48–68 de altura** em unidades de mundo (variável por instância). Definida no core
  (`OBSTACLE_CATALOG`, `src/core/spawn/catalog.ts`); a arte NUNCA a altera.
- **Animação:** nenhuma por ora — o placeholder é estático (`kind:'primitive'`, sem campo `idle`
  no manifesto). Quando a arte real entrar como sprite, um idle cosmético (ex.: brilho pulsante se
  for cristal) pode ser adicionado seguindo o precedente do 9.4, mas isso não está travado agora.
- **Composição:** o range de altura (48–68 unidades, razão ≈1,42) é comparável ao de `obstacle.vine`
  (razão ≈1,7), que exigiu composição **SEGMENTADA** (9.2) para não distorcer/deixar vazio ao
  esticar 1 sprite único. Recomenda-se o mesmo padrão aqui: 3 frames `cap`/`body`/`base` (tira
  horizontal), montados no render como `cap + N×body + base` para cobrir qualquer altura sorteada.
  **Particularidade do `spire`:** por ser `floating` (não encosta em chão nem teto), não há uma
  extremidade "presa" como em `tree` (base no chão) ou `vine` (cap no teto) — a convenção de
  composição já usada no render é puramente geométrica (`cap` = topo do objeto, `base` = fundo,
  independente de ancoragem — ver `layoutSegments` em `src/render/sprites.ts`), então basta desenhar
  as duas pontas como faces plausíveis de uma agulha rochosa flutuante (ex.: ambas afiladas/
  fraturadas), sem precisar de uma narrativa de fixação. `body` precisa ser tileável na vertical.
  Fonte (quando a arte entrar): `public/art/themes/<tema>/obstacles/<tema>_obstacle.spire.segments.png`
  (empacotada via modo `parts` do `gen-atlas`, mesmo pipeline do `tree`/`vine`).
- **Variação por tema:** mesma silhueta/proporção nos 3 temas (`classic`/`volcano`/`glacier`);
  muda só material — rocha comum (classic), basalto/obsidiana com brasa (volcano), gelo/cristal
  (glacier).
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2**
> (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem
> detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com
  `dino.default`).
- **Paleta:** rocha/cristal `#8a8f98`, sombra `#5a5f68`, contorno `#3a3f48`, realce `#aab0ba`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave; opcionalmente um leve brilho interno
  (cristal) sem virar fonte de luz colorida forte.
- **Coerência:** rochedo/cristal jurássico de pack inicial.

## Prompt para geração por IA
> "A narrow floating rock spire / crystal shard, tall and thin, filling its frame vertically, side
> view 2D game sprite, flat cartoon vector style, bold dark outline, simple cel shading, subtle
> inner glow, transparent background, no text, no ground shadow, not touching any floor or
> ceiling."

## Checklist de aceite
- [ ] Fundo transparente; silhueta estreita e alta preenchendo o quadro verticalmente.
- [ ] Proporções batem com a hitbox lógica (8–12 × 48–68 unidades de mundo).
- [ ] Se segmentado (recomendado): 3 células iguais, `body` tileável na vertical, sem vão nem
      sobreposição em nenhuma altura sorteada.
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
