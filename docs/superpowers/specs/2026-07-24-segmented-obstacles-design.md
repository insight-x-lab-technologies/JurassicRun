# 9.2 — Obstáculos cobrem a hitbox (composição por segmentos) — Design

**Fase 9, Frente A, item 9.2 (#3).** `src/core/` **intocado** ⇒ determinismo **67 inalterado**
(sem re-pin de goldens). Guarda-chuva: `docs/roadmap/PHASE-09-structural-improvements.md`;
apêndice de arte A.2.

## Problema (causa)

Obstáculos têm hitbox de **altura aleatória por instância** (`obstacle.tree` =
`aabb(6, rng.range(24,40))`, `obstacle.vine` = `aabb(4, rng.range(20,34))`). O render desenha **um
único sprite** com `setDisplaySize(bbox)`. Como a arte de um obstáculo tem forma própria (tronco
estreito + copa, silhueta com margens transparentes), esticá-la para um retângulo alto e fino:
(a) distorce a arte, e (b) deixa pixels transparentes dentro da caixa lógica ⇒ o jogador colide
onde "não há nada visível" (percepção de "colisão no vazio").

⚠️ A colisão **não** muda (REGRA 2): a hitbox lógica é a fonte da verdade. A correção é a **arte
passar a cobrir 100% da caixa**, montando a peça a partir de segmentos que preenchem qualquer altura.

## Escopo — quais obstáculos são segmentados

A composição por segmentos empilha um **retângulo vertical** (`cap` no topo, `body` repetível no
meio, `base` embaixo). Isso casa exatamente com obstáculos de hitbox **`aabb`**:

| Obstáculo | Hitbox | Tratamento |
|-----------|--------|------------|
| `obstacle.tree` (chão) | `aabb` 12×(48–80) | **Segmentado** (cap/body/base) |
| `obstacle.vine` (teto) | `aabb` 8×(40–68) | **Segmentado** (cap/body/base) |
| `obstacle.stalactite` (teto) | `polygon` triângulo | **1 sprite** (arte triangular casa a hitbox) |
| `obstacle.boulder` (flutuante) | `circle` | **1 sprite** (arte redonda casa a hitbox) |

**Decisão de escopo:** só `aabb` é segmentado. A distorção real é do **retângulo alto e fino de
altura variável** (tree/vine, aspecto até ~1:8). Stalactite (triângulo) e boulder (círculo) já têm
a **forma da arte batendo com a forma da hitbox** — 1 sprite escalado ao bbox cobre sem o problema
de tiling/distorção, e são de aspecto modesto. Segmentar um triângulo (body cônico) não tila sem
costura, então fica fora. O critério de aceite ("borda visível coincide com a hitbox, sem
distorção nem vazio") é satisfeito para todos: aabb via segmentos, triângulo/círculo via forma.

`cap`→topo, `base`→base valem para chão **e** teto (ordem de empilhamento idêntica): tree = copa no
topo / raízes embaixo; vine = fixação no teto (topo) / ponta pendente (base). Anchor não altera a
ordem.

## Decisão-chave: pipeline contra PLACEHOLDER procedural

Precedente travado da Fase 9/8 (parallax 9.1, atlas 8.2, áudio 4.10): construir o **pipeline agora**
contra um placeholder gerado proceduralmente; a arte AAA real (cap/body/base por obstáculo por tema,
prompts A.2) **dropa depois só trocando os PNG-fonte** (REGRA 2, zero retrabalho de código).

Consequência: a arte real atual de tree (chroma por tema) e vine (cartoon compartilhado) é
**substituída por placeholder segmentado** — que corrige o bug (cobre a hitbox) enquanto a arte real
segmentada não chega. Regressão visual cosmética aceita e documentada (idêntico ao 9.1, que trocou
bandas opacas por placeholder alpha).

## Arquitetura

Padrão puro×casca do projeto. Cinco peças:

### 1. `scripts/gen-obstacle-placeholder.mjs` (novo — molde de `gen-parallax-placeholder.mjs`)
Gera, para cada tema (`classic`/`volcano`/`glacier`) e cada obstáculo segmentado (`tree`/`vine`),
uma **tira horizontal de 3 células** `[cap | body | base]` em
`public/art/themes/<tema>/obstacles/<tema>_obstacle.<id>.segments.png`. Cada célula é **full-bleed
opaca** (preenche toda a largura ⇒ cobre a hitbox), com:
- `cap`: topo arredondado/detalhe (copa da árvore / fixação do cipó), tom mais claro.
- `body`: miolo **verticalmente tileável** (topo casa com a base ⇒ silhueta/cor constante na
  vertical), tom base.
- `base`: alargamento (raízes / ponta), tom mais escuro.
Recolor por tema (paleta placeholder coerente com o Style Bible). Encoder PNG puro reusado de
`gen-icons.mjs` (`encodePng`), zero dep. `npm run gen:obstacle-placeholder`.

### 2. `scripts/gen-atlas.mjs` — modo `parts`
Nova via de fatiamento (ao lado de `frames`/`grid`): uma fonte com
`parts: ['cap','body','base']` fatia a tira horizontal em 3 células iguais e emite os frames
`<id>.cap`, `<id>.body`, `<id>.base`. **Largura consistente** entre as 3 partes via **união do
X-bbox** (como o registro estável do dino); **altura por célula** (cada parte mantém sua própria
altura). Isso garante que cap/body/base empilhem alinhados quando a arte real (com margens
transparentes) chegar. `themeSources()` passa a referenciar as tiras de segmento para tree/vine.

### 3. `src/render/manifest.ts` — flag `segmented`
A variante `sprite` do `Renderable` ganha `segmented?: boolean`. `obstacle.tree`/`obstacle.vine`
marcados `segmented: true`. O `frame` do manifesto para segmentados aponta para a parte
representativa (`<id>.body`) — usado só como fallback/guarda; a composição lê as 3 partes por
convenção de nome.

### 4. `src/render/sprites.ts` — helpers puros (testáveis)
- `segmentFramesFor(typeId): { cap: string; body: string; base: string } | null` — frames das
  partes se o id for segmentado, senão `null`.
- `layoutSegments(height, capUnitH, bodyUnitH, baseUnitH, out): SegmentLayout` — **matemática pura,
  alocação-zero** (muta e devolve `out`, um scratch reusável no hot path). Dado a altura total `H`
  (unidades de mundo) e as alturas unitárias das 3 partes (já escaladas pela largura), calcula:
  - `bodyN = ceil((H − capH − baseH) / bodyUnitH)`, `bodyH = bodySpace / bodyN` (preenchimento
    exato, sem sobreposição/vão; body é textura tileável ⇒ leve ajuste vertical invisível);
  - se `capH + baseH ≥ H` (obstáculo curtíssimo): encolhe cap/base proporcionalmente, `bodyN = 0`.
  Campos: `{ capH, baseH, bodyH, bodyN }`. Testável (passa `out` fresco, asserções nos campos).

### 5. `src/render/GameScene.ts` — casca de composição
`drawSegmentedEntity(e, scrollX, tint)`: culling (reusa `isHorizontallyVisible`); calcula a
largura-escala a partir das dims do frame no atlas (cacheada por typeId — dims constantes); chama
`layoutSegments` num scratch reusado; adquire `2 + bodyN` `Image` do **pool existente** e posiciona
cap (topo), N×body (do topo para baixo), base (fundo), todos com `setTint`. **Alocação-zero** no hot
path (scratch reusado, sem arrays temporários). Ordem de desenho: obstáculos segmentados na mesma
passada de `drawVisibleSprites`; o roteamento (`segmentFramesFor(typeId) !== null`) decide
segmentado × sprite único.

## Determinismo & performance
- `src/core/` **intocado** ⇒ determinismo 67, sem re-pin de goldens. Colisão/hitbox inalteradas.
- Hot path alocação-zero: scratch de layout reusado; pool de `Image` já existente cresce até o pico;
  cache de dims de frame por typeId. Culling preservado (segmentos fora do viewport não desenham).
- 60fps mantido (mesmo nº de draw calls ↑ por obstáculo alto, mas 1 textura de atlas ⇒ batching).

## Guardas de teste a atualizar
`tests/render/atlas.test.ts`:
- **COMPLETUDE**: id sprite `segmented` não tem frame bare `<id>`; a guarda passa a exigir os 3
  frames `<id>.{cap,body,base}` para ids segmentados (e `<id>` para os demais).
- **frame órfão**: o strip de sufixo passa a tolerar `.cap/.body/.base` além de `.N`.

## Toca
`scripts/gen-obstacle-placeholder.mjs` (novo), `scripts/gen-atlas.mjs`, `src/render/manifest.ts`,
`src/render/sprites.ts`, `src/render/GameScene.ts`, `docs/assets/specs/obstacle.{tree,vine}.md`
(campo segmentos), `docs/assets/asset-registry.md`, `tests/render/{sprites,atlas}.test.ts`,
`public/art/themes/*/obstacles/*.segments.png` (placeholder gerado, commitado),
`public/atlas/entities*.{png,json}` (regenerado, commitado), `package.json` (script npm).
**Core intocado.**

## Aceite
- Obstáculos aabb (tree/vine) de qualquer altura preenchidos por cap+N×body+base, **sem distorção
  nem vazio**; a borda visível coincide com a hitbox (validação Playwright sobrepondo hitbox×sprite).
- Stalactite/boulder inalterados (1 sprite, forma casa).
- `npm run check` limpo, `npm test` verde, determinismo 67 (core intocado).
- 60fps mantido (evidência Playwright).

## Backlog (adiado)
- Arte AAA real segmentada (cap/body/base por obstáculo por tema, prompts A.2) — usuário gera, dropa
  trocando os PNG-fonte.
- Animação idle cosmética dos obstáculos (9.4) — strip de 4 frames por parte, mesmo mecanismo do dino.
- Segmentação do stalactite se a arte real triangular exigir (hoje 1 sprite basta).
