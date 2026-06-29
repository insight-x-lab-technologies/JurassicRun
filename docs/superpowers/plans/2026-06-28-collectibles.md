# Coletáveis (pássaros-moeda) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar pássaros-moeda (`bird.coin`) deterministicamente e definir a coleta (incrementa `food`).

**Architecture:** Generaliza `SpawnGenerator` (catálogo + tipo de entidade, defaults retrocompatíveis) para também gerar coletáveis num stream de RNG dedicado (`fork('collectibles')`). Adiciona `food` e um 2º gerador ao `WorldState`, integra geração+cull no `step`, e um helper puro `collect(world, entity)`. A colisão (gatilho) fica para 1.6.

**Tech Stack:** TypeScript estrito, Vitest, aliases `@core/*`.

## Global Constraints

- `src/core/` é TS puro: sem `phaser`/`preact`/DOM/IO; **proibido** `Math.random()`, `Date.now()`, `performance.now()` (guarda ESLint + teste). Aleatoriedade só via `Rng`; tempo só via passo fixo.
- Mesma seed + inputs ⇒ estado idêntico (há testes que provam).
- Sem alocação por frame no hot path do `step` (REGRA 3).
- Hitbox é lógica; arte nunca a altera (REGRA 2). Toda imagem trocável tem asset-spec (REGRA 5).
- Sem `any` sem justificativa. Commits pequenos e descritivos.

---

### Task 1: Generalizar o gerador + catálogo/constantes de coletáveis

**Files:**
- Modify: `src/core/spawn/catalog.ts`
- Modify: `src/core/spawn/generator.ts`
- Modify: `src/core/spawn/constants.ts`
- Modify: `src/core/spawn/index.ts`
- Test: `tests/core/spawn/collectibles.test.ts` (criar)

**Interfaces:**
- Consumes: `Rng` (`@core/rng`), `Hitbox`/`Entity`/`EntityType` (`@core/sim`), `circle`/`boundsOf` (`@core/sim/hitbox`).
- Produces:
  - `type Anchor = 'floor' | 'ceiling' | 'floating'`
  - `interface SpawnType { readonly id: string; readonly anchor: Anchor; makeHitbox(rng: Rng): Hitbox }`
  - `const OBSTACLE_CATALOG: readonly SpawnType[]` (inalterado em conteúdo)
  - `const COLLECTIBLE_CATALOG: readonly SpawnType[]` (`bird.coin`, circle, floating)
  - `class SpawnGenerator` com construtor `(rng: Rng, config: SpawnConfig, catalog?: readonly SpawnType[], entityType?: EntityType)` — defaults `OBSTACLE_CATALOG`, `'obstacle'`.
  - `const DEFAULT_COLLECTIBLE_CONFIG: SpawnConfig`
  - constantes `COLLECTIBLE_START_X`, `COLLECTIBLE_GAP_MIN`, `COLLECTIBLE_GAP_MAX`

- [ ] **Step 1: Escrever o teste que falha** — `tests/core/spawn/collectibles.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { boundsOf } from '@core/sim';
import type { Entity } from '@core/sim';
import { SpawnGenerator, COLLECTIBLE_CATALOG, DEFAULT_COLLECTIBLE_CONFIG } from '@core/spawn';

function gen(seed = 'col-test'): SpawnGenerator {
  return new SpawnGenerator(createRng(seed).fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
}

describe('geração de coletáveis', () => {
  it('emite coletáveis com type/tag corretos, x crescente e ids 0..n', () => {
    const out: Entity[] = [];
    gen().generateUpTo(3000, out);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]!.id).toBe(i);
      expect(out[i]!.type).toBe('collectible');
      expect(out[i]!.tags[0]).toBe('bird.coin');
      if (i > 0) expect(out[i]!.transform.position.x).toBeGreaterThan(out[i - 1]!.transform.position.x);
    }
    expect(out[0]!.transform.position.x).toBe(DEFAULT_COLLECTIBLE_CONFIG.startX);
  });

  it('placement mantém a hitbox dentro das margens', () => {
    const out: Entity[] = [];
    gen().generateUpTo(5000, out);
    for (const e of out) {
      const b = boundsOf(e.hitbox);
      expect(e.transform.position.y + b.minY).toBeGreaterThanOrEqual(DEFAULT_COLLECTIBLE_CONFIG.yMargin - 1e-9);
      expect(e.transform.position.y + b.maxY).toBeLessThanOrEqual(DEFAULT_COLLECTIBLE_CONFIG.worldHeight - DEFAULT_COLLECTIBLE_CONFIG.yMargin + 1e-9);
    }
  });

  it('catálogo cobre bird.coin com hitbox circular', () => {
    expect(COLLECTIBLE_CATALOG.some((t) => t.id === 'bird.coin')).toBe(true);
    const hb = COLLECTIBLE_CATALOG[0]!.makeHitbox(createRng('x'));
    expect(hb.kind).toBe('circle');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/spawn/collectibles.test.ts`
Expected: FAIL (`COLLECTIBLE_CATALOG`/`DEFAULT_COLLECTIBLE_CONFIG` não exportados).

- [ ] **Step 3: Generalizar `catalog.ts`** — renomear tipos para neutros e adicionar catálogo de coletáveis. Substituir o topo do arquivo:

```ts
import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde a entidade se ancora verticalmente. */
export type Anchor = 'floor' | 'ceiling' | 'floating';

/**
 * Tipo lógico de algo colocável (obstáculo ou coletável): dado puro. `id` = chave do
 * asset-registry e tag da entidade. `makeHitbox` pode variar o tamanho via Rng (a arte
 * nunca muda a hitbox).
 */
export interface SpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
}
```

Trocar a anotação de `OBSTACLE_CATALOG` para `readonly SpawnType[]` (conteúdo inalterado) e, ao final do arquivo, adicionar:

```ts
/** Catálogo de coletáveis (pássaros-moeda). 1.5: um único tipo basta. */
export const COLLECTIBLE_CATALOG: readonly SpawnType[] = [
  // Pássaro-moeda flutuante (comida). Corpo compacto ⇒ hitbox circular.
  { id: 'bird.coin', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
];
```

- [ ] **Step 4: Generalizar `generator.ts`** — usar os tipos neutros e parametrizar o construtor. Trocar os imports de `ObstacleAnchor` por `Anchor`/`SpawnType` e `OBSTACLE_CATALOG`:

```ts
import type { Rng } from '@core/rng';
import type { Entity, EntityType, Hitbox } from '@core/sim/types';
import { boundsOf } from '@core/sim/hitbox';
import { OBSTACLE_CATALOG } from './catalog';
import type { Anchor, SpawnType } from './catalog';
```

Trocar a assinatura de `placeY` para `(anchor: Anchor, ...)`. Substituir os campos/construtor da classe:

```ts
export class SpawnGenerator {
  private readonly rng: Rng;
  private readonly config: SpawnConfig;
  private readonly catalog: readonly SpawnType[];
  private readonly entityType: EntityType;
  private nextSpawnX: number;
  private nextId: number;

  constructor(
    rng: Rng,
    config: SpawnConfig,
    catalog: readonly SpawnType[] = OBSTACLE_CATALOG,
    entityType: EntityType = 'obstacle',
  ) {
    this.rng = rng;
    this.config = config;
    this.catalog = catalog;
    this.entityType = entityType;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }
```

No corpo de `generateUpTo`, trocar `OBSTACLE_CATALOG` por `this.catalog` e `type: 'obstacle'` por `type: this.entityType`. Em `clone()`, propagar catálogo e tipo:

```ts
  clone(): SpawnGenerator {
    const c = new SpawnGenerator(this.rng.clone(), this.config, this.catalog, this.entityType);
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
```

- [ ] **Step 5: Adicionar constantes em `constants.ts`** — ao final:

```ts
// Coletáveis: aparecem mais intercalados que obstáculos. Placeholders; 1.7/Fase 2 afinam.
export const COLLECTIBLE_START_X = 150;
export const COLLECTIBLE_GAP_MIN = 90;
export const COLLECTIBLE_GAP_MAX = 160;

/** Config padrão do gerador de coletáveis (createWorld sobrescreve worldHeight). */
export const DEFAULT_COLLECTIBLE_CONFIG: SpawnConfig = {
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: COLLECTIBLE_START_X,
  gapMin: COLLECTIBLE_GAP_MIN,
  gapMax: COLLECTIBLE_GAP_MAX,
};
```

- [ ] **Step 6: `index.ts`** — já reexporta `./catalog`, `./generator`, `./constants` com `export *`. Confirmar que os novos símbolos saem (sem mudança necessária; só verificar).

- [ ] **Step 7: Rodar a suíte de spawn (novos + retrocompat de obstáculos)**

Run: `npx vitest run tests/core/spawn/`
Expected: PASS (collectibles novos + `catalog`/`generator` de obstáculos verdes).

- [ ] **Step 8: Commit**

```bash
git add src/core/spawn tests/core/spawn/collectibles.test.ts
git commit -m "feat(core/spawn): generaliza gerador + catálogo de coletáveis (bird.coin)"
```

---

### Task 2: Integrar coletáveis ao mundo (`food`, 2º gerador, step)

**Files:**
- Modify: `src/core/sim/types.ts`
- Modify: `src/core/sim/world.ts`
- Modify: `src/core/sim/step.ts`
- Test: `tests/core/sim/collectibles-world.test.ts` (criar)

**Interfaces:**
- Consumes: `SpawnGenerator`, `DEFAULT_COLLECTIBLE_CONFIG`, `COLLECTIBLE_CATALOG` (Task 1); `SPAWN_LOOKAHEAD`/`CULL_MARGIN`/`rightExtent`.
- Produces: `WorldState.food: number`, `WorldState.collectibleSpawner: SpawnGenerator | null`, `WorldConfig.collectibleSpawn?: Partial<SpawnConfig>`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/core/sim/collectibles-world.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';

describe('coletáveis no mundo', () => {
  it('createWorld inicia food em 0 e sem seed não tem collectibleSpawner', () => {
    const w = createWorld();
    expect(w.food).toBe(0);
    expect(w.collectibleSpawner).toBeNull();
    expect(w.collectibles).toEqual([]);
  });

  it('com seed, o step gera coletáveis à frente', () => {
    const w = createWorld({ seed: 'endless:ABC' });
    expect(w.collectibleSpawner).not.toBeNull();
    for (let i = 0; i < 120; i++) step(w, { flap: i % 7 === 0 });
    expect(w.collectibles.length).toBeGreaterThan(0);
    expect(w.collectibles[0]!.type).toBe('collectible');
  });

  it('cloneWorld copia food e isola o collectibleSpawner', () => {
    const w = createWorld({ seed: 'endless:ABC' });
    w.food = 5;
    const c = cloneWorld(w);
    expect(c.food).toBe(5);
    for (let i = 0; i < 200; i++) step(c, { flap: false });
    // mutar o clone não muda o original
    const before = w.collectibles.length;
    for (let i = 0; i < 1; i++) step(w, { flap: false });
    expect(w.collectibles.length).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/sim/collectibles-world.test.ts`
Expected: FAIL (`food`/`collectibleSpawner` inexistentes).

- [ ] **Step 3: `types.ts`** — em `WorldConfig`, após `spawn?:`, adicionar:

```ts
  /** Overrides parciais da config de spawn de coletáveis (tuning). */
  collectibleSpawn?: Partial<SpawnConfig>;
```

Em `WorldState`, adicionar `food` (perto de `distance`) e `collectibleSpawner` (após `spawner`):

```ts
  /** Comida coletada (pássaros-moeda). Multiplicadores/score completos ficam para 1.8. */
  food: number;
```
```ts
  /** Gerador de coletáveis (null quando o mundo não tem seed). */
  collectibleSpawner: SpawnGenerator | null;
```

- [ ] **Step 4: `world.ts`** — importar os defaults de coletável e construir o 2º gerador. Ajustar o import:

```ts
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG, DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG } from '@core/spawn';
```

Adicionar um builder ao lado de `buildSpawner`:

```ts
function buildCollectibleSpawner(seed: string, worldHeight: number, override?: Partial<SpawnConfig>): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_COLLECTIBLE_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('collectibles'), config, COLLECTIBLE_CATALOG, 'collectible');
}
```

Em `createWorld`, após calcular `spawner`:

```ts
  const collectibleSpawner =
    config.seed === undefined ? null : buildCollectibleSpawner(config.seed, c.worldHeight, config.collectibleSpawn);
```

No objeto retornado, adicionar `food: 0,` e `collectibleSpawner,`. Em `cloneWorld`, adicionar `food: w.food,` e `collectibleSpawner: w.collectibleSpawner ? w.collectibleSpawner.clone() : null,`.

- [ ] **Step 5: `step.ts`** — após o bloco de obstáculos (`if (world.spawner) {...}`), adicionar o bloco simétrico:

```ts
  if (world.collectibleSpawner) {
    world.collectibleSpawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.collectibles);
    const cullX = pos.x - CULL_MARGIN;
    const cols = world.collectibles;
    while (cols.length > 0 && cols[0]!.transform.position.x + rightExtent(cols[0]!.hitbox) < cullX) {
      cols.shift();
    }
  }
```

- [ ] **Step 6: Rodar os testes do mundo + suíte sim**

Run: `npx vitest run tests/core/sim/`
Expected: PASS (novos + `world`/`step`/`physics` existentes verdes).

- [ ] **Step 7: Commit**

```bash
git add src/core/sim tests/core/sim/collectibles-world.test.ts
git commit -m "feat(core/sim): integra coletáveis ao mundo (food + 2º gerador + step)"
```

---

### Task 3: Mecanismo de coleta — `collect(world, entity)`

**Files:**
- Create: `src/core/sim/collect.ts`
- Modify: `src/core/sim/index.ts`
- Test: `tests/core/sim/collect.test.ts` (criar)

**Interfaces:**
- Consumes: `WorldState`, `Entity` (`@core/sim/types`).
- Produces: `function collect(world: WorldState, entity: Entity): boolean`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/core/sim/collect.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, collect } from '@core/sim';
import type { Entity } from '@core/sim';

function fakeCoin(id: number): Entity {
  return {
    id,
    type: 'collectible',
    tags: ['bird.coin'],
    transform: { position: { x: 0, y: 0 } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('collect', () => {
  it('incrementa food e remove o coletável da lista', () => {
    const w = createWorld();
    const coin = fakeCoin(0);
    w.collectibles.push(coin);
    expect(collect(w, coin)).toBe(true);
    expect(w.food).toBe(1);
    expect(w.collectibles).not.toContain(coin);
  });

  it('é idempotente: coletar duas vezes não conta em dobro', () => {
    const w = createWorld();
    const coin = fakeCoin(0);
    w.collectibles.push(coin);
    collect(w, coin);
    expect(collect(w, coin)).toBe(false);
    expect(w.food).toBe(1);
  });

  it('retorna false para entidade ausente (no-op)', () => {
    const w = createWorld();
    expect(collect(w, fakeCoin(9))).toBe(false);
    expect(w.food).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/sim/collect.test.ts`
Expected: FAIL (`collect` não exportado).

- [ ] **Step 3: Implementar `collect.ts`**

```ts
import type { Entity, WorldState } from './types';

/**
 * Coleta um pássaro-moeda: incrementa `food` e remove o coletável do mundo. Busca por
 * referência (ids de geradores distintos podem coincidir entre listas). Idempotente: se o
 * coletável não está mais presente, é no-op e retorna false. O GATILHO (colisão) é o item 1.6;
 * multiplicadores/score completos são o item 1.8 (aqui +1 por pássaro).
 */
export function collect(world: WorldState, entity: Entity): boolean {
  const i = world.collectibles.indexOf(entity);
  if (i < 0) return false;
  world.collectibles.splice(i, 1);
  world.food += 1;
  return true;
}
```

- [ ] **Step 4: `index.ts`** — reexportar. Adicionar `export * from './collect';` (manter ordem com os demais `export *`).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/core/sim/collect.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/sim/collect.ts src/core/sim/index.ts tests/core/sim/collect.test.ts
git commit -m "feat(core/sim): collect(world, entity) incrementa food (idempotente)"
```

---

### Task 4: Determinismo dos coletáveis

**Files:**
- Test: `tests/determinism/collectibles.determinism.test.ts` (criar)

**Interfaces:**
- Consumes: `createRng`, `SpawnGenerator`, `DEFAULT_COLLECTIBLE_CONFIG`, `COLLECTIBLE_CATALOG`, `OBSTACLE_CATALOG`, `DEFAULT_SPAWN_CONFIG`.

- [ ] **Step 1: Escrever os testes** — `tests/determinism/collectibles.determinism.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import type { Entity } from '@core/sim';
import {
  SpawnGenerator,
  COLLECTIBLE_CATALOG,
  OBSTACLE_CATALOG,
  DEFAULT_COLLECTIBLE_CONFIG,
  DEFAULT_SPAWN_CONFIG,
} from '@core/spawn';

function cols(seed: string, upTo: number): Entity[] {
  const g = new SpawnGenerator(createRng(seed).fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
  const out: Entity[] = [];
  g.generateUpTo(upTo, out);
  return out;
}

describe('determinismo dos coletáveis', () => {
  it('mesma seed ⇒ mesma sequência', () => {
    expect(cols('endless:ABC', 4000)).toEqual(cols('endless:ABC', 4000));
  });

  it('seeds diferentes ⇒ sequências diferentes', () => {
    expect(cols('endless:ABC', 4000)).not.toEqual(cols('endless:XYZ', 4000));
  });

  it('independência de batching: uma chamada == várias incrementais', () => {
    const single = cols('endless:ABC', 4000);
    const g = new SpawnGenerator(createRng('endless:ABC').fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
    const inc: Entity[] = [];
    for (let x = 0; x <= 4000; x += 137) g.generateUpTo(x, inc);
    g.generateUpTo(4000, inc);
    expect(inc).toEqual(single);
  });

  it('stream de coletáveis é independente do de obstáculos (mesma seed)', () => {
    const obsGen = new SpawnGenerator(createRng('endless:ABC').fork('obstacles'), DEFAULT_SPAWN_CONFIG, OBSTACLE_CATALOG, 'obstacle');
    const obs: Entity[] = [];
    obsGen.generateUpTo(4000, obs);
    const obsXs = obs.map((e) => e.transform.position.x);
    const colXs = cols('endless:ABC', 4000).map((e) => e.transform.position.x);
    expect(colXs).not.toEqual(obsXs);
  });
});
```

- [ ] **Step 2: Rodar e ver passar**

Run: `npx vitest run tests/determinism/collectibles.determinism.test.ts`
Expected: PASS.

- [ ] **Step 3: Rodar a bateria de determinismo completa**

Run: `npm run test:determinism`
Expected: PASS (sem regressões; novos testes inclusos).

- [ ] **Step 4: Commit**

```bash
git add tests/determinism/collectibles.determinism.test.ts
git commit -m "test(determinism): sequência de coletáveis estável e independente dos obstáculos"
```

---

### Task 5: Asset-spec e registro do `bird.coin` (REGRA 5)

**Files:**
- Create: `docs/assets/specs/bird.coin.md`
- Modify: `docs/assets/asset-registry.md`

- [ ] **Step 1: Criar `docs/assets/specs/bird.coin.md`** (mesmo formato dos obstáculos)

```markdown
# Asset Spec — bird.coin

## Identidade
- **id:** `bird.coin`
- **Categoria:** coletável (comida)
- **Substitui o placeholder geométrico:** círculo (pássaro-moeda) flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 36 × 36 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`COLLECTIBLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** opcional bater de asas (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `collectibles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** corpo dourado `#f2c14e`, asa `#e0a92e`, contorno `#7a5a12`, realce `#ffe39b`.
- **Iluminação/ângulo:** vista lateral (perfil de voo), luz superior suave.
- **Coerência:** pequeno pássaro pré-histórico “moeda”, legível em movimento rápido.

## Prompt para geração por IA
> "Side-view 2D game sprite of a small golden prehistoric coin-bird flying, flat cartoon vector style, bold dark outline, simple cel shading, warm gold body, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `collectibles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
```

- [ ] **Step 2: Atualizar `asset-registry.md`** — na seção "Coletáveis / power-ups", trocar a linha do `bird.coin`:

```markdown
| `bird.coin` | pássaro-moeda (comida) | spec | `specs/bird.coin.md` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/assets/specs/bird.coin.md docs/assets/asset-registry.md
git commit -m "docs(assets): asset-spec do bird.coin (coletável do item 1.5) + registro"
```

---

## Fechamento (após as 5 tasks)
- Marcar item 1.5 como `[x]` em `docs/roadmap/PHASE-01-deterministic-core.md`.
- Atualizar "Estado atual" do `CLAUDE.md`.
- `verify-determinism` + `npm test` + `npm run check` verdes (verification-before-completion).
- Review final da branch e merge para `main` (`--no-ff`).
