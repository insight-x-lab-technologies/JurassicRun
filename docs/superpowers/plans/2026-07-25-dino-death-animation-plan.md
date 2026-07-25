# Plano — 9.3 Animação de morte do dino

Spec: `docs/superpowers/specs/2026-07-25-dino-death-animation-design.md`
Branch: `feat/dino-death-animation` · Execução: subagentes, **1 commit por task** + review por task.
`src/core/` **intocado** (determinismo 67 inalterado).

---

## Task 1 — Curvas puras da morte (`src/render/death.ts`)

**TDD.** Testes primeiro em `tests/render/death.test.ts`.

- `DEATH_ANIM_SECONDS = 0.75`.
- `interface DeathVisual { progress; rotation; dropFactor; shakeX; shakeY; flash }`.
- `deathVisual(elapsed: number, out: DeathVisual): DeathVisual` — escreve em `out` e devolve `out`.
  - `p = clamp(elapsed / DEATH_ANIM_SECONDS, 0, 1)`
  - `rotation = 2π · 1.25 · p²`
  - `dropFactor = −0.5·p + 1.5·p²` (pop para cima, cruza 0 em p=1/3, vale 1.0 em p=1)
  - `shakeX = A·(1−p)²·cos(2π·18·elapsed)`, `shakeY = 0.6·A·(1−p)²·sin(2π·23.4·elapsed)`, `A = 1.6`
  - `flash = clamp(1 − elapsed/0.12, 0, 1)`
  - `elapsed ≤ 0` ⇒ tudo em repouso exceto `flash = 1`.

**Testes:** clamp de progresso; shake **exatamente 0** em `p ≥ 1`; `dropFactor` negativo no início,
`1` (±1e-9) em p=1; rotação estritamente crescente e ≈ `2π·1.25` no fim; `flash` 1→0 em 0,12 s;
identidade do `out` preservada (REGRA 3).

**Aceite:** `npx vitest run tests/render/death.test.ts` verde; `npm run check` limpo.
**Commit:** `feat(9.3): curvas puras da animação de morte (death.ts)`

---

## Task 2 — Partículas puras (`src/render/particles.ts`)

**TDD.** Testes primeiro em `tests/render/particles.test.ts`.

- `DEATH_PARTICLE_COUNT = 14`.
- `interface Particle { x; y; radius; alpha; visible }`.
- `deathParticleAt(i: number, elapsed: number, out: Particle): Particle` — stateless, sem RNG:
  - ângulo `a = i · 2.399963` (ângulo áureo)
  - `speed = 16 + (i % 5) · 7`, `life = 0.42 + (i % 3) · 0.14`, `radius = 0.8 + (i % 2) · 0.7`
  - `x = cos(a)·speed·t`, `y = sin(a)·speed·t + 0.5·70·t²`
  - `alpha = clamp(1 − t/life, 0, 1)`, `visible = t > 0 && t < life`

**Testes:** pureza (mesmo `i`,`t` ⇒ mesmos valores); direções distintas entre índices; `y` cresce
com o tempo (gravidade); `alpha` decresce até 0 e `visible=false` após a vida; `out` devolvido é o
mesmo objeto.

**Aceite:** `npx vitest run tests/render/particles.test.ts` verde; `npm run check` limpo.
**Commit:** `feat(9.3): partículas puras stateless da morte (particles.ts)`

---

## Task 3 — Relógio da morte no `MatchController`

**TDD.** Adições em `tests/render/match.test.ts` (não apagar/alterar os testes existentes).

- Campo privado `deathElapsed`; zerado em `startMatch` e na transição `playing → dead`.
- `advance(dt)`: se `phase === 'dead'`, `deathElapsed = min(deathElapsed + dt, DEATH_ANIM_SECONDS)`
  e **retorna** (sem rodar steps, sem redisparar `onGameOver`); resto igual.
- Getters `deathElapsed: number` e `dying: boolean`
  (`phase === 'dead' && deathElapsed < DEATH_ANIM_SECONDS`).
- `restart()`: no-op também quando `dying` (além de fora de `dead`).

**Testes novos:** na morte `dying===true` e `deathElapsed===0`; `advance` em dead acumula sem mexer
em `world.tick` nem em `onGameOver`; satura em `DEATH_ANIM_SECONDS` e `dying` vira false; `restart`
durante `dying` é no-op e depois funciona; nova partida zera `deathElapsed`.

**Aceite:** `npx vitest run tests/render/match.test.ts` verde (todos, inclusive os antigos).
**Commit:** `feat(9.3): relógio cosmético de morte no MatchController`

---

## Task 4 — Casca: `GameScene` + `startGame` + `PlayScreen`

Sem novos testes unitários (Phaser/rAF); validado por Playwright na Task 5.

**`src/render/GameScene.ts`**
- Scratch de campo: `deathVisualScratch: DeathVisual` e `particleScratch: Particle` (REGRA 3).
- Na transição para `dead` (1×): memoriza `deathX/deathY` (posição interpolada do dino no impacto)
  e para a anim de flap (`this.dinoSprite.stop()`).
- Enquanto `match.dying`:
  - `deathVisual(match.deathElapsed, scratch)`;
  - dino: `setRotation(rotation)`, `setPosition(px(deathX), px(clamp(deathY + dropFactor·maxDrop)))`
    onde `maxDrop = (VIEW_HEIGHT − GROUND_THICKNESS − halfH do dino) − deathY` (≥ 0), e tint
    interpolado entre `entityTint` e vermelho de impacto pelo `flash` (cálculo de cor **sem
    alocação** — inteiros);
  - partículas: `for i < DEATH_PARTICLE_COUNT` → `deathParticleAt` → `gfx.fillStyle/fillCircle` em
    `deathX + p.x`, `deathY + p.y` (o `gfx` já é limpo por frame);
  - shake: `cameras.main.scrollX = px(scrollX + shakeX)`, `cameras.main.scrollY = px(shakeY)`.
    O `scrollX` de mundo (parallax/culling) fica **sem** shake.
- Fora de `dying` (inclusive após o fim da animação e no restart): rotação 0, tint normal,
  `scrollY = 0`, anim de flap religada 1× na transição (nunca por frame).
- `syncGameOver` (caminho legado in-canvas): `dead && !dying`.

**`src/app/game/startGame.ts`**
- `MatchSnapshot` ganha `readonly dying: boolean`; `snapshot()` publica `match.dying`.
- `bindGameControls({ isDead: () => match.phase === 'dead' && !match.dying })`.

**`src/app/screens/PlayScreen.tsx`**
- `INITIAL` ganha `dying: false`.
- Gate do rAF ganha `prevDying` (senão a revelação não re-renderiza).
- Overlay: `snap.phase === 'dead' && !snap.dying && snap.gameOver !== null`.

**Aceite:** `npm test` verde e `npm run check` limpo (nenhum teste existente quebrado).
**Commit:** `feat(9.3): render da morte (giro/queda/partículas/shake) + overlay atrasado`

---

## Task 5 — Docs, asset-spec e validação (controlador, inline)

- `docs/assets/specs/dino.hit.md` (REGRA 5): strip 1×5, mesma moldura de `dino.default`, prompt de
  geração (Apêndice A.3 do PHASE-09), marcado como **futuro/opcional** — a animação atual é
  procedural. Entrada em `docs/assets/asset-registry.md` (status `spec`).
- `PHASE-09`: 9.3 → `[x]` + nota de execução (decisões, desvio consciente dos frames `dino.hit`).
- `CLAUDE.md`: "Estado atual" (contagem de testes; 9.3 concluído, próximo = 9.4).
- **Verificação real:** `npm test`, `npm run check`, `npm run test:determinism` (deve seguir 67).
- **Playwright** (build de produção, `?nocache` + unregister do SW — gotcha 7.2): morrer e medir
  que o `<GameOverOverlay>` aparece ~0,75 s após a morte, com o dino girando/caindo antes.
**Commit:** `docs(9.3): asset-spec dino.hit + fecha 9.3 no roadmap`

---

## Review

- Review por task (agente `reviewer`, foco em REGRA 3/alocação por frame e em não tocar core).
- Review final da branch antes do merge.
- `determinism-guardian` **não** é necessário (nenhuma linha em `src/core/`), mas
  `npm run test:determinism` roda na Task 5 como prova.

## Integração

PR + merge automático para `main` (pré-autorizado no CLAUDE.md); branch aposentada.
