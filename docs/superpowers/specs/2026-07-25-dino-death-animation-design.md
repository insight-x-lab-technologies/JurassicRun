# Spec — 9.3 Animação de morte do dino

**Item do roadmap:** `docs/roadmap/PHASE-09-structural-improvements.md` → Frente A, 9.3 (#4).
**Data:** 2026-07-25 · **Core tocado:** NÃO (`src/core/` intocado ⇒ determinismo segue 67).

## Problema

Hoje a morte é instantânea e sem peso: no frame em que `world.alive` vira `false`, o
`MatchController` passa para `dead`, o `startGame` publica `gameOver` no snapshot e o
`<GameOverOverlay>` DOM aparece **no mesmo frame**. O jogador não vê o impacto — o jogo simplesmente
troca de tela. Falta o feedback cosmético de "eu bati".

## Objetivo

Inserir uma **fase cosmética `dying`** de ~0,75 s entre a morte lógica e o overlay DOM: o dino reage
(impacto → giro → queda), partículas de penas/poeira saem do ponto de impacto e a câmera treme.
Só depois o Game Over aparece.

## Restrições (do CLAUDE.md)

1. **REGRA 1 (determinismo):** `src/core/` intocado. A sim já congela na morte (`advance` não roda
   steps em `dead`); a animação é 100% render, alimentada por tempo REAL de frame — não por steps.
   Nada de `Math.random` aqui: as curvas e as partículas são **funções puras do tempo decorrido**
   (também torna tudo testável sem DOM/Phaser).
2. **REGRA 2 (arte desacoplada):** nenhuma mudança de hitbox/colisão.
3. **REGRA 3 (performance):** alocação-zero no hot path — curvas e partículas escrevem em scratch
   reusável; partículas desenhadas no `Graphics` que já existe (sem novos GameObjects por frame).
4. **REGRA 4 (i18n):** nenhuma string nova visível.
5. Efeitos colaterais de fim de partida (moedas, leaderboard, troféus, replay, submissão online)
   continuam disparando **no instante da morte** (hook `onGameOver` intocado) — só a *revelação*
   do overlay atrasa. Sair da tela durante a animação não perde progresso.

## Decisões travadas (autônomas)

| Decisão | Escolha | Porquê |
|---|---|---|
| Onde vive o relógio da morte | No `MatchController` (`advance` passa a acumular tempo em `dead`) | Já é a classe pura dona do ciclo de partida e já recebe `dt` da cena; não cria um segundo dono de estado nem um timer paralelo |
| Como a fase é exposta | Novo booleano `dying` (getter + campo no `MatchSnapshot`) — **sem** novo membro na união `MatchPhase` | `phase: 'dead'` continua significando "partida acabou" para todos os consumidores (hooks, controles, HUD); só a revelação do overlay olha `dying`. Zero churn de tipos/testes existentes |
| Frames de arte `dino.hit.*` (Apêndice A.3 do PHASE-09) | **Fora do escopo deste item** — a animação é procedural (giro/queda/flash/partículas/shake) sobre o frame de flap congelado | Não há arte real ainda, e um placeholder derivado do dino atual acrescentaria pipeline + 5 frames por tema em 3 atlas com ganho visual ~nulo. O asset-spec fica documentado (`docs/assets/specs/dino.hit.md`) para a arte real dropar depois. Sem branch morto no código |
| Restart durante o `dying` | Bloqueado (teclado e ponteiro) | O overlay ainda não está na tela; um toque residual do flap fatal não pode pular a animação nem reiniciar por acidente. Janela curta (0,75 s) |
| Pausa durante o `dying` | Congela a animação | `GameScene.update` já sai cedo quando pausado, antes de `match.advance` |
| Screen-shake | Offset próprio somado ao `scrollX/scrollY` da câmera | O `scrollX` já é escrito por frame pela cena; usar `camera.shake()` do Phaser competiria com essa escrita. Offset próprio é determinístico e testável |

## Arquitetura

Puro × casca, como o resto de `src/render/`:

```
src/render/death.ts      (PURO)  curvas da animação: progresso, rotação, queda, shake, flash
src/render/particles.ts  (PURO)  partículas stateless: estado da partícula i no tempo t
src/render/match.ts      (PURO)  relógio da morte: deathElapsed, dying
src/render/GameScene.ts  (CASCA) aplica ao dinoSprite, ao Graphics e à câmera
src/app/game/startGame.ts(CASCA) publica `dying` no MatchSnapshot; gate do restart
src/app/screens/PlayScreen.tsx   segura o <GameOverOverlay> enquanto `dying`
```

### `src/render/death.ts` (novo, puro)

```ts
export const DEATH_ANIM_SECONDS = 0.75;   // dentro da faixa 0,6–0,9 s do roadmap

export interface DeathVisual {
  progress: number;   // 0..1 (elapsed / DEATH_ANIM_SECONDS, clampado)
  rotation: number;   // rad; giro acelerado (~1,25 volta no total)
  dropFactor: number; // −0,04..1 — pop para cima no impacto, depois queda acelerada
  shakeX: number;     // unidades de mundo, oscilação amortecida
  shakeY: number;
  flash: number;      // 1→0 nos primeiros 0,12 s (tint de impacto)
}

export function deathVisual(elapsed: number, out: DeathVisual): DeathVisual;
```

- `dropFactor(p) = V0·p + ½·G·p²` com `V0 = −0.5`, `G = 3` ⇒ sobe até ~p=1/6, cruza 0 em p=1/3,
  chega exatamente a **1,0** em p=1. A cena multiplica por `maxDrop` (distância até o chão) e
  clampa — o dino nunca atravessa o solo.
- `rotation(p) = 2π · TURNS · p²` (giro que acelera; `TURNS = 1.25`).
- `shake`: amplitude `SHAKE_AMP · (1−p)²` × oscilação `cos(2π·f·elapsed)` (f ≈ 18 Hz) em x e
  `sin(2π·f·1.3·elapsed)·0.6` em y ⇒ decai a 0 exatamente no fim.
- `flash = clamp(1 − elapsed/0.12, 0, 1)`.
- Escreve em `out` e devolve `out` (identidade estável — scratch da cena, REGRA 3).

### `src/render/particles.ts` (novo, puro)

Sistema **stateless**: nada de array vivo, nada de spawn/despawn. O estado da partícula `i` no
tempo `t` é uma função fechada — o índice faz o papel da "aleatoriedade" (ângulo áureo), sem RNG.

```ts
export const DEATH_PARTICLE_COUNT = 14;

export interface Particle {
  x: number; y: number;   // offset em unidades de mundo, relativo ao ponto de impacto
  radius: number;
  alpha: number;          // 0 quando morta
  visible: boolean;
}

export function deathParticleAt(i: number, elapsed: number, out: Particle): Particle;
```

- Ângulo `a_i = i · 2.399963` (ângulo áureo) ⇒ leque uniforme sem RNG.
- Velocidade/vida/raio variam por `i % k` (penas leves × poeira pesada).
- `x = cos(a)·v·t`, `y = sin(a)·v·t + ½·g·t²`; `alpha = 1 − t/life`; `visible = t < life`.

### `MatchController` (mudança mínima)

- Campo `deathElapsed` (segundos). Zerado em `startMatch` e na transição `playing → dead`.
- `advance(dt)`: em `dead`, acumula `deathElapsed` (clampado em `DEATH_ANIM_SECONDS`) e retorna;
  em `playing`, comportamento atual.
- Getters `deathElapsed` e `dying` (`phase === 'dead' && deathElapsed < DEATH_ANIM_SECONDS`).
- `restart()`: no-op enquanto `dying`.

### `GameScene` (casca)

- Estado da morte lido por frame de `match.dying/deathElapsed` → `deathVisual(...)` no scratch.
- **Dino:** para a anim de flap na entrada em `dead` (1× na transição), aplica `setRotation`,
  posição `y + dropFactor·maxDrop` (clampado ao chão) e tint de impacto interpolado pelo `flash`.
- **Partículas:** `DEATH_PARTICLE_COUNT` círculos no `this.gfx` (que já é limpo por frame),
  ancorados no ponto de impacto memorizado na transição. Só enquanto `dying`.
- **Shake:** `camera.scrollX = px(scrollX + shakeX)`, `camera.scrollY = px(shakeY)`.
  O `scrollX` de mundo usado por parallax/culling continua **sem** shake (o fundo não treme; só o
  mundo) — e `scrollY` volta a 0 ao fim.
- **Reset no restart:** rotação 0, tint normal, `scrollY = 0`, anim de flap religada.

### `startGame` / `PlayScreen`

- `MatchSnapshot` ganha `readonly dying: boolean`.
- `bindGameControls({ isDead })` passa a exigir `phase === 'dead' && !dying`.
- `PlayScreen`: overlay só quando `phase === 'dead' && !snap.dying && gameOver !== null`; o gate de
  re-render do rAF ganha `prevDying` (senão a transição dying→revelado não re-renderiza).

## Testes (Vitest, sem DOM)

`tests/render/death.test.ts`
- progresso clampa em [0,1]; `elapsed ≥ DEATH_ANIM_SECONDS` ⇒ shake exatamente 0.
- `dropFactor` começa negativo (pop), cruza zero e vale 1,0 em p=1; monotônico após o pop.
- rotação monotônica crescente e ≈ `2π·1.25` no fim.
- `flash` = 1 em t=0 e 0 a partir de 0,12 s.
- devolve o MESMO objeto passado (alocação-zero — REGRA 3).

`tests/render/particles.test.ts`
- contagem estável; `deathParticleAt` é função pura (mesmo `i`,`t` ⇒ mesmos valores).
- partículas se espalham em direções distintas (leque) e caem (y cresce com o tempo).
- `alpha` decresce até 0 e `visible` vira false depois da vida.
- devolve o mesmo objeto (scratch).

`tests/render/match.test.ts` (adições)
- ao morrer, `dying === true` e `deathElapsed === 0`.
- `advance` em `dead` acumula `deathElapsed` sem rodar steps (`world.tick` intocado) e sem
  redisparar `onGameOver`; após `DEATH_ANIM_SECONDS`, `dying === false` e o valor satura.
- `restart()` durante `dying` é no-op; depois de `dying` funciona como hoje.
- nova partida zera `deathElapsed`/`dying`.

Validação visual (Playwright, build de produção, precedente 9.1/9.2): morrer e conferir que o
overlay DOM só aparece ~0,75 s depois, com o dino girando/caindo nesse intervalo.

## Documentação

- `docs/assets/specs/dino.hit.md`: asset-spec do strip 1×5 de morte (REGRA 5), marcado como
  **futuro** — a animação atual não depende dele; entra trocando/adicionando a fonte no
  `gen-atlas.mjs`. Entrada correspondente em `docs/assets/asset-registry.md`.
- `PHASE-09`: item 9.3 marcado `[x]` + nota de execução; `CLAUDE.md` "Estado atual" atualizado.

## Fora de escopo

- Arte real `dino.hit` (fica no backlog da fase, com prompt no Apêndice A.3).
- Animação idle de obstáculo (9.4) e badges de power-up (9.5).
- Qualquer mudança em `src/core/` ou nos goldens de replay.
