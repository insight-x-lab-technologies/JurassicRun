# Animação idle cosmética de obstáculo (9.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** árvores e cipós balançam, estalactites pingam — micro-animação idle 100% cosmética, com
hitbox e colisão idênticas e sem alocação por frame.

**Architecture:** módulo PURO `src/render/idle.ts` (funções fechadas no tempo, scratch de saída,
molde de `death.ts`/`particles.ts`) + campo `idle` no manifesto de arte + casca em
`GameScene.ts` (relógio cosmético local, deslocamento dos segmentos com **sangria = amplitude**
para nunca descobrir a hitbox, gota desenhada no `Graphics` existente).

**Tech Stack:** TypeScript estrito, Phaser 3 (só na casca), Vitest.

## Global Constraints

- **`src/core/` INTOCADO.** Nada neste item entra na simulação: nenhuma mudança de hitbox, spawn,
  colisão ou hash. Determinismo continua **67** testes.
- **REGRA 3 (performance):** zero alocação por frame no hot path. Scratch de campo + memoização
  (`Map`) + pool de `Image` existente. Nenhuma concatenação de string por frame.
- **REGRA 2 (arte desacoplada):** ligar/desligar/tunar idle = editar `src/render/manifest.ts`.
- **REGRA 4 (i18n):** este item não cria string visível ao usuário.
- Comentários e nomes de teste em **português** (convenção do repositório).
- Fonte da verdade: `docs/superpowers/specs/2026-07-25-obstacle-idle-animation-design.md`.
- Comandos: `npm test`, `npm run check`.

---

### Task 1: módulo puro `idle.ts` + campo `idle` no manifesto

**Files:**
- Create: `src/render/idle.ts`
- Create: `tests/render/idle.test.ts`
- Modify: `src/render/manifest.ts` (tipo `IdleSpec` + campo `idle` nas 3 entradas de obstáculo)
- Modify: `src/render/constants.ts` (cor da gota)

**Interfaces:**
- Consumes: `renderableFor(typeId)` de `./manifest`.
- Produces (usados na Task 2):
  - `IDLE_WRAP_SECONDS: number`
  - `wrapIdleTime(t: number): number`
  - `idlePhaseFor(worldX: number): number`
  - `interface SwayOffset { dx: number }`
  - `swayOffset(amp: number, t01: number, elapsed: number, phase: number, out: SwayOffset): SwayOffset`
  - `interface DripState { y: number; radius: number; alpha: number; visible: boolean }`
  - `dripAt(elapsed: number, phase: number, out: DripState): DripState`
  - `idleMotionFor(typeId: string): IdleSpec | null`
  - de `./manifest`: `type IdleSpec = { kind:'sway'; anchor:'top'|'bottom'; amp:number } | { kind:'drip' }`
  - de `./constants`: `IDLE_DRIP_COLOR: number`

- [ ] **Step 1: escrever os testes que falham**

Criar `tests/render/idle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  IDLE_WRAP_SECONDS,
  wrapIdleTime,
  idlePhaseFor,
  swayOffset,
  dripAt,
  idleMotionFor,
  type SwayOffset,
  type DripState,
} from '@render/idle';
import { DINO_TYPE_ID } from '@render/manifest';

const sway: SwayOffset = { dx: 0 };
const drip: DripState = { y: 0, radius: 0, alpha: 0, visible: false };

describe('swayOffset', () => {
  it('extremidade ancorada (t01=0) não se move', () => {
    for (const t of [0, 0.3, 0.77, 1.9]) {
      expect(swayOffset(0.8, 0, t, 1.1, sway).dx).toBe(0);
    }
  });

  it('amplitude 0 ⇒ sem movimento', () => {
    expect(swayOffset(0, 1, 0.4, 0, sway).dx).toBe(0);
  });

  it('|dx| <= amp em qualquer instante e posição (invariante de cobertura)', () => {
    const amp = 0.6;
    for (let i = 0; i < 200; i++) {
      const elapsed = i * 0.037;
      const t01 = (i % 11) / 10;
      const dx = swayOffset(amp, t01, elapsed, idlePhaseFor(i * 13), sway).dx;
      expect(Math.abs(dx)).toBeLessThanOrEqual(amp + 1e-12);
    }
  });

  it('a ponta livre balança mais que o meio no mesmo instante', () => {
    const elapsed = 0.31; // fora de um zero da senoide
    const tip = Math.abs(swayOffset(0.8, 1, elapsed, 0, sway).dx);
    const mid = Math.abs(swayOffset(0.8, 0.5, elapsed, 0, sway).dx);
    expect(tip).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
  });

  it('clampa t01 fora de 0..1', () => {
    const at1 = swayOffset(0.8, 1, 0.31, 0, sway).dx;
    const above = swayOffset(0.8, 1.4, 0.31, 0, sway).dx;
    const below = swayOffset(0.8, -3, 0.31, 0, sway).dx;
    expect(above).toBe(at1);
    expect(below).toBe(0);
  });

  it('fases diferentes ⇒ obstáculos dessincronizados', () => {
    const a = swayOffset(0.8, 1, 0.31, idlePhaseFor(100), sway).dx;
    const b = swayOffset(0.8, 1, 0.31, idlePhaseFor(137), sway).dx;
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('muta e devolve o MESMO out (alocação-zero)', () => {
    expect(swayOffset(0.8, 1, 0.31, 0, sway)).toBe(sway);
  });
});

describe('dripAt', () => {
  it('a gota engorda parada na ponta antes de cair', () => {
    const d = dripAt(0.5, 0, drip); // dentro da fase de formação (40% de 2,5s = 1,0s)
    expect(d.y).toBe(0);
    expect(d.radius).toBeGreaterThan(0);
    expect(d.visible).toBe(true);
  });

  it('depois de soltar, cai monotonicamente e some', () => {
    const y1 = dripAt(1.2, 0, drip).y;
    const y2 = dripAt(1.8, 0, drip).y;
    const end = dripAt(2.49, 0, drip);
    expect(y2).toBeGreaterThan(y1);
    expect(y1).toBeGreaterThan(0);
    expect(end.alpha).toBeLessThan(0.2);
  });

  it('o ciclo se repete (mesmo estado a cada período)', () => {
    const a = dripAt(0.7, 0, drip);
    const snapshot = { y: a.y, radius: a.radius, alpha: a.alpha, visible: a.visible };
    const b = dripAt(0.7 + 2.5, 0, drip);
    expect(b.y).toBeCloseTo(snapshot.y, 9);
    expect(b.alpha).toBeCloseTo(snapshot.alpha, 9);
    expect(b.visible).toBe(snapshot.visible);
  });

  it('fases diferentes dessincronizam as gotas', () => {
    const a = dripAt(1.2, 0, drip).y;
    const b = dripAt(1.2, Math.PI, drip).y;
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('muta e devolve o MESMO out (alocação-zero)', () => {
    expect(dripAt(1.2, 0, drip)).toBe(drip);
  });
});

describe('wrapIdleTime', () => {
  it('embrulha em IDLE_WRAP_SECONDS', () => {
    expect(IDLE_WRAP_SECONDS).toBe(100);
    expect(wrapIdleTime(0.5)).toBeCloseTo(0.5, 9);
    expect(wrapIdleTime(100.5)).toBeCloseTo(0.5, 9);
    expect(wrapIdleTime(-0.5)).toBeCloseTo(99.5, 9);
  });

  it('o embrulho não dá salto visual: sway e drip fecham um número inteiro de ciclos', () => {
    const before = swayOffset(0.8, 1, IDLE_WRAP_SECONDS + 0.31, 0.4, sway).dx;
    const after = swayOffset(0.8, 1, 0.31, 0.4, sway).dx;
    expect(before).toBeCloseTo(after, 6);

    const dBefore = dripAt(IDLE_WRAP_SECONDS + 1.2, 0.4, drip).y;
    const dAfter = dripAt(1.2, 0.4, drip).y;
    expect(dBefore).toBeCloseTo(dAfter, 6);
  });
});

describe('idlePhaseFor', () => {
  it('fase estável por posição de mundo, dentro de 0..2π', () => {
    for (const x of [-500, 0, 37.5, 1200]) {
      const p = idlePhaseFor(x);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(2 * Math.PI);
      expect(idlePhaseFor(x)).toBe(p); // determinística, sem RNG
    }
  });
});

describe('idleMotionFor', () => {
  it('árvore balança ancorada embaixo; cipó ancorado em cima', () => {
    expect(idleMotionFor('obstacle.tree')).toEqual({ kind: 'sway', anchor: 'bottom', amp: 0.6 });
    expect(idleMotionFor('obstacle.vine')).toEqual({ kind: 'sway', anchor: 'top', amp: 0.8 });
  });

  it('estalactite pinga', () => {
    expect(idleMotionFor('obstacle.stalactite')).toEqual({ kind: 'drip' });
  });

  it('null para quem não anima (pedra, dino, power-ups, id desconhecido)', () => {
    expect(idleMotionFor('obstacle.boulder')).toBeNull();
    expect(idleMotionFor(DINO_TYPE_ID)).toBeNull();
    expect(idleMotionFor('powerup.shield')).toBeNull();
    expect(idleMotionFor('bird.coin')).toBeNull();
    expect(idleMotionFor('nao.existe')).toBeNull();
  });

  it('memoizado: identidade estável entre chamadas (REGRA 3)', () => {
    expect(idleMotionFor('obstacle.tree')).toBe(idleMotionFor('obstacle.tree'));
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/render/idle.test.ts`
Expected: FAIL — `Failed to resolve import "@render/idle"`.

- [ ] **Step 3: adicionar o tipo/campo `idle` no manifesto**

Em `src/render/manifest.ts`, acrescentar o tipo exportado e o campo opcional na variante
`sprite`, e preencher as 3 entradas de obstáculo (nada mais muda):

```ts
/** Animação idle cosmética (9.4). Puramente visual: não toca hitbox nem simulação.
 *  `sway.anchor` = extremidade PRESA (a livre é a que balança); `amp` em unidades de mundo. */
export type IdleSpec =
  | { readonly kind: 'sway'; readonly anchor: 'top' | 'bottom'; readonly amp: number }
  | { readonly kind: 'drip' };

export type Renderable =
  | { readonly kind: 'primitive'; readonly color: number; readonly shape?: 'hitbox' | 'triangle' }
  | {
      readonly kind: 'sprite';
      readonly atlas: string;
      readonly frame?: string;
      readonly animation?: string;
      readonly segmented?: boolean;
      readonly idle?: IdleSpec;
    };
```

```ts
  'obstacle.tree': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.tree.body', segmented: true, idle: { kind: 'sway', anchor: 'bottom', amp: 0.6 } },
  'obstacle.vine': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.vine.body', segmented: true, idle: { kind: 'sway', anchor: 'top', amp: 0.8 } },
  'obstacle.boulder': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.boulder' },
  'obstacle.stalactite': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.stalactite', idle: { kind: 'drip' } },
```

- [ ] **Step 4: criar `src/render/idle.ts`**

```ts
/**
 * Animação idle cosmética de obstáculo (9.4): funções PURAS fechadas no tempo real de render.
 * Molde de `death.ts`/`particles.ts` — sem estado vivo, sem RNG, sem Phaser/DOM, escrevendo em
 * `out` (scratch reusável no hot path ⇒ alocação-zero, REGRA 3). Nada aqui toca `src/core/`:
 * a hitbox lógica é imutável e a colisão não enxerga estes deslocamentos (REGRA 2).
 */
import { renderableFor } from './manifest';
import type { IdleSpec } from './manifest';

/** O relógio cosmético embrulha aqui. Frequências abaixo fecham um número INTEIRO de ciclos
 *  neste período ⇒ o embrulho é invisível (e a precisão do float não degrada com o tempo). */
export const IDLE_WRAP_SECONDS = 100;

const SWAY_HZ = 0.4; // 0,4 × 100 = 40 ciclos exatos
const DRIP_PERIOD = 2.5; // 100 / 2,5 = 40 ciclos exatos
const DRIP_SWELL = 0.4; // fração do ciclo em que a gota engorda parada na ponta
const DRIP_FALL = 26; // queda total, unidades de mundo
const DRIP_RADIUS = 0.9; // raio máximo da gota, unidades de mundo
const DRIP_FADE_FROM = 0.7; // fração da queda a partir da qual a gota desvanece

const TWO_PI = Math.PI * 2;

/** Mantém o relógio cosmético em [0, IDLE_WRAP_SECONDS). */
export function wrapIdleTime(t: number): number {
  const w = t % IDLE_WRAP_SECONDS;
  return w < 0 ? w + IDLE_WRAP_SECONDS : w;
}

/** Fase por instância derivada da posição de mundo (constante por obstáculo — é o mundo que
 *  rola). Cosmética: dessincroniza os obstáculos SEM usar o RNG determinístico do core. */
export function idlePhaseFor(worldX: number): number {
  const p = worldX * 0.137 % TWO_PI;
  return p < 0 ? p + TWO_PI : p;
}

export interface SwayOffset {
  /** Deslocamento lateral em unidades de mundo; |dx| <= amp SEMPRE (garante a cobertura). */
  dx: number;
}

/** Balanço lateral de um segmento. `t01` = 0 na extremidade presa, 1 na livre; o peso `t01²`
 *  deixa a base cravada e a ponta solta. */
export function swayOffset(
  amp: number,
  t01: number,
  elapsed: number,
  phase: number,
  out: SwayOffset,
): SwayOffset {
  const t = t01 <= 0 ? 0 : t01 >= 1 ? 1 : t01;
  out.dx = amp * t * t * Math.sin(TWO_PI * SWAY_HZ * elapsed + phase);
  return out;
}

export interface DripState {
  /** Deslocamento vertical a partir da ponta do obstáculo (unidades de mundo, +y = baixo). */
  y: number;
  radius: number;
  alpha: number;
  visible: boolean;
}

/** Gota da estalactite: engorda parada na ponta, solta, cai acelerando e desvanece. Ciclo
 *  fechado ⇒ estado é função de (elapsed, phase), sem spawn/despawn. */
export function dripAt(elapsed: number, phase: number, out: DripState): DripState {
  const shifted = elapsed + (phase / TWO_PI) * DRIP_PERIOD;
  const cycle = ((shifted % DRIP_PERIOD) + DRIP_PERIOD) % DRIP_PERIOD;
  const p = cycle / DRIP_PERIOD;
  if (p < DRIP_SWELL) {
    const q = p / DRIP_SWELL;
    out.y = 0;
    out.radius = DRIP_RADIUS * q;
    out.alpha = 1;
    out.visible = q > 0;
    return out;
  }
  const q = (p - DRIP_SWELL) / (1 - DRIP_SWELL);
  out.y = DRIP_FALL * q * q;
  out.radius = DRIP_RADIUS;
  out.alpha = q < DRIP_FADE_FROM ? 1 : Math.max(0, (1 - q) / (1 - DRIP_FADE_FROM));
  out.visible = out.alpha > 0;
  return out;
}

/** Cache por typeId: roda 1×/obstáculo/frame no hot path ⇒ não pode alocar (REGRA 3). */
const idleCache = new Map<string, IdleSpec | null>();

/** Movimento idle do tipo lógico, ou null se ele não anima. Memoizado (identidade estável). */
export function idleMotionFor(typeId: string): IdleSpec | null {
  let spec = idleCache.get(typeId);
  if (spec === undefined) {
    const r = renderableFor(typeId);
    spec = r.kind === 'sprite' ? (r.idle ?? null) : null;
    idleCache.set(typeId, spec);
  }
  return spec;
}
```

- [ ] **Step 5: cor da gota em `src/render/constants.ts`**

Acrescentar junto das constantes de morte (9.3), seguindo o estilo do arquivo:

```ts
/** Cor da gota da estalactite (idle 9.4). Água mineral clara sobre a rocha. */
export const IDLE_DRIP_COLOR = 0x9fd8ef;
```

- [ ] **Step 6: rodar os testes**

Run: `npx vitest run tests/render/idle.test.ts tests/render/manifest.test.ts tests/render/sprites.test.ts`
Expected: PASS (todos).

- [ ] **Step 7: typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 8: commit**

```bash
git add src/render/idle.ts src/render/manifest.ts src/render/constants.ts tests/render/idle.test.ts
git commit -m "feat(9.4): curvas puras de idle de obstáculo (sway/drip) + campo idle no manifesto"
```

---

### Task 2: casca — balanço dos segmentos e gota na `GameScene`

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: tudo o que a Task 1 produziu (`idleMotionFor`, `swayOffset`, `dripAt`,
  `idlePhaseFor`, `wrapIdleTime`, `IDLE_DRIP_COLOR`, `IdleSpec`).
- Produces: nada para tasks seguintes (é a ponta da casca).

- [ ] **Step 1: imports e campos de estado**

Nos imports de `./sprites`/`./manifest` já existentes, acrescentar:

```ts
import { idleMotionFor, swayOffset, dripAt, idlePhaseFor, wrapIdleTime } from './idle';
import type { SwayOffset, DripState } from './idle';
import type { IdleSpec } from './manifest';
```

e `IDLE_DRIP_COLOR` na lista de `./constants`.

Campos novos da classe (junto dos scratches de morte, ~linha 90):

```ts
  // Idle cosmético de obstáculo (9.4): relógio de render local (não existe no core, não entra em
  // hash) + scratches reusáveis (REGRA 3).
  private idleElapsed = 0;
  private readonly swayScratch: SwayOffset = { dx: 0 };
  private readonly dripScratch: DripState = { y: 0, radius: 0, alpha: 0, visible: false };
```

- [ ] **Step 2: avançar o relógio cosmético**

Em `update`, logo após o early-return de pausa (`if (paused) return;`) e antes de
`const match = this.match;`:

```ts
    // Relógio do idle cosmético (9.4). Congela na pausa (o early-return acima) e embrulha em
    // IDLE_WRAP_SECONDS sem salto visual.
    this.idleElapsed = wrapIdleTime(this.idleElapsed + deltaMs / 1000);
```

- [ ] **Step 3: gota da estalactite no caminho de sprite único**

Em `drawSpriteEntity`, ajustar a chamada da versão segmentada para passar o spec e desenhar a
gota no caminho de sprite único (o `Graphics` `this.gfx` já desenha em unidades de mundo):

```ts
  private drawSpriteEntity(e: Entity, scrollX: number, entityTint: number): void {
    const typeId = e.tags[0] ?? '';
    const idle = idleMotionFor(typeId);
    const seg = segmentFramesFor(typeId);
    if (seg !== null) { this.drawSegmentedEntity(e, seg, idle, scrollX, entityTint); return; }
    const x = e.transform.position.x;
    if (!isHorizontallyVisible(x, leftExtent(e.hitbox), rightExtent(e.hitbox), scrollX, VIEW_WIDTH, CULL_MARGIN)) {
      return;
    }
    const frame = frameFor(typeId);
    if (frame === null) { // fallback primitivo (id desconhecido)
      this.drawEntity(this.gfx, e);
      return;
    }
    const img = this.acquireSprite();
    img.setTexture(this.atlasKey, frame);
    img.setTint(entityTint);
    const s = this.sizeFor(typeId, e.hitbox);
    img.setDisplaySize(this.px(s.w), this.px(s.h)); // W5: mundo → px de render
    img.setPosition(this.px(x), this.px(e.transform.position.y));
    // Idle 9.4: a estalactite pinga. O sprite NÃO se desloca ⇒ a cobertura da hitbox (9.2) fica
    // idêntica; a gota é desenho à parte, como as partículas de morte.
    if (idle !== null && idle.kind === 'drip') {
      this.drawDrip(x, e.transform.position.y + s.h / 2);
    }
  }

  /** Gota caindo da ponta (cx, tipY) em unidades de mundo. Alocação-zero (scratch de campo). */
  private drawDrip(cx: number, tipY: number): void {
    const d = dripAt(this.idleElapsed, idlePhaseFor(cx), this.dripScratch);
    if (!d.visible || d.radius <= 0) return;
    this.gfx.fillStyle(IDLE_DRIP_COLOR, d.alpha);
    this.gfx.fillCircle(cx, tipY + d.y, d.radius);
  }
```

- [ ] **Step 4: balanço na composição segmentada (com sangria)**

Substituir `drawSegmentedEntity` por:

```ts
  /** Monta cap(topo)+N×body+base(fundo) cobrindo a hitbox aabb (REGRA 2). Alocação-zero:
   *  scratch de layout reusado + pool de Image (REGRA 3).
   *  Idle 9.4 (`sway`): cada segmento desloca `dx` (|dx| <= amp) e é desenhado com largura
   *  `W + 2·amp` — a SANGRIA igual à amplitude garante, por construção, que o balanço nunca
   *  descobre a hitbox (aceite de 9.2: a borda visível cobre a caixa lógica). */
  private drawSegmentedEntity(
    e: Entity,
    frames: SegmentFrames,
    idle: IdleSpec | null,
    scrollX: number,
    tint: number,
  ): void {
    const hb = e.hitbox;
    if (hb.kind !== 'aabb') return; // segmentação só p/ aabb (garantido pelo catálogo)
    const x = e.transform.position.x;
    if (!isHorizontallyVisible(x, leftExtent(hb), rightExtent(hb), scrollX, VIEW_WIDTH, CULL_MARGIN)) return;
    const sway = idle !== null && idle.kind === 'sway' ? idle : null;
    const amp = sway !== null ? sway.amp : 0;
    const phase = sway !== null ? idlePhaseFor(x) : 0;
    const W = hb.halfW * 2 + 2 * amp, H = hb.halfH * 2;
    const cy = e.transform.position.y, top = cy - hb.halfH, bottom = cy + hb.halfH;
    const d = this.segDims(frames);
    const widthScale = W / d.partW;
    const L = layoutSegments(H, d.capH * widthScale, d.bodyH * widthScale, d.baseH * widthScale, this.segScratch);
    const capY = top + L.capH / 2;
    this.placeSeg(frames.cap, x + this.swayDx(sway, phase, capY, top, H), capY, W, L.capH, tint);
    let y = top + L.capH;
    for (let i = 0; i < L.bodyN; i++) {
      const bodyY = y + L.bodyH / 2;
      this.placeSeg(frames.body, x + this.swayDx(sway, phase, bodyY, top, H), bodyY, W, L.bodyH, tint);
      y += L.bodyH;
    }
    const baseY = bottom - L.baseH / 2;
    this.placeSeg(frames.base, x + this.swayDx(sway, phase, baseY, top, H), baseY, W, L.baseH, tint);
  }

  /** Deslocamento lateral do segmento centrado em `cy`. `t01` = distância normalizada até a
   *  extremidade PRESA (`anchor`). 0 quando o obstáculo não balança. */
  private swayDx(
    sway: Extract<IdleSpec, { kind: 'sway' }> | null,
    phase: number,
    cy: number,
    top: number,
    H: number,
  ): number {
    if (sway === null || H <= 0) return 0;
    const t01 = sway.anchor === 'top' ? (cy - top) / H : (top + H - cy) / H;
    return swayOffset(sway.amp, t01, this.idleElapsed, phase, this.swayScratch).dx;
  }
```

Nota: `W` agora inclui a sangria, então `widthScale` já escala as alturas das partes na mesma
proporção — a arte continua sem distorção (razão de aspecto de cada parte preservada).

- [ ] **Step 5: rodar a suíte inteira**

Run: `npm test`
Expected: PASS, incluindo `tests/render/idle.test.ts` da Task 1. Nenhum teste novo aqui: a
`GameScene` é casca de Phaser (não testável em unidade); a lógica testável está na Task 1.

- [ ] **Step 6: typecheck/lint**

Run: `npm run check`
Expected: sem erros. Atenção ao `Extract<IdleSpec, { kind: 'sway' }>` (TS estrito, sem `any`).

- [ ] **Step 7: commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(9.4): balanço dos obstáculos segmentados (sangria=amplitude) + gota da estalactite"
```

---

### Task 3: docs, roadmap e verificação final

**Files:**
- Modify: `docs/assets/specs/obstacle.tree.md` (campo **Animação**)
- Modify: `docs/assets/specs/obstacle.vine.md` (campo **Animação**)
- Modify: `docs/assets/specs/obstacle.stalactite.md` (campo **Animação**)
- Modify: `docs/assets/specs/obstacle.boulder.md` (campo **Animação**)
- Modify: `docs/roadmap/PHASE-09-structural-improvements.md` (marcar 9.4 + nota de fechamento)
- Modify: `CLAUDE.md` (bloco "Estado atual": contagem de testes e a linha da Frente A)

**Interfaces:**
- Consumes: o comportamento entregue nas Tasks 1 e 2.
- Produces: nada em código.

- [ ] **Step 1: atualizar o campo Animação dos 4 asset-specs**

Em cada arquivo, substituir a linha `- **Animação:** ...` pelo texto correspondente (REGRA 5: o
caminho de frames fica documentado como variante futura, sem branch morto no código):

`obstacle.tree.md`:
```markdown
- **Animação:** idle PROCEDURAL no render (9.4) — balanço lateral (`idle: { kind:'sway', anchor:'bottom', amp:0.6 }` no manifesto), base cravada e copa solta; a arte é 1 frame por parte. Variante futura opcional: tira de 4 frames por parte (Apêndice A.2 do PHASE-09) — exigiria também trocar o manifesto e o caminho de render.
```

`obstacle.vine.md`:
```markdown
- **Animação:** idle PROCEDURAL no render (9.4) — balanço pendente (`idle: { kind:'sway', anchor:'top', amp:0.8 }` no manifesto), fixação no teto cravada e ponta solta; a arte é 1 frame por parte. Variante futura opcional: tira de 4 frames por parte (Apêndice A.2 do PHASE-09).
```

`obstacle.stalactite.md`:
```markdown
- **Animação:** idle PROCEDURAL no render (9.4) — gota se formando na ponta e caindo em ciclo de 2,5 s (`idle: { kind:'drip' }` no manifesto), desenhada à parte no `Graphics`; o sprite NÃO se desloca. A arte é 1 frame.
```

`obstacle.boulder.md`:
```markdown
- **Animação:** estático de propósito (pedra) — sem `idle` no manifesto (9.4).
```

- [ ] **Step 2: marcar 9.4 no arquivo da fase**

Em `docs/roadmap/PHASE-09-structural-improvements.md`, na seção `### 9.4`, trocar `- [ ]` por
`- [x]` nos dois bullets, marcar o título como `— CONCLUÍDA` e inserir logo abaixo dos bullets
um bloco `>` (mesmo formato de 9.2/9.3) registrando: decisão procedural (frames rejeitados e por
quê), invariante da sangria = amplitude, `src/render/idle.ts` puro + campo `idle` no manifesto,
relógio embrulhado em 100 s, resultados de `npm test`/`npm run check`/determinismo e o backlog
(arte real segmentada; variante de frames). Além disso, na linha 113 do bloco de 9.2 e na linha
169 do bloco de 9.3, o texto que remete a 9.4 continua válido — não editar.

- [ ] **Step 3: atualizar o "Estado atual" do `CLAUDE.md`**

- Na linha de métricas, atualizar a contagem de testes para o número REAL impresso por
  `npm test` (não estimar).
- Na linha da Frente A, marcar `9.4 idle de obstáculo ✅` com uma frase-resumo e apontar
  `**9.5 ... ← PRÓXIMO**` na Frente B.

- [ ] **Step 4: verificação de verdade**

Run: `npm test`
Expected: 0 falhas; anotar o total.

Run: `npm run check`
Expected: limpo.

Run: `npm run test:determinism`
Expected: **67** testes passando (o core não foi tocado — a contagem tem de ficar idêntica).

- [ ] **Step 5: commit**

```bash
git add docs/assets/specs/obstacle.*.md docs/roadmap/PHASE-09-structural-improvements.md CLAUDE.md
git commit -m "docs(9.4): specs de animação, item marcado na fase e estado atual"
```

---

## Verificação final da branch (controlador)

1. `npm test` + `npm run check` + `npm run test:determinism` — evidência colada no relato.
2. Review final da branch (agente `reviewer`), com foco em: alocação por frame (REGRA 3),
   `src/core/` intocado (`git diff main --stat -- src/core` vazio), cobertura da hitbox
   preservada pela sangria.
3. Validação visual Playwright no build de produção (`npm run build` + preview, `?nocache` e
   unregister do service worker — gotcha recorrente): confirmar que árvore/cipó oscilam, que a
   gota aparece e cai, e que não há erro de console.
4. PR + merge automático em `main` (pré-autorizado pelo `CLAUDE.md`).

## Self-review deste plano

- **Cobertura da spec:** módulo puro (T1), manifesto (T1), constantes (T1), casca sway + drip com
  sangria (T2), testes puros incluindo a propriedade de cobertura e o embrulho (T1), docs/asset
  specs/roadmap (T3), fora-de-escopo respeitado (nenhuma task toca coletáveis/power-ups, atlas,
  gen-atlas ou `src/core/`).
- **Placeholders:** nenhum — todo passo tem código ou comando concreto.
- **Consistência de tipos:** `IdleSpec` (manifest) / `SwayOffset` / `DripState` / `swayOffset` /
  `dripAt` / `idleMotionFor` / `wrapIdleTime` / `idlePhaseFor` / `IDLE_DRIP_COLOR` usados com os
  mesmos nomes e assinaturas nas Tasks 1 e 2.
