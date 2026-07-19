# Design — Tier-1 Rodada D: parallax real (bg.layers → far/mid/near)

**Data:** 2026-07-19
**Item:** 8.1 Tier-1, rodada D (última) de A→B→C→D.
**Escopo:** substituir as silhuetas geométricas de parallax do `GameScene` pela **arte real**
(`bg.layers.png` fatiado em 3 camadas far/mid/near), ligando o ramo `sprite` do `ParallaxVisual`
(stub desde 2.3). Preserva scroll de parallax, tint por tempo-do-dia (3.3) e recolor por pack (8.3).

## Contexto e restrições

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**. Toca `scripts/`, `src/render/`, `public/ui/`, `tests/`.
- Reusa o pipeline: `gen-ui.mjs` (`regions`), `public/ui/` (precacheado).
- REGRA 2 (arte por dados). REGRA 3 (parallax por frame só ajusta `tilePositionX` — escalar, sem
  alocação; inalterado).
- Arte-fonte: `public/art/final/parallax/bg.layers.png` (2172×724 RGBA — 3 bandas empilhadas
  verticalmente: far=montanhas azuis no topo, mid=colinas verdes no meio, near=selva embaixo, sobre
  transparência acima de cada silhueta).

## Componentes

### 1. `gen-ui.mjs` — 3 tiras de parallax

Nova fonte com `regions` (terços verticais, content-trim isola cada silhueta):
```
{ out:'parallax', file:'parallax/bg.layers.png', maxDim:720, regions:[
  { name:'parallax.far', x:0, y:0.00, w:1, h:0.34 },
  { name:'parallax.mid', x:0, y:0.34, w:1, h:0.34 },
  { name:'parallax.near', x:0, y:0.66, w:1, h:0.34 } ] }
```
Saída commitada: `public/ui/parallax.{far,mid,near}.png` (tiras largas, tileáveis em x).

### 2. `parallax.ts` — camadas viram `sprite`

`PARALLAX_LAYERS` passa `primitive`→`sprite`. O ramo `sprite` do `ParallaxVisual` ganha os campos de
posicionamento que o render precisa (a posição vertical da camada, hoje só nos campos primitivos):
```ts
| { readonly kind: 'sprite'; readonly texture: string; readonly baseFromBottom: number; readonly dispHeight: number }
```
- `bg.layer.far`: `{kind:'sprite', texture:'parallax.far', baseFromBottom:64, dispHeight:52, scrollFactor 0.2}`
- `bg.layer.mid`: `{... texture:'parallax.mid', baseFromBottom:34, dispHeight:44, scrollFactor 0.4}`
- `bg.layer.near`: `{... texture:'parallax.near', baseFromBottom:0, dispHeight:56, scrollFactor 0.7}`
(valores placeholder — ajustados na validação visual; a arte fica ancorada ao fundo por camada.)

`packs.ts` `CLASSIC_PARALLAX` já mapeia `visual.kind!=='primitive' ? 0xffffff` ⇒ zero mudança (a cor
per-pack era só das silhuetas geométricas; o recolor por pack agora vem do `parallaxTint` do dia/noite
via `setTint`, como antes). volcano/glacier mantêm suas entradas (color ignorada p/ sprite).

### 3. `GameScene` — carregar + posicionar as tiras

- `preload()`: `this.load.image(layer.visual.texture, base+'ui/'+layer.visual.texture+'.png')` para as 3.
- `ensureLayerTexture(layer,...)`: no ramo `sprite`, retorna `layer.visual.texture` (a key carregada)
  em vez de gerar triângulos; o ramo `primitive` fica como fallback (nenhuma camada o usa agora).
- `create()`/`applyDayNight()`: ao montar/atualizar o `TileSprite` de uma camada `sprite`, usa
  `tileSprite(0, VIEW_HEIGHT - baseFromBottom - dispHeight, VIEW_WIDTH, dispHeight, texture)`
  `.setOrigin(0,0)` (posiciona a banda na altura da camada) em vez de `VIEW_WIDTH×VIEW_HEIGHT`. Mantém
  `setScrollFactor(0)`, `setDepth(-(N-index))`, `setTint(parallaxTint)` e o `tilePositionX =
  parallaxTileOffset(scrollX, factor)` por frame (inalterado). O `TileSprite` tila a tira em x
  (parallax infinito); a altura = `dispHeight` (uma cópia vertical da tira).

## Testes

- `tests/render/gen-ui.test.ts`: cobre `parallax.{far,mid,near}` (presentes; determinismo; commitados batem).
- `tests/render/parallax.test.ts`: `PARALLAX_LAYERS` agora `sprite` com `texture`/`baseFromBottom`/
  `dispHeight`/`scrollFactor` corretos; `parallaxTileOffset` intacto.
- Determinismo: **67** (core intocado).
- Playwright (build prod, partida ativa): 3 camadas de arte real rolando com profundidade (far
  devagar, near rápido); recolor por pack/dia-noite via tint; 60fps mantido (parallax não aloca por
  frame). Ajustar `baseFromBottom`/`dispHeight` se a composição vertical ficar errada.

## Fora de escopo / riscos

- **Costura de tiling:** a tira repete a cada largura da textura; se a arte não for perfeitamente
  tileável em x, aparece uma emenda periódica. Aceitável p/ parallax distante; **backlog:** arte
  seam-less ou mirror-tile. Validar no Playwright — se gritante, manter geométrico como fallback e
  registrar.
- **Fundos de tela** (`bg.screen`) e **UI** já feitos (rodadas A–C). **Fim da Fase 8 Tier-1** após D
  (resta só backlog: compressão de PNG, arte de dino in-game, a11y de rank, etc.).
