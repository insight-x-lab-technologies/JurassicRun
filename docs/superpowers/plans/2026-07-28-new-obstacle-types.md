# Novos tipos de obstáculo (item 9.8) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar 3 obstáculos novos (`obstacle.spire`, `obstacle.gate`, `obstacle.rock_arch`) ao
núcleo determinístico, com composição por múltiplas entidades convexas, justiça provada por teste e
goldens de replay re-pinados.

**Architecture:** `SpawnType` vira uma união `SimpleSpawnType | CompositeSpawnType`. O tipo composto
expõe `makePieces(rng, field)` que devolve peças com hitbox convexa, `dx` relativo ao x do spawn e
`y` absoluto já ancorado. O `SpawnGenerator` emite 1 entidade por peça (ids sequenciais), mantendo o
cursor `nextSpawnX` avançando **uma vez por evento de spawn**. Nada muda em `collision/`,
`hashState` ou `WorldState`.

**Tech Stack:** TypeScript estrito, Vitest, Phaser 4 (só no render), Node scripts `.mjs`.

## Global Constraints

- `src/core/` é TS puro: **proibido** `Math.random`, `Date.now`, `performance.now`, DOM, Phaser.
  Aleatoriedade só via `Rng` (`@core/rng`); tempo só via o relógio da simulação.
- Simulação em passo fixo; mesma seed + mesmos inputs ⇒ estado idêntico (`hashState`).
- Hitbox lógica ≠ arte (REGRA 2). Arte nunca define colisão.
- Sem alocação por frame no hot path do render (REGRA 3).
- Campo lógico fixo: `worldHeight = 180`, `yMargin = 8` ⇒ faixa útil y ∈ [8, 172]. Dino: `aabb(10, 8)`.
- Margem de justiça: **toda passagem ≥ 30 unidades**.
- Comentários e nomes de teste em pt-BR, como o resto do repositório.
- Rodar do diretório do projeto: `npm test`, `npm run check`, `npm run test:determinism`.

---

### Task 1: Mecanismo de obstáculo composto no gerador

**Files:**
- Modify: `src/core/spawn/catalog.ts` (tipos `SpawnType`/`SpawnPiece`/`SpawnField`)
- Modify: `src/core/spawn/generator.ts` (emissão de peças)
- Modify: `src/core/spawn/index.ts` (exports dos tipos novos, se o arquivo re-exporta nomes)
- Test: `tests/core/spawn/generator.test.ts`

**Interfaces:**
- Consumes: `Rng` (`@core/rng`), `Hitbox`/`Entity` (`@core/sim/types`), `aabb` (`@core/sim/hitbox`).
- Produces:
  - `export interface SpawnField { readonly worldHeight: number; readonly yMargin: number }`
  - `export interface SpawnPiece { readonly hitbox: Hitbox; readonly dx: number; readonly y: number; readonly tag?: string }`
  - `export interface SimpleSpawnType { readonly id: string; readonly anchor: Anchor; makeHitbox(rng: Rng): Hitbox; readonly makePieces?: undefined }`
  - `export interface CompositeSpawnType { readonly id: string; readonly anchor?: undefined; readonly makeHitbox?: undefined; makePieces(rng: Rng, field: SpawnField): readonly SpawnPiece[] }`
  - `export type SpawnType = SimpleSpawnType | CompositeSpawnType`
  - `SpawnConfig` continua satisfazendo `SpawnField` estruturalmente (tem `worldHeight` e `yMargin`).

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `tests/core/spawn/generator.test.ts` (manter os testes existentes intactos):

```ts
import { aabb } from '@core/sim/hitbox';
import type { SpawnType } from '@core/spawn';

/** Tipo composto de teste: 2 peças a ±10 em x, y fixos. Consome 1 saque. */
const COMPOSITE: SpawnType = {
  id: 'obstacle.test_composite',
  makePieces: (rng, field) => {
    const h = 10 + rng.next() * 10;
    return [
      { hitbox: aabb(3, h / 2), dx: -10, y: field.yMargin + h / 2 },
      { hitbox: aabb(3, h / 2), dx: 10, y: field.worldHeight - field.yMargin - h / 2, tag: 'obstacle.test_composite.low' },
    ];
  },
};

describe('obstáculo composto', () => {
  it('emite uma entidade por peça, no mesmo evento de spawn', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX, out);
    expect(out).toHaveLength(2);
    expect(out[0]!.transform.position.x).toBe(DEFAULT_SPAWN_CONFIG.startX - 10);
    expect(out[1]!.transform.position.x).toBe(DEFAULT_SPAWN_CONFIG.startX + 10);
  });

  it('ids são sequenciais entre peças e entre eventos', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 500, out);
    expect(out.map((e) => e.id)).toEqual(out.map((_, i) => i));
  });

  it('a tag da peça manda; sem tag, herda o id do tipo', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX, out);
    expect(out[0]!.tags).toEqual(['obstacle.test_composite']);
    expect(out[1]!.tags).toEqual(['obstacle.test_composite.low']);
  });

  it('mesma seed ⇒ mesmas peças (determinismo)', () => {
    const run = () => {
      const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
      const out: Entity[] = [];
      g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, out);
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('clone() preserva o cursor e o estado do rng com compostos', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const warm: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 300, warm);
    const a: Entity[] = [];
    const b: Entity[] = [];
    g.clone().generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, a);
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, b);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/spawn/generator.test.ts`
Esperado: FAIL (typecheck/`makePieces` inexistente).

- [ ] **Step 3: Implementar os tipos em `src/core/spawn/catalog.ts`**

Substituir a interface `SpawnType` atual por:

```ts
/** Campo lógico visto por um compositor de peças (subconjunto de SpawnConfig). */
export interface SpawnField {
  readonly worldHeight: number;
  readonly yMargin: number;
}

/** Peça de um obstáculo composto: hitbox convexa própria, `dx` relativo ao x do spawn e `y`
 *  CENTRO absoluto (o compositor já ancorou). `tag` default = id do tipo. */
export interface SpawnPiece {
  readonly hitbox: Hitbox;
  readonly dx: number;
  readonly y: number;
  readonly tag?: string;
}

/** Tipo simples: 1 entidade, ancorada por `placeY`. */
export interface SimpleSpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
  readonly makePieces?: undefined;
}

/** Tipo composto: N entidades convexas emitidas no mesmo evento de spawn. Resolve formas
 *  não-convexas (arco com buraco) sem tocar em `collision/` (SAT continua convexo-a-convexo). */
export interface CompositeSpawnType {
  readonly id: string;
  readonly anchor?: undefined;
  readonly makeHitbox?: undefined;
  makePieces(rng: Rng, field: SpawnField): readonly SpawnPiece[];
}

/**
 * Tipo lógico de algo colocável (obstáculo ou coletável): dado puro. `id` = chave do
 * asset-registry e tag da entidade. Tamanhos podem variar via Rng (a arte nunca muda a hitbox).
 */
export type SpawnType = SimpleSpawnType | CompositeSpawnType;
```

- [ ] **Step 4: Implementar a emissão em `src/core/spawn/generator.ts`**

```ts
  /** Empurra em `sink` toda entidade com spawnX <= upToX (ordem de x crescente). */
  generateUpTo(upToX: number, sink: Entity[]): void {
    while (this.nextSpawnX <= upToX) {
      const type = this.rng.pick(this.catalog);
      if (type.makePieces !== undefined) {
        const pieces = type.makePieces(this.rng, this.config);
        for (const p of pieces) {
          this.emit(p.tag ?? type.id, p.hitbox, this.nextSpawnX + p.dx, p.y, sink);
        }
      } else {
        const hitbox = type.makeHitbox(this.rng);
        this.emit(type.id, hitbox, this.nextSpawnX, placeY(type.anchor, hitbox, this.config, this.rng), sink);
      }
      const s = this.gapScale(this.nextSpawnX);
      this.nextSpawnX += this.rng.range(this.config.gapMin * s, this.config.gapMax * s);
    }
  }

  /** Materializa 1 entidade e avança o contador de id. */
  private emit(tag: string, hitbox: Hitbox, x: number, y: number, sink: Entity[]): void {
    sink.push({
      id: this.nextId,
      type: this.entityType,
      tags: [tag],
      transform: { position: { x, y } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox,
    });
    this.nextId += 1;
  }
```

Atenção: a ordem de consumo do RNG do caminho SIMPLES não pode mudar — `makeHitbox` antes de
`placeY`, e o `rng.range` do gap depois. (No trecho acima `placeY` é avaliado como argumento
DEPOIS de `makeHitbox`; se houver qualquer dúvida de ordem de avaliação, extraia as duas em
`const` na ordem original.)

- [ ] **Step 5: Rodar os testes de spawn e determinismo**

Run: `npm test -- tests/core/spawn tests/determinism` e `npm run check`
Esperado: PASS em tudo — inclusive os goldens de replay **sem re-pin** (o catálogo real não mudou
nesta task).

- [ ] **Step 6: Commit**

```bash
git add src/core/spawn tests/core/spawn/generator.test.ts
git commit -m "feat(9.8): mecanismo de obstáculo composto (peças convexas) no spawn"
```

---

### Task 2: Os 3 obstáculos novos + justiça + re-pin dos goldens

**Files:**
- Modify: `src/core/spawn/catalog.ts` (3 entradas novas + constantes de tuning)
- Modify: `tests/core/spawn/catalog.test.ts` (narrowing da união + testes de justiça)
- Modify: `tests/determinism/replay.determinism.test.ts` (re-pin dos 3 cenários com seed)
- Modify: `supabase/functions/verify-challenge/_verify.bundle.js` (gerado por `npm run build:edge`)

**Interfaces:**
- Consumes: `SpawnPiece`/`SpawnField`/`CompositeSpawnType` da Task 1; `aabb` (`@core/sim/hitbox`).
- Produces: ids `obstacle.spire`, `obstacle.gate`, `obstacle.rock_arch`; tags de peça
  `obstacle.rock_arch.leg` e `obstacle.rock_arch.span` (o `gate` usa a tag do próprio tipo nas 2
  peças). O manifesto da Task 3 consome exatamente essas tags.

- [ ] **Step 1: Escrever os testes de justiça que falham**

Acrescentar em `tests/core/spawn/catalog.test.ts`:

```ts
import { aabb } from '@core/sim/hitbox';
import { boundsOf } from '@core/sim/hitbox';
import type { SpawnField, SpawnPiece } from '@core/spawn';

const FIELD: SpawnField = { worldHeight: 180, yMargin: 8 };
const DINO_H = 16;
const MIN_PASSAGE = 30; // ≈1,9× a altura do dino

function typeById(id: string) {
  const t = OBSTACLE_CATALOG.find((x) => x.id === id);
  expect(t, `tipo ausente no catálogo: ${id}`).toBeDefined();
  return t!;
}

/** Faixa vertical [topo, base] ocupada por uma peça. */
function span(p: SpawnPiece): { top: number; bottom: number } {
  const b = boundsOf(p.hitbox);
  return { top: p.y + b.minY, bottom: p.y + b.maxY };
}

describe('justiça dos obstáculos novos (9.8)', () => {
  it('gate: fresta sempre passável e braços não degeneram', () => {
    const t = typeById('obstacle.gate');
    const rng = createRng('fairness-gate');
    for (let i = 0; i < 500; i++) {
      const pieces = t.makePieces!(rng, FIELD);
      expect(pieces).toHaveLength(2);
      const [ceil, floor] = pieces.map(span) as [ReturnType<typeof span>, ReturnType<typeof span>];
      expect(ceil.top).toBeCloseTo(FIELD.yMargin, 6);
      expect(floor.bottom).toBeCloseTo(FIELD.worldHeight - FIELD.yMargin, 6);
      expect(floor.top - ceil.bottom).toBeGreaterThanOrEqual(MIN_PASSAGE);
      expect(ceil.bottom - ceil.top).toBeGreaterThanOrEqual(12);
      expect(floor.bottom - floor.top).toBeGreaterThanOrEqual(12);
    }
  });

  it('rock_arch: buraco entre as pernas e vão superior sempre passáveis', () => {
    const t = typeById('obstacle.rock_arch');
    const rng = createRng('fairness-arch');
    for (let i = 0; i < 500; i++) {
      const pieces = t.makePieces!(rng, FIELD);
      expect(pieces).toHaveLength(3);
      const legs = pieces.filter((p) => p.tag === 'obstacle.rock_arch.leg');
      const spanPiece = pieces.find((p) => p.tag === 'obstacle.rock_arch.span')!;
      expect(legs).toHaveLength(2);
      const legSpan = span(legs[0]!);
      const barSpan = span(spanPiece);
      // pernas apoiadas no chão
      expect(legSpan.bottom).toBeCloseTo(FIELD.worldHeight - FIELD.yMargin, 6);
      // buraco = do chão até a trave
      expect(legSpan.bottom - legSpan.top).toBeGreaterThanOrEqual(MIN_PASSAGE);
      // trave encostada no topo das pernas (sem invadir o buraco)
      expect(barSpan.bottom).toBeCloseTo(legSpan.top, 6);
      // vão por cima da trave
      expect(barSpan.top - FIELD.yMargin).toBeGreaterThanOrEqual(MIN_PASSAGE);
      // as pernas ficam de lados opostos e a trave as cobre
      expect(legs[0]!.dx).toBeLessThan(0);
      expect(legs[1]!.dx).toBeGreaterThan(0);
      expect(boundsOf(spanPiece.hitbox).maxX).toBeGreaterThanOrEqual(
        legs[1]!.dx + boundsOf(legs[1]!.hitbox).maxX - 1e-9,
      );
    }
  });

  it('spire: estreita, alta e sempre com um lado largo para passar', () => {
    const t = typeById('obstacle.spire');
    const rng = createRng('fairness-spire');
    for (let i = 0; i < 500; i++) {
      const h = t.makeHitbox!(rng);
      expect(h.kind).toBe('aabb');
      if (h.kind !== 'aabb') continue;
      expect(h.halfW * 2).toBeLessThanOrEqual(12);
      const free = FIELD.worldHeight - 2 * FIELD.yMargin - h.halfH * 2;
      expect(free / 2).toBeGreaterThanOrEqual(MIN_PASSAGE); // pior caso (centrado)
      expect(h.halfH * 2).toBeGreaterThan(DINO_H);
    }
  });

  it('todo tipo composto emite peças com hitbox dentro do campo', () => {
    const rng = createRng('fairness-bounds');
    for (const t of OBSTACLE_CATALOG) {
      if (t.makePieces === undefined) continue;
      for (let i = 0; i < 200; i++) {
        for (const p of t.makePieces(rng, FIELD)) {
          const s = span(p);
          expect(s.top).toBeGreaterThanOrEqual(FIELD.yMargin - 1e-9);
          expect(s.bottom).toBeLessThanOrEqual(FIELD.worldHeight - FIELD.yMargin + 1e-9);
        }
      }
    }
  });
});
```

Ajustar também os testes já existentes do arquivo para a união (`t.anchor` e `t.makeHitbox` só
existem no tipo simples):

```ts
  it('tem ids únicos e âncoras válidas', () => {
    const ids = OBSTACLE_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of OBSTACLE_CATALOG) {
      expect(t.id.startsWith('obstacle.')).toBe(true);
      if (t.makePieces === undefined) expect(['floor', 'ceiling', 'floating']).toContain(t.anchor);
    }
  });

  it('cobre os três tipos de hitbox (não só retângulos)', () => {
    const rng = createRng('catalog-test');
    const kinds = new Set(
      OBSTACLE_CATALOG.filter((t) => t.makePieces === undefined).map((t) => t.makeHitbox!(rng).kind),
    );
    expect(kinds.has('aabb')).toBe(true);
    expect(kinds.has('circle')).toBe(true);
    expect(kinds.has('polygon')).toBe(true);
  });

  it('makeHitbox é determinístico para o mesmo estado de rng', () => {
    const t = OBSTACLE_CATALOG[0]!;
    if (t.makePieces !== undefined) throw new Error('esperado tipo simples na posição 0');
    const a = t.makeHitbox(createRng('seed-x'));
    const b = t.makeHitbox(createRng('seed-x'));
    expect(a).toEqual(b);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/spawn/catalog.test.ts`
Esperado: FAIL ("tipo ausente no catálogo: obstacle.gate").

- [ ] **Step 3: Implementar os 3 tipos em `src/core/spawn/catalog.ts`**

Acrescentar as constantes de tuning acima do `OBSTACLE_CATALOG` (unidades de mundo; campo útil
y ∈ [8, 172]; dino 20 × 16):

```ts
// --- Tuning dos obstáculos compostos (9.8). Números escolhidos p/ manter toda passagem ≥ 30
// unidades (≈1,9× a altura do dino) no campo lógico 320×180. Ver os testes de justiça. ---
const GATE_HALF_W = 5;
const GATE_GAP_MIN = 38;
const GATE_GAP_MAX = 52;
const GATE_ARM_MIN = 12; // braço mínimo p/ o par não degenerar num obstáculo só
const ARCH_LEG_HALF_W = 5;
const ARCH_LEG_DX = 18;
const ARCH_LEG_MIN = 34; // altura da perna = altura do buraco
const ARCH_LEG_MAX = 50;
const ARCH_SPAN_HALF_H = 4;
const ARCH_SPAN_HALF_W = ARCH_LEG_DX + ARCH_LEG_HALF_W; // a trave cobre as duas pernas

/** Tags das peças do arco (a arte real pode diferenciá-las sem tocar no core). */
export const ARCH_LEG_TAG = 'obstacle.rock_arch.leg';
export const ARCH_SPAN_TAG = 'obstacle.rock_arch.span';
```

E as 3 entradas novas ao final do array `OBSTACLE_CATALOG`:

```ts
  // Agulha rochosa flutuante: estreita e alta ⇒ decide-se passar por cima ou por baixo.
  { id: 'obstacle.spire', anchor: 'floating', makeHitbox: (rng) => aabb(rng.range(4, 6), rng.range(24, 34)) },
  // Par chão+teto no mesmo x, com fresta no meio (composto de 2 peças).
  {
    id: 'obstacle.gate',
    makePieces: (rng, field) => {
      const gap = rng.range(GATE_GAP_MIN, GATE_GAP_MAX);
      const top = field.yMargin;
      const bottom = field.worldHeight - field.yMargin;
      const tMin = top + GATE_ARM_MIN;
      const tMax = bottom - gap - GATE_ARM_MIN;
      // Sempre consome exatamente 1 saque (estabilidade do stream), como placeY faz no floating.
      const u = rng.next();
      const t = tMax > tMin ? tMin + u * (tMax - tMin) : (tMin + tMax) / 2;
      const ceilH = t - top;
      const floorH = bottom - (t + gap);
      return [
        { hitbox: aabb(GATE_HALF_W, ceilH / 2), dx: 0, y: top + ceilH / 2 },
        { hitbox: aabb(GATE_HALF_W, floorH / 2), dx: 0, y: bottom - floorH / 2 },
      ];
    },
  },
  // Arco de pedra: 2 pernas no chão + trave. O "buraco" (não-convexo) sai de 3 peças convexas —
  // é o obstacle.rock_arch adiado no item 1.4.
  {
    id: 'obstacle.rock_arch',
    makePieces: (rng, field) => {
      const bottom = field.worldHeight - field.yMargin;
      const legH = rng.range(ARCH_LEG_MIN, ARCH_LEG_MAX);
      const legHalfH = legH / 2;
      const legY = bottom - legHalfH;
      return [
        { hitbox: aabb(ARCH_LEG_HALF_W, legHalfH), dx: -ARCH_LEG_DX, y: legY, tag: ARCH_LEG_TAG },
        { hitbox: aabb(ARCH_LEG_HALF_W, legHalfH), dx: ARCH_LEG_DX, y: legY, tag: ARCH_LEG_TAG },
        {
          hitbox: aabb(ARCH_SPAN_HALF_W, ARCH_SPAN_HALF_H),
          dx: 0,
          y: bottom - legH - ARCH_SPAN_HALF_H,
          tag: ARCH_SPAN_TAG,
        },
      ];
    },
  },
```

- [ ] **Step 4: Rodar os testes de justiça**

Run: `npm test -- tests/core/spawn`
Esperado: PASS.

- [ ] **Step 5: Re-pinar os goldens de replay**

Os 3 cenários **com seed** de `tests/determinism/replay.determinism.test.ts` mudam (catálogo 4 → 7
tipos altera `rng.pick`). O cenário "sem seed — só física até a morte" **não muda** (mundo sem
spawner) — se ele mudar, é bug: pare e investigue.

Capturar os hashes novos:

```bash
npm test -- tests/determinism/replay.determinism.test.ts 2>&1 | grep -A2 "expected"
```

Substituir os campos `golden` dos 3 cenários com seed pelos valores observados. **Não** alterar o
golden do cenário sem seed. Depois:

Run: `npm run test:determinism`
Esperado: PASS (67 testes; nenhum teste novo de determinismo é necessário — os existentes já
exercitam o catálogo novo).

- [ ] **Step 6: Regenerar o bundle da Edge Function**

```bash
npm run build:edge
git diff --stat supabase/functions/verify-challenge/_verify.bundle.js
```
Esperado: o bundle muda (contém o catálogo). Se não mudar, o bundle não está pegando `@core/spawn`
— pare e investigue.

- [ ] **Step 7: Suíte completa + typecheck**

Run: `npm test && npm run check`
Esperado: tudo verde. (`tests/render/manifest.test.ts` pode falhar por falta de entrada no
manifesto — isso é a Task 3; se falhar, deixe registrado e siga.)

- [ ] **Step 8: Commit**

```bash
git add src/core/spawn/catalog.ts tests/core/spawn/catalog.test.ts \
  tests/determinism/replay.determinism.test.ts supabase/functions/verify-challenge/_verify.bundle.js
git commit -m "feat(9.8): spire, gate e rock_arch no catálogo + goldens re-pinados"
```

---

### Task 3: Manifesto de render (placeholder primitivo) + guarda de completude

**Files:**
- Modify: `src/render/manifest.ts` (4 entradas `kind:'primitive'`)
- Modify: `tests/render/manifest.test.ts` (guarda cobrindo tags de peça)

**Interfaces:**
- Consumes: ids/tags da Task 2 (`obstacle.spire`, `obstacle.gate`, `obstacle.rock_arch.leg`,
  `obstacle.rock_arch.span`), `SpawnField` (`@core/spawn`).
- Produces: nada para tasks seguintes além das entradas de manifesto.

Contexto: `drawSpriteEntity` já cai em `drawEntity`→`drawPrimitive` quando o manifesto não é
sprite, e `drawPrimitive` desenha **exatamente a hitbox** ⇒ cobertura perfeita (REGRA 2) enquanto a
arte real não chega. O id **bare** `obstacle.rock_arch` não recebe entrada: nenhuma entidade carrega
essa tag (as peças têm tags próprias).

- [ ] **Step 1: Escrever a guarda que falha**

Substituir o teste "COMPLETUDE" de `tests/render/manifest.test.ts` por:

```ts
import { createRng } from '@core/rng';
import type { SpawnField } from '@core/spawn';

const FIELD: SpawnField = { worldHeight: 180, yMargin: 8 };

/** Tags que o gerador de fato coloca em `entity.tags[0]` — para tipo composto, as tags das peças. */
function emittedTags(catalog: readonly { id: string; makePieces?: unknown }[]): string[] {
  const out: string[] = [];
  for (const t of catalog) {
    const composite = t as { id: string; makePieces?: (rng: ReturnType<typeof createRng>, f: SpawnField) => readonly { tag?: string }[] };
    if (composite.makePieces === undefined) { out.push(t.id); continue; }
    const rng = createRng('manifest-guard');
    for (const p of composite.makePieces(rng, FIELD)) out.push(p.tag ?? t.id);
  }
  return out;
}

  it('COMPLETUDE: toda tag emitida pelos catálogos + o dino têm entrada no manifesto', () => {
    const ids = [
      DINO_TYPE_ID,
      ...emittedTags(OBSTACLE_CATALOG),
      ...emittedTags(COLLECTIBLE_CATALOG),
      ...emittedTags(POWERUP_CATALOG),
    ];
    for (const id of ids) {
      expect(ASSET_MANIFEST[id], `id sem entrada no manifesto: ${id}`).toBeDefined();
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/render/manifest.test.ts`
Esperado: FAIL ("id sem entrada no manifesto: obstacle.spire").

- [ ] **Step 3: Adicionar as entradas em `src/render/manifest.ts`**

Logo depois de `'obstacle.stalactite'`:

```ts
  // 9.8: entram contra placeholder primitivo (desenha a hitbox exata ⇒ cobertura perfeita).
  // A arte real dropa depois trocando estas entradas por sprites do atlas (asset-specs em
  // docs/assets/specs/obstacle.{spire,gate,rock_arch}.md).
  'obstacle.spire': { kind: 'primitive', color: 0x8a8f98 },
  'obstacle.gate': { kind: 'primitive', color: 0x6b5a44 },
  'obstacle.rock_arch.leg': { kind: 'primitive', color: 0x7a6a55 },
  'obstacle.rock_arch.span': { kind: 'primitive', color: 0x7a6a55 },
```

- [ ] **Step 4: Rodar os testes de render**

Run: `npm test -- tests/render && npm run check`
Esperado: PASS (o teste de atlas ignora `kind:'primitive'`; nenhum frame novo é exigido).

- [ ] **Step 5: Commit**

```bash
git add src/render/manifest.ts tests/render/manifest.test.ts
git commit -m "feat(9.8): manifesto dos obstáculos novos (placeholder primitivo) + guarda de peças"
```

---

### Task 4: Asset-specs, brief de arte e fechamento de docs

**Files:**
- Create: `docs/assets/specs/obstacle.spire.md`
- Create: `docs/assets/specs/obstacle.gate.md`
- Create: `docs/assets/specs/obstacle.rock_arch.md`
- Modify: `docs/assets/asset-registry.md` (registrar os 3; `rock_arch` sai de "placeholder")
- Modify: `docs/assets/PHASE-09-ART-BRIEF.md` (prompts dos 3, por tema)
- Modify: `docs/roadmap/PHASE-09-structural-improvements.md` (marcar 9.8 `[x]`)
- Modify: `CLAUDE.md` (campo "Estado atual")

**Interfaces:**
- Consumes: ids/tags e dimensões lógicas da Task 2.
- Produces: nada (documentação).

- [ ] **Step 1: Ler os specs existentes para copiar o formato**

Abrir `docs/assets/specs/obstacle.tree.md` e `docs/assets/specs/obstacle.stalactite.md` e seguir a
mesma estrutura de seções, incluindo a regra "arte cobre a hitbox, nunca a define".

- [ ] **Step 2: Escrever os 3 asset-specs**

Conteúdo obrigatório de cada um: id lógico, âncora, faixa de dimensões da hitbox em unidades de
mundo (spire: 8–12 × 48–68; gate: 10 de largura por braço, fresta 38–52; rock_arch: pernas 10 × 34–50
em dx ±18, trave 46 × 8), estratégia de composição (`gate` e `rock_arch` são **peças separadas**,
uma imagem por peça: `obstacle.rock_arch.leg`, `obstacle.rock_arch.span`, `obstacle.gate`),
variação por tema (classic/volcano/glacier) e a nota de que a arte deve **preencher** a hitbox
(precedente 9.2 — composição por segmentos para peças de altura variável).

- [ ] **Step 3: Registrar em `docs/assets/asset-registry.md`**

Adicionar as 3 linhas na tabela, no formato já usado. `obstacle.rock_arch` deixa de ser
"placeholder adiado (1.4)" e passa a apontar para o spec novo.

- [ ] **Step 4: Prompts no brief de arte**

Acrescentar uma seção "9.8 — obstáculos novos" em `docs/assets/PHASE-09-ART-BRIEF.md` com um prompt
por peça e por tema, seguindo as regras gerais já escritas no apêndice do arquivo da fase
(fundo transparente/chroma, sem texto, sem sombra projetada, tileável na vertical onde a peça
repete).

- [ ] **Step 5: Marcar o item e atualizar o estado**

Em `docs/roadmap/PHASE-09-structural-improvements.md`, marcar os dois checkboxes de 9.8 como `[x]`.
Em `CLAUDE.md`, atualizar o bloco "Estado atual": métricas (nº de testes após `npm test`), Frente D
com 9.8 ✅ e o resumo de uma linha (composição por peças convexas + goldens re-pinados).

- [ ] **Step 6: Verificação final**

Run: `npm test && npm run check && npm run test:determinism`
Esperado: tudo verde. Anotar os números reais (testes totais / determinismo) para o `CLAUDE.md`.

- [ ] **Step 7: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs(9.8): asset-specs dos obstáculos novos + brief de arte + fechamento do item"
```

---

## Self-Review

- **Cobertura da spec:** mecanismo de peças (T1) · 3 tipos + justiça + goldens + bundle edge (T2) ·
  manifesto/placeholder + guarda de completude (T3) · asset-specs/registry/brief/docs (T4).
  Item "regressão de RNG do caminho simples" da spec ⇒ coberto pelo Step 5 da T1 (goldens passam
  **sem** re-pin quando só o mecanismo entra) — é a prova mais forte possível.
- **Sem placeholders:** todo passo de código traz o código.
- **Consistência de tipos:** `SpawnPiece`/`SpawnField`/`SpawnType` definidos na T1 são exatamente os
  usados na T2 e T3; tags `obstacle.rock_arch.leg`/`.span` idênticas nas T2/T3/T4.
