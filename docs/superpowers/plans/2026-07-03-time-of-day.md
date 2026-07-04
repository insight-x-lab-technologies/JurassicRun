# Tempo do dia (cosmético) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar atmosfera de tempo do dia (manhã/tarde/entardecer/noite) às partidas via paletas de fundo derivadas da seed, **sem tocar a simulação**.

**Architecture:** módulo PURO `src/render/daynight.ts` (catálogo de paletas + seleção determinística por `hashSeed`) consumido por uma casca fina na `GameScene` que aplica céu/faixas/tint na criação e no restart. Zero toque em `src/core/`; determinismo intacto. Padrão puro×casca de 2.3/2.4.

**Tech Stack:** TypeScript estrito, Phaser (só na casca), Vitest (env node para o módulo puro), `hashSeed` de `@core/rng`.

## Global Constraints

- **REGRA 1:** `src/core/` NÃO é tocado. Nada lê/escreve `WorldState`. Bateria de determinismo (61) inalterada.
- **REGRA 2:** paletas são dados; cores-base das silhuetas ficam em `parallax.ts`.
- **REGRA 3:** aplicar paleta é trabalho de transição (create + troca de seed), nunca por frame. Hot path zero-alloc.
- **REGRA 4:** nenhuma string visível ⇒ sem i18n.
- **TS estrito:** sem `any`. `Record<TimeOfDay, DayNightPalette>` força completude em tempo de compilação.
- Comandos: `npm test` (Vitest), `npm run check` (lint+typecheck), `npm run test:determinism`.

---

### Task 1: Módulo puro `daynight.ts` (catálogo + seleção por seed)

**Files:**
- Create: `src/render/daynight.ts`
- Create: `tests/render/daynight.test.ts`
- Modify: `src/render/index.ts` (reexportar o módulo puro)

**Interfaces:**
- Consumes: `hashSeed(seed: string | number): number` de `@core/rng`.
- Produces:
  - `type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night'`
  - `interface DayNightPalette { readonly sky: number; readonly ground: number; readonly ceiling: number; readonly parallaxTint: number }`
  - `const TIME_OF_DAY_ORDER: readonly TimeOfDay[]`
  - `const DAY_NIGHT_PALETTES: Readonly<Record<TimeOfDay, DayNightPalette>>`
  - `function timeOfDayForSeed(seed: string): TimeOfDay`
  - `function paletteFor(tod: TimeOfDay): DayNightPalette`

- [ ] **Step 1: Write the failing test**

`tests/render/daynight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TIME_OF_DAY_ORDER,
  DAY_NIGHT_PALETTES,
  timeOfDayForSeed,
  paletteFor,
} from '@render/daynight';
import type { TimeOfDay } from '@render/daynight';

describe('daynight catalog', () => {
  it('tem uma paleta para cada fase da ordem (e nenhuma órfã)', () => {
    for (const tod of TIME_OF_DAY_ORDER) {
      expect(DAY_NIGHT_PALETTES[tod]).toBeDefined();
    }
    expect(Object.keys(DAY_NIGHT_PALETTES).length).toBe(TIME_OF_DAY_ORDER.length);
  });

  it('cada paleta expõe 4 cores inteiras válidas (0..0xffffff)', () => {
    for (const tod of TIME_OF_DAY_ORDER) {
      const p = paletteFor(tod);
      for (const c of [p.sky, p.ground, p.ceiling, p.parallaxTint]) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});

describe('timeOfDayForSeed', () => {
  it('é determinístico: a mesma seed devolve sempre a mesma fase', () => {
    const seeds = ['endless:GOLD1', 'endless:GOLD2', 'daily:2026-07-03', 'weekly:2026-W27'];
    for (const s of seeds) {
      expect(timeOfDayForSeed(s)).toBe(timeOfDayForSeed(s));
    }
  });

  it('sempre devolve uma fase de TIME_OF_DAY_ORDER', () => {
    for (let i = 0; i < 200; i++) {
      const tod = timeOfDayForSeed(`endless:SEED${i}`);
      expect(TIME_OF_DAY_ORDER).toContain(tod);
    }
  });

  it('a seleção varia entre seeds (não colapsa numa fase só)', () => {
    const seen = new Set<TimeOfDay>();
    for (let i = 0; i < 200; i++) seen.add(timeOfDayForSeed(`endless:SEED${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- daynight`
Expected: FAIL — `Cannot find module '@render/daynight'` (módulo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

`src/render/daynight.ts`:

```ts
/**
 * Tempo do dia (item 3.3) — cosmético PURO, derivado da seed da partida. Não toca `src/core/`
 * nem `WorldState` (REGRA 1): é só paleta de fundo, como parallax (2.3). Trocar por arte real
 * (gradientes/sprites de céu, Fase 8) = editar o catálogo, não a lógica (REGRA 2).
 */
import { hashSeed } from '@core/rng';

export type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night';

/** Cores de uma fase do dia. `parallaxTint` é multiplicativo (0xffffff = sem alteração). */
export interface DayNightPalette {
  readonly sky: number;
  readonly ground: number;
  readonly ceiling: number;
  readonly parallaxTint: number;
}

/** Ordem estável usada na seleção por módulo (amanhecer→noite). */
export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = ['morning', 'afternoon', 'dusk', 'night'];

/**
 * Paletas por fase. Valores são PLACEHOLDERS de tuning cosmético (Fase 8 refina).
 * `afternoon` herda o look atual (SKY/GROUND/CEILING de constants.ts) ⇒ sem regressão visual.
 */
export const DAY_NIGHT_PALETTES: Readonly<Record<TimeOfDay, DayNightPalette>> = {
  morning: { sky: 0xffdcb0, ground: 0x4a7038, ceiling: 0x4a3a52, parallaxTint: 0xffe0c0 },
  afternoon: { sky: 0x9ad4e6, ground: 0x4a7a3a, ceiling: 0x3a2f4a, parallaxTint: 0xffffff },
  dusk: { sky: 0xff9e6b, ground: 0x3f5a34, ceiling: 0x52304a, parallaxTint: 0xffb080 },
  night: { sky: 0x1a2340, ground: 0x24331f, ceiling: 0x1e1830, parallaxTint: 0x5566aa },
};

/** Paleta de uma fase. */
export function paletteFor(tod: TimeOfDay): DayNightPalette {
  return DAY_NIGHT_PALETTES[tod];
}

/**
 * Fase do dia de uma partida: função determinística da seed via `hashSeed` (xmur3 portável do
 * core). Endless (token aleatório) varia de partida em partida; Diário/Semanal (Fase 5) fica
 * reproduzível para todos.
 */
export function timeOfDayForSeed(seed: string): TimeOfDay {
  const idx = hashSeed(seed) % TIME_OF_DAY_ORDER.length;
  return TIME_OF_DAY_ORDER[idx]!;
}
```

- [ ] **Step 4: Reexport from the render barrel**

`src/render/index.ts` — adicionar a linha (após `export * from './parallax';`):

```ts
export * from './daynight';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- daynight`
Expected: PASS (todos os testes de `daynight.test.ts`).

- [ ] **Step 6: Typecheck/lint**

Run: `npm run check`
Expected: limpo (sem erros de tsc/eslint).

- [ ] **Step 7: Commit**

```bash
git add src/render/daynight.ts tests/render/daynight.test.ts src/render/index.ts
git commit -m "feat(3.3): módulo puro daynight (paletas + seleção determinística por seed)"
```

---

### Task 2: Casca — aplicar a paleta na `GameScene` (+ nota nos asset-specs)

**Files:**
- Modify: `src/render/GameScene.ts` (campos, `create()`, `update()`, novo método `applyDayNight`)
- Modify: `docs/assets/specs/bg.layer.far.md`, `bg.layer.mid.md`, `bg.layer.near.md` (nota de tempo do dia)

**Interfaces:**
- Consumes (da Task 1): `paletteFor`, `timeOfDayForSeed`.
- Produces: comportamento visual — céu/faixas/tint por partida; sem API pública nova.

Sem teste de unidade (casca Phaser, como 2.3/2.4); a verificação é `check` + visual (Playwright).

- [ ] **Step 1: Importar o módulo na GameScene**

`src/render/GameScene.ts` — adicionar após o import de `parallax`:

```ts
import { paletteFor, timeOfDayForSeed } from './daynight';
```

- [ ] **Step 2: Novos campos da cena**

Em `GameScene`, junto aos outros campos privados (ex.: após `private parallaxTiles ...`), adicionar:

```ts
  private bandsGfx!: Phaser.GameObjects.Graphics;
  private appliedDayNightSeed: string | null = null;
```

- [ ] **Step 3: Substituir a criação das faixas fixas por `bandsGfx` + aplicar paleta inicial**

Em `create()`, trocar o bloco atual:

```ts
    // Cenário fixo (scrollFactor 0): faixas de teto e chão.
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(CEILING_COLOR, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    bg.fillStyle(GROUND_COLOR, 1);
    bg.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);
```

por:

```ts
    // Cenário fixo (scrollFactor 0): faixas de teto e chão. Cores vêm da paleta de tempo do dia
    // (3.3), aplicada aqui e no restart via applyDayNight — desenho só na transição (REGRA 3).
    this.bandsGfx = this.add.graphics().setScrollFactor(0);

    // Tempo do dia (3.3): paleta derivada da seed da partida. Céu + faixas + tint de parallax.
    this.applyDayNight(this.match.seedLabel);
```

> Nota: os imports `CEILING_COLOR`/`GROUND_COLOR` de `./constants` deixam de ser usados na cena. Remover ambos da lista de import no topo do arquivo para o lint não acusar import não-usado. (Mantidos em `constants.ts` — a paleta `afternoon` referencia esses valores como o look default.)

- [ ] **Step 4: Aplicar a paleta em troca de seed (restart) no `update()`**

Em `update()`, logo após `this.syncGameOver();` e ANTES de `if (paused) return;`, inserir:

```ts
    // Restart traz nova seed ⇒ possivelmente nova fase do dia. Compara-e-aplica só na troca
    // (string compare por frame não aloca; o redesenho só ocorre na transição — REGRA 3).
    if (this.match.seedLabel !== this.appliedDayNightSeed) {
      this.applyDayNight(this.match.seedLabel);
    }
```

- [ ] **Step 5: Implementar `applyDayNight`**

Adicionar como método privado da `GameScene` (ex.: antes de `ensureLayerTexture`):

```ts
  /** Aplica a paleta de tempo do dia (3.3): céu, faixas chão/teto e tint das camadas de parallax.
   *  Só chamado na criação e quando a seed da partida muda (restart) — nunca por frame (REGRA 3). */
  private applyDayNight(seed: string): void {
    const p = paletteFor(timeOfDayForSeed(seed));
    // sky < 0x1000000 ⇒ Phaser trata como RGB opaco (alpha 255). Cobre o backgroundColor do jogo.
    this.cameras.main.setBackgroundColor(p.sky);
    const g = this.bandsGfx;
    g.clear();
    g.fillStyle(p.ceiling, 1);
    g.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    g.fillStyle(p.ground, 1);
    g.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);
    for (const tile of this.parallaxTiles) tile.setTint(p.parallaxTint);
    this.appliedDayNightSeed = seed;
  }
```

- [ ] **Step 6: Typecheck/lint**

Run: `npm run check`
Expected: limpo. Se acusar `CEILING_COLOR`/`GROUND_COLOR` não-usados, confirmar que foram removidos do import do topo (Step 3).

- [ ] **Step 7: Build de sanidade**

Run: `npm run build`
Expected: build ok (a casca compila com Phaser).

- [ ] **Step 8: Nota nos asset-specs de fundo (REGRA 2/5)**

Em cada um de `docs/assets/specs/bg.layer.far.md`, `bg.layer.mid.md`, `bg.layer.near.md`, acrescentar ao fim uma seção:

```markdown
## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite). A arte real (Fase 8) deve funcionar como silhueta neutra que
aceita tint multiplicativo; evite cores saturadas embutidas que briguem com o tint.
```

- [ ] **Step 9: Commit**

```bash
git add src/render/GameScene.ts docs/assets/specs/bg.layer.far.md docs/assets/specs/bg.layer.mid.md docs/assets/specs/bg.layer.near.md
git commit -m "feat(3.3): GameScene aplica paleta de tempo do dia (céu/faixas/tint) por partida"
```

---

## Verificação final (após as duas tasks)

- [ ] `npm test` — toda a suíte verde (novos testes de `daynight` incluídos).
- [ ] `npm run check` — limpo.
- [ ] `npm run test:determinism` — **61 verdes, inalterados** (core intocado).
- [ ] Verificação visual (Playwright): fases diferentes ⇒ céus/silhuetas diferentes; um restart pode trocar a fase (a seed muda). Registrar evidência.
- [ ] Marcar 3.3 como `[x]` em `docs/roadmap/PHASE-03-powerups-and-weather.md` e atualizar "Estado atual" no `CLAUDE.md`.

## Self-review (coberto)

- **Cobertura da spec:** §3.1 → Task 1; §3.2 → Task 2; §4 determinismo → verificação final; §5 testes → Task 1 steps 1-5; §6 fora de escopo → não implementado (correto); §7 pronto → verificação final + nota asset-spec (Task 2 step 8).
- **Placeholders:** valores de cor são placeholders de tuning declarados (não são placeholders de plano); todo passo tem código concreto.
- **Consistência de tipos:** `timeOfDayForSeed`/`paletteFor`/`TIME_OF_DAY_ORDER`/`DAY_NIGHT_PALETTES` usados na Task 2 batem com as assinaturas definidas na Task 1.
