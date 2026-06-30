# Replay / Golden Master (Item 1.9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao núcleo um replay headless (`simulate(config, timeline)`) e um hash canônico do estado (`hashState`), e fixar um golden master de regressão de determinismo.

**Architecture:** Novo módulo-folha puro `src/core/replay/` que compõe `createWorld`+`step` (replay) e percorre o `WorldState` numa ordem fixa codificando números pelos bits IEEE-754 (via `DataView` little-endian explícito) num digest de 128 bits estilo xmur3. Nenhuma mudança em `sim`/`spawn`/`rng`. Um teste de determinismo pina hashes de cenários `(seed, timeline)` conhecidos.

**Tech Stack:** TypeScript estrito, Vitest. Aliases `@core/*`. Sem dependências novas.

## Global Constraints

- **REGRA 1 (determinismo):** `src/core/` é TS puro. PROIBIDO `Math.random()`, `Date.now()`, `performance.now()`. Só `Math.imul`/`>>>`/`DataView`/typed arrays. (Guarda ESLint + teste `tests/determinism/no-forbidden-apis.determinism.test.ts`.)
- **REGRA 2:** colisão/estado usa hitbox lógica, nunca pixels.
- **REGRA 3:** sem alocação por palavra no encoder; `simulate` só chama `step`. (Hash não é hot-path do jogo.)
- TypeScript estrito, sem `any` sem justificativa. Imports via aliases `@core/*`.
- Testes unit em `tests/core/replay/`; golden em `tests/determinism/`.
- Endianness FIXA: usar `DataView` com flag `littleEndian = true` em todas as leituras/escritas de float (portabilidade do golden entre engines/plataformas).
- Commits pequenos, um por task. Mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Replay runner (`simulate` + `InputTimeline`)

**Files:**
- Create: `src/core/replay/timeline.ts`
- Create: `src/core/replay/simulate.ts`
- Create: `src/core/replay/index.ts`
- Test: `tests/core/replay/simulate.test.ts`

**Interfaces:**
- Consumes: `createWorld`, `step`, `WorldConfig`, `WorldState`, `InputFrame` de `@core/sim`.
- Produces:
  - `type InputTimeline = readonly InputFrame[]`
  - `function buildTimeline(length: number, pattern: (i: number) => boolean): InputTimeline`
  - `function simulate(config: WorldConfig, timeline: InputTimeline): WorldState`

- [ ] **Step 1: Write the failing test**

`tests/core/replay/simulate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';
import { simulate, buildTimeline } from '@core/replay';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:SIMTEST',
};

describe('buildTimeline', () => {
  it('cria frames com flap conforme o pattern', () => {
    const tl = buildTimeline(5, (i) => i % 2 === 0);
    expect(tl.map((f) => f.flap)).toEqual([true, false, true, false, true]);
  });

  it('length 0 ⇒ timeline vazia', () => {
    expect(buildTimeline(0, () => true)).toEqual([]);
  });
});

describe('simulate', () => {
  it('equivale a createWorld + step manuais', () => {
    const tl = buildTimeline(300, (i) => i % 9 === 0);
    const manual = createWorld(CONFIG);
    for (const f of tl) step(manual, f);
    const replayed = simulate(CONFIG, tl);
    expect(replayed).toEqual(manual);
  });

  it('timeline vazia ⇒ estado inicial', () => {
    expect(simulate(CONFIG, [])).toEqual(createWorld(CONFIG));
  });

  it('reprodutível: duas chamadas iguais ⇒ estados iguais', () => {
    const tl = buildTimeline(500, (i) => i % 7 === 0);
    expect(simulate(CONFIG, tl)).toEqual(simulate(CONFIG, tl));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/replay/simulate.test.ts`
Expected: FAIL — `Cannot find module '@core/replay'` / `simulate is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/core/replay/timeline.ts`:

```ts
import type { InputFrame } from '@core/sim';

/** Sequência de inputs de um replay headless (um frame por step de simulação). */
export type InputTimeline = readonly InputFrame[];

/** Constrói uma timeline de `length` frames; flap quando `pattern(i)` é true. Determinístico. */
export function buildTimeline(length: number, pattern: (i: number) => boolean): InputTimeline {
  const out: InputFrame[] = new Array<InputFrame>(length);
  for (let i = 0; i < length; i++) out[i] = { flap: pattern(i) };
  return out;
}
```

`src/core/replay/simulate.ts`:

```ts
import { createWorld, step } from '@core/sim';
import type { WorldConfig, WorldState } from '@core/sim';
import type { InputTimeline } from './timeline';

/**
 * Roda a simulação headless do início ao fim a partir de `config` (com seed) e uma timeline
 * de inputs, devolvendo o `WorldState` final. Pura: toda aleatoriedade vem de `config.seed`
 * e o tempo é o passo fixo da simulação. fps-independente (garantido por `step`).
 */
export function simulate(config: WorldConfig, timeline: InputTimeline): WorldState {
  const world = createWorld(config);
  for (const frame of timeline) step(world, frame);
  return world;
}
```

`src/core/replay/index.ts`:

```ts
export * from './timeline';
export * from './simulate';
```

Se `@core/replay` ainda não resolver, confirmar o padrão de alias em `tsconfig.json`/`vitest.config.ts` (mesmo dos outros módulos `@core/*`); nenhum novo alias deve ser necessário (todos usam `@core/*` → `src/core/*`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/replay/simulate.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/replay/timeline.ts src/core/replay/simulate.ts src/core/replay/index.ts tests/core/replay/simulate.test.ts
git commit -m "feat(1.9): replay runner headless (simulate + InputTimeline)"
```

---

### Task 2: Hash canônico do estado (`hashState`)

**Files:**
- Create: `src/core/replay/hash.ts`
- Modify: `src/core/replay/index.ts` (re-export do hash)
- Test: `tests/core/replay/hash.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `Entity`, `Hitbox`, `Vec2`, `Pterodactyl` de `@core/sim`; `createWorld`/`step` de `@core/sim` (para montar estados de teste).
- Produces: `function hashState(world: WorldState): string` — 32 chars hex (128 bits).

- [ ] **Step 1: Write the failing test**

`tests/core/replay/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { WorldConfig, WorldState } from '@core/sim';
import { hashState } from '@core/replay';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:HASHTEST',
};

function advanced(n: number, flapEvery = 6): WorldState {
  const w = createWorld(CONFIG);
  for (let i = 0; i < n; i++) step(w, { flap: i % flapEvery === 0 });
  return w;
}

describe('hashState — formato', () => {
  it('retorna 32 chars hexadecimais', () => {
    const h = hashState(createWorld(CONFIG));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('hashState — determinismo', () => {
  it('mesmo estado ⇒ mesmo hash', () => {
    expect(hashState(advanced(400))).toBe(hashState(advanced(400)));
  });
});

describe('hashState — sensibilidade', () => {
  it('detecta mudança em escalar inteiro (food)', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.food += 1;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta mudança float minúscula (distance += 1e-9)', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.distance += 1e-9;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta mudança numa posição de obstáculo', () => {
    const a = advanced(400);
    const b = advanced(400);
    expect(a.obstacles.length).toBeGreaterThan(0);
    b.obstacles[0]!.transform.position.x += 1e-6;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta flag alive virada', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.alive = !b.alive;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta tag adicionada num obstáculo', () => {
    const a = advanced(400);
    const b = advanced(400);
    b.obstacles[0]!.tags = [...b.obstacles[0]!.tags, 'x'];
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('hashState — normalização de -0', () => {
  it('+0 e -0 produzem o mesmo hash', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    a.distance = 0;
    b.distance = -0;
    expect(hashState(a)).toBe(hashState(b));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/replay/hash.test.ts`
Expected: FAIL — `hashState is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/core/replay/hash.ts`:

```ts
import type { Entity, Hitbox, Pterodactyl, Vec2, WorldState } from '@core/sim';

// Buffer de módulo p/ extrair os bits IEEE-754 de um float64 sem alocação por chamada.
// Endianness FIXA (littleEndian=true) ⇒ o golden é portável entre engines/plataformas.
const FLOAT_BUF = new ArrayBuffer(8);
const FLOAT_VIEW = new DataView(FLOAT_BUF);

function mixLane(h: number, w: number, prime: number): number {
  const x = Math.imul(h ^ w, prime);
  return (((x << 13) | (x >>> 19)) >>> 0);
}

function avalanche(h: number): number {
  let x = h >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function word8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** Acumulador de digest de 128 bits (4 lanes uint32), mistura estilo xmur3/scramble. */
class Digest {
  private h0 = 0x811c9dc5 | 0;
  private h1 = 0x9e3779b9 | 0;
  private h2 = 0x85ebca6b | 0;
  private h3 = 0xc2b2ae35 | 0;

  /** Absorve uma palavra (int32 bit-a-bit). */
  word(w: number): void {
    const x = w | 0;
    this.h0 = mixLane(this.h0, x, 0x01000193);
    this.h1 = mixLane(this.h1, x, 0x85ebca77);
    this.h2 = mixLane(this.h2, x, 0xc2b2ae3d);
    this.h3 = mixLane(this.h3, x, 0x27d4eb2f);
  }

  /** Absorve um float pelos seus 64 bits IEEE-754 (LE). Normaliza -0 → +0. */
  number(n: number): void {
    FLOAT_VIEW.setFloat64(0, n === 0 ? 0 : n, true);
    this.word(FLOAT_VIEW.getUint32(0, true));
    this.word(FLOAT_VIEW.getUint32(4, true));
  }

  bool(b: boolean): void {
    this.word(b ? 1 : 0);
  }

  string(s: string): void {
    this.word(s.length);
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
  }

  hex(): string {
    return word8(avalanche(this.h0)) + word8(avalanche(this.h1)) +
      word8(avalanche(this.h2)) + word8(avalanche(this.h3));
  }
}

function encodeVec2(d: Digest, v: Vec2): void {
  d.number(v.x);
  d.number(v.y);
}

function encodeHitbox(d: Digest, h: Hitbox): void {
  d.string(h.kind);
  switch (h.kind) {
    case 'aabb':
      d.number(h.halfW);
      d.number(h.halfH);
      break;
    case 'circle':
      d.number(h.radius);
      break;
    case 'polygon':
      d.word(h.points.length);
      for (const p of h.points) encodeVec2(d, p);
      break;
  }
}

function encodeEntity(d: Digest, e: Entity): void {
  d.number(e.id);
  d.string(e.type);
  d.word(e.tags.length);
  for (const t of e.tags) d.string(t);
  encodeVec2(d, e.transform.position);
  encodeVec2(d, e.kinematics.velocity);
  encodeHitbox(d, e.hitbox);
}

function encodePterodactyl(d: Digest, p: Pterodactyl): void {
  encodeVec2(d, p.transform.position);
  encodeVec2(d, p.kinematics.velocity);
  encodeHitbox(d, p.hitbox);
}

/**
 * Digest canônico, estável e portável do estado VISÍVEL do mundo (escalares + pterodáctilo +
 * obstáculos + coletáveis + presença dos geradores). Não lê o estado interno privado dos
 * SpawnGenerator: numa timeline fixa todo draw de RNG já se manifesta nas entidades emitidas.
 * Saída: 32 chars hex (128 bits).
 */
export function hashState(world: WorldState): string {
  const d = new Digest();
  d.number(world.tick);
  d.number(world.distance);
  d.number(world.food);
  d.number(world.nearMisses);
  d.number(world.score);
  d.number(world.scoreMultiplier);
  d.bool(world.alive);
  d.bool(world.lastFlap);
  d.number(world.scrollSpeed);
  d.number(world.baseScrollSpeed);
  d.number(world.level);
  d.bool(world.difficultyEnabled);
  d.number(world.gravity);
  d.number(world.flapSpeed);
  d.number(world.worldHeight);
  encodePterodactyl(d, world.pterodactyl);
  d.word(world.obstacles.length);
  for (const e of world.obstacles) encodeEntity(d, e);
  d.word(world.collectibles.length);
  for (const e of world.collectibles) encodeEntity(d, e);
  d.bool(world.spawner !== null);
  d.bool(world.collectibleSpawner !== null);
  return d.hex();
}
```

`src/core/replay/index.ts` (adicionar a linha):

```ts
export * from './timeline';
export * from './simulate';
export * from './hash';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/replay/hash.test.ts`
Expected: PASS (todos os testes de hash).

- [ ] **Step 5: Commit**

```bash
git add src/core/replay/hash.ts src/core/replay/index.ts tests/core/replay/hash.test.ts
git commit -m "feat(1.9): hashState — digest canônico portável do WorldState"
```

---

### Task 3: Golden master de determinismo (pinos commitados)

**Files:**
- Create: `tests/determinism/replay.determinism.test.ts`

**Interfaces:**
- Consumes: `simulate`, `buildTimeline`, `hashState` de `@core/replay`; `WorldConfig` de `@core/sim`.
- Produces: nada de runtime — pino de regressão.

- [ ] **Step 1: Escrever o teste com goldens-sentinela**

`tests/determinism/replay.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { WorldConfig } from '@core/sim';
import { simulate, buildTimeline, hashState } from '@core/replay';

/** Cadência de flap fixa por cenário (determinística). */
const flapEvery = (n: number) => (i: number) => i % n === 0;

interface Scenario {
  name: string;
  config: WorldConfig;
  length: number;
  pattern: (i: number) => boolean;
  golden: string; // preenchido na 1ª execução (ver Step 2/3)
}

const BASE: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
};

const SCENARIOS: Scenario[] = [
  {
    name: 'sem seed — só física até a morte',
    config: { ...BASE },
    length: 400,
    pattern: () => false,
    golden: 'SENTINEL',
  },
  {
    name: 'com seed — sobrevive bastante (flap regular)',
    config: { ...BASE, seed: 'endless:GOLD1' },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'SENTINEL',
  },
  {
    name: 'com seed — difficulty:false',
    config: { ...BASE, seed: 'endless:GOLD1', difficulty: false },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'SENTINEL',
  },
  {
    name: 'com seed diferente',
    config: { ...BASE, seed: 'endless:GOLD2' },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'SENTINEL',
  },
];

describe('golden master — replay determinístico', () => {
  for (const s of SCENARIOS) {
    it(`pino estável: ${s.name}`, () => {
      const hash = hashState(simulate(s.config, buildTimeline(s.length, s.pattern)));
      expect(hash).toBe(s.golden);
    });
  }

  it('seeds diferentes ⇒ hashes diferentes (GOLD1 vs GOLD2)', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const a = hashState(simulate({ ...BASE, seed: 'endless:GOLD1' }, tl));
    const b = hashState(simulate({ ...BASE, seed: 'endless:GOLD2' }, tl));
    expect(a).not.toBe(b);
  });

  it('difficulty on vs off ⇒ hashes diferentes', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const on = hashState(simulate({ ...BASE, seed: 'endless:GOLD1' }, tl));
    const off = hashState(simulate({ ...BASE, seed: 'endless:GOLD1', difficulty: false }, tl));
    expect(on).not.toBe(off);
  });
});
```

- [ ] **Step 2: Rodar para capturar os hashes reais**

Run: `npx vitest run tests/determinism/replay.determinism.test.ts`
Expected: os 4 testes de "pino estável" FALHAM mostrando `expected '<hash real>' to be 'SENTINEL'`. Os 2 testes de diferença devem PASSAR. Copiar cada `<hash real>` (32 chars hex) impresso no diff.

> Workflow de golden master: o valor correto é gerado pela 1ª execução. Este passo coleta os hashes reais; o Step 3 os fixa. Não inventar valores.

- [ ] **Step 3: Fixar os goldens reais no teste**

Substituir cada `golden: 'SENTINEL'` pelo hash real correspondente capturado no Step 2 (na ordem dos cenários). Exemplo de forma (valores ilustrativos — usar os reais):

```ts
    golden: '3f2a9c01b4d7e6f5089a1c2d3e4f5061',
```

- [ ] **Step 4: Rodar de novo — tudo verde**

Run: `npx vitest run tests/determinism/replay.determinism.test.ts`
Expected: PASS (todos). Re-rodar uma 2ª vez para confirmar estabilidade entre execuções:
Run: `npx vitest run tests/determinism/replay.determinism.test.ts`
Expected: PASS idêntico.

- [ ] **Step 5: Commit**

```bash
git add tests/determinism/replay.determinism.test.ts
git commit -m "test(1.9): golden master de determinismo (replay + hashState)"
```

---

### Task 4: Fechamento — docs e verificação final

**Files:**
- Modify: `docs/roadmap/PHASE-01-deterministic-core.md` (marcar 1.9 `[x]`)
- Modify: `CLAUDE.md` (campo "Estado atual": 1.9 concluído, Fase 1 concluída, próximo = Fase 2)

- [ ] **Step 1: Marcar o item 1.9 no arquivo da fase**

Em `docs/roadmap/PHASE-01-deterministic-core.md`, trocar:

```md
### 1.9 Replay / golden master
- [ ] Suporte a rodar `sim(seed, InputTimeline)` headless e hashear o estado.
- [ ] Golden master para seeds fixas (detecta regressão de determinismo).
```

por (`[x]` nos dois):

```md
### 1.9 Replay / golden master
- [x] Suporte a rodar `sim(seed, InputTimeline)` headless e hashear o estado.
- [x] Golden master para seeds fixas (detecta regressão de determinismo).
```

- [ ] **Step 2: Atualizar "Estado atual" no `CLAUDE.md`**

Adicionar parágrafo de 1.9 ao bloco da Fase 1, marcar a Fase 1 como CONCLUÍDA e ajustar a linha "Próximo:" para apontar a Fase 2 (vertical slice Endless). Resumo de 1.9: módulo `src/core/replay/` (`simulate`, `buildTimeline`, `hashState`); hash canônico 128-bit dos bits IEEE-754 via `DataView` LE; golden master em `tests/determinism/replay.determinism.test.ts`.

- [ ] **Step 3: Verificação final de verdade**

Run: `npm run check`
Expected: sem erros de tsc nem eslint.

Run: `npm test`
Expected: todos verdes (suíte anterior + replay unit + golden).

Run: `npm run test:determinism`
Expected: bateria verde incluindo `replay.determinism.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap/PHASE-01-deterministic-core.md CLAUDE.md
git commit -m "docs(1.9): fecha item 1.9 e Fase 1 (roadmap + estado atual)"
```

---

## Self-Review

- **Cobertura da spec:** replay runner (Task 1), hash canônico c/ bits IEEE-754 + normalização -0 + 128-bit (Task 2), golden master com cenários sem-seed/seed/difficulty-false/seed-diferente (Task 3), fechamento docs+verificação (Task 4). Decisão de escopo (não hashear estado interno do spawner) refletida no `hashState`. ✓
- **Placeholders:** o único "SENTINEL" é parte intencional do workflow de golden master (gera-na-1ª-execução), com passos exatos de captura/fixação — não é um TODO vago. ✓
- **Consistência de tipos:** `InputTimeline`/`buildTimeline`/`simulate`/`hashState` usados com as mesmas assinaturas em todas as tasks; `Digest.word/number/bool/string/hex` coerentes; campos de `WorldState` batem com `src/core/sim/types.ts`. ✓
- **REGRAS:** módulo puro, `DataView` LE explícito (portável), sem APIs proibidas, sem alocação por palavra. Verificação de determinismo na Task 3 e Task 4. ✓
