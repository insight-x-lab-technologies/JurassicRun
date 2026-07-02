# Spec — 2.7 Performance (render): culling, hot-path zero-alloc, evidência de fps

> Fase 2, item 2.7. Fecha o vertical slice Endless com **60fps+** provado.
> Escopo: **só `src/render/`** (+ um helper puro em `src/core/sim/hitbox.ts`). O core de
> simulação NÃO é tocado ⇒ determinismo intacto por construção (REGRA 1).

## Objetivo

O jogo já roda (2.1–2.6). Este item garante que ele roda **rápido e sem GC no hot path**, e
**registra evidência** de fps. Traduz o item do roadmap ("object pooling; culling de fora-de-tela;
medir fps desktop/mobile, alvo 60fps+") para a realidade do renderer geométrico atual.

## Contexto: como o renderer desenha hoje

`GameScene.update` usa **um único `Phaser.GameObjects.Graphics`** (`this.gfx`) que é `clear()`ado
e **redesenhado por completo a cada frame** em modo imediato (`fillRect`/`fillCircle`/
`fillTriangle`/`fillPoints`). **Não há GameObject por entidade.** Consequências:

- **"Object pooling" clássico (reusar sprites em vez de criar/destruir) não se aplica na fase
  geométrica** — não existem objetos por entidade para reciclar. Ele só passa a importar quando
  entram sprites PNG (Fase 8). **Decisão:** adiar pooling de sprites real para a Fase 8; em 2.7
  atacamos o objetivo verdadeiro do item (sem GC no hot path, 60fps) via **desenho
  alocação-zero** + **culling**.
- O hot path **aloca por frame** em dois pontos (dívida marcada desde 2.1):
  1. `drawPrimitive` polígono: `hitbox.points.map((p) => new Phaser.Math.Vector2(...))` ⇒ um array
     + N `Vector2` por obstáculo-polígono por frame.
  2. `drawPrimitive` triângulo (dino): `boundsOf(hitbox)` ⇒ um objeto `Bounds` por frame.
- **Todas** as entidades do mundo são desenhadas, mesmo fora da tela.

## Escopo (o que 2.7 entrega)

### A. Culling horizontal de fora-de-tela (puro + testável)
- O mundo cabe na **altura** da view (`VIEW_HEIGHT == worldHeight` ⇒ 1 unidade = 1px), então num
  side-scroller **só o eixo horizontal** sai da tela. Culling é **horizontal apenas** (documentado).
- Novo módulo PURO `src/render/culling.ts` (sem `phaser`, testável em node):
  `isHorizontallyVisible(worldX, extentLeft, extentRight, cameraScrollX, viewWidth, margin) →
  boolean`. Verdadeiro sse o intervalo de tela `[worldX+extentLeft−scrollX,
  worldX+extentRight−scrollX]` intersecta `[−margin, viewWidth+margin]`. Só escalares ⇒
  **alocação-zero** (REGRA 3).
- `extentLeft`/`extentRight` vêm de helpers **alocação-zero** da hitbox: `rightExtent` já existe em
  `src/core/sim/hitbox.ts`; adicionar seu espelho `leftExtent(h)` (mínimo x da hitbox), pura,
  sem fontes proibidas ⇒ determinismo intacto. Testada junto de `rightExtent`.
- `CULL_MARGIN` (constante pequena, ex. `4`px) em `constants.ts` evita "pop" de entidades entrando
  na borda por arredondamento/interp.
- Wiring na `GameScene.update`: antes de `drawEntity`, pular obstáculos/coletáveis não-visíveis
  (a câmera segue o dino interpolado; culling usa `cameras.main.scrollX`). O dino nunca é cullado.

### B. Hot path alocação-zero (casca Phaser)
- **Polígono:** trocar `fillPoints(points.map(new Vector2))` pela **API de path do Graphics**
  (`beginPath`/`moveTo`/`lineTo`/`closePath`/`fillPath`), iterando os pontos com `for` indexado ⇒
  zero `Vector2`/array por frame.
- **Triângulo do dino:** cachear os 4 escalares de `boundsOf(dinoHitbox)`; recomputar **só** quando a
  referência da hitbox do dino muda (troca de partida no restart). Zero alocação em regime.
- **Guarda de exaustividade:** `default: never` no `switch (hitbox.kind)` de `drawPrimitive`
  (dívida adiada desde 2.1) ⇒ `tsc` quebra se um novo `kind` de hitbox for adicionado sem tratar
  o desenho.

### C. Evidência de fps (verificação, não código de produção)
- Rodar o jogo real (dev server) via Playwright, iniciar a partida e **medir fps de verdade** por
  `requestAnimationFrame` durante alguns segundos:
  - **Desktop**: viewport padrão.
  - **Mobile (emulado)**: viewport de celular + throttling de CPU (CDP `Emulation.setCPUThrottlingRate`
    quando disponível) — aproximação honesta; **não** é device real (limitação registrada).
- Registrar os números medidos e a metodologia numa seção "Evidência de performance" **neste
  arquivo de spec** (fonte da verdade do item) e refletir no `CLAUDE.md`/arquivo da fase.
- Critério de aceite de fps: **≥ 60fps sustentado no desktop**; no mobile emulado, registrar o
  valor e sinalizar se < 60 (aceitável como aproximação, com nota).

## Fora de escopo (adiado, com destino)
- **Pooling de sprites real** e batching de atlas ⇒ **Fase 8** (quando entram PNGs).
- Culling **vertical** ⇒ desnecessário enquanto o mundo couber na altura da view.
- Medição em **device físico** ⇒ fora do headless; Fase 7 (PWA/responsividade/deploy) valida em
  hardware real.
- Qualquer mudança em `src/core/` de simulação (só `hitbox.ts` ganha `leftExtent`, geometria pura).

## Arquitetura / unidades
- `src/core/sim/hitbox.ts`: `+ leftExtent(h): number` (espelho puro de `rightExtent`).
- `src/render/culling.ts` (NOVO, puro): `isHorizontallyVisible(...)`.
- `src/render/constants.ts`: `+ CULL_MARGIN`.
- `src/render/GameScene.ts` (casca): culling no laço de desenho; polígono via path; cache de bounds
  do dino; `default: never`.
- `docs/superpowers/specs/2026-07-01-render-performance-design.md`: seção de evidência.

## Testes
- **Puro (Vitest, node):** `culling.test.ts` — visível no centro; cullado à esquerda (right edge <
  câmera); cullado à direita (left edge > viewport); casos de borda com `margin`; hitbox
  aabb/circle/polygon via extents. `leftExtent` coberto em `hitbox.test.ts` (paridade com
  `rightExtent`, os 3 kinds).
- **Determinismo:** suíte de determinismo permanece verde (core intocado); rodar mesmo assim.
- **Casca Phaser:** sem teste de unidade (padrão 2.1–2.6); validada por `tsc`/`eslint` + Playwright
  (evidência de fps + inspeção visual de que entidades fora da tela não são desenhadas e o cenário
  segue idêntico).

## Definição de pronto
- `npm run check` limpo, `npm test` verde, determinismo verde.
- Culling e desenho alocação-zero em produção; `default: never` no switch.
- Seção "Evidência de performance" preenchida com números reais (desktop ≥ 60fps).
- Item 2.7 marcado `[x]`; `CLAUDE.md` "Estado atual" atualizado (Fase 2 concluída).

## Evidência de performance
_(preenchida na Task de medição — Task C)_
