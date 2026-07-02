# Render Performance (2.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a Fase 2 provando 60fps+: culling de fora-de-tela, hot path de render sem alocação por frame, e evidência de fps registrada.

**Architecture:** O renderer usa um único `Graphics` em modo imediato (redesenhado por frame). Adicionamos um predicado PURO de culling horizontal (novo `src/render/culling.ts`), um helper geométrico puro `leftExtent` na hitbox, e tornamos o desenho alocação-zero (polígono via API de path, bounds do dino cacheados). Nenhuma mudança na simulação (`src/core/sim/step.ts` etc.) ⇒ determinismo intacto.

**Tech Stack:** TypeScript estrito, Phaser 4 (só na casca `GameScene`), Vitest (testes puros em node), Playwright (evidência de fps).

## Global Constraints

- **REGRA 1 (Determinismo):** `src/core/` de simulação NÃO é tocado. Único arquivo de core editado é `src/core/sim/hitbox.ts` (geometria pura: sem `Math.random`/`Date`/`performance`). Suíte de determinismo permanece verde.
- **REGRA 2 (Arte desacoplada):** culling e desenho usam a **hitbox lógica**, nunca pixels/arte.
- **REGRA 3 (Performance):** nenhuma alocação por frame no hot path (`update`/`drawPrimitive`). Só escalares.
- **REGRA 4 (i18n):** nenhuma string de UI hardcoded (este item não adiciona texto visível).
- Módulos PUROS de `src/render/` NÃO importam `phaser` (testáveis em node). A casca (`GameScene`) não tem teste de unidade — validada por `tsc`/`eslint` + Playwright (padrão 2.1–2.6).
- Verificação de fechamento: `npm run check` limpo, `npm test` verde, `npm run test:determinism` verde.
- Canvas lógico: `VIEW_WIDTH=320`, `VIEW_HEIGHT=180`. Câmera segue o dino: `scrollX = renderX − DINO_SCREEN_X`. Entidades vivem em coords de mundo; `x de tela = worldX − scrollX`.

---

### Task A: Culling horizontal de fora-de-tela

**Files:**
- Modify: `src/core/sim/hitbox.ts` (adiciona `leftExtent`, espelho de `rightExtent`)
- Test: `tests/core/sim/hitbox.test.ts` (cobre `leftExtent` e `rightExtent`)
- Create: `src/render/culling.ts` (predicado puro)
- Test: `tests/render/culling.test.ts`
- Modify: `src/render/constants.ts` (adiciona `CULL_MARGIN`)
- Modify: `src/render/GameScene.ts` (aplica culling no laço de desenho)

**Interfaces:**
- Produces:
  - `leftExtent(h: Hitbox): number` — menor x da hitbox relativo ao centro (aabb: `-halfW`; circle: `-radius`; polygon: min dos `p.x`). Alocação-zero. Exportada de `@core/sim`.
  - `isHorizontallyVisible(worldX: number, extentLeft: number, extentRight: number, cameraScrollX: number, viewWidth: number, margin: number): boolean` em `@render/culling`. Alocação-zero.
  - `CULL_MARGIN: number` em `@render/constants` (valor `4`).
- Consumes: `rightExtent` (já existe em `@core/sim`), `boundsOf`/`Entity`/`Hitbox` (já usados na `GameScene`).

- [ ] **Step 1: Escrever o teste que falha para `leftExtent` (e fixar `rightExtent`)**

Em `tests/core/sim/hitbox.test.ts`, adicionar ao import `rightExtent, leftExtent`:
```ts
import { aabb, circle, cloneHitbox, polygon, boundsOf, rightExtent, leftExtent } from '@core/sim';
```
E adicionar o bloco:
```ts
describe('leftExtent / rightExtent', () => {
  it('aabb: extents são ∓halfW', () => {
    expect(leftExtent(aabb(6, 8))).toBe(-6);
    expect(rightExtent(aabb(6, 8))).toBe(6);
  });
  it('circle: extents são ∓radius', () => {
    expect(leftExtent(circle(10))).toBe(-10);
    expect(rightExtent(circle(10))).toBe(10);
  });
  it('polygon: extents são min/max dos x dos pontos', () => {
    const h = polygon([
      { x: -4, y: -3 },
      { x: 6, y: 0 },
      { x: 2, y: 9 },
    ]);
    expect(leftExtent(h)).toBe(-4);
    expect(rightExtent(h)).toBe(6);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/core/sim/hitbox.test.ts`
Expected: FAIL — `leftExtent` não existe (erro de import/tsc).

- [ ] **Step 3: Implementar `leftExtent` em `src/core/sim/hitbox.ts`**

Logo após `rightExtent`, adicionar:
```ts
/** Extensão horizontal à esquerda do centro (minX), sem alocar — espelho de rightExtent. */
export function leftExtent(h: Hitbox): number {
  switch (h.kind) {
    case 'aabb':
      return -h.halfW;
    case 'circle':
      return -h.radius;
    case 'polygon': {
      let minX = Infinity;
      for (const p of h.points) if (p.x < minX) minX = p.x;
      return minX;
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/core/sim/hitbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste que falha do predicado de culling**

Criar `tests/render/culling.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isHorizontallyVisible } from '@render/culling';

// viewWidth=320. Assinatura: (worldX, extentLeft, extentRight, cameraScrollX, viewWidth, margin)
describe('isHorizontallyVisible', () => {
  it('entidade no centro da tela é visível', () => {
    // worldX=160, scrollX=0 ⇒ tela [150,170] dentro de [0,320]
    expect(isHorizontallyVisible(160, -10, 10, 0, 320, 0)).toBe(true);
  });

  it('entidade totalmente à esquerda da câmera é cullada', () => {
    // worldX=100, scrollX=200 ⇒ right edge de tela = 100+10-200 = -90 < 0
    expect(isHorizontallyVisible(100, -10, 10, 200, 320, 0)).toBe(false);
  });

  it('entidade totalmente à direita do viewport é cullada', () => {
    // worldX=540, scrollX=0 ⇒ left edge de tela = 540-10-0 = 530 > 320
    expect(isHorizontallyVisible(540, -10, 10, 0, 320, 0)).toBe(false);
  });

  it('entidade tocando a borda esquerda (screen maxX = 0) é visível com margin 0', () => {
    // worldX=190, scrollX=200 ⇒ maxX de tela = 190+10-200 = 0 ⇒ >= 0 ⇒ visível
    expect(isHorizontallyVisible(190, -10, 10, 200, 320, 0)).toBe(true);
  });

  it('a margin amplia a janela visível (entidade logo à esquerda entra)', () => {
    // worldX=185, scrollX=200 ⇒ maxX de tela = 185+10-200 = -5. margin 0 ⇒ fora; margin 8 ⇒ dentro
    expect(isHorizontallyVisible(185, -10, 10, 200, 320, 0)).toBe(false);
    expect(isHorizontallyVisible(185, -10, 10, 200, 320, 8)).toBe(true);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test -- tests/render/culling.test.ts`
Expected: FAIL — `culling` module/`isHorizontallyVisible` não existe.

- [ ] **Step 7: Implementar `src/render/culling.ts`**

```ts
/**
 * Culling horizontal de render (REGRA 3, alocação-zero). O mundo cabe na ALTURA da view
 * (VIEW_HEIGHT == worldHeight), então num side-scroller só o eixo x sai da tela.
 * Uma entidade em worldX ocupa, em coords de tela, [worldX+extentLeft−scrollX,
 * worldX+extentRight−scrollX]; é visível sse esse intervalo intersecta [−margin, viewWidth+margin].
 */
export function isHorizontallyVisible(
  worldX: number,
  extentLeft: number,
  extentRight: number,
  cameraScrollX: number,
  viewWidth: number,
  margin: number,
): boolean {
  const screenMinX = worldX + extentLeft - cameraScrollX;
  const screenMaxX = worldX + extentRight - cameraScrollX;
  return screenMaxX >= -margin && screenMinX <= viewWidth + margin;
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- tests/render/culling.test.ts`
Expected: PASS.

- [ ] **Step 9: Adicionar `CULL_MARGIN` em `src/render/constants.ts`**

Após o bloco de `DINO_SCREEN_X`/`MAX_FRAME_TIME` (topo do arquivo), adicionar:
```ts
/** Margem (px) do culling horizontal de render: evita "pop" de entidades entrando na borda. */
export const CULL_MARGIN = 4;
```

- [ ] **Step 10: Aplicar culling no laço de desenho da `GameScene`**

Em `src/render/GameScene.ts`:

Ajustar imports do core para incluir os extents:
```ts
import { boundsOf, leftExtent, rightExtent } from '@core/sim';
```
Adicionar `CULL_MARGIN` à lista de imports de `./constants`.

Substituir o laço de desenho de entidades em `update` (as duas linhas `for (const o ...)` / `for (const c ...)`) por uma versão com culling. Trocar:
```ts
    const g = this.gfx;
    g.clear();
    for (const o of world.obstacles) this.drawEntity(g, o);
    for (const c of world.collectibles) this.drawEntity(g, c);
    this.drawPrimitive(g, DINO_TYPE_ID, world.pterodactyl.hitbox, loop.renderX, loop.renderY);
```
por:
```ts
    const g = this.gfx;
    g.clear();
    this.drawVisible(g, world.obstacles, scrollX);
    this.drawVisible(g, world.collectibles, scrollX);
    this.drawPrimitive(g, DINO_TYPE_ID, world.pterodactyl.hitbox, loop.renderX, loop.renderY);
```
(`scrollX` já está em escopo — é `this.cameras.main.scrollX` capturado acima do laço de parallax.)

Adicionar o método privado (perto de `drawEntity`):
```ts
  /** Desenha só as entidades cuja extensão horizontal intersecta o viewport (culling, REGRA 3). */
  private drawVisible(g: Phaser.GameObjects.Graphics, entities: readonly Entity[], scrollX: number): void {
    for (const e of entities) {
      const x = e.transform.position.x;
      if (!isHorizontallyVisible(x, leftExtent(e.hitbox), rightExtent(e.hitbox), scrollX, VIEW_WIDTH, CULL_MARGIN)) {
        continue;
      }
      this.drawEntity(g, e);
    }
  }
```
Adicionar o import do predicado:
```ts
import { isHorizontallyVisible } from './culling';
```

- [ ] **Step 11: Rodar suíte completa + typecheck**

Run: `npm run check && npm test`
Expected: `tsc`/eslint limpos; todos os testes verdes (incluindo os novos de culling e hitbox).

- [ ] **Step 12: Commit**

```bash
git add src/core/sim/hitbox.ts tests/core/sim/hitbox.test.ts src/render/culling.ts tests/render/culling.test.ts src/render/constants.ts src/render/GameScene.ts
git commit -m "feat(2.7): culling horizontal de fora-de-tela (leftExtent + isHorizontallyVisible)"
```

---

### Task B: Hot path de desenho sem alocação por frame

**Files:**
- Modify: `src/render/GameScene.ts` (`drawPrimitive` polígono via path; cache de bounds do dino; `default: never`)

**Interfaces:**
- Consumes: `boundsOf` (já importado), `Hitbox` (já importado).
- Produces: nenhuma API pública nova (mudança interna da casca).

**Nota de teste:** a casca Phaser não tem teste de unidade (padrão 2.1–2.6). A verificação desta task é `npm run check` (o `default: never` é uma prova de compilação) + a inspeção visual/fps da Task C. Não há passo de "teste que falha" porque não há módulo puro novo.

- [ ] **Step 1: Polígono via API de path (elimina `points.map(new Vector2)`)**

Em `src/render/GameScene.ts`, no `switch (hitbox.kind)` de `drawPrimitive`, trocar o `case 'polygon'`:
```ts
      case 'polygon':
        g.fillPoints(
          hitbox.points.map((p) => new Phaser.Math.Vector2(cx + p.x, cy + p.y)),
          true,
        );
        break;
```
por (iteração indexada, zero alocação por frame):
```ts
      case 'polygon': {
        const pts = hitbox.points;
        g.beginPath();
        g.moveTo(cx + pts[0]!.x, cy + pts[0]!.y);
        for (let i = 1; i < pts.length; i++) g.lineTo(cx + pts[i]!.x, cy + pts[i]!.y);
        g.closePath();
        g.fillPath();
        break;
      }
```

- [ ] **Step 2: Guarda de exaustividade no switch de hitbox**

No mesmo `switch (hitbox.kind)`, após o `case 'polygon'`, adicionar:
```ts
      default: {
        const _exhaustive: never = hitbox;
        return _exhaustive;
      }
```

- [ ] **Step 3: Cachear os bounds do triângulo do dino (elimina `boundsOf` por frame)**

Adicionar campos privados na classe `GameScene` (junto dos outros, ex. após `wasDead = false;`):
```ts
  private dinoBoundsHitbox: Hitbox | null = null;
  private dinoBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
```
No ramo `if (r.shape === 'triangle')` de `drawPrimitive`, trocar:
```ts
    if (r.shape === 'triangle') {
      const b = boundsOf(hitbox); // ápice em +x (pássaro voltado para a direita)
      g.fillTriangle(cx + b.minX, cy + b.minY, cx + b.minX, cy + b.maxY, cx + b.maxX, cy);
      return;
    }
```
por (recomputa só quando a referência da hitbox muda — no restart nasce um novo world):
```ts
    if (r.shape === 'triangle') {
      if (this.dinoBoundsHitbox !== hitbox) {
        this.dinoBounds = boundsOf(hitbox); // ápice em +x (pássaro voltado para a direita)
        this.dinoBoundsHitbox = hitbox;
      }
      const b = this.dinoBounds;
      g.fillTriangle(cx + b.minX, cy + b.minY, cx + b.minX, cy + b.maxY, cx + b.maxX, cy);
      return;
    }
```

- [ ] **Step 4: Typecheck + suíte**

Run: `npm run check && npm test`
Expected: `tsc`/eslint limpos (o `never` compila porque o switch é exaustivo); testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "perf(2.7): desenho alocação-zero (polígono via path, bounds do dino cacheados, default:never)"
```

---

### Task C: Medição de fps e evidência

**Files:**
- Modify: `docs/superpowers/specs/2026-07-01-render-performance-design.md` (seção "Evidência de performance")
- Modify: `docs/roadmap/PHASE-02-endless-vertical-slice.md` (marca 2.7 `[x]`)
- Modify: `CLAUDE.md` (atualiza "Estado atual" — Fase 2 concluída)

**Interfaces:** nenhuma (task de verificação + documentação).

**Nota:** esta task é feita pelo ORQUESTRADOR (não por subagente), pois usa Playwright/dev server e escreve a evidência. Metodologia: subir o dev server, abrir o jogo no Playwright, iniciar a partida (tap), e medir fps real por `requestAnimationFrame` durante ~5s, em viewport desktop e em viewport mobile emulado (com CPU throttling via CDP quando disponível). Registrar números e limitações (sem device físico ⇒ Fase 7).

- [ ] **Step 1: Subir o dev server**

Run (background): `bash scripts/run.sh` (ou `npm run dev`). Confirmar a URL/porta.

- [ ] **Step 2: Medir fps desktop via Playwright**

Navegar ao jogo, dar um tap (iniciar partida), aguardar ~1s de warm-up, então medir fps por rAF durante ~5s via `browser_evaluate`:
```js
() => new Promise((resolve) => {
  let frames = 0; const t0 = performance.now();
  function tick(){ frames++; if (performance.now()-t0 < 5000) requestAnimationFrame(tick);
    else resolve({ fps: Math.round(frames / ((performance.now()-t0)/1000)) }); }
  requestAnimationFrame(tick);
});
```
Registrar o valor.

- [ ] **Step 3: Medir fps mobile emulado**

Redimensionar para viewport de celular (ex. 390×844), repetir a medição de rAF. Se o backend expuser CDP `Emulation.setCPUThrottlingRate`, aplicar throttle (ex. 4×) e medir de novo; senão, registrar como "sem throttle de CPU".

- [ ] **Step 4: Inspeção visual do culling**

Confirmar que o cenário renderiza idêntico (entidades fora da tela não desenhadas não causam buraco visível) e que a partida joga do início ao Game Over. Screenshot como evidência.

- [ ] **Step 5: Preencher a seção "Evidência de performance" na spec**

Substituir o placeholder `_(preenchida...)_` por: viewport(s), fps medido (desktop/mobile), metodologia (rAF 5s), throttle usado, e a limitação (headless ≠ device físico; validação em hardware é Fase 7). Se desktop ≥ 60fps ⇒ critério atendido.

- [ ] **Step 6: Marcar o item e atualizar o estado**

Em `docs/roadmap/PHASE-02-endless-vertical-slice.md`, marcar os dois checkboxes de 2.7 como `[x]`.
Em `CLAUDE.md`, atualizar "Estado atual": Fase 2 CONCLUÍDA (incluir resumo de 2.7) e ajustar a linha "Próximo" para a Fase 3.

- [ ] **Step 7: Parar o dev server e commitar**

Run: `bash scripts/stop.sh` (se aplicável).
```bash
git add docs/superpowers/specs/2026-07-01-render-performance-design.md docs/roadmap/PHASE-02-endless-vertical-slice.md CLAUDE.md
git commit -m "docs(2.7): evidência de fps (60fps+ desktop) e fechamento da Fase 2"
```

---

## Self-Review

**Spec coverage:**
- (A) Culling horizontal puro + `leftExtent` + wiring → Task A. ✓
- (B) Hot path zero-alloc (polígono via path, bounds do dino, `default:never`) → Task B. ✓
- (C) Evidência de fps desktop+mobile + fechamento → Task C. ✓
- Pooling de sprites / culling vertical / device físico → documentados como fora de escopo na spec; nenhuma task (correto). ✓

**Placeholder scan:** a única marca `TBD/placeholder` é a seção de evidência da spec, que a Task C preenche com números reais. Sem TODOs no código.

**Type consistency:** `leftExtent(h: Hitbox): number` e `rightExtent` (existente) usados na Task A batem com a chamada em `drawVisible`. `isHorizontallyVisible(worldX, extentLeft, extentRight, cameraScrollX, viewWidth, margin)` idêntica entre teste, implementação e chamada. `dinoBounds`/`dinoBoundsHitbox` consistentes na Task B. ✓
