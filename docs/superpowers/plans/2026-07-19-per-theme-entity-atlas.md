# Atlas de entidades por-tema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Habilitar um pack/tema a ter seu próprio atlas de entidades: `gen-atlas.mjs` gera N atlases; `GameScene` desenha as entidades com a key do atlas do pack ativo (não uma constante), com a anim `dino.flap` por-atlas.

**Architecture:** `renderAtlas(sources)` parametrizado + `ATLAS_VARIANTS`; `main()` escreve um atlas por variante. `GameScene` guarda `this.atlasKey = atlasRefFor(activePack).key` no `preload` e usa em todos os draws + na key da anim.

**Tech Stack:** Node ESM, Vitest, TypeScript estrito, Phaser (casca).

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- `renderAtlas()` (sem arg) permanece byte-idêntico ao commitado (`public/atlas/entities.{png,json}`).
- Sem dep nova; hot path do render inalterado (REGRA 3).
- Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `gen-atlas.mjs` — multi-atlas parametrizado

**Files:**
- Modify: `scripts/gen-atlas.mjs`
- Modify: `scripts/gen-atlas.d.mts`
- Modify: `tests/render/atlas.test.ts`

**Interfaces:**
- Produces: `renderAtlas(sources?: typeof ATLAS_SOURCES): {png,json}`; `ATLAS_VARIANTS: {key,sources}[]` (default `[{key:'entities', sources:ATLAS_SOURCES}]`).

- [ ] **Step 1: Parametrizar `renderAtlas`** — em `scripts/gen-atlas.mjs`, na linha `export function renderAtlas() {`, trocar por:

```js
export function renderAtlas(sources = ATLAS_SOURCES) {
```
E no laço logo abaixo (`for (const src of ATLAS_SOURCES) {`), trocar `ATLAS_SOURCES` por `sources`:
```js
  for (const src of sources) {
```

- [ ] **Step 2: `ATLAS_VARIANTS` + `main` em laço** — em `scripts/gen-atlas.mjs`, logo após o array `ATLAS_SOURCES`, adicionar:

```js
// Variantes de atlas (multi-atlas). Um atlas de tema entra aqui: { key, sources } com os MESMOS
// ids do manifesto e arquivos-fonte diferentes; depois `npm run gen:atlas` + `pack.atlas`.
export const ATLAS_VARIANTS = [{ key: ATLAS_KEY, sources: ATLAS_SOURCES }];
```
E substituir a função `main()` inteira por:

```js
function main() {
  const dir = path.join(ROOT, 'public/atlas');
  mkdirSync(dir, { recursive: true });
  for (const v of ATLAS_VARIANTS) {
    const { png, json } = renderAtlas(v.sources);
    writeFileSync(path.join(dir, `${v.key}.png`), png);
    writeFileSync(path.join(dir, `${v.key}.json`), JSON.stringify(json, null, 2));
    console.log(`atlas ${v.key}: ${png.length} bytes, ${Object.keys(json.frames).length} frames`);
  }
}
```

- [ ] **Step 3: `scripts/gen-atlas.d.mts`** — adicionar/atualizar as declarações:

```ts
export const ATLAS_VARIANTS: readonly { key: string; sources: typeof ATLAS_SOURCES }[];
export function renderAtlas(sources?: typeof ATLAS_SOURCES): {
  png: Buffer;
  json: {
    frames: Record<string, {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean; trimmed: boolean;
      sourceSize: { w: number; h: number };
      spriteSourceSize: { x: number; y: number; w: number; h: number };
    }>;
    meta: Record<string, unknown>;
  };
};
```
(Se já houver uma declaração de `renderAtlas` sem parâmetro, substitua-a por esta com `sources?`. Mantenha as declarações existentes de `ATLAS_SOURCES`/`ATLAS_KEY`/helpers.)

- [ ] **Step 4: Testes** — em `tests/render/atlas.test.ts`, garantir que o import inclui `ATLAS_VARIANTS` (adicionar ao import de `../../scripts/gen-atlas.mjs`) e adicionar dois `it`:

```ts
  it('ATLAS_VARIANTS inclui o atlas default entities', () => {
    expect(ATLAS_VARIANTS.some((v) => v.key === 'entities')).toBe(true);
  });

  it('renderAtlas aceita uma lista de fontes (multi-atlas)', () => {
    const subset = ATLAS_SOURCES.filter((s) => s.frames === 1).slice(0, 3);
    const { png, json } = renderAtlas(subset);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    for (const s of subset) expect(json.frames[s.id], s.id).toBeDefined();
  });
```
(o teste "arquivos commitados batem com o gerado" continua chamando `renderAtlas()` sem arg ⇒ default ⇒ byte-idêntico.)

- [ ] **Step 5: Rodar o teste**

Run: `npx vitest run tests/render/atlas.test.ts`
Expected: PASS (default byte-idêntico; os 2 novos verdes). Se a assinatura do committed-match falhar, é bug — pare e reporte.

- [ ] **Step 6: Regenerar (deve ser no-op) + suíte + tipos**

Run: `npm run gen:atlas && git status --porcelain public/atlas/ && npm test && npm run check`
Expected: `git status public/atlas/` **vazio** (byte-idêntico, nada muda); suíte verde.

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts tests/render/atlas.test.ts
git commit -m "feat(theme): gen-atlas multi-atlas (renderAtlas(sources) + ATLAS_VARIANTS)"
```

---

### Task 2: `GameScene` — desenhar com a key do pack ativo + anim por-atlas

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: `atlasRefFor` (já importado), `PARALLAX_LAYERS`.
- Produces: nenhuma API (casca Phaser; validado no Playwright da Task 3).

- [ ] **Step 1: Campo `atlasKey`** — em `src/render/GameScene.ts`, junto dos outros campos privados (perto de `private dinoSprite`), adicionar:

```ts
  private atlasKey = 'entities';
```

- [ ] **Step 2: Setar no `preload`** — no `preload()`, logo após `const ref = atlasRefFor(packForId(entitlementsService.activeExpansion.value.id));`, adicionar:

```ts
    this.atlasKey = ref.key;
```
(o `this.load.atlas(ref.key, ...)` existente permanece.)

- [ ] **Step 3: Dino + anim por-atlas** — substituir o bloco de criação do dino/anim (as linhas do `this.dinoSprite = this.add.sprite(0, 0, ATLAS_KEY, ...)` até o `this.dinoSprite.play('dino.flap');`) por:

```ts
    this.dinoSprite = this.add
      .sprite(0, 0, this.atlasKey, frameFor(DINO_TYPE_ID) ?? DINO_TYPE_ID)
      .setDepth(1);
    const animKey = 'dino.flap.' + this.atlasKey;
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNames(this.atlasKey, { prefix: 'dino.default.', start: 0, end: 5 }),
        frameRate: DINO_FLAP_FPS,
        repeat: -1,
      });
    }
    this.dinoSprite.play(animKey);
```

- [ ] **Step 4: Pool + setTexture** — trocar `this.add.image(0, 0, ATLAS_KEY)` (em `acquireSprite`) por `this.add.image(0, 0, this.atlasKey)`; e `img.setTexture(ATLAS_KEY, frame)` (em `drawSpriteEntity`) por `img.setTexture(this.atlasKey, frame)`.

- [ ] **Step 5: Limpar o import** — se o eslint acusar `ATLAS_KEY` não usado no import de `./sprites` (linha 10), removê-lo do import (segue exportado por `sprites.ts`). Rodar `npm run check` p/ confirmar.

- [ ] **Step 6: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde (sem teste de unidade novo; casca Phaser). Determinismo intocado.

- [ ] **Step 7: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(theme): GameScene desenha entidades com a key do atlas do pack + anim por-atlas"
```

---

### Task 3 (controlador, inline): docs + validação (regressão + prova de capacidade)

- [ ] **Step 1: Docs** — em `docs/assets/asset-registry.md` (ou `docs/assets/ART-DIRECTION.md`), adicionar uma nota "Atlas de entidades por tema": (1) desenhar o set do tema com os mesmos ids do manifesto em `public/art/final/<tema>/`; (2) adicionar `{ key:'<tema>', sources:[...] }` a `ATLAS_VARIANTS`; (3) `npm run gen:atlas`; (4) `pack.atlas = { key:'<tema>', png:'atlas/<tema>.png', json:'atlas/<tema>.json' }`. Commit.
- [ ] **Step 2: Regressão** — `npm run build` + `npx vite preview`; Playwright (390×844), partida: entidades reais (classic) renderizam + 60fps (caminho `atlasKey==='entities'`).
- [ ] **Step 3: Prova de capacidade (throwaway, NÃO commitar)** — adicionar TEMPORARIAMENTE a `ATLAS_VARIANTS` `{ key:'entities.demo', sources: ATLAS_SOURCES }`, `npm run gen:atlas` (gera `public/atlas/entities.demo.{png,json}`), editar TEMP `PACK_VOLCANO.atlas = { key:'entities.demo', png:'atlas/entities.demo.png', json:'atlas/entities.demo.json' }`, `npm run build`, Playwright: desbloquear/selecionar volcano, entrar em Play, confirmar que as entidades carregam sob a textura `entities.demo` (ex.: `game.textures.exists('entities.demo')` via sonda, ou que o dino/entidades renderizam) e a anim toca. Depois **reverter tudo**: `git checkout scripts/gen-atlas.mjs src/render/packs.ts` + `rm public/atlas/entities.demo.*`.
- [ ] **Step 4: Estado** — atualizar `CLAUDE.md` (nota curta: atlas por-tema habilitado; lacuna do 8.1 in-game fechada) + `docs/roadmap/PHASE-08-art-and-packs.md`. Commit.

**Gotcha (7.2/8.3):** SW pode servir dist antigo — `unregister()` + limpar caches + `?nocache=<ts>`.

## Self-Review

- **Cobertura:** multi-atlas (T1) ✓; consumo da key do pack + anim por-atlas (T2) ✓; docs + regressão + prova (T3) ✓; core intocado ✓.
- **Placeholders:** nenhum (o `entities.demo` da T3 é throwaway explícito, revertido).
- **Consistência:** `renderAtlas(sources)` (T1) ⇒ `main` por `ATLAS_VARIANTS`; `this.atlasKey` (T2) = `atlasRefFor(activePack).key` (seam existente); anim key inclui `atlasKey` p/ evitar reuso global; frames iguais entre atlases (mesmos ids do manifesto).
