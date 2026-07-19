# Design — Arte real de entidades + seam de atlas por tema (8.1, parte in-game)

**Data:** 2026-07-19
**Fase/Item:** 8.1 (produção de arte — parte in-game/Tier 2) + extensão do sistema de packs (8.3).
**Escopo:** substituir o atlas placeholder procedural das 11 entidades in-game por arte real
gerada pelo usuário (`public/art/final/`), com o **dino animado** (flap de 6 frames), e criar o
**seam de atlas por tema** para que futuros sets de arte alternativos (ex.: mais sério / mais
cartoon) sejam trocáveis sem tocar consumidores.

## Contexto e restrições

- `src/core/` **NÃO é tocado** ⇒ determinismo **67 intacto**, sem re-pin de goldens. Toca só
  `scripts/`, `src/render/`, `src/app/`, `docs/`, `tests/` e artefatos em `public/`.
- REGRA 2 (arte desacoplada): colisão usa hitbox lógica; trocar arte = editar dados (manifesto/
  atlas/pack), nunca lógica. REGRA 3 (perf): nada de alocação por frame no hot path.
- O jogo já renderiza entidades por sprites de um texture atlas desde 8.2
  (`kind:'sprite'` no `ASSET_MANIFEST`; `GameScene` pool de `Image`; fallback primitivo). Hoje o
  atlas é **placeholder procedural** (`scripts/gen-atlas.mjs`), carregado por path fixo
  (`ATLAS_KEY/ATLAS_PNG/ATLAS_JSON` em `src/render/sprites.ts`).
- O sistema de packs (8.3, `src/render/packs.ts`) hoje só recolore (tokens CSS + paletas dia/noite
  + `entityTint`); **todos os packs compartilham o mesmo atlas**. `LookPack` não tem campo de
  atlas. O ponto de extensão "atlas próprio por pack" está documentado, não implementado.

**Validação dos assets do usuário (feita, evidência por decoder PNG + amostra de alpha):** os 32
PNGs `public/art/final/` são corretos — entidades/UI com fundo transparente (alpha=0 nas bordas),
backgrounds/covers RGB opaco. Resoluções acima do spec @1x (downscale no empacotamento). Não são
drop-in: dinos são **strips horizontais de 6 frames** (2172×724); sheets de UI/covers/parallax
precisam de fatiamento. Esta rodada usa só as 11 entidades in-game; Tier 1 (UI/backgrounds) e os
outros 10 dinos ficam para rodadas futuras.

## Fora de escopo (adiado)

- Tier 1: logo, molduras/botões 9-slice, ícones de nav, medalhas, fundos de tela por bioma,
  parallax com arte real (`bg.layers.png`). Segue geométrico/CSS.
- Os 10 dinos do Ninho (arte de roster) — o in-game usa só `dino.default`.
- Arte alternativa real (sério/cartoon) — esta rodada entrega o **seam**; o set alternativo é
  produção futura do usuário, que entra como um novo pack com seu atlas.
- Troca de atlas em runtime quando o pack muda no meio da partida: hoje só `classic` tem atlas
  próprio; `volcano`/`glacier` reusam o de `classic` (+ seu `entityTint`), então nenhuma troca de
  textura em runtime é necessária. Fica documentado como extensão.

## Entidades no atlas (11 ids lógicos)

`dino.default` (6 frames de flap), `obstacle.tree`, `obstacle.vine`, `obstacle.boulder`,
`obstacle.stalactite`, `bird.coin`, `powerup.shield`, `powerup.extraLife`, `powerup.magnet`,
`powerup.doubleCoin`, `powerup.slowMo`. São exatamente as chaves de `ASSET_MANIFEST`.

## Componentes

### 1. Reescrita do atlas builder (`scripts/gen-atlas.mjs`)

Passa de gerador procedural a **empacotador de PNGs reais**. Reusa `encodePng` de
`gen-icons.mjs` e um **decoder PNG** (inflate zlib + unfilter de scanlines; RGBA/RGB não
entrelaçado — o mesmo algoritmo já validado no probe de validação). Zero dep nova.

Config declarativa por asset (fonte única, exportada para o teste):
```
ATLAS_SOURCES = [
  { id: 'dino.default', file: 'dinos/dino.default.flap.png', frames: 6, layout: 'strip-h' },
  { id: 'obstacle.tree', file: 'obstacles/obstacle.tree.png', frames: 1 },
  ... (as 10 demais entidades, frames:1)
]
```
Pipeline por asset:
1. Decodifica o PNG de `public/art/final/<file>`.
2. `frames:1` → recorta a bounding box do conteúdo não-transparente (alpha>0).
   `strip-h` (dino) → fatia em N colunas iguais (`w/6`), calcula a **bbox-união** do conteúdo
   das 6 fatias e recorta **todas as fatias com a mesma bbox** ⇒ registro estável (sem jitter de
   posição entre frames do flap).
3. Downscale (área/box, inteiro) para caber num alvo `CELL_MAX` (ex.: 128px na maior dimensão),
   preservando aspecto.
4. Coloca no atlas (empacotamento por linhas/prateleiras simples, largura fixa; determinístico).

Saída (commitada): `public/atlas/entities.png` + `entities.json` no formato **Phaser JSONHash**.
Frames:
- Cada entidade single-frame → 1 entrada nomeada pelo id (`obstacle.tree`, `bird.coin`, …).
- Dino → 6 entradas `dino.default.0`..`dino.default.5` **mais** um alias `dino.default`
  (mesmo rect de `.0`) para os consumidores baseados em frame (`frameFor`, textura inicial do
  sprite, guarda de completude) continuarem resolvendo.
Cada frame: `frame{x,y,w,h}`, `trimmed:false`, `sourceSize`=tamanho do frame (o recorte já é a
arte; `setDisplaySize` na hitbox estica como no placeholder — mesmo comportamento de 8.2).

`npm run gen:atlas` regenera. O determinismo do encoder e a presença dos 11 ids são cobertos por
teste.

### 2. Seam de atlas por tema (`src/render/packs.ts`, `src/render/sprites.ts`)

`LookPack` ganha:
```
readonly atlas?: AtlasRef;   // { key, png, json } — paths relativos ao BASE_URL
```
- `PACK_CLASSIC.atlas` = `{ key:'entities', png:'atlas/entities.png', json:'atlas/entities.json' }`
  (o atlas real novo, tema **default**).
- `PACK_VOLCANO`/`PACK_GLACIER` **omitem** `atlas` ⇒ fallback pro atlas do `classic` + mantêm o
  `entityTint` (recolor). Um set de arte futuro define seu próprio `AtlasRef`.

`sprites.ts`: `AtlasRef` type + `DEFAULT_ATLAS` (o do classic) + helper `atlasRefFor(pack)` =
`pack.atlas ?? DEFAULT_ATLAS`. As constantes `ATLAS_KEY/ATLAS_PNG/ATLAS_JSON` passam a derivar de
`DEFAULT_ATLAS` (retrocompat), mas os consumidores de tema usam `atlasRefFor`.

### 3. GameScene — carregar atlas do pack ativo + animar o dino

- `preload()`: resolve `ref = atlasRefFor(packForId(activeExpansion))` e
  `this.load.atlas(ref.key, base+ref.png, base+ref.json)`. (Hoje resolve para o atlas real do
  classic; o seam já lê do pack.)
- **Dino animado:** `dinoSprite` passa de `Image` para `Phaser.GameObjects.Sprite`. Em `create()`,
  cria a anim `dino.flap` via `this.anims.create({ key, frames: generateFrameNames(key, {prefix:
  'dino.default.', start:0, end:5}), frameRate: DINO_FLAP_FPS (12), repeat:-1 })` e dá `play`. A
  anim roda internamente (sem alocação por frame nossa — REGRA 3). `setTint/setDisplaySize/
  setPosition` continuam idênticos (Sprite ⊂ Image). A textura inicial usa o frame alias
  `dino.default`. A anim usa a key do atlas ativo (`ATLAS_KEY` do pack). Guardas de fallback
  primitivo (`frameFor===null`) intactas.
- Demais entidades (pool de `Image`, culling, tint, sizeFor): inalteradas.

### 4. Registro e manifesto

- `docs/assets/asset-registry.md`: status dos 11 ids in-game `spec` → `art`.
- `ASSET_MANIFEST`: já é `kind:'sprite'` — sem mudança (frames continuam nomeados pelos ids;
  o dino resolve o alias `dino.default`). `FALLBACK` primitivo mantido.

## Testes

- `tests/render/atlas.test.ts` (reescrito): o builder gera PNG (assinatura + IHDR) e JSON JSONHash
  com **todos os 11 ids do manifesto presentes como frames**, os 6 frames `dino.default.N` + alias
  `dino.default`, determinismo do encoder (2 execuções idênticas), e cada frame com `w/h>0`.
- `tests/render/sprites.test.ts`: `atlasRefFor` (classic → atlas real; volcano/glacier → default);
  `DEFAULT_ATLAS` = classic; helpers `spriteSizeFor`/`frameFor` intactos.
- `tests/render/packs.test.ts` (se existir; senão adiciona): `PACK_CLASSIC.atlas` definido;
  volcano/glacier sem atlas próprio; `packForId` fallback.
- `tests/assets/registry-specs.test.ts`: paridade registro↔spec mantida; adiciona guarda de que os
  11 ids `art` têm o PNG-fonte em `public/art/final/`.
- Determinismo: `npm run test:determinism` continua **67** (core intocado).
- Validação visual (Playwright): entidades reais renderizam; **dino flapeja** (anim ciclando);
  60fps sustentado (p50 ~16,7ms) e draw-calls baixos (batching — 1 textura de atlas); seam de
  atlas lido do pack.

## Determinismo e perf

Core intocado (só `scripts/`+render/app/docs/tests) ⇒ **det 67**, sem golden re-pin. Hot path
segue alocação-zero: a anim do dino roda no motor do Phaser; pool de `Image` inalterado; atlas
único ⇒ batching preservado. Downscale mantém a textura do atlas pequena.

## Riscos / decisões

- **Distorção de aspecto** ao esticar o frame recortado para a bounding box da hitbox: aceita —
  é o mesmo comportamento do placeholder de 8.2 (frame esticado à hitbox); as hitboxes casam
  grosseiramente o aspecto das artes (árvore alta, moeda quadrada, etc.).
- **Registro do flap:** bbox-união entre os 6 frames evita jitter de posição do dino.
- **Troca de atlas em runtime por pack:** não implementada (nenhum pack precisa hoje); o seam de
  dados (`LookPack.atlas`) + a resolução no `preload` são o entregável de tema. Extensão futura:
  recarregar textura quando `appliedPackId` mudar e a `AtlasRef.key` diferir.
- **Alias `dino.default`:** garante que `frameFor` e a guarda de completude sigam válidos sem
  ramo especial para animação.
