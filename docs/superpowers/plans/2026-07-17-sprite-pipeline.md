# 8.2 Sprite Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o desenho geométrico das entidades in-game por sprites de um texture atlas (placeholder gerado proceduralmente), com pooling e batching, mantendo 60fps e `src/core/` intocado.

**Architecture:** Puro×casca (padrão do render). Gerador de atlas PNG+JSON puro node (reusa `encodePng` de gen-icons). Helpers de sprite puros testáveis. Manifesto passa a `kind:'sprite'`. GameScene (casca Phaser, não-testada por unidade) carrega o atlas no `preload` e desenha via pool de `Image`. Fallback primitivo mantido.

**Tech Stack:** TypeScript estrito, Phaser 3, Vitest, Node (encoder PNG puro), Vite (BASE_URL).

## Global Constraints

- `src/core/` **NÃO é tocado** neste item. Determinismo = 67, sem re-pin de goldens (REGRA 1).
- Nenhuma alocação por frame no hot path do render (REGRA 3): pool cresce 1× até o pico.
- Arte desacoplada (REGRA 2): trocar arte = trocar PNG/JSON do atlas, sem mudar código.
- Sem dep nova (encoder PNG via `node:zlib`, reuso de `scripts/gen-icons.mjs`).
- Campo lógico fixo 320×180 (`VIEW_WIDTH`/`VIEW_HEIGHT`). Sem @2x.
- Caminhos de asset respeitam `import.meta.env.BASE_URL` (Pages/itch, 7.3/7.4).
- `npm run check` limpo e `npm test` verde ao fim de cada task.

---

### Task 1: Gerador de atlas placeholder + assets commitados + teste

**Files:**
- Create: `scripts/gen-atlas.mjs`
- Create: `scripts/gen-atlas.d.mts` (tipos p/ o teste `.ts` importar o `.mjs`)
- Create: `public/atlas/entities.png` (gerado)
- Create: `public/atlas/entities.json` (gerado)
- Create: `tests/render/atlas.test.ts`
- Modify: `package.json` (script `gen:atlas`)

**Interfaces:**
- Consumes: `encodePng(width, height, rgba)` de `scripts/gen-icons.mjs` (já exportado).
- Produces:
  - `scripts/gen-atlas.mjs` exporta `ATLAS_FRAMES: { id: string, color: number, shape: 'rect'|'circle'|'triangle' }[]` (11 entradas, ids = manifesto), `CELL = 64`, `COLS = 4`, e `renderAtlas(): { png: Buffer, json: object }`.
  - `public/atlas/entities.json` formato Phaser JSONHash: `{ frames: { "<id>": { frame: {x,y,w,h}, sourceSize:{w,h}, spriteSourceSize:{x:0,y:0,w,h} } }, meta: { image: "entities.png", size:{w,h}, scale:"1" } }`.

**Detalhe do gerador (`scripts/gen-atlas.mjs`):**
- `ATLAS_FRAMES` (cores dos asset-specs / manifesto atual):
  ```
  { id:'dino.default',        color:0xcc5544, shape:'triangle' },
  { id:'obstacle.tree',       color:0x6b4a2f, shape:'rect'     },
  { id:'obstacle.vine',       color:0x2f6b2f, shape:'rect'     },
  { id:'obstacle.boulder',    color:0x808896, shape:'circle'   },
  { id:'obstacle.stalactite', color:0x9aa3b2, shape:'triangle' },
  { id:'bird.coin',           color:0xffd54a, shape:'circle'   },
  { id:'powerup.shield',      color:0x4ac0ff, shape:'circle'   },
  { id:'powerup.extraLife',   color:0xff5a7a, shape:'circle'   },
  { id:'powerup.magnet',      color:0xc061ff, shape:'circle'   },
  { id:'powerup.doubleCoin',  color:0xffe14a, shape:'circle'   },
  { id:'powerup.slowMo',      color:0x66ffcc, shape:'circle'   },
  ```
- Layout: grid `COLS=4`, `CELL=64`; `rows = Math.ceil(n/COLS)`; imagem `w=COLS*CELL`, `h=rows*CELL`. Frame i em `x=(i%COLS)*CELL, y=Math.floor(i/COLS)*CELL, w=CELL, h=CELL`.
- Desenho por célula: fundo transparente (RGBA alpha 0); forma centrada com margem ~8px na cor (alpha 255). `rect` = quadrado inset; `circle` = disco; `triangle` = apontando p/ direita (dino/estalactite iguais visualmente — placeholder). Cor `0xRRGGBB` → bytes `(c>>16)&255, (c>>8)&255, c&255`.
- `renderAtlas()` monta o RGBA único, chama `encodePng`, e o objeto JSON com todos os frames.
- `main()` escreve os 2 arquivos em `public/atlas/`, só quando executado como script (guarda `process.argv[1] === fileURLToPath(import.meta.url)`, molde do gen-icons).

- [ ] **Step 1: Escrever o teste que falha** — `tests/render/atlas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ATLAS_FRAMES, renderAtlas } from '../../scripts/gen-atlas.mjs';
import { ASSET_MANIFEST } from '@render/manifest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('atlas placeholder de entidades', () => {
  it('renderAtlas gera PNG com assinatura + IHDR válidos', () => {
    const { png } = renderAtlas();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // \x89PNG
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  });

  it('encoder é determinístico (mesmos bytes a cada run)', () => {
    expect(renderAtlas().png.equals(renderAtlas().png)).toBe(true);
  });

  it('JSON tem um frame por id de ATLAS_FRAMES com geometria válida', () => {
    const { json } = renderAtlas();
    for (const f of ATLAS_FRAMES) {
      const frame = json.frames[f.id];
      expect(frame, `frame ausente: ${f.id}`).toBeDefined();
      expect(frame.frame.w).toBeGreaterThan(0);
      expect(frame.frame.h).toBeGreaterThan(0);
    }
  });

  it('COMPLETUDE: todo id sprite do manifesto tem frame no atlas', () => {
    const frameIds = new Set(ATLAS_FRAMES.map((f) => f.id));
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind === 'sprite') {
        expect(frameIds.has(id), `manifesto sprite sem frame no atlas: ${id}`).toBe(true);
      }
    }
  });

  it('sem frame órfão: todo id de ATLAS_FRAMES existe no manifesto', () => {
    for (const f of ATLAS_FRAMES) {
      expect(ASSET_MANIFEST[f.id], `frame órfão no atlas: ${f.id}`).toBeDefined();
    }
  });

  it('os arquivos commitados existem e o PNG bate com o gerado', () => {
    const png = readFileSync(path.join(root, 'public/atlas/entities.png'));
    expect(png.equals(renderAtlas().png)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- atlas` → FAIL (módulo `gen-atlas.mjs` inexistente).
- [ ] **Step 3: Implementar** `scripts/gen-atlas.mjs` + `scripts/gen-atlas.d.mts` (declara `ATLAS_FRAMES`, `CELL`, `COLS`, `renderAtlas`) conforme o detalhe acima.
- [ ] **Step 4: Gerar os assets** — adicionar `"gen:atlas": "node scripts/gen-atlas.mjs"` ao `package.json`; rodar `npm run gen:atlas`; confirmar `public/atlas/entities.png` + `.json` escritos.
- [ ] **Step 5: Rodar testes** — `npm test -- atlas` → PASS. `npm run check` limpo.
- [ ] **Step 6: Commit**

```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts public/atlas tests/render/atlas.test.ts package.json
git commit -m "feat(8.2): gerador de atlas placeholder + assets + teste de completude"
```

**NOTA para o implementador:** o `.d.mts` deve declarar os exports usados no teste. `renderAtlas` retorna `{ png: Buffer; json: { frames: Record<string, { frame: { x:number;y:number;w:number;h:number }; sourceSize:{w:number;h:number}; spriteSourceSize:{x:number;y:number;w:number;h:number} }>; meta: Record<string, unknown> } }`. `ATLAS_FRAMES` é `readonly { id:string; color:number; shape:'rect'|'circle'|'triangle' }[]`.

---

### Task 2: Helpers puros de sprite (`src/render/sprites.ts`) + teste

**Files:**
- Create: `src/render/sprites.ts`
- Create: `tests/render/sprites.test.ts`
- Modify: `src/render/index.ts` (reexportar os puros, sem vazar phaser)

**Interfaces:**
- Consumes: `Hitbox` de `@core/sim`; `renderableFor` de `./manifest`.
- Produces:
  - `ATLAS_KEY = 'entities'`
  - `ATLAS_PNG = 'atlas/entities.png'`, `ATLAS_JSON = 'atlas/entities.json'` (relativos ao BASE_URL, sem barra inicial)
  - `spriteSizeFor(hitbox: Hitbox): { w: number; h: number }`
  - `frameFor(typeId: string): string | null`

**Implementação (`src/render/sprites.ts`):**
```ts
import type { Hitbox } from '@core/sim';
import { renderableFor } from './manifest';

export const ATLAS_KEY = 'entities';
export const ATLAS_PNG = 'atlas/entities.png';
export const ATLAS_JSON = 'atlas/entities.json';

/** Tamanho do sprite = bounding box da hitbox (hitboxes são aleatórias por instância; o
 *  sprite cobre a hitbox). Escalares apenas — sem alocação intermediária além do retorno. */
export function spriteSizeFor(hitbox: Hitbox): { w: number; h: number } {
  switch (hitbox.kind) {
    case 'aabb':
      return { w: hitbox.halfW * 2, h: hitbox.halfH * 2 };
    case 'circle':
      return { w: hitbox.radius * 2, h: hitbox.radius * 2 };
    case 'polygon': {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of hitbox.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { w: maxX - minX, h: maxY - minY };
    }
    default: {
      const _exhaustive: never = hitbox;
      return _exhaustive;
    }
  }
}

/** Nome de frame do atlas para um tipo lógico; null se não for sprite (fallback primitivo). */
export function frameFor(typeId: string): string | null {
  const r = renderableFor(typeId);
  return r.kind === 'sprite' ? (r.frame ?? typeId) : null;
}
```

- [ ] **Step 1: Escrever o teste que falha** — `tests/render/sprites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spriteSizeFor, frameFor } from '@render/sprites';
import { aabb, circle, polygon } from '@core/sim/hitbox';
import { DINO_TYPE_ID } from '@render/manifest';

describe('helpers de sprite', () => {
  it('spriteSizeFor: aabb = 2·half', () => {
    expect(spriteSizeFor(aabb(6, 20))).toEqual({ w: 12, h: 40 });
  });
  it('spriteSizeFor: circle = 2·r', () => {
    expect(spriteSizeFor(circle(9))).toEqual({ w: 18, h: 18 });
  });
  it('spriteSizeFor: polygon = extensão min/max', () => {
    const h = polygon([{ x: -8, y: -11 }, { x: 8, y: -11 }, { x: 0, y: 11 }]);
    expect(spriteSizeFor(h)).toEqual({ w: 16, h: 22 });
  });
  it('frameFor: id sprite conhecido devolve o frame', () => {
    expect(frameFor(DINO_TYPE_ID)).toBe(DINO_TYPE_ID);
  });
  it('frameFor: id desconhecido (fallback primitivo) devolve null', () => {
    expect(frameFor('nao.existe')).toBeNull();
  });
});
```

**NOTA:** este teste depende do manifesto já ter `dino.default` como `sprite` (Task 3). Para não acoplar a ordem, na Task 2 o teste de `frameFor(DINO_TYPE_ID)` pode ser mantido; se o manifesto ainda for primitivo quando a Task 2 rodar isolada, o subagente da Task 2 deve ordenar após a Task 3 OU trocar temporariamente por um id já-sprite. **Decisão do plano:** executar Task 3 ANTES da Task 2. Ver ordem no fim do plano.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- sprites` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** `src/render/sprites.ts` (código acima) e reexportar em `src/render/index.ts`.
- [ ] **Step 4: Rodar testes** — `npm test -- sprites` → PASS. `npm run check` limpo.
- [ ] **Step 5: Commit**

```bash
git add src/render/sprites.ts tests/render/sprites.test.ts src/render/index.ts
git commit -m "feat(8.2): helpers puros de sprite (spriteSizeFor, frameFor)"
```

---

### Task 3: Manifesto → sprite

**Files:**
- Modify: `src/render/manifest.ts:17-29` (as 11 entradas)
- Modify: `tests/render/manifest.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `ASSET_MANIFEST[id]` agora `{ kind:'sprite', atlas:'entities', frame:'<id>' }` para os 11 ids; `FALLBACK` continua primitivo.

- [ ] **Step 1: Atualizar o teste** — `tests/render/manifest.test.ts`, o caso do dino:

```ts
it('mapeia o dino para um sprite do atlas', () => {
  const r = renderableFor(DINO_TYPE_ID);
  expect(r.kind).toBe('sprite');
  if (r.kind === 'sprite') {
    expect(r.atlas).toBe('entities');
    expect(r.frame).toBe(DINO_TYPE_ID);
  }
});
```
Manter o teste de fallback primitivo e o de COMPLETUDE (todo id do catálogo tem entrada).

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- manifest` → FAIL (ainda primitivo).
- [ ] **Step 3: Implementar** — trocar as 11 entradas de `ASSET_MANIFEST` para:

```ts
export const ASSET_MANIFEST: Readonly<Record<string, Renderable>> = {
  [DINO_TYPE_ID]:       { kind: 'sprite', atlas: 'entities', frame: 'dino.default' },
  'obstacle.tree':      { kind: 'sprite', atlas: 'entities', frame: 'obstacle.tree' },
  'obstacle.vine':      { kind: 'sprite', atlas: 'entities', frame: 'obstacle.vine' },
  'obstacle.boulder':   { kind: 'sprite', atlas: 'entities', frame: 'obstacle.boulder' },
  'obstacle.stalactite':{ kind: 'sprite', atlas: 'entities', frame: 'obstacle.stalactite' },
  'bird.coin':          { kind: 'sprite', atlas: 'entities', frame: 'bird.coin' },
  'powerup.shield':     { kind: 'sprite', atlas: 'entities', frame: 'powerup.shield' },
  'powerup.extraLife':  { kind: 'sprite', atlas: 'entities', frame: 'powerup.extraLife' },
  'powerup.magnet':     { kind: 'sprite', atlas: 'entities', frame: 'powerup.magnet' },
  'powerup.doubleCoin': { kind: 'sprite', atlas: 'entities', frame: 'powerup.doubleCoin' },
  'powerup.slowMo':     { kind: 'sprite', atlas: 'entities', frame: 'powerup.slowMo' },
};
```
Atualizar o comentário do topo do arquivo (a fase geométrica virou sprite; primitive é fallback).

- [ ] **Step 4: Rodar testes** — `npm test -- manifest atlas` → PASS. `npm run check` limpo.
- [ ] **Step 5: Commit**

```bash
git add src/render/manifest.ts tests/render/manifest.test.ts
git commit -m "feat(8.2): manifesto de entidades passa de primitive para sprite"
```

---

### Task 4: GameScene — carga do atlas + pool de sprites (casca)

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: `ATLAS_KEY`, `ATLAS_PNG`, `ATLAS_JSON`, `spriteSizeFor`, `frameFor` de `./sprites`; `renderableFor`, `DINO_TYPE_ID` de `./manifest`.
- Produces: render por sprite (nenhum export novo).

Esta é a casca Phaser: **não há teste de unidade** (convenção do render). Validação é a suíte + `npm run check` verde + Playwright na Task 5.

- [ ] **Step 1: `preload()`** — adicionar método à `GameScene`, carregando o atlas do BASE_URL:

```ts
override preload(): void {
  const base = import.meta.env.BASE_URL; // termina com '/'
  this.load.atlas(ATLAS_KEY, base + ATLAS_PNG, base + ATLAS_JSON);
}
```

- [ ] **Step 2: Campos do pool** — adicionar à classe:

```ts
private spritePool: Phaser.GameObjects.Image[] = [];
private spritePoolUsed = 0;
private dinoSprite!: Phaser.GameObjects.Image;
private readonly sizeCache = new Map<string, { w: number; h: number }>();
```

- [ ] **Step 3: Criar o dino sprite no `create()`** — após criar `this.gfx`:

```ts
// Sprite do dino (8.2): sempre visível, posição interpolada, acima das outras entidades.
this.dinoSprite = this.add.image(0, 0, ATLAS_KEY, DINO_TYPE_ID).setDepth(1);
```

- [ ] **Step 4: Helpers de pool + draw de sprite** — adicionar métodos:

```ts
/** Devolve um Image do pool (cresce 1× até o pico), pronto e visível (REGRA 3). */
private acquireSprite(): Phaser.GameObjects.Image {
  let img = this.spritePool[this.spritePoolUsed];
  if (img === undefined) {
    img = this.add.image(0, 0, ATLAS_KEY).setDepth(0);
    this.spritePool.push(img);
  }
  this.spritePoolUsed += 1;
  img.setVisible(true);
  return img;
}

/** displaySize da hitbox, cacheado por tipo (tamanho estável dentro do range do catálogo). */
private sizeFor(typeId: string, hitbox: Hitbox): { w: number; h: number } {
  let s = this.sizeCache.get(typeId);
  if (s === undefined) {
    s = spriteSizeFor(hitbox);
    this.sizeCache.set(typeId, s);
  }
  return s;
}

private drawSpriteEntity(e: Entity, scrollX: number): void {
  const x = e.transform.position.x;
  if (!isHorizontallyVisible(x, leftExtent(e.hitbox), rightExtent(e.hitbox), scrollX, VIEW_WIDTH, CULL_MARGIN)) {
    return;
  }
  const typeId = e.tags[0] ?? '';
  const frame = frameFor(typeId);
  if (frame === null) { // fallback primitivo (id desconhecido)
    this.drawEntity(this.gfx, e);
    return;
  }
  const img = this.acquireSprite();
  img.setTexture(ATLAS_KEY, frame);
  const s = this.sizeFor(typeId, e.hitbox);
  img.setDisplaySize(s.w, s.h);
  img.setPosition(x, e.transform.position.y);
}

private drawVisibleSprites(entities: readonly Entity[], scrollX: number): void {
  for (const e of entities) this.drawSpriteEntity(e, scrollX);
}
```

- [ ] **Step 5: Reescrever o bloco de desenho no `update()`** — substituir as 4 linhas de draw:

```ts
const g = this.gfx;
g.clear();
this.spritePoolUsed = 0;
this.drawVisibleSprites(world.obstacles, scrollX);
this.drawVisibleSprites(world.collectibles, scrollX);
this.drawVisibleSprites(world.powerups, scrollX);
// Dino: sprite se o manifesto for sprite; senão primitivo (fallback de segurança).
if (frameFor(DINO_TYPE_ID) !== null) {
  this.dinoSprite.setVisible(true).setPosition(loop.renderX, loop.renderY);
  const ds = this.sizeFor(DINO_TYPE_ID, world.pterodactyl.hitbox);
  this.dinoSprite.setDisplaySize(ds.w, ds.h);
} else {
  this.dinoSprite.setVisible(false);
  this.drawPrimitive(g, DINO_TYPE_ID, world.pterodactyl.hitbox, loop.renderX, loop.renderY);
}
// Esconde os sprites do pool não usados neste frame.
for (let i = this.spritePoolUsed; i < this.spritePool.length; i++) {
  this.spritePool[i]!.setVisible(false);
}
```

- [ ] **Step 6: Imports** — adicionar no topo do GameScene:

```ts
import { ATLAS_KEY, ATLAS_PNG, ATLAS_JSON, spriteSizeFor, frameFor } from './sprites';
```
`spriteSizeFor` é usado por `sizeFor`. Manter `drawPrimitive`/`drawEntity`/`drawVisible` (fallback). Se `drawVisible` ficar sem uso, remover para o lint passar; `drawEntity` é usado no fallback.

- [ ] **Step 7: Verificar** — `npm run check` limpo (sem imports/campos não usados), `npm test` verde.
- [ ] **Step 8: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(8.2): GameScene carrega atlas e desenha entidades via pool de sprites"
```

**NOTA:** ao remover as linhas antigas de `drawVisible(g, ...)` no update, `drawVisible` pode ficar órfão. Manter só se o dino-fallback ou algo o usar; caso contrário, apagar `drawVisible` e deixar `drawSpriteEntity` fazer o culling. O `drawPrimitive` e `drawEntity` permanecem para o fallback. Confirmar com `npm run check` (TS estrito acusa não-usado).

---

### Task 5: Validação de 60fps (Playwright) + fechamento

**Files:**
- Modify: `CLAUDE.md` (bloco "Estado atual": marcar 8.2)
- Modify: `docs/roadmap/PHASE-08-art-and-packs.md` (marcar `[x]` os dois checkboxes de 8.2)

Esta task é verificação + docs; sem código de produção novo.

- [ ] **Step 1: Build + servir** — `npm run build` limpo; servir `dist/` (ou `npm run dev`) e abrir com Playwright.
- [ ] **Step 2: Confirmar sprites** — navegar até Play, iniciar partida; via `browser_evaluate` ou snapshot, confirmar que o canvas mostra os sprites do atlas (não os primitivos) e que a partida roda do início ao Game Over.
- [ ] **Step 3: Medir fps** — laço rAF real (molde 2.7) em mobile emulado 390×844 durante uma partida; registrar p50 do frame time e contagem de frames >33ms. Alvo: 60fps sustentado, 0 jank atribuível ao jogo.
- [ ] **Step 4: Confirmar batching** — via `browser_evaluate` no renderer Phaser (ou inspeção), confirmar que as entidades compartilham a textura de atlas única (poucos draw calls). Registrar evidência.
- [ ] **Step 5: verify-determinism** — rodar a skill/`npm run test:determinism`: determinismo **67 inalterado** (core intocado).
- [ ] **Step 6: Marcar concluído** — `[x]` nos checkboxes de 8.2 no PHASE-08; atualizar "Estado atual" do CLAUDE.md com o resumo de 8.2.
- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/roadmap/PHASE-08-art-and-packs.md
git commit -m "docs(8.2): fecha o item de pipeline de sprite (evidência de 60fps + estado)"
```

---

## Ordem de execução

**Task 1 → Task 3 → Task 2 → Task 4 → Task 5.**
(Task 3 antes da Task 2 porque o teste de `frameFor(DINO_TYPE_ID)` espera o manifesto já em `sprite`. Task 1 primeiro porque a completude do atlas cruza com o manifesto — mas o teste de Task 1 só checa ids sprite do manifesto; roda igual antes ou depois da Task 3, pois cruza só as entradas que JÁ são sprite. Ordenar 1→3→2 é o caminho sem fricção.)

## Self-Review

- **Cobertura da spec:** gerador de atlas (T1) ✓; helpers puros (T2) ✓; manifesto→sprite (T3) ✓; GameScene preload+pool+culling+fallback (T4) ✓; validação fps/batching + determinismo + docs (T5) ✓. Fiação BASE_URL coberta no preload (T4).
- **Placeholders:** nenhum "TBD"; todo passo tem código/comando concreto.
- **Consistência de tipos:** `spriteSizeFor`/`frameFor`/`ATLAS_KEY`/`ATLAS_PNG`/`ATLAS_JSON` usados em T4 batem com T2; `ATLAS_FRAMES`/`renderAtlas` de T1 batem com o teste. `renderableFor` já existe.
- **Gap conhecido:** completude atlas↔manifesto — se um dia um id sprite não tiver frame, o teste de T1 (COMPLETUDE) quebra. Coberto.
