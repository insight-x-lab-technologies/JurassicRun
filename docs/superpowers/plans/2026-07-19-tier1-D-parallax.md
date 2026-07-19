# Tier-1 Rodada D: parallax real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** As 3 camadas de parallax do jogo renderizam a arte real (`bg.layers.png` → far/mid/near) em vez das silhuetas geométricas, preservando scroll/tint/pack.

**Architecture:** `gen-ui.mjs` fatia `bg.layers.png` em 3 tiras → `public/ui/parallax.*.png`; `parallax.ts` troca os visuais para `sprite`; `GameScene` carrega e posiciona as tiras como `TileSprite`s (tint por dia/noite + scroll inalterados).

**Tech Stack:** Node ESM, Vitest, TypeScript estrito, Phaser (casca), Preact.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- Look só por dados; sem dep nova; scripts só `node:*` + `encodePng`.
- Parallax por frame só ajusta `tilePositionX` (escalar, zero alocação — REGRA 3).
- Runtime assets em `public/ui/`; URLs com `import.meta.env.BASE_URL`.
- Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `gen-ui.mjs` — 3 tiras de parallax

**Files:**
- Modify: `scripts/gen-ui.mjs`
- Modify: `tests/render/gen-ui.test.ts`
- Regenera+commita `public/ui/parallax.{far,mid,near}.png`

- [ ] **Step 1: Nova fonte** — em `scripts/gen-ui.mjs`, adicionar ao `UI_SOURCES`:

```js
  { out: 'parallax', file: 'parallax/bg.layers.png', maxDim: 720, regions: [
    { name: 'parallax.far', x: 0, y: 0.0, w: 1, h: 0.34 },
    { name: 'parallax.mid', x: 0, y: 0.34, w: 1, h: 0.34 },
    { name: 'parallax.near', x: 0, y: 0.66, w: 1, h: 0.34 } ] },
```

- [ ] **Step 2: Teste** — em `tests/render/gen-ui.test.ts`, novo `it`:

```ts
  it('gera as 3 tiras de parallax', () => {
    const names = renderUi().map((o) => o.out);
    for (const n of ['parallax.far', 'parallax.mid', 'parallax.near']) expect(names, n).toContain(n);
  });
```

- [ ] **Step 3: FALHAR**

Run: `npx vitest run tests/render/gen-ui.test.ts`
Expected: FAIL (commitados ausentes).

- [ ] **Step 4: Gerar + PASSAR + suíte**

Run: `npm run gen:ui && npx vitest run tests/render/gen-ui.test.ts && npm test && npm run check`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-ui.mjs tests/render/gen-ui.test.ts public/ui/parallax.far.png public/ui/parallax.mid.png public/ui/parallax.near.png
git commit -m "feat(8.1): gen-ui fatia bg.layers em 3 tiras de parallax"
```

---

### Task 2: `parallax.ts` — camadas viram `sprite`

**Files:**
- Modify: `src/render/parallax.ts`
- Modify: `tests/render/parallax.test.ts`
- Modify: `src/render/packs.test.ts`

**Interfaces:**
- Produces: `ParallaxVisual` sprite = `{kind:'sprite', texture, baseFromBottom, dispHeight}`; `PARALLAX_LAYERS` com visuais sprite.

- [ ] **Step 1: Ajustar os testes (falham primeiro)** — em `tests/render/parallax.test.ts`, substituir o `it('toda camada tem um visual primitivo completo', ...)` (linhas 28-38) por:

```ts
  it('toda camada tem um visual sprite completo', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.visual.kind).toBe('sprite');
      if (l.visual.kind === 'sprite') {
        expect(l.visual.texture).toMatch(/^parallax\./);
        expect(l.visual.dispHeight).toBeGreaterThan(0);
        expect(l.visual.baseFromBottom).toBeGreaterThanOrEqual(0);
      }
    }
  });
```
E em `src/render/packs.test.ts`, no `PARALLAX_LAYERS.forEach((layer, i) => { if (layer.visual.kind === 'primitive') {...} })` (linhas ~13-16), trocar o corpo por (cobre o caso sprite sem virar vácuo):

```ts
    PARALLAX_LAYERS.forEach((layer, i) => {
      expect(PACK_CLASSIC.parallax[i]!.color).toBe(
        layer.visual.kind === 'primitive' ? layer.visual.color : 0xffffff,
      );
    });
```

- [ ] **Step 2: FALHAR**

Run: `npx vitest run tests/render/parallax.test.ts src/render/packs.test.ts`
Expected: FAIL (ainda `primitive`).

- [ ] **Step 3: `src/render/parallax.ts`** — trocar o tipo sprite do `ParallaxVisual`:

```ts
  | { readonly kind: 'sprite'; readonly texture: string; readonly baseFromBottom: number; readonly dispHeight: number };
```
E substituir os 3 `visual` de `PARALLAX_LAYERS`:
```ts
    visual: { kind: 'sprite', texture: 'parallax.far', baseFromBottom: 64, dispHeight: 52 },
```
```ts
    visual: { kind: 'sprite', texture: 'parallax.mid', baseFromBottom: 34, dispHeight: 44 },
```
```ts
    visual: { kind: 'sprite', texture: 'parallax.near', baseFromBottom: 0, dispHeight: 56 },
```
(mantém `id`/`scrollFactor` de cada camada.)

- [ ] **Step 4: PASSAR + tipos**

Run: `npx vitest run tests/render/parallax.test.ts src/render/packs.test.ts && npm run check`
Expected: verde. (`packs.ts` `CLASSIC_PARALLAX` já trata não-primitivo ⇒ compila.)

- [ ] **Step 5: Commit**

```bash
git add src/render/parallax.ts tests/render/parallax.test.ts src/render/packs.test.ts
git commit -m "feat(8.1): camadas de parallax viram sprite (texture/baseFromBottom/dispHeight)"
```

---

### Task 3: `GameScene` — carregar + posicionar as tiras

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: `PARALLAX_LAYERS` sprite (Task 2); `public/ui/parallax.*.png` (Task 1).
- Produces: nenhuma API (casca Phaser; validado no Playwright da Task 4).

- [ ] **Step 1: `preload` carrega as 3 imagens** — em `src/render/GameScene.ts`, no fim de `preload()`:

```ts
    for (const layer of PARALLAX_LAYERS) {
      if (layer.visual.kind === 'sprite') {
        this.load.image(layer.visual.texture, base + 'ui/' + layer.visual.texture + '.png');
      }
    }
```
(`base` já existe no `preload`.)

- [ ] **Step 2: `ensureLayerTexture` retorna a key da tira p/ sprite** — na função `ensureLayerTexture`, substituir a linha `if (layer.visual.kind !== 'primitive') return key;` por:

```ts
    if (layer.visual.kind === 'sprite') return layer.visual.texture;
```
(remove a variável `key` local se ficar não-usada antes desse ponto? Não — `key` segue usada no ramo primitivo abaixo; a nova linha só antecipa o retorno sprite. Mantenha a declaração de `key` onde está; a linha do sprite retorna antes de usá-la.)
NOTA: reordene para que o `return` sprite venha ANTES de `const key = ...` só se o `key` não for usado no sprite; como o sprite retorna `layer.visual.texture`, mova a checagem sprite para o topo da função (primeira linha), antes de `const key`.

- [ ] **Step 3: Posicionar o `TileSprite` por camada** — em `create()`, no `this.parallaxTiles = PARALLAX_LAYERS.map((layer, index) => { ... })`, substituir o corpo por:

```ts
    this.parallaxTiles = PARALLAX_LAYERS.map((layer, index) => {
      const key = this.ensureLayerTexture(layer, createPack.parallax[index]!.color, createPack.id);
      const v = layer.visual;
      const y = v.kind === 'sprite' ? VIEW_HEIGHT - v.baseFromBottom - v.dispHeight : 0;
      const h = v.kind === 'sprite' ? v.dispHeight : VIEW_HEIGHT;
      const tile = this.add
        .tileSprite(0, y, VIEW_WIDTH, h, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-(PARALLAX_LAYERS.length - index));
      return tile;
    });
```

- [ ] **Step 4: `applyDayNight` mantém posição, re-tinta** — na função `applyDayNight`, no laço que faz `ensureLayerTexture` + `setTexture` + `setTint`, garantir que só re-seta textura e tint (NÃO recria/reposiciona). O laço existente já faz `setTexture(key)` + `setTint(p.parallaxTint)` — para sprite, `key` é constante (`layer.visual.texture`), então `setTexture` é inócuo e a posição/altura definidas no `create()` permanecem. Nenhuma mudança de código extra além de já usar `PARALLAX_LAYERS[i]` (confirme que o laço lê `pack.parallax[i]!.color` sem quebrar p/ sprite — a cor é ignorada por `ensureLayerTexture`).

- [ ] **Step 5: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde (sem teste de unidade novo — casca Phaser; validação visual na Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(8.1): GameScene renderiza parallax real (tiras posicionadas + tint)"
```

---

### Task 4 (controlador, inline): validação visual + tuning + docs

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright (390×844), iniciar partida, flap p/ mover. Observar as 3 camadas de arte real rolando com profundidade (far devagar, near rápido). Screenshot em movimento.
- [ ] **Step 2:** Se a composição vertical estiver errada (camada cortada/flutuando), ajustar `baseFromBottom`/`dispHeight` em `parallax.ts` (inline, commit de tuning) e revalidar.
- [ ] **Step 3:** Confirmar 60fps (parallax não aloca por frame). Registrar. Anotar se há costura de tiling visível (backlog).
- [ ] **Step 4:** Atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (rodada D — **fim do Tier-1**) + `CLAUDE.md`. Commit.

**Gotcha (7.2/8.3):** SW pode servir dist antigo — `unregister()` + limpar caches + `?nocache=<ts>`.

## Self-Review

- **Cobertura:** tiras (T1) ✓; camadas sprite + testes (T2) ✓; GameScene load+posição (T3) ✓; validação+tuning+docs (T4) ✓; core intocado ✓.
- **Placeholders:** nenhum (valores de posição são placeholders explícitos, ajustáveis na T4).
- **Consistência:** `texture:'parallax.<layer>'` (T2) casa os `name` das regiões (T1) e o `load.image` (T3); `baseFromBottom`/`dispHeight` definidos em T2 e lidos em T3; `packs.ts`/`packs.test` tratam sprite→0xffffff.
