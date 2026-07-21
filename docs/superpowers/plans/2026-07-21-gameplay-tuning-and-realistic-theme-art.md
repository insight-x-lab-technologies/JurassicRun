# Flap mais suave + arte realista in-game por tema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir a força do flap e elevar o realismo da tela de jogo integrando os novos
assets AAA por tema (classic/volcano/glacier).

**Architecture:** Todo o trabalho é render/build/asset, exceto a constante de flap. `src/core/`
só muda em `constants.ts` (flap → re-pin de goldens). Um novo helper de chroma-key no pipeline de
`scripts/` converte o fundo-chave dos novos PNGs em alpha; `gen-atlas` gera um atlas de entidades
por tema; `gen-ui` gera texturas de parallax por tema; `packs.ts`/`GameScene` ligam tudo pela pack
(=expansão) ativa.

**Tech Stack:** TypeScript estrito, Node scripts ESM (encoder/decoder PNG próprios, zero dep),
Phaser (GameScene), Vitest, Playwright (verificação visual).

## Global Constraints

- **Determinismo:** `src/core/` só muda em `src/core/sim/constants.ts` (flap). Qualquer mudança
  no estado visível re-pina os goldens de `tests/determinism/replay.determinism.test.ts`. Rodar
  `npm run test:determinism` verde. Nenhuma outra parte toca a simulação.
- **REGRA 2 (arte desacoplada):** trocar arte = editar manifesto/packs/scripts, nunca lógica.
- **REGRA 3 (performance):** zero alocação por frame no hot path do `GameScene`.
- **REGRA 4 (i18n):** nenhuma string de UI nova neste trabalho (só arte/tuning).
- **REGRA 5 (asset-specs):** registrar as fontes por-tema em `docs/assets/asset-registry.md`.
- Fontes de arte por tema vivem em `public/art/themes/<tema>/` (magenta/verde = chroma-key).
- Saídas de runtime: atlas em `public/atlas/`, parallax/bg em `public/ui/`.
- Powerups vêm numa folha 3×2; ordem row-major: `shield, extraLife, magnet, doubleCoin, slowMo,
  spare(ignorada)`.
- Chroma varia: magenta (~#FF00FF) na maioria, verde (~#00FF00) em `bird.coin`. Auto-detectar
  pela cor do canto.
- `npm run check` limpo ao fim de cada task.

---

### Task 1: Reduzir a força do flap (core) + re-pin dos goldens

**Files:**
- Modify: `src/core/sim/constants.ts:11`
- Modify (re-pin): `tests/determinism/replay.determinism.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `FLAP_SPEED = 170` (constante de simulação).

- [ ] **Step 1: Alterar a constante**

Em `src/core/sim/constants.ts`, linha 11:
```ts
export const FLAP_SPEED = 170; // unidades/s (impulso para cima)
```

- [ ] **Step 2: Rodar o determinismo e ver FALHAR**

Run: `npm run test:determinism`
Expected: FAIL — os hashes golden pinados em `replay.determinism.test.ts` não batem mais
(a trajetória vertical mudou). As asserções relacionais (GOLD1≠GOLD2, difficulty on≠off) devem
continuar passando.

- [ ] **Step 3: Re-pinar os goldens**

Rodar o helper de impressão dos hashes atuais (o teste já falha imprimindo `expected` vs
`received`; copiar os `received`). Substituir cada hash pinado no arquivo pelos novos valores.
NÃO alterar a estrutura do teste, só os literais de hash.

- [ ] **Step 4: Rodar tudo verde**

Run: `npm run test:determinism && npm test`
Expected: PASS (contagem de testes inalterada; só hashes mudaram).

- [ ] **Step 5: Commit**

```bash
git add src/core/sim/constants.ts tests/determinism/replay.determinism.test.ts
git commit -m "feat(core): reduz força do flap 240→170 + re-pin goldens"
```

---

### Task 2: Helper de chroma-key no pipeline

**Files:**
- Modify: `scripts/gen-atlas.mjs` (adicionar/exportar `chromaKeyToAlpha`)
- Modify: `scripts/gen-atlas.d.mts` (declarar o export)
- Create: `tests/scripts/chroma.test.ts`

**Interfaces:**
- Consumes: nada (opera sobre `{w,h,rgba:Buffer}` no formato de `decodePng`).
- Produces: `chromaKeyToAlpha(img, opts?) → {w,h,rgba}` — auto-detecta a cor-chave pelo pixel
  `(0,0)` e zera o alpha dos pixels próximos, com feather e descontaminação de borda. `opts` =
  `{ inner?: number, outer?: number }` (limiares de distância RGB; defaults `inner=60`,
  `outer=120`). Idempotente e determinístico. Retorna um NOVO buffer (não muta a entrada,
  para não corromper o `loadArt` memoizado).

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/scripts/chroma.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
// @ts-expect-error — script ESM .mjs com .d.mts sibling
import { chromaKeyToAlpha } from '../../scripts/gen-atlas.mjs';

/** Constrói um {w,h,rgba} com fundo `key` e um pixel de conteúdo em (cx,cy). */
function img(w: number, h: number, key: [number, number, number], cx: number, cy: number, content: [number, number, number]) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i*4]=key[0]; rgba[i*4+1]=key[1]; rgba[i*4+2]=key[2]; rgba[i*4+3]=255; }
  const d = (cy * w + cx) * 4; rgba[d]=content[0]; rgba[d+1]=content[1]; rgba[d+2]=content[2]; rgba[d+3]=255;
  return { w, h, rgba };
}

describe('chromaKeyToAlpha', () => {
  it('zera o alpha do fundo magenta e mantém o conteúdo', () => {
    const out = chromaKeyToAlpha(img(4, 4, [255, 0, 255], 1, 1, [200, 180, 40]));
    expect(out.rgba[(0 * 4 + 0) * 4 + 3]).toBe(0);      // canto = fundo → transparente
    expect(out.rgba[(1 * 4 + 1) * 4 + 3]).toBe(255);    // conteúdo → opaco
  });

  it('auto-detecta chroma verde', () => {
    const out = chromaKeyToAlpha(img(4, 4, [0, 255, 0], 2, 2, [180, 140, 30]));
    expect(out.rgba[0 * 4 + 3]).toBe(0);
    expect(out.rgba[(2 * 4 + 2) * 4 + 3]).toBe(255);
  });

  it('não muta a entrada', () => {
    const src = img(2, 2, [255, 0, 255], 0, 0, [10, 20, 30]);
    const before = Buffer.from(src.rgba);
    chromaKeyToAlpha(src);
    expect(src.rgba.equals(before)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npx vitest run tests/scripts/chroma.test.ts`
Expected: FAIL — `chromaKeyToAlpha is not a function`.

- [ ] **Step 3: Implementar em `scripts/gen-atlas.mjs`**

Adicionar (perto dos outros helpers exportados):
```js
/**
 * Converte o fundo-chave (chroma) em alpha. Auto-detecta a cor-chave pelo pixel (0,0) — os cantos
 * são sempre fundo. Para cada pixel: distância euclidiana RGB até a chave; dist<inner ⇒ alpha 0,
 * dist>outer ⇒ alpha inalterado, entre os dois ⇒ rampa linear (feather anti-franja). Também
 * descontamina a cor de pixels semi-transparentes (remove o tingido da chave) para evitar halo.
 * Retorna um NOVO buffer; não muta a entrada (loadArt é memoizado).
 */
export function chromaKeyToAlpha(img, opts = {}) {
  const inner = opts.inner ?? 60, outer = opts.outer ?? 120;
  const kR = img.rgba[0], kG = img.rgba[1], kB = img.rgba[2];
  const out = Buffer.from(img.rgba); // cópia
  for (let i = 0; i < img.w * img.h; i++) {
    const d = i * 4, r = out[d], g = out[d + 1], b = out[d + 2];
    const dist = Math.sqrt((r - kR) ** 2 + (g - kG) ** 2 + (b - kB) ** 2);
    let a;
    if (dist <= inner) a = 0;
    else if (dist >= outer) a = out[d + 3];
    else a = Math.round(out[d + 3] * ((dist - inner) / (outer - inner)));
    // descontaminação: puxa a cor para longe da chave proporcional à transparência ganha
    if (a < out[d + 3] && a > 0) {
      const t = 1 - a / 255; // quanto de chave remover
      out[d] = Math.max(0, Math.min(255, Math.round((r - kR * t) / (1 - t + 1e-6))));
      out[d + 1] = Math.max(0, Math.min(255, Math.round((g - kG * t) / (1 - t + 1e-6))));
      out[d + 2] = Math.max(0, Math.min(255, Math.round((b - kB * t) / (1 - t + 1e-6))));
    }
    out[d + 3] = a;
  }
  return { w: img.w, h: img.h, rgba: out };
}
```

Em `scripts/gen-atlas.d.mts` adicionar:
```ts
export function chromaKeyToAlpha(img: { w: number; h: number; rgba: Buffer }, opts?: { inner?: number; outer?: number }): { w: number; h: number; rgba: Buffer };
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npx vitest run tests/scripts/chroma.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts tests/scripts/chroma.test.ts
git commit -m "feat(build): chroma-key auto-detectado (magenta/verde) no pipeline de arte"
```

---

### Task 3: Atlas de entidades por tema (gen-atlas)

**Files:**
- Modify: `scripts/gen-atlas.mjs` (nova fonte por-tema + slice de powerups + chroma; `ATLAS_VARIANTS`)
- Modify: `tests/**` da geração de atlas (guarda de completude por variante — localizar via
  `grep -rl "ATLAS_VARIANTS\|renderAtlas\|manifest" tests/`)
- Regenera: `public/atlas/entities.{png,json}`, `entities.volcano.{png,json}`, `entities.glacier.{png,json}`

**Interfaces:**
- Consumes: `chromaKeyToAlpha`, `loadArt`, `contentBounds`, `cropResize` (Task 2 + existentes).
- Produces: 3 atlas com os MESMOS 11 ids do manifesto por variante.

- [ ] **Step 1: Generalizar `loadArt`/fontes para aceitar raiz e chroma**

Hoje `loadArt(file)` resolve sob `public/art/final`. Adicionar um parâmetro de raiz e um passo de
chroma opcional. Manter `loadArt(file)` retrocompatível (default = `final`), e adicionar
`loadArtChroma(absOrThemeFile)` que decodifica e aplica `chromaKeyToAlpha`. Concretamente, cada
`ATLAS_SOURCES` ganha campos opcionais `root` (default `public/art/final`) e `chroma` (bool). Em
`renderAtlas`, se `src.chroma`, aplicar `chromaKeyToAlpha` após decodificar (antes de
`contentBounds`). Para o strip de dino (frames>1), aplicar chroma no `img` inteiro antes do slice.
Para powerups (folha 3×2), ver Step 2.

- [ ] **Step 2: Fonte de powerups fatiada da folha 3×2**

Adicionar suporte a `src.grid = {cols, rows, names}` em `renderAtlas` (espelha `gen-ui`): recorta
cada célula, aplica chroma, `contentBounds` + `targetSize` + `cropResize`, emite um frame por
`name`. A fonte de powerups do tema:
```js
{ id: 'powerups', file: 'powerups/<tema>_powerups.chromakey.png', root: 'public/art/themes/<tema>',
  chroma: true, grid: { cols: 3, rows: 2, names: [
    'powerup.shield', 'powerup.extraLife', 'powerup.magnet',
    'powerup.doubleCoin', 'powerup.slowMo', null ] } } // null = slot spare ignorado
```
(`names` com `null` → não emite frame para o slot.)

- [ ] **Step 3: Montar `ATLAS_VARIANTS` para os 3 temas**

Cada variante (`entities` [classic], `entities.volcano`, `entities.glacier`) tem estas fontes:
```js
function themeSources(theme) {
  const R = `public/art/themes/${theme}`;
  return [
    { id: 'dino.default', root: R, file: `dinos/${theme}_dino.default.flap.chromakey.png`, frames: 6, chroma: true },
    { id: 'obstacle.tree', root: R, file: `obstacles/${theme}_obstacle.tree.chromakey.png`, frames: 1, chroma: true },
    { id: 'bird.coin', root: R, file: `collectibles/${theme}_bird.coin.chromakey.png`, frames: 1, chroma: true },
    { id: 'powerups', root: R, file: `powerups/${theme}_powerups.chromakey.png`, chroma: true,
      grid: { cols: 3, rows: 2, names: ['powerup.shield','powerup.extraLife','powerup.magnet','powerup.doubleCoin','powerup.slowMo', null] } },
    // 3 obstáculos ainda cartoon: reusa final/ (já alpha, sem chroma)
    { id: 'obstacle.vine', file: 'obstacles/obstacle.vine.png', frames: 1 },
    { id: 'obstacle.boulder', file: 'obstacles/obstacle.boulder.png', frames: 1 },
    { id: 'obstacle.stalactite', file: 'obstacles/obstacle.stalactite.png', frames: 1 },
  ];
}
export const ATLAS_VARIANTS = [
  { key: 'entities', sources: themeSources('classic') },
  { key: 'entities.volcano', sources: themeSources('volcano') },
  { key: 'entities.glacier', sources: themeSources('glacier') },
];
```
Ajustar `renderAtlas`/`loadArt` para honrar `src.root`. O alias `dino.default = dino.default.0`
já existe.

- [ ] **Step 4: Gerar e inspecionar**

Run: `npm run gen:atlas`
Expected: escreve `entities.png/json` (11 ids), `entities.volcano.*`, `entities.glacier.*`.
Verificar o count de frames por variante = 16 (10 singles + 6 do dino) no log.

- [ ] **Step 5: Atualizar a guarda de completude**

Garantir que o teste cruza manifesto↔atlas para CADA variante (todos os 11 ids do
`ASSET_MANIFEST` presentes em cada `entities*.json`). Rodar:
Run: `npm test -- <arquivo-da-guarda>`
Expected: PASS.

- [ ] **Step 6: `check` + commit**

Run: `npm run check && npm test`
```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts public/atlas tests
git commit -m "feat(art): atlas de entidades realista por tema (classic/volcano/glacier)"
```

---

### Task 4: Ligar o atlas por tema em packs.ts

**Files:**
- Modify: `src/render/packs.ts` (`PACK_VOLCANO.atlas`, `PACK_GLACIER.atlas`)
- Modify: teste de packs (guarda de completude expansão↔atlas — `grep -rl "LOOK_PACKS\|packForId" tests/ src/render/*.test.ts`)

**Interfaces:**
- Consumes: atlas gerados (Task 3), `AtlasRef` de `sprites.ts`.
- Produces: `PACK_VOLCANO.atlas`/`PACK_GLACIER.atlas` preenchidos; classic usa `DEFAULT_ATLAS`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/render/packs.test.ts` (ou o arquivo de teste de packs existente):
```ts
it('volcano e glacier apontam atlas de tema próprios', () => {
  expect(packForId('volcano').atlas?.key).toBe('entities.volcano');
  expect(packForId('glacier').atlas?.key).toBe('entities.glacier');
  expect(packForId('classic').atlas).toBeUndefined(); // usa DEFAULT_ATLAS
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npx vitest run src/render/packs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Preencher em `packs.ts`**

```ts
// em PACK_VOLCANO:
atlas: { key: 'entities.volcano', png: 'atlas/entities.volcano.png', json: 'atlas/entities.volcano.json' },
// em PACK_GLACIER:
atlas: { key: 'entities.glacier', png: 'atlas/entities.glacier.png', json: 'atlas/entities.glacier.json' },
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npx vitest run src/render/packs.test.ts && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/packs.ts src/render/packs.test.ts
git commit -m "feat(render): liga atlas de entidades por tema (volcano/glacier)"
```

---

### Task 5: Parallax realista por tema (gen-ui + packs + GameScene)

**Files:**
- Modify: `scripts/gen-ui.mjs` (fonte da banda de parallax de cada tema, com chroma)
- Modify: `scripts/gen-ui.d.mts` se necessário
- Modify: `src/render/packs.ts` (`LookPack.parallaxTextures`)
- Modify: `src/render/GameScene.ts` (preload/create usam as texturas por pack)
- Regenera: `public/ui/parallax.{far,mid,near}.{classic,volcano,glacier}.png`

**Interfaces:**
- Consumes: `chromaKeyToAlpha` (via gen-atlas), a folha `ui/<tema>_ui-parallax.chromakey.png`.
- Produces: `LookPack.parallaxTextures: readonly [string, string, string]` (nomes de arquivo em
  `public/ui/`, sem extensão, ex.: `parallax.far.volcano`), presente em TODOS os packs.

- [ ] **Step 1: Adicionar a fonte de parallax por tema em `gen-ui.mjs`**

A banda de parallax fica no terço inferior da folha `ui/<tema>_ui-parallax.chromakey.png`, com 3
sub-camadas separadas por linhas de chroma. Usar `regions` com chroma-key e `padBottomTo` (como o
parallax atual). **Coordenadas iniciais (CALIBRAR no Step 4 via inspeção):** banda em `y≈0.62..1.0`,
dividida em 3. Para cada tema, adicionar a `UI_SOURCES`:
```js
{ out: 'parallax', file: `themes/${theme}/ui/${theme}_ui-parallax.chromakey.png`, maxDim: 2172,
  chroma: true, regions: [
    { name: `parallax.far.${theme}`,  x: 0, y: 0.62, w: 1, h: 0.126, padBottomTo: 350 },
    { name: `parallax.mid.${theme}`,  x: 0, y: 0.746, w: 1, h: 0.126, padBottomTo: 235 },
    { name: `parallax.near.${theme}`, x: 0, y: 0.872, w: 1, h: 0.126 } ] }
```
Fazer `crop`/`renderUi` honrarem `src.chroma`/`rg.chroma` (aplicar `chromaKeyToAlpha` após
`loadArt`; importar de `gen-atlas.mjs`). Marcar as fontes de `bg.screen.<tema>` já-existentes
para continuar lendo de `final/` (sem mudança). Nota: a leitura de `themes/...` exige que
`loadArt` aceite `root`/caminho — reusar a generalização da Task 3.

- [ ] **Step 2: Adicionar `parallaxTextures` a `packs.ts`**

```ts
// no LookPack interface:
readonly parallaxTextures: readonly [string, string, string];
// classic:
parallaxTextures: ['parallax.far.classic', 'parallax.mid.classic', 'parallax.near.classic'],
// volcano:
parallaxTextures: ['parallax.far.volcano', 'parallax.mid.volcano', 'parallax.near.volcano'],
// glacier:
parallaxTextures: ['parallax.far.glacier', 'parallax.mid.glacier', 'parallax.near.glacier'],
```
Como agora a arte de parallax é fotorrealista, zerar o recolor: setar `parallax[i].color =
0xffffff` em volcano/glacier (classic já mistura via day-night tint). O `parallaxTint` de
day-night continua aplicado por cima (variação por hora do dia).

- [ ] **Step 3: `GameScene` carrega as texturas por pack**

Em `preload`, trocar o load fixo de `layer.visual.texture` por load das 3 texturas da pack ativa:
```ts
const pack = packForId(entitlementsService.activeExpansion.value.id);
pack.parallaxTextures.forEach((tex) => this.load.image(tex, base + 'ui/' + tex + '.png'));
```
Em `create`, o `key` de cada `tileSprite` passa a ser `pack.parallaxTextures[index]` (em vez de
`ensureLayerTexture(...visual.texture)`). Manter `baseFromBottom`/`dispHeight` de
`PARALLAX_LAYERS`, `setTileScale`, `setDepth` e o tint de day-night inalterados (REGRA 3: nada por
frame muda).

- [ ] **Step 4: Gerar, buildar e CALIBRAR visualmente**

Run: `npm run gen:ui && npm run build`
Depois servir o build e abrir no Playwright (partida ativa) em cada tema. Verificar: as 3 camadas
de parallax realista aparecem empilhadas, sem linha de chroma residual, chegando ao chão, sem
franja. Se a banda estiver cortada/deslocada, ajustar as frações `y`/`h` do Step 1 e repetir.

- [ ] **Step 5: `check` + commit**

Run: `npm run check && npm test`
```bash
git add scripts/gen-ui.mjs scripts/gen-ui.d.mts src/render/packs.ts src/render/GameScene.ts public/ui tests
git commit -m "feat(render): parallax fotorrealista por tema"
```

---

### Task 6: Fundo de gameplay fotorrealista (verificar-e-ajustar)

**Files:**
- Modify: `src/render/GameScene.ts` (backdrop distante `bg.screen.<tema>` + tint day-night)

**Interfaces:**
- Consumes: `pack.bgScreen` (nome já em `LookPack`, ex.: `bg.screen.classic`), texturas já em
  `public/ui/`.
- Produces: um backdrop estático no gameplay (ou, se reprovado na verificação, NADA — fallback
  para céu sólido; registrar a decisão).

- [ ] **Step 1: Carregar e posicionar o backdrop**

Em `preload`, carregar `this.load.image(pack.bgScreen, base + 'ui/' + pack.bgScreen + '.png')`.
Em `create`, adicionar antes das camadas de parallax:
```ts
const bg = this.add.image(0, 0, pack.bgScreen).setOrigin(0, 0).setScrollFactor(0)
  .setDepth(-(PARALLAX_LAYERS.length + 1)); // atrás de todo o parallax
bg.setDisplaySize(this.px(VIEW_WIDTH), this.px(VIEW_HEIGHT));
this.bgImage = bg; // campo novo, para o tint em applyDayNight
```
Em `applyDayNight`, aplicar `this.bgImage?.setTint(palette.parallaxTint)` (mesma variação por hora
do dia do parallax). REGRA 3: só na transição de seed, como o resto do day-night.

- [ ] **Step 2: Build + Playwright (decisão)**

Run: `npm run build`, servir, abrir partida nos 3 temas.
Critério: o backdrop melhora o realismo SEM prejudicar a legibilidade das entidades/obstáculos.
- **Se aprovado:** manter. Commit.
- **Se reprovado** (escuro/carregado demais atrás do jogo): reverter as mudanças deste Task
  (`git checkout src/render/GameScene.ts`), manter só o céu sólido + parallax realista da Task 5,
  e registrar "Parte 5 descartada na verificação" no CLAUDE.md (Task 7).

- [ ] **Step 3: Commit (se aprovado)**

```bash
git add src/render/GameScene.ts
git commit -m "feat(render): backdrop de gameplay fotorrealista por tema"
```

---

### Task 7: Verificação final + docs

**Files:**
- Modify: `CLAUDE.md` (Estado atual — registrar o item)
- Modify: `docs/roadmap/PHASE-08-art-and-packs.md` (nota no 8.1)
- Modify: `docs/assets/asset-registry.md` (fontes por-tema `public/art/themes/`)

- [ ] **Step 1: Suíte completa**

Run: `npm run check && npm test && npm run test:determinism`
Expected: tudo verde; determinismo re-pinado (só flap), contagem estável exceto os testes novos.

- [ ] **Step 2: Playwright final (build de produção)**

Servir `dist/` e verificar nos 3 temas: flap mais suave (dino sobe menos por clique), dino/tree/
coin/powerups realistas sem halo de chroma, parallax realista até o chão, backdrop (se mantido),
fps 60/0 jank. Registrar evidência.

- [ ] **Step 3: Atualizar docs**

- `docs/assets/asset-registry.md`: seção das fontes por-tema (`public/art/themes/<tema>/`, chroma).
- `docs/roadmap/PHASE-08-art-and-packs.md`: nota no 8.1 (arte realista in-game por tema + flap).
- `CLAUDE.md` (Estado atual): resumo do item (flap 240→170, chroma-key, atlas/parallax/backdrop por
  tema, det 67 re-pinado, contagem de testes, decisão da Parte 5).

- [ ] **Step 4: Commit + merge**

```bash
git add CLAUDE.md docs/
git commit -m "docs: registra flap tuning + arte realista in-game por tema"
```
Depois integrar no `main` (PR + merge automático se houver remote; senão merge local), conforme as
regras do projeto.

---

## Self-Review

- **Cobertura do spec:** Parte 1→Task 1; Parte 2 (chroma)→Task 2; Parte 3 (atlas por tema)→Tasks
  3–4; Parte 4 (parallax)→Task 5; Parte 5 (backdrop)→Task 6; testes/docs→Task 7. ✓
- **Placeholders:** coordenadas de parallax marcadas explicitamente como CALIBRAR (Task 5 Step 4)
  — não é um TODO oculto, é um passo de verificação visual com critério. ✓
- **Consistência de tipos:** `AtlasRef` (key/png/json) usado igual em Tasks 3–4; `parallaxTextures`
  como `readonly [string,string,string]` em Task 5 Steps 2–3; `chromaKeyToAlpha(img,opts?)`
  assinatura idêntica em Tasks 2, 3, 5. ✓
- **Determinismo:** só Task 1 toca core; re-pin explícito. ✓
