# Economy & Score (Item 1.8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à simulação uma pontuação canônica: distância como score base, comida e near-miss adicionam pontos, tudo escalado por um multiplicador mutável, acumulado incrementalmente no `WorldState`.

**Architecture:** Módulo-folha puro `src/core/economy/` expõe `scoreDelta(distanceDelta, foodDelta, nearMissDelta, multiplier)` (só aritmética). O `step` captura os incrementos de comida/near-miss do passo, computa `dx`, e ao fim banca `world.score += scoreDelta(...)` à taxa de `world.scoreMultiplier` ativa. `score`/`scoreMultiplier` entram em `WorldState`, `createWorld` e `cloneWorld`.

**Tech Stack:** TypeScript estrito, Vitest. Aliases `@core/*`. Sem dependências novas.

## Global Constraints

- **Determinismo (REGRA 1):** dentro de `src/core/` proibido `Math.random`/`Date.now`/`performance.now`. `scoreDelta` usa só `+`, `−`, `·` (IEEE-754 portável; sem `Math.pow`/`exp`/`log`/`hypot`/`round`/`floor`). Mesma seed + inputs ⇒ mesmo `score`.
- **Performance (REGRA 3):** sem alocação por-entidade-por-frame. `scoreDelta` retorna `number`; integração no `step` usa só leituras/escritas escalares.
- **`src/core/` não importa** de phaser/preact/DOM/IO. `economy` é folha: opera sobre `number`, não importa de `@core/sim`.
- **Score é float canônico** — NÃO arredondar no core (apresentação faz `floor` na Fase 2).
- Pesos placeholder (afinados na Fase 2): `DISTANCE_SCORE_WEIGHT = 1`, `FOOD_SCORE_VALUE = 10`, `NEAR_MISS_SCORE_VALUE = 5`.
- TDD: teste que falha → mínimo p/ passar. Um commit por task na branch `feat/1.8-economy-score`.

---

### Task 1: Módulo `economy` puro (`scoreDelta` + constantes)

**Files:**
- Create: `src/core/economy/constants.ts`
- Create: `src/core/economy/score.ts`
- Create: `src/core/economy/index.ts`
- Test: `tests/core/economy/score.test.ts`

**Interfaces:**
- Consumes: nada (módulo-folha sobre primitivos).
- Produces:
  - `scoreDelta(distanceDelta: number, foodDelta: number, nearMissDelta: number, multiplier: number): number`
  - Constantes exportadas: `DISTANCE_SCORE_WEIGHT`, `FOOD_SCORE_VALUE`, `NEAR_MISS_SCORE_VALUE` (todas `number`).
  - Barrel `@core/economy` re-exporta `scoreDelta` e as três constantes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/core/economy/score.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  scoreDelta,
  DISTANCE_SCORE_WEIGHT,
  FOOD_SCORE_VALUE,
  NEAR_MISS_SCORE_VALUE,
} from '@core/economy';

describe('scoreDelta', () => {
  it('só distância: aplica DISTANCE_SCORE_WEIGHT', () => {
    expect(scoreDelta(10, 0, 0, 1)).toBe(10 * DISTANCE_SCORE_WEIGHT);
  });

  it('só comida: aplica FOOD_SCORE_VALUE por unidade', () => {
    expect(scoreDelta(0, 3, 0, 1)).toBe(3 * FOOD_SCORE_VALUE);
  });

  it('só near-miss: aplica NEAR_MISS_SCORE_VALUE por unidade', () => {
    expect(scoreDelta(0, 0, 2, 1)).toBe(2 * NEAR_MISS_SCORE_VALUE);
  });

  it('multiplicador 1 (default): soma simples dos componentes ponderados', () => {
    const expected =
      5 * DISTANCE_SCORE_WEIGHT + 2 * FOOD_SCORE_VALUE + 1 * NEAR_MISS_SCORE_VALUE;
    expect(scoreDelta(5, 2, 1, 1)).toBe(expected);
  });

  it('multiplicador 2 dobra a soma; 0 zera; fracionário escala', () => {
    const base = scoreDelta(5, 2, 1, 1);
    expect(scoreDelta(5, 2, 1, 2)).toBe(base * 2);
    expect(scoreDelta(5, 2, 1, 0)).toBe(0);
    expect(scoreDelta(5, 2, 1, 1.5)).toBe(base * 1.5);
  });

  it('deltas zero ⇒ 0', () => {
    expect(scoreDelta(0, 0, 0, 1)).toBe(0);
  });

  it('puro/idempotente: mesmos argumentos ⇒ mesmo resultado', () => {
    expect(scoreDelta(7.25, 1, 3, 2)).toBe(scoreDelta(7.25, 1, 3, 2));
  });

  it('valores grandes: aritmética float sã', () => {
    expect(scoreDelta(1e6, 1000, 1000, 1)).toBe(
      1e6 * DISTANCE_SCORE_WEIGHT + 1000 * FOOD_SCORE_VALUE + 1000 * NEAR_MISS_SCORE_VALUE,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- tests/core/economy/score.test.ts`
Expected: FAIL (módulo `@core/economy` não existe).

- [ ] **Step 3: Implementar constantes**

Criar `src/core/economy/constants.ts`:

```ts
// Pesos de pontuação (placeholders de tuning; afinados na Fase 2). Unidades abstratas.

/** Pontos por unidade de distância percorrida (score base). */
export const DISTANCE_SCORE_WEIGHT = 1;
/** Pontos por pássaro-moeda (comida) coletado. */
export const FOOD_SCORE_VALUE = 10;
/** Pontos por near-miss (passar perto de um obstáculo sem colidir). */
export const NEAR_MISS_SCORE_VALUE = 5;
```

- [ ] **Step 4: Implementar `scoreDelta`**

Criar `src/core/economy/score.ts`:

```ts
import { DISTANCE_SCORE_WEIGHT, FOOD_SCORE_VALUE, NEAR_MISS_SCORE_VALUE } from './constants';

/**
 * Pontos ganhos num passo, dados os incrementos do passo e o multiplicador ativo.
 * Acúmulo incremental: o chamador faz `score += scoreDelta(...)` por step, de modo que um
 * multiplicador temporário (power-up da Fase 3) banca pontos à taxa ativa no momento em que
 * foram ganhos. Puro: só +, −, · (DETERMINISM.md §5); sem RNG, sem tempo, sem transcendentais.
 */
export function scoreDelta(
  distanceDelta: number,
  foodDelta: number,
  nearMissDelta: number,
  multiplier: number,
): number {
  const base =
    distanceDelta * DISTANCE_SCORE_WEIGHT +
    foodDelta * FOOD_SCORE_VALUE +
    nearMissDelta * NEAR_MISS_SCORE_VALUE;
  return base * multiplier;
}
```

- [ ] **Step 5: Criar o barrel**

Criar `src/core/economy/index.ts`:

```ts
export { scoreDelta } from './score';
export { DISTANCE_SCORE_WEIGHT, FOOD_SCORE_VALUE, NEAR_MISS_SCORE_VALUE } from './constants';
```

- [ ] **Step 6: Rodar o teste e o check**

Run: `npm test -- tests/core/economy/score.test.ts` → Expected: PASS (todos).
Run: `npm run check` → Expected: typecheck/lint limpos.

- [ ] **Step 7: Commit**

```bash
git add src/core/economy/ tests/core/economy/
git commit -m "feat(core/economy): scoreDelta puro + pesos de pontuação (1.8)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Integração no `WorldState`/`step` (acúmulo de score)

**Files:**
- Modify: `src/core/sim/types.ts` (campos `score`/`scoreMultiplier` em `WorldState`)
- Modify: `src/core/sim/world.ts` (`createWorld` inicializa; `cloneWorld` copia)
- Modify: `src/core/sim/step.ts` (captura deltas + banca score no fim)
- Test: `tests/core/sim/economy-step.test.ts`

**Interfaces:**
- Consumes: `scoreDelta` de `@core/economy` (Task 1); `FOOD_SCORE_VALUE`, `NEAR_MISS_SCORE_VALUE` nos testes.
- Produces:
  - `WorldState.score: number` (inicia 0) — pontuação canônica acumulada.
  - `WorldState.scoreMultiplier: number` (inicia 1) — multiplicador mutável em runtime.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/core/sim/economy-step.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import { FOOD_SCORE_VALUE, NEAR_MISS_SCORE_VALUE } from '@core/economy';

describe('integração da economia no step', () => {
  it('mundo recém-criado: score 0 e scoreMultiplier 1', () => {
    const w = createWorld({ seed: 'endless:E' });
    expect(w.score).toBe(0);
    expect(w.scoreMultiplier).toBe(1);
  });

  it('voar sem coletar/morrer: score cresce e é igual à distância acumulada (peso 1, mult 1)', () => {
    // Sem seed ⇒ sem obstáculos/coletáveis: só a distância pontua. DISTANCE_SCORE_WEIGHT=1.
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    for (let i = 0; i < 500; i++) step(w, { flap: i % 2 === 0 });
    expect(w.score).toBeGreaterThan(0);
    expect(w.score).toBeCloseTo(w.distance, 9); // peso 1, multiplicador 1
  });

  it('coletar comida adiciona FOOD_SCORE_VALUE no step da coleta', () => {
    // Mundo alto (não morre) com coletáveis; detecta o step em que food incrementa.
    const w = createWorld({ worldHeight: 100000, startY: 50000, seed: 'endless:FOODSCORE' });
    let prevFood = w.food;
    let prevScore = w.score;
    let observed = false;
    for (let i = 0; i < 4000 && !observed; i++) {
      step(w, { flap: i % 2 === 0 });
      if (w.food > prevFood) {
        const foodGained = w.food - prevFood;
        const scoreGained = w.score - prevScore;
        // score do step = distância(dx)*1 + comida*FOOD_SCORE_VALUE. A parte de comida:
        expect(scoreGained).toBeGreaterThanOrEqual(foodGained * FOOD_SCORE_VALUE);
        observed = true;
      }
      prevFood = w.food;
      prevScore = w.score;
    }
    expect(observed).toBe(true);
  });

  it('multiplicador temporário banca correto: pontos ganhos no 2x permanecem ao voltar a 1', () => {
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    // Fase 1: multiplicador 1 por alguns steps.
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    const scoreAfterPhase1 = w.score;
    // Fase 2: multiplicador 2 por alguns steps (simula power-up ativo).
    w.scoreMultiplier = 2;
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    const scoreAfterPhase2 = w.score;
    const gainedDuring2x = scoreAfterPhase2 - scoreAfterPhase1;
    // Fase 3: multiplicador volta a 1; o score NÃO regride (pontos do 2x ficam bancados).
    w.scoreMultiplier = 1;
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    expect(w.score).toBeGreaterThan(scoreAfterPhase2);
    // O ganho no 2x foi ~2x o ganho equivalente a 1x (distância por step é da mesma ordem).
    expect(gainedDuring2x).toBeGreaterThan(scoreAfterPhase1 * 1.5);
  });

  it('congelamento na morte: score não muda após morrer', () => {
    // Mundo baixo + gravidade: cai e morre no chão. Após a morte, step é no-op.
    const w = createWorld({ worldHeight: 50, startY: 25 });
    while (w.alive && w.tick < 100000) step(w, { flap: false });
    expect(w.alive).toBe(false);
    const scoreAtDeath = w.score;
    for (let i = 0; i < 50; i++) step(w, { flap: true });
    expect(w.score).toBe(scoreAtDeath);
  });
});
```

(O peso `NEAR_MISS_SCORE_VALUE` é importado para documentar intenção; um teste direto de near-miss vive na Task 2 opcionalmente, mas o caminho near-miss já é exercitado pelos testes de determinismo da Task 3. Se preferir, adicione aqui um cenário de near-miss espelhando `collision-step.test.ts`.)

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- tests/core/sim/economy-step.test.ts`
Expected: FAIL (`w.score`/`w.scoreMultiplier` `undefined`).

- [ ] **Step 3: Adicionar campos ao `WorldState`**

Em `src/core/sim/types.ts`, dentro de `interface WorldState`, logo após `nearMisses`, adicionar:

```ts
  /** Pontuação canônica acumulada da partida (float). Distância base + comida + near-miss,
   * escalado por scoreMultiplier, bancado por step. Apresentação faz floor (Fase 2). */
  score: number;
  /** Multiplicador de score ativo (default 1). Mutável em runtime (power-ups da Fase 3). */
  scoreMultiplier: number;
```

Também atualizar o comentário existente de `nearMisses` (que dizia "Multiplicador/score são 1.8") para refletir que agora pontuam — trocar a frase final por: `Pontua via score (item 1.8).` E o de `food`: trocar `Multiplicadores/score completos ficam para 1.8.` por `Pontua via score (item 1.8).`

- [ ] **Step 4: Inicializar em `createWorld` e copiar em `cloneWorld`**

Em `src/core/sim/world.ts`, no objeto retornado por `createWorld`, após `nearMisses: 0,` adicionar:

```ts
    score: 0,
    scoreMultiplier: 1,
```

E em `cloneWorld`, após `nearMisses: w.nearMisses,` adicionar:

```ts
    score: w.score,
    scoreMultiplier: w.scoreMultiplier,
```

- [ ] **Step 5: Bancar o score no `step`**

Em `src/core/sim/step.ts`:

1. No topo, adicionar o import:

```ts
import { scoreDelta } from '@core/economy';
```

2. Logo após a linha `world.distance += dx;` (onde `dx` já está definido), capturar as contagens-base:

```ts
  // Economia: captura as contagens antes das passadas de colisão (item 1.8).
  const foodBefore = world.food;
  const nearMissBefore = world.nearMisses;
```

3. No **fim** da função `step` (após os dois blocos de colisão, última instrução), bancar:

```ts
  // Acúmulo incremental do score: distância deste step + comida/near-miss ganhos, à taxa do
  // multiplicador ativo agora (item 1.8). Alocação-zero (escalares). Na morte, foodDelta/
  // nearMissDelta deste step são 0 (contados só sob `if (world.alive)`); a distância dx conta.
  world.score += scoreDelta(dx, world.food - foodBefore, world.nearMisses - nearMissBefore, world.scoreMultiplier);
```

- [ ] **Step 6: Rodar testes e check**

Run: `npm test -- tests/core/sim/economy-step.test.ts` → Expected: PASS.
Run: `npm test` → Expected: toda a suíte verde (inclui `world.test.ts`/`step.test.ts` que comparam `WorldState` via `toEqual` — agora com os campos novos, copiados por `cloneWorld`).
Run: `npm run check` → Expected: limpo.

Se algum teste pré-existente que constrói/espelha um `WorldState` literal quebrar por falta dos campos, atualizá-lo para incluir `score`/`scoreMultiplier` (busca: `grep -rn "nearMisses" tests/`).

- [ ] **Step 7: Commit**

```bash
git add src/core/sim/ tests/core/sim/economy-step.test.ts
git commit -m "feat(core/sim): acúmulo de score por step + scoreMultiplier no WorldState (1.8)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Testes de determinismo da economia

**Files:**
- Test: `tests/determinism/economy.determinism.test.ts`

**Interfaces:**
- Consumes: `createWorld`/`step`/`WorldState`/`WorldConfig`/`InputFrame` de `@core/sim`.
- Produces: nada (suíte de testes).

- [ ] **Step 1: Escrever os testes de determinismo**

Criar `tests/determinism/economy.determinism.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

// Mundo alto p/ a partida durar; seed liga obstáculos e coletáveis (comida/near-miss pontuam).
const SEEDED: WorldConfig = { worldHeight: 100000, startY: 50000, seed: 'endless:ECON1' };

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 2 === 0 });
  return out;
}

function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) step(w, timeline[i]!);
  }
  return w;
}

describe('determinismo da economia/score', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ score idêntico', () => {
    const t = makeTimeline(1500);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.score).toBe(b.score);
    expect(a.food).toBe(b.food);
    expect(a.nearMisses).toBe(b.nearMisses);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ score idêntico', () => {
    const t = makeTimeline(1500);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two.score).toBe(one.score);
    expect(five.score).toBe(one.score);
    // Estado completo idêntico (score incluso) reforça o contrato.
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('duas partidas frescas com a mesma seed ⇒ mesmo score na mesma distância', () => {
    const t = makeTimeline(900);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.distance).toBe(b.distance);
    expect(a.score).toBe(b.score);
  });
});
```

- [ ] **Step 2: Rodar e verificar PASS**

Run: `npm test -- tests/determinism/economy.determinism.test.ts` → Expected: PASS.
Run: `npm run test:determinism` → Expected: toda a bateria de determinismo verde (inclui a nova).

- [ ] **Step 3: Commit**

```bash
git add tests/determinism/economy.determinism.test.ts
git commit -m "test(determinism): score reprodutível e fps-independente (1.8)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Fechar o item (docs)

**Files:**
- Modify: `docs/roadmap/PHASE-01-deterministic-core.md` (marcar 1.8 `[x]`)
- Modify: `CLAUDE.md` (atualizar "Estado atual")

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: Marcar o item 1.8 como concluído**

Em `docs/roadmap/PHASE-01-deterministic-core.md`, na seção `### 1.8 Economia e score`, trocar:

```
- [ ] Comida coletada, multiplicadores, distância como score base.
- [ ] Testes (inclui multiplicadores e bordas).
```

por:

```
- [x] Comida coletada, multiplicadores, distância como score base.
- [x] Testes (inclui multiplicadores e bordas).
```

- [ ] **Step 2: Atualizar "Estado atual" no `CLAUDE.md`**

Em `CLAUDE.md`, na seção "Estado atual", acrescentar à lista de itens concluídos da Fase 1 o **1.8** e um parágrafo curto descrevendo-o (espelhando o estilo dos itens 1.5–1.7): módulo `src/core/economy/` com `scoreDelta` puro (distância base + comida + near-miss × multiplicador), acúmulo incremental no `step`, `WorldState.{score,scoreMultiplier}`. Atualizar a linha "Próximo:" para o **item 1.9 (replay / golden master)**. Atualizar contagens de testes/determinismo conforme a saída real de `npm test`.

- [ ] **Step 3: Verificação final**

Run: `npm test` → Expected: toda a suíte verde. Anotar o total de testes e de determinismo para o "Estado atual".
Run: `npm run check` → Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap/PHASE-01-deterministic-core.md CLAUDE.md
git commit -m "docs(1.8): fecha item 1.8 (roadmap + estado atual)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Módulo `economy` puro + `scoreDelta` → Task 1. ✓
- Distância base / comida / near-miss pontuam → Task 1 (fórmula) + Task 2 (integração). ✓
- Multiplicador (`scoreMultiplier`, default 1, mutável) → Task 2. ✓
- Acúmulo incremental + bancar temporário → Task 2 (step + teste do 2x). ✓
- `createWorld`/`cloneWorld`/`WorldState` → Task 2. ✓
- Testes unidade/integração/determinismo → Tasks 1/2/3. ✓
- Float canônico sem floor → respeitado (nenhum `floor` no core). ✓
- Fechar docs → Task 4. ✓
- Não-objetivos (food multiplier, persistência, HUD) → não tocados. ✓

**Placeholder scan:** sem TBD/TODO; todo código presente. ✓

**Type consistency:** `scoreDelta(distanceDelta, foodDelta, nearMissDelta, multiplier)` idêntica em Task 1 (def) e Task 2 (uso). Campos `score`/`scoreMultiplier` consistentes entre types/world/step/clone. ✓
