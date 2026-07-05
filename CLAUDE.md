# CLAUDE.md — JurassicRun

> Briefing sempre carregado. Leia isto antes de qualquer trabalho.
> É a memória persistente do projeto para sessões autônomas. Mantenha-o curto e verdadeiro.

## O que é

PWA mobile-first, side-scroller estilo Flappy Bird com temática de dinossauros.
O jogador é um **pterodáctilo**. Hobby project, sem frameworks pagos, sem custo no lançamento.

Design completo: `docs/superpowers/specs/2026-06-27-jurassicrun-design.md`
Arquitetura: `docs/architecture/ARCHITECTURE.md`
Roadmap: `docs/roadmap/ROADMAP.md`
Como trabalhar aqui: `docs/WORKFLOW.md`

## Regras inegociáveis (NÃO VIOLE)

1. **Determinismo.** Toda lógica de jogo vive em `src/core/` (TS puro, sem Phaser, sem DOM).
   - `Math.random()`, `Date.now()`, `performance.now()` são **PROIBIDOS** dentro de `src/core/`.
     Aleatoriedade só via o serviço de RNG com seed. Tempo só via o relógio da simulação.
   - Simulação roda em **passo fixo**. Render nunca altera estado de simulação.
   - Mesma seed + mesma sequência de inputs ⇒ estado idêntico. Há testes que provam isso.
   - Detalhes e checklist: `docs/architecture/DETERMINISM.md`.
2. **Arte desacoplada.** Colisão usa hitbox lógica, nunca pixels. Trocar geométrico↔PNG é
   editar o manifesto de assets, não a lógica. Expansões só mudam cosméticos.
   Detalhes: `docs/architecture/RENDERING-AND-ASSETS.md`.
3. **Performance.** Alvo 60fps+. Não introduza alocação por frame no hot path nem trabalho
   síncrono pesado no loop. Use atlases, não imagens soltas.
4. **i18n.** Nenhuma string visível ao usuário hardcoded. Tudo via chaves i18next.
5. **Toda imagem trocável** precisa de um asset-spec em `docs/assets/specs/` (ver skill
   `create-asset-spec`).

## Como rodar

- Dev: `npm run dev` (ou `bash scripts/run.sh` em background; `bash scripts/stop.sh` para parar)
- Testes: `npm test` (Vitest)
- Verificar determinismo: `npm run test:determinism` (ou skill `verify-determinism`)
- Build: `npm run build`
- Lint/typecheck: `npm run check`

## Convenções

Ver `docs/conventions/CONVENTIONS.md`. Resumo:
- TypeScript estrito. Sem `any` sem justificativa.
- `src/core/` não importa de `phaser`, `preact`, nem nada de DOM/IO.
- Toda feature segue o fluxo SDD (`docs/WORKFLOW.md`): spec → plano → TDD → review.
- Commits pequenos e descritivos. Não fazer commit/push sem o usuário pedir.

## Modo de operação (autônomo)

Default para sessões de desenvolvimento (ex.: `/next-item`), salvo pedido em contrário:
- **Execução por sub-agentes** (`subagent-driven-development`): um implementador por task +
  review por task + review final. Não pergunte qual método usar.
- **Branch de feature + um commit por task**, automático. Não pergunte.
- **Sem gate humano de aprovação** de spec nem de plano: decida pelas suas recomendações
  (o usuário não é especialista em game dev e confia na recomendação) e siga. Relate as
  decisões para permitir correção de rumo, mas não bloqueie.
- Pergunte só quando travar numa decisão de **produto/escopo** sem default razoável.
- **`main` é o branch principal (tronco).** Um desenvolvimento em execução por vez.
- **Commit, PR e merge para `main` são pré-autorizados** (merge automático): ao terminar um
  item, integre no `main` sem pedir. Quando houver remote GitHub + `gh`, abra PR e use merge
  automático; sem remote, faça merge local no `main`. Demais ações externas/irreversíveis
  (deploy, publicar em loja, etc.) ainda exigem o usuário pedir.

## Estado atual

**Fase 0 (Fundações) — CONCLUÍDA.** Itens 0.3 (esqueleto técnico), 0.4 (scaffold i18n) e
0.5 (CI) prontos: Vite+TS estrito, aliases, estrutura `src/`, bootstrap Preact que
inicializa i18n, guarda anti-não-determinismo em dupla camada (ESLint + teste Vitest),
scripts npm e dev server; i18next via `I18nService` (`src/services/i18n.ts`) com 10 locales
JSON (`en` default + es, pt-BR, fr, it, de, ja, zh, ko, hi) e `t()` no app shell; CI em
GitHub Actions (`.github/workflows/ci.yml`) rodando `check` + `test` + `test:determinism`
em PRs e pushes no `main`.

**Fase 1 (núcleo determinístico headless) — CONCLUÍDA.** Itens 1.1 (RNG), 1.2
(derivação de seeds), 1.3 (modelo de mundo + loop de passo fixo), 1.4 (geração de
obstáculos), 1.5 (coletáveis), 1.6 (colisão), 1.7 (dificuldade), 1.8 (economia e score) e
1.9 (replay / golden master) concluídos.

**Fase 2 (vertical slice jogável Endless) — CONCLUÍDA.** Itens 2.1 (render Phaser sobre
o core), 2.2 (input), 2.3 (parallax), 2.4 (HUD), 2.5 (fluxo de partida), 2.6 (Game Over
overlay) e 2.7 (performance) concluídos. **1º milestone atingido:** dá para jogar Endless do
início ao Game Over, com HUD completo, a 60fps (evidência registrada).

1.1 (RNG): `src/core/rng/` com PRNG portável `mulberry32` + hash de seed `xmur3` (só
`Math.imul`/`>>>0`, zero fontes proibidas), classe `Rng` (`createRng`/`rngFromState`/
`hashSeed`) com `next`/`range`/`int`/`pick`/`fork`/`clone`/`nextUint32` e `seed`/`state`;
`fork(streamId)` deriva streams independentes.

1.2 (seeds): `src/core/seed/` puro (sem `Date`). `calendar.ts` faz a matemática de
calendário/semana ISO-8601 sobre `CalendarDate {year,month,day}` (Sakamoto p/ dia da semana,
`isoWeekOf` com bordas de virada de ano validadas 1990–2060 vs `Date` UTC). `seed.ts` monta a
**string canônica** por modo — `dailySeed`→`"daily:YYYY-MM-DD"`, `weeklySeed`→`"weekly:YYYY-Www"`,
`endlessSeed(token)`→`"endless:<token>"` — sem hashear (hashing fica em `createRng`, caminho
único); `randomEndlessToken(uint32)` formata um token exibível Crockford base32 (7 chars).
A aleatoriedade do Endless e a conversão relógio→`CalendarDate` UTC vêm de FORA do core
(esta última é da Fase 5, com o modo Diário/Semanal).

1.3 (modelo de mundo): `src/core/sim/` com `WorldState`, `Entity`, `Hitbox` (aabb/circle/polygon),
`createWorld`/`cloneWorld` e `step(world, input)` — gravidade, flap (borda de subida), scroll
horizontal, clamp de teto, morte no chão, estado congelado após morte. `FIXED_DT = 1/60`. Suíte
verde (`check` limpo, 81 testes, bateria de determinismo 27 — inclui reprodutibilidade e
independência de fps 1/2/5 steps por frame).

1.4 (obstáculos): `src/core/spawn/` com `OBSTACLE_CATALOG` (tree=aabb/floor, vine=aabb/ceiling,
boulder=circle/floating, stalactite=polygon/ceiling — cobre aabb/circle/polygon) e
`SpawnGenerator` keyed por distância (consome `createRng(seed).fork('obstacles')`; cursor avança
por obstáculo emitido ⇒ independente de batching). Integrado: `WorldConfig.seed?`/`spawn?`,
`WorldState.spawner` (null sem seed); `step` gera até `distance+SPAWN_LOOKAHEAD` e culla os
ultrapassados (cull via `rightExtent`, sem alocação por frame). Helpers `polygon`/`boundsOf`/
`rightExtent` em `sim/hitbox`. Asset-specs dos 4 obstáculos + registro (REGRA 5). Suíte verde
(`check` limpo, 99 testes, determinismo 34). `rock_arch` adiado (arco real exige hitbox
não-convexa/multi-hitbox).

1.5 (coletáveis): `SpawnGenerator` generalizado (catálogo + `entityType`, defaults
retrocompatíveis) reaproveitado para `COLLECTIBLE_CATALOG` (`bird.coin`=circle/floating) num
stream de RNG dedicado `createRng(seed).fork('collectibles')` ⇒ independente dos obstáculos.
`WorldState.food` (inicia 0) + `WorldState.collectibleSpawner` (null sem seed); `step` gera e
culla coletáveis espelhando os obstáculos (sem alocação por frame). `collect(world, entity)` em
`src/core/sim/collect.ts`: busca por referência, remove o coletável e faz `food += 1`,
idempotente (o GATILHO por colisão é 1.6; multiplicadores/score são 1.8). Asset-spec do
`bird.coin` + registro (REGRA 5). Suíte verde (`check` limpo, 112 testes, determinismo 38).

1.6 (colisão): `src/core/collision/` com `overlaps(ha,pa,hb,pb)` — predicado simétrico e
alocação-zero (REGRA 3) cobrindo os 6 pares aabb/circle/polygon: casos diretos
(aabb-aabb/circle-circle/aabb-circle) e SAT por projeção escalar para pares com polígono
(eixos não-normalizados; círculo via `sqrt(ax²+ay²)` portável, não `Math.hypot`; eixo extra
círculo→vértice mais próximo). `WorldState.nearMisses` (inicia 0) + `NEAR_MISS_MARGIN`.
A passada de colisão no `step` (após spawn/cull, guardada por `alive`): dino×obstáculo ⇒
morte; dino×coletável ⇒ `collect()` (itera de trás p/ frente por causa do splice); near-miss
contado 1× por obstáculo ultrapassado (transição em x via `dx`, stateless) com gap vertical ≤
margem — só obstáculos, `boundsOf` chamado só no step pontual do cruzamento. Suíte verde
(`check` limpo, 147 testes, determinismo 42; determinism-guardian "contrato intacto").

1.7 (dificuldade): `src/core/difficulty/` com curva PURA `difficultyAt(distance) →
{level, speedScale, gapScale}` + `levelForDistance` (forma hiperbólica assintótica
`d/(d+H)`, só aritmética + `Math.floor` — sem transcendentais; escalas adimensionais
ancoradas em 1.0 em `distance=0` ⇒ **reinicia a cada partida**). Velocidade e gaps são os dois
eixos: `step` deriva `scrollSpeed` efetiva = `baseScrollSpeed × speedScale(distance)` e
`level` (amostrados APÓS `distance+=dx` ⇒ estado pós-step auto-consistente, lag de 1 step na
velocidade); `SpawnGenerator` ganhou 5º param `gapScale?(x)` que encolhe o espaçamento dos
obstáculos na posição x do spawn (gaps↔densidade são um eixo no modelo de 1 hitbox por
obstáculo). Refs de função ESTÁVEIS de módulo (`noScale` no spawn, `OBSTACLE_GAP_SCALE` no
`world.ts`) p/ o `toEqual` de `WorldState` continuar válido. `WorldState.{baseScrollSpeed,
level,difficultyEnabled}`; `WorldConfig.difficulty?:boolean` (default true; `false` ⇒ velocidade
constante e level 1). `SpawnConfig` agora `readonly` + defaults `Object.freeze` (pendência de
1.4). Suíte verde (`check` limpo, 164 testes, determinismo 45; determinism-guardian "contrato
intacto", review final "READY TO MERGE"). **Adiados:** distribuição ponderada de tipos de
obstáculo e densidade de coletáveis (tuning Fase 2); constantes de tuning são placeholders.

1.8 (economia e score): `src/core/economy/` módulo-folha puro com `scoreDelta(distanceDelta,
foodDelta, nearMissDelta, multiplier)` = `(dist·DISTANCE_SCORE_WEIGHT + food·FOOD_SCORE_VALUE +
nearMiss·NEAR_MISS_SCORE_VALUE)·multiplier` (só `+ − ·`, sem transcendentais/arredondamento ⇒
`score` é float canônico; presentação faz floor na Fase 2). Pesos placeholder 1/10/5 (tuning
Fase 2). Score **acumulado incrementalmente** no fim do `step` (`world.score += scoreDelta(dx,
food−foodBefore, nearMisses−nearMissBefore, scoreMultiplier)`; deltas capturados após
`distance+=dx`) ⇒ multiplicador temporário banca pontos à taxa ativa no momento (semântica
correta p/ power-ups da Fase 3, que NÃO recomputa do total). `WorldState.{score(0),
scoreMultiplier(1)}`, copiados por `cloneWorld`; sem novos campos em `WorldConfig` (multiplier é
mutado em runtime). Na morte o `dx` daquele step conta; food/near-miss não (estão sob `if(alive)`).
Alocação-zero no hot path (só escalares). Near-miss (de 1.6) passa a pontuar. Suíte verde
(`check` limpo, 180 testes, determinismo 48 — economia reprodutível e fps-independente com
food/near-miss > 0 exercitados; determinism-guardian "contrato intacto"). **Adiados (Fase 3):**
multiplicador de comida ("moeda dobrada") e fontes de `scoreMultiplier` (power-ups); conversão
comida→saldo de moedas e exibição de score (HUD/Game Over, Fase 2/4).

1.9 (replay / golden master): `src/core/replay/` módulo-folha puro. `simulate(config, timeline)`
roda a simulação headless do início ao fim (compõe `createWorld`+`step`, fps-independente);
`buildTimeline(length, pattern)` monta uma `InputTimeline` (`readonly InputFrame[]`)
determinística. `hashState(world)` é um digest canônico **portável** de 128 bits (32 hex) do
estado VISÍVEL do mundo: percorre os campos em ordem fixa e absorve cada número pelos **bits
IEEE-754 do float64** via `DataView` com `littleEndian=true` explícito (independe da endianness
da plataforma; `-0`→`+0`), num acumulador de 4 lanes uint32 estilo `xmur3`/`scramble`. Não lê o
estado interno privado dos `SpawnGenerator` (só presença): numa timeline fixa todo draw de RNG
já se manifesta nas entidades emitidas. Golden master em
`tests/determinism/replay.determinism.test.ts`: pinos commitados de `(seed, timeline)` fixos
(sem-seed, `endless:GOLD1` com/sem difficulty, `endless:GOLD2`) + asserções de que seeds e
difficulty distintos ⇒ hashes distintos. Guardas de completude impedem que o hash omita
silenciosamente um campo novo: `default: never` no switch de `Hitbox` (erro de `tsc` ao
adicionar um kind) + teste que pina as chaves de `WorldState`/`Entity` (falha ao adicionar um
campo sem atualizar `hashState` e re-pinar os goldens). Suíte verde (`check` limpo, 202 testes,
determinismo 54; determinism-guardian "contrato intacto", review final "READY TO MERGE").
**Adiado:** cenário golden que exercite `nearMisses>0` (redundante — já coberto por
`economy.determinism.test.ts`).

2.1 (render Phaser sobre o core): `src/render/` — primeira camada de render, dividida em
módulos PUROS testáveis (sem `phaser`, env node) e a casca Phaser (sem teste de unidade).
`FixedStepLoop` (`loop.ts`) roda o loop canônico acumulador+passo fixo (clamp `MAX_FRAME_TIME`
anti spiral-of-death; consulta `InputSource` 1×/step; chama `step` do core) e expõe interpolação
do dino via `renderX/renderY`=`lerp(prev,curr,alpha)`, `alpha=accumulator/FIXED_DT`. O estado de
interpolação é SÓ a posição do dino (obstáculos são estáticos em coords de mundo ⇒ câmera seguindo
o dino interpolado suaviza o cenário) ⇒ zero clone de `WorldState` por frame (REGRA 3). Manifesto
de assets (`manifest.ts`, REGRA 2): `id lógico → Renderable` (`primitive {color, shape?}` agora;
`sprite` depois) + guarda de completude testada (todo id de `OBSTACLE_CATALOG`/`COLLECTIBLE_CATALOG`
+ `DINO_TYPE_ID`). `GameScene` (Phaser) lê `WorldState`, câmera scrolla em x seguindo `renderX`,
desenha cada entity pela geometria da hitbox na cor do manifesto (dino = triângulo cosmético);
canvas lógico 320×180 (`Scale.FIT`, 1 unidade=1px). `InputSource`/`NullInputSource` (input real é
2.2). `import * as Phaser from 'phaser'` só em `GameScene`/`game`; `src/render/index.ts` reexporta
só os módulos puros (não vaza phaser p/ testes). `main.ts` cria um mundo de demo (`endless:DEMO`)
e monta o jogo. **Core NÃO tocado** ⇒ determinismo intacto. Suíte verde (`check` limpo, 216 testes,
determinismo 54; review final "READY TO MERGE"). Verificação visual (playwright) confirmada.
**Adiados (Fase 2):** alocação-zero no `update` — `points.map`/`boundsOf` alocam por frame — e
`default: never` no switch de `drawPrimitive` (guarda de exaustividade) p/ 2.7 (pooling/culling);
input real p/ 2.2 (e `NullInputSource` reusar objeto); teste-guarda estático "render puro não
importa phaser" (backlog).

2.2 (input): `src/render/` ganha input real, mantendo módulos PUROS testáveis × casca DOM
(sem teste de unidade, como 2.1). `FlapInputSource` (puro) reporta o estado ATUAL do botão
(a borda "1 flap por pressão" continua no core via `lastFlap`); rastreia multi-fonte (dedo +
tecla) por `Set<string>` de ids e um `latch` que garante 1 flap num tap sub-frame; flag
`wasHeld` distingue autorepeat de tap (evita flap-fantasma). `sample()` é alocação-zero (reusa
um `InputFrame`; `NullInputSource` idem — fecha pendência de 2.1). `PauseController` (puro):
`paused`/`toggle`/`pause`/`resume` + hook `onPause`. Casca: `controls.ts` (`bindGameControls`
liga pointerdown/up/cancel + keydown/up → flap; `P`/`Escape` → pausa; `blur` → auto-pausa;
`preventDefault` só em Space/ArrowUp; retorna cleanup) e o gate na `GameScene` (quando
`paused`, `update` não chama `loop.advance` ⇒ sim congela sem acumular tempo; overlay
escurecido não-textual, sem string de UI — rótulo i18n fica p/ 2.4/2.6). `game.ts` passa a
`createGame(parent, world, {input?, pause?})`; `main.ts` cabeia tudo (`onPause=()=>flap.reset()`).
**Core NÃO tocado** ⇒ determinismo intacto. Suíte verde (`check` limpo, 232 testes,
determinismo 54; reviews spec✅/qualidade e review final "READY TO MERGE"). Verificação visual
(Playwright, via exposição TEMP revertida): flap trava/reverte a queda do dino; `P`/`Escape`
congela o tick (606→606) e retoma (609→627); overlay escurece a cena. **Observado (adiado p/
2.5):** o mundo de demo nasce o dino a 8px do chão (startY 172, worldHeight 180) ⇒ morre ~0,5s
após o load — tuning de demo herdado de 2.1, fora do escopo de input; fluxo/seed de partida é
2.5. **Adiados (Fase 2/4):** rótulo textual de pausa (2.4/2.6); escopar `pointerdown` ao canvas
e usar o cleanup ao entrar a shell Preact (2.5/Fase 4); `preventDefault` no `Escape`/fullscreen
(2.7/Fase 7).

2.3 (parallax multicamadas): `src/render/parallax.ts` — módulo PURO (sem `phaser`, testável)
com `PARALLAX_LAYERS` (catálogo trás→frente: `bg.layer.far` scrollFactor 0.2 / `mid` 0.4 /
`near` 0.7, `scrollFactor` em `[0,1)` estritamente crescente = profundidade pela ordem do
array) e `parallaxTileOffset(scrollX, factor)=scrollX·factor`. `ParallaxVisual` espelha o
`Renderable` do manifesto (`primitive` geométrico agora / `sprite` na Fase 8, REGRA 2). Casca
na `GameScene`: `ensureLayerTexture` gera 1× (idempotente + `destroy`, sem leak) uma textura de
tile transparente com linha de triângulos (silhueta) por camada; um `TileSprite` por camada
(`setOrigin(0,0)`/`setScrollFactor(0)`/`setDepth(-(N-index))` ⇒ far=-3/mid=-2/near=-1, atrás do
mundo/faixas e do overlay de pausa em 1000). No ramo NÃO-pausado do `update` (congela sob pausa,
como 2.2), laço `for` indexado seta `tilePositionX = parallaxTileOffset(cameras.main.scrollX,
factor)` ⇒ tiling infinito, **zero alocação por frame** (REGRA 3; só escalares). Derivado do
`scrollX` ABSOLUTO ⇒ fps-independente sem drift. **Core NÃO tocado** ⇒ determinismo intacto.
3 asset-specs (`docs/assets/specs/bg.layer.{far,mid,near}.md`) + registry placeholder→spec
(REGRA 5). Suíte verde (`check` limpo, 240 testes, determinismo 54; review final "READY TO
MERGE"). Verificação visual (Playwright, exposição TEMP revertida): `tilePositionX/scrollX` =
`[0.2,0.4,0.7]` exatos em runtime; 3 camadas com profundidade correta. **Adiados (Fase 8):**
ramo `sprite` de `ensureLayerTexture` não carrega textura ainda; `bg.layer.far` (`baseFromBottom
40`) flutua ~40px (tuning cosmético); cores/alturas são placeholders. `default: never` do switch
segue adiado p/ 2.7 (herdado de 2.1).

2.4 (HUD): `src/render/hud.ts` — módulo PURO (sem `phaser`, testável) com `HudTicker`
(throttle de refresh que, ao fechar a janela de `HUD_REFRESH_INTERVAL`=0.2s, devolve o
**fps** = frames÷tempo decorrido; `tick(dt)` alocação-zero, só escalares — REGRA 3) e
`formatHudValues(raw)→HudView` (floor de distância/comida/nível, round de fps/velocidade,
seed passthrough; rótulos/unidades vivem nas chaves i18n). Casca na `GameScene`: um
`Phaser.Text` (`setScrollFactor(0)`/`setDepth(900)` — acima do mundo/parallax, ABAIXO do
overlay de pausa em 1000) criado em `create()` com refresh inicial; no ramo NÃO-pausado do
`update()` (congela sob pausa, como 2.2/2.3) chama `hudTicker.tick(dt)` e, só quando fecha a
janela (~5 Hz), `refreshHud(fps)` monta as 6 linhas via `i18n.t('hud.<campo>', {value})` sobre
`formatHudValues` lido do `world` por referência (distância, comida, fps, nível,
`world.scrollSpeed`, seed) ⇒ `setText`/alocação de string SÓ no refresh, fora do hot path.
Chaves i18n `hud.{distance,food,fps,level,speed,seed}` (com `{{value}}`) nos 10 locales
(REGRA 4; paridade garantida por `tests/i18n/locales.test.ts`). Seed plumbada por
`GameDeps.seedLabel` (→ `GameScene`, 4º arg; `main.ts` reusa a mesma const p/ `createWorld` e
`createGame`) — 2.5 liga à seed real da partida. **Core NÃO tocado** ⇒ determinismo intacto.
Suíte verde (`check` limpo, 247 testes; determinismo 54 intactos; reviews de task spec✅/
qualidade e review final "READY TO MERGE"). Verificação visual (Playwright): os 6 campos
aparecem legíveis no canto, `Seed: endless:DEMO` bate com a config, `Speed: 123`=`scrollSpeed`
base, e o FPS refresca ao vivo (30→47). **Adiados:** o dino de demo ainda morre nos primeiros
frames (startY perto do chão) ⇒ distância não avança na demo — é o **fluxo de partida 2.5**
(fora do escopo do HUD); rótulo textual de pausa segue p/ 2.6.

2.5 (fluxo de partida): ciclo de partida real por cima do core (intocado ⇒ morte por colisão/
chão, dificuldade crescente e reinício-do-zero já vinham das Fases 1.6/1.7). Três peças novas em
`src/render/` no padrão puro×casca: (1) `seedSource.ts` — seed Endless aleatória FORA do core:
parte pura `endlessSeedFromUint32(v)=endlessSeed(randomEndlessToken(v>>>0))` (testada) + casca
`randomEndlessSeed()` via `crypto.getRandomValues` (único ponto de aleatoriedade real). (2)
`match.ts` — `MatchController` PURO (sem phaser, testável): máquina de estados
`ready→playing→dead→restart`; possui o `WorldState`+`FixedStepLoop`+`seedLabel` da partida
corrente via `factory` injetável; `advance(dt)` só roda a sim em `playing` (no-op em `ready`/
`dead` ⇒ **resolve a morte-imediata da demo**: sim congelada até o 1º tap) e vira `dead` quando
`world.alive` cai; `notifyFlap()` (borda) faz `ready→playing` (o mesmo tap vira o 1º flap via
latch) e, em `dead`, monta nova partida (nova seed/world) + hook `onNewMatch`. (3) borda de flap:
`FlapInputSource.press` passa a retornar `boolean` (fresco×autorepeat) e `bindGameControls` ganha
`onFlap?` disparado só na borda genuína → `notifyFlap`. Casca `GameScene` agora é dirigida pelo
`MatchController` (lê `world`/`loop`/`seedLabel`/`phase` por frame) + prompt central i18n
`match.tapToStart` (10 locales, REGRA 4) visível só em `ready` (depth 950, entre HUD 900 e overlay
1000); `game.ts`=`createGame(parent, match, {pause?})`; `main.ts` monta o ciclo com factory
`randomEndlessSeed()`+`createWorld` e `onNewMatch=()=>flap.reset()` (tap de restart não vira 1º
flap). Gate de pausa preservado (congela qualquer fase). Hot path alocação-zero (trabalho só nas
transições). **Core NÃO tocado** ⇒ determinismo intacto. Suíte verde (`check` limpo, 260 testes,
determinismo 54; reviews de task spec✅/qualidade — Minors não-bloqueadores: `!` de atribuição em
`_world`/`_loop` e `deltaMs/1000` recalculado). **Adiados:** overlay de Game Over com estatísticas
(distância/comida/near-misses) e botões reiniciar/sair é o **2.6** — em 2.5 o restart-on-tap em
`dead` já funciona, sem UI de morte; pooling/culling é 2.7.

2.6 (Game Over overlay básico): overlay no estado `dead`, no padrão puro×casca. `src/render/
gameover.ts` PURO: `formatGameOverStats(raw)→GameOverView` (floor de distância/comida/near-misses
em strings; molde de `formatHudValues`). `MatchController` (match.ts) separou os dois sentidos de
`notifyFlap`: agora `notifyFlap()` só faz `ready→playing` e o novo `restart()` só age em `dead`
(monta nova partida via `factory` + `onNewMatch`) — restart deixou de ser "tap em qualquer lugar"
e passou a ser dirigido pelo botão/tecla. Casca na `GameScene`: overlay (fundo escuro depth 960 +
título/3 stats/botões depth 970, entre HUD 900 e pausa 1000) visível só em `dead` via
`syncGameOver()` (chamado no ramo pausado e após `advance`); estatísticas refeitas **1× na
transição** para `dead` (flag `wasDead`) ⇒ zero alocação por frame (REGRA 3); botão **Reiniciar**
interativo→`match.restart()`, botão **Sair** acinzentado e NÃO interativo (stub — decisão de
produto: sem destino até o menu da Fase 4). Restart de teclado vive no **caminho único** de
`bindGameControls` (controls.ts ganhou `onRestart`/`isDead`): em `dead`, `CONFIRM_KEYS`
(Space/ArrowUp/Enter) chama `onRestart` e retorna (não vira flap) — isso corrige uma **corrida de
evento** (o listener de keydown próprio da GameScene reiniciava ANTES do handler global de flap,
que então via `ready` e auto-iniciava a partida + flap-fantasma; achado crítico da review,
reproduzido e consertado). Chaves i18n `gameover.{title,distance,food,nearMisses,restart,quit}`
nos 10 locales (REGRA 4). **Core NÃO tocado** ⇒ determinismo intacto. Suíte verde (`check` limpo,
264 testes, determinismo 54; reviews de task spec✅/qualidade Approved). Verificação visual
(Playwright): overlay renderiza título + 3 stats (batendo com o HUD); clique real no **Reiniciar**
e teclas Space/ArrowUp/Enter em `dead` → `ready` (tick 0, nova seed, sem auto-start); toque em
espaço vazio/Sair → não reinicia. **Adiados:** menu/home e destino real do "Sair" (Fase 4); score
final/high-score/persistência (Fases 3/4); animações e hit-area maior dos botões (cosmético/Fase 8).

2.7 (performance): item de fechamento da Fase 2, **só `src/render/`** (+ helper puro `leftExtent`
em `src/core/sim/hitbox.ts`) ⇒ core de simulação intocado, determinismo intacto. Realidade do
renderer: **um único `Graphics` em modo imediato** (redesenhado por frame, sem GameObject por
entidade), então "object pooling" clássico de sprites não se aplica na fase geométrica (adiado p/
Fase 8, quando entram PNGs) — o objetivo real (sem GC no hot path + 60fps) foi atingido por
**desenho alocação-zero + culling**. (1) **Culling horizontal** (`src/render/culling.ts` PURO,
testável): `isHorizontallyVisible(worldX, extentLeft, extentRight, scrollX, viewWidth, margin)` —
visível sse `[worldX+extentLeft−scrollX, worldX+extentRight−scrollX]` intersecta
`[−margin, viewWidth+margin]`; só x sai da tela (mundo cabe na altura). Extents alocação-zero:
`rightExtent` (existente) + novo espelho `leftExtent`. `CULL_MARGIN=4`. Wiring na `GameScene`
(`drawVisible` pula obstáculos/coletáveis fora do viewport; o dino nunca é cullado). (2) **Hot
path alocação-zero** na casca `GameScene.drawPrimitive`: polígono via API de path do Graphics
(`beginPath`/`moveTo`/`lineTo`/`closePath`/`fillPath`) em vez de `points.map(new Vector2)`; bounds
do triângulo do dino cacheados (recomputa só quando a ref da hitbox muda — no restart); guarda
`default: never` no `switch (hitbox.kind)` (dívida herdada de 2.1) ⇒ `tsc` quebra se um novo kind
for adicionado sem tratar o desenho. **Core NÃO tocado** (só `leftExtent`, geometria pura) ⇒
determinismo intacto. Suíte verde (`check` limpo, 272 testes, determinismo 54; reviews de task
spec✅/qualidade Approved, sem findings). **Evidência de fps** (Playwright, rAF real, partida do
início ao Game Over): mobile emulado 390×844 = **60fps sustentado** (p50 16,7ms, 0 frames >33ms em
480); desktop 780×493 = 56fps média mas **0 jank** (cadência de refresh do ambiente headless
~57Hz, não custo do jogo — mesmo desenho lógico 320×180 nos dois). Detalhes/limitações em
`docs/superpowers/specs/2026-07-01-render-performance-design.md`. **Adiados:** pooling de sprites
real + batching de atlas (Fase 8); culling vertical (desnecessário); medição sob throttle de CPU e
em device físico (Fase 7 — CDP não exposto no ambiente headless).

**Fase 3 (Power-ups & clima) — CONCLUÍDA.** Itens 3.1, 3.2, 3.3 e 3.4 concluídos.

3.1 (sistema de power-ups): módulo-folha puro `src/core/powerup/` (framework de efeitos
temporários com duração em STEPS + catálogo). `ActiveEffect {kind, remaining}` em
`WorldState.effects`; `activateEffect` (estende via `max`, nunca encurta), `tickEffects` (1×/step
no fim, remove ao zerar), `isEffectActive` (busca linear alocação-zero), `cloneEffects`. Quatro
power-ups (`POWERUP_CATALOG`, tag→kind por `powerupKindForTag`): **escudo** (invuln. a obstáculo por
duração), **vida extra** (carga `WorldState.extraLives`, não é efeito temporário; `killOrRevive`
consome 1 e revive ao centro `worldHeight/2` com escudo-de-graça, salvando colisão E chão),
**ímã** (`applyMagnet` puxa coletáveis dentro de `MAGNET_RADIUS` em direção ao dino via
`Math.sqrt`/`FIXED_DT`, antes da coleta), **moeda dobrada** (`collect` dá `food += 2` ativo).
Slow-mo ADIADO ao 3.2 (não spawna pickup inerte; gancho pronto no framework). Geração keyed por
distância reusa `SpawnGenerator` num 3º stream `createRng(seed).fork('powerups')` (independente de
obstáculos/coletáveis); `WorldState.{powerups, powerupSpawner}` + `WorldConfig.powerupSpawn`; step
gera/culla/coleta espelhando coletáveis, com passada de pickup (ativa efeito / incrementa vida) e
escudo amostrado 1×/step (após revive no loop, `shielded=true` ⇒ ≤1 carga por step). `hashState`
codifica os 4 campos novos (guarda de completude 20→24 chaves; goldens re-pinados). Render: 4 cores
no `ASSET_MANIFEST` + `drawVisible(world.powerups)` (culling reusado) + 4 asset-specs (REGRA 5) e
registro. Sem strings i18n novas (indicadores de efeito ativo/HUD adiados). **Core determinístico
intocado no contrato** (determinism-guardian "CONTRATO INTACTO"; review final "READY TO MERGE").
Suíte verde (`check` limpo, 296 testes, determinismo 58; execução SDD por subagentes: 5 tasks +
review por task + 1 fix de review de task + review final + 2 Minors do review final aplicados com
teste de regressão). **Adiados:** slow-mo (3.2); indicadores visuais de efeito ativo + HUD de
power-up + rótulos i18n; tuning de durações/raio/frequência (placeholders); `DEFAULT_POWERUP_CONFIG.
worldHeight:0` sobrescrito em runtime; `pickupPowerup`/`collect` refazem `indexOf` (padrão de 1.5/1.6).

3.2 (câmera lenta): slow-mo coletável (`powerup.slowMo`, 5ª entrada do `POWERUP_CATALOG`).
**Modelo: escala de tempo na camada de render — o "lento" vive FORA do core.** `slowMo` é um
efeito temporário determinístico em `WorldState.effects` (ativado no pickup dentro de `step()`,
ticado 1×/step por `tickEffects`, no golden hash via `d.string(eff.kind)`); a **lentidão** é
aplicada só na única garganta tempo-real→steps: `FixedStepLoop.advance` (render) escala o `dt`
real por `SLOW_MO_TIME_SCALE=0.4` quando `slowMo` está ativo (`isEffectActive`), ANTES de somar
ao acumulador de passo fixo (clamp `MAX_FRAME_TIME` fica sobre o `dt` real). Efeito: menos steps
de sim por segundo real ⇒ mundo/parallax/interpolação em câmera lenta, com o `step()` sempre
recebendo `FIXED_DT` fixo. O sim fica **byte-idêntico** clocado devagar ou não — é só mais uma
variação de ritmo, exatamente a fps-independência que a bateria já prova; core tocado só no
registro determinístico (união `PowerupKind`+= `slowMo`, entrada de catálogo/`KIND_BY_TAG`,
`SLOW_MO_DURATION_STEPS=180`, `durationFor`). Como o mundo avança a MESMA distância por step,
distância/dificuldade/score/spawns ficam idênticos com ou sem slow-mo (modelo alternativo de
escalar dentro de `step()` foi rejeitado por comprimir progressão). Render: cor mint `0x66ffcc`
no manifesto + asset-spec `powerup.slowMo` + registro (REGRA 5). Sem strings i18n (indicador
visual dedicado adiado, como no 3.1). Goldens re-pinados: 2 dos 3 seeded (GOLD1 com/sem
difficulty mudaram magnet→doubleCoin; GOLD2 caiu no mesmo índice ⇒ inalterado — verificado pelo
determinism-guardian reconstruindo o catálogo antigo). **Core determinístico intocado no
contrato** (determinism-guardian "CONTRATO INTATO"; review final "READY TO MERGE"). Suíte verde
(`check` limpo, 303 testes, determinismo 61; execução SDD por subagentes: 3 tasks + review por
task + review final + determinism-guardian + 2 Minors do review final aplicados — teste de
determinismo end-to-end do slow-mo + correção de nota de goldens no spec). **Adiados:** tuning de
`SLOW_MO_DURATION_STEPS`/`SLOW_MO_TIME_SCALE` (placeholders); indicador visual de efeito ativo +
HUD de power-up + rótulos i18n (Fase 4/8); cosméticos de slow-mo (vinheta/tint/motion-blur,
Fase 8).

3.3 (tempo do dia — cosmético): paletas de fundo manhã/tarde/entardecer/noite, **só na camada de
render** ⇒ core intocado, determinismo inalterado (61). O tempo do dia é **função determinística
da seed da partida**: módulo PURO `src/render/daynight.ts` com `TimeOfDay`
(`morning|afternoon|dusk|night`), catálogo `DAY_NIGHT_PALETTES` (`{sky, ground, ceiling,
parallaxTint}`) e `timeOfDayForSeed(seed) = TIME_OF_DAY_ORDER[hashSeed(seed) % 4]` (usa o `hashSeed`
xmur3 **portável** de `@core/rng` — render pode importar do core; sem `Date`/`Math.random`).
Consequência: Endless (token aleatório) varia a paleta de partida em partida "de graça"; Diário/
Semanal (Fase 5) fica reproduzível para todos. `afternoon` herda o look atual (sky=SKY_COLOR ⇒ sem
regressão). Casca fina na `GameScene`: `applyDayNight(seed)` seta `cameras.main.setBackgroundColor`,
redesenha as faixas chão/teto (a `Graphics` anônima virou `this.bandsGfx`) e aplica
`tile.setTint(parallaxTint)` nas TileSprites — chamado no `create()` e no `update()` **só quando a
seed muda** (restart), guardado por `appliedDayNightSeed` ⇒ zero-alloc no hot path (REGRA 3). Cores
de chão/teto migraram para as paletas (`daynight` é o dono único); `GROUND_COLOR`/`CEILING_COLOR`
removidos de `constants.ts` (SKY_COLOR fica como fallback do `backgroundColor` em `game.ts`). Sem
strings i18n (cosmético, como 3.1/3.2). Nota de tempo do dia adicionada aos 3 asset-specs
`bg.layer.*` (REGRA 2/5). Suíte verde (`check` limpo, 308 testes, determinismo 61 **inalterado**;
execução SDD por subagentes: 2 tasks + review por task + review final "READY TO MERGE" + 1 Minor do
review aplicado). Verificação visual (Playwright, 6 reloads + amostragem de pixel): fases distintas
com sky **pixel-exato** ao catálogo (`morning #ffdcb0`, `afternoon #9ad4e6`=SKY_COLOR, `night
#1a2340`) e prova end-to-end de que o browser renderiza a fase que a seed determina. **Adiados:**
tuning das paletas (placeholders, Fase 8); ciclo dinâmico dia→noite dentro da partida; indicador/
HUD de tempo do dia; arte real de céu (gradientes/estrelas/lua-sol, Fase 8); dusk não caiu no RNG
dos reloads mas compartilha o mesmo code path (coberto por teste unitário).

3.4 (clima — afeta gameplay): condições climáticas determinísticas que alteram a física da
simulação. **Modelo: eixo vertical apenas** ⇒ clima toca só a integração vertical (`gravityScale`
+ `windY`), mantendo scroll/`distance`/dificuldade/economia/spawns byte-idênticos (só a trajetória
vertical do dino muda; food/near-miss/score podem divergir porque a trajetória decide o que o dino
toca — gameplay pretendido, o eixo horizontal é intacto). Módulo-folha PURO `src/core/weather/`:
`WeatherKind` (`clear|rain|wind|storm|snow`), catálogo `WEATHER_PHYSICS` congelado + `weatherPhysics(kind)`
(lookup alocação-zero; `clear={1,0}` ⇒ sem regressão) e `WeatherGenerator` keyed por distância num
5º stream RNG dedicado `createRng(seed).fork('weather')` (independente de obstáculos/coletáveis/
power-ups ⇒ suas sequências ficam byte-idênticas). O gerador sorteia segmentos (pick + comprimento
por RNG) com warmup inicial `clear`; `advanceTo(distance)` avança o cursor por fronteira cruzada
⇒ nº de saques = f(distância), fps-independente. `WorldState.{weather, weatherGenerator}`;
`WorldConfig.weather?:boolean` (default true; espelha `difficulty?`; sem seed OU `weather:false` ⇒
gerador null ⇒ física baseline). `step` resolve o clima no INÍCIO (de `world.distance` corrente) e
aplica `vel.y += (gravity·gravityScale + windY)·FIXED_DT`; `cloneWorld` copia `weather` +
`weatherGenerator.clone()`. Registro determinístico: `hashState` absorve `weather` (string) +
presença do gerador; completeness 24→**26 chaves**; **4 goldens de replay re-pinados** (formato do
hash cresceu + trajetória vertical dos seeded mudou; relacionais `GOLD1≠GOLD2`/`difficulty on≠off`
passaram sem edição ⇒ prova de não-vazamento). Render: indicador de clima no HUD (chave `hud.weather`
+ nomes `weather.{clear,rain,wind,storm,snow}` nos 10 locales, REGRA 4; tradução do nome na
`GameScene`, `hud.ts` só passthrough). Core determinístico intocado no contrato
(determinism-guardian **"CONTRATO INTACTO"**; review final **"READY TO MERGE"**). Suíte verde
(`check` limpo, 326 testes, determinismo 64; execução SDD por subagentes: 5 tasks + review por task
+ determinism-guardian + review final; Task 5 finalizada pelo controlador após o implementador
esbarrar em limite de sessão). **Adiados:** VFX real de clima (partículas de chuva/neve,
escurecimento de tempestade, tint dedicado — Fase 8); vento horizontal (rejeitado por acoplar clima↔
distância); rajadas contínuas suaves (começou piecewise-constant); distribuição ponderada de climas
e tuning de física/segmentos (placeholders, Fase 8); assert unitário de `storm.windY>0` e guarda
contra `segmentMin==max==0` (backlog de hardening).

**Fase 3 concluída** (todos os 4 itens).

**Fase 4 (Meta offline — perfis, ninho, loja, i18n, áudio, UI) — EM ANDAMENTO.** Itens 4.1
e 4.2 concluídos.

4.1 (app shell e navegação): casca Preact que hospeda **telas** navegáveis, com o jogo Phaser
existente vivendo como a tela "Play". `main.ts`→`main.tsx` agora só faz `i18n.init()` +
`render(<App/>, #app)` (a fiação de jogo migrou para `src/app/game/startGame.ts`). Padrão
puro×casca: **router** puro testável em `src/app/router/` (`routes.ts` tipo `Screen`
= home|play|profile|nest|shop|settings|leaderboard|expansions; `router.ts` = pilha de histórico
+ sinal `@preact/signals` `route` com `navigate`/`back`/`canGoBack`/`resetToHome` — navegar p/ a
rota corrente e `back` na raiz são no-op). `App.tsx` observa `route.value` e faz switch exaustivo
(`default: never`) tela→componente. Telas: `HomeScreen` (menu temporário com botão Jogar + 6
stubs — o menu real é 4.3) e `PlaceholderScreen` genérico (`titleKey`, reusado pelas 6 telas
futuras). `PlayScreen` monta o Phaser via **dynamic `import('../game/startGame')`** dentro de
`useLayoutEffect` (Phaser fica FORA do grafo estático do shell ⇒ code-splitting: chunk do
Phaser ~1.4MB separado do bundle ~76KB) e destrói no unmount (`game.destroy(true)` +
cleanup de `bindGameControls`; guard de corrida por flag `cancelled`) ⇒ sair de Play não vaza.
**Design tokens** responsivos em `src/app/styles/{tokens,global}.css` (custom properties de
cor/espaçamento/tipografia-fluida-`clamp`/raio; reset + safe-area `env(safe-area-inset-*)`;
mobile-first, retrato+paisagem; cores neutras re-temáveis por packs na Fase 8). i18n (REGRA 4):
chaves `nav.*`/`screen.*` nos 10 locales. **`src/core/` intocado** ⇒ determinismo intacto (64).
Nota de ambiente: `vite@8` é rolldown-vite ⇒ JSX Preact via `oxc:{jsx:{runtime:'automatic',
importSource:'preact'}}` no `vite.config.ts` (não `esbuild:`). Suíte verde (`check` limpo,
334 testes — router 6 + smoke de App 2 via `happy-dom` + resto; determinismo 64; execução SDD
por subagentes: 4 tasks + review por task + review final "READY TO MERGE"). Verificação visual
(Playwright, retrato 390×844 + paisagem 844×390): Home renderiza; Jogar→canvas 320×180 (Phaser
carrega só no clique); Voltar→canvas destruído; stub→título+"em breve"→Voltar; sem scroll
horizontal. **Adiados:** menu Home real (4.3); telas reais 4.2/4.4–4.8; troca de idioma ao vivo
(seam pronta, disparo 4.8); roteamento URL/hash + back-button do browser (Fase 7); transições
animadas e temas de pack (Fase 8); `PlaceholderScreen.titleKey` tipado `string` (poderia ser
union das chaves i18n — cosmético, some quando as telas reais chegam).

4.2 (perfis de jogador — local): identidade local do jogador, padrão puro×casca em
`src/services/profile/`. `store.ts` PURO (modelo `Profile {id,name,createdAt}` + `ProfileState`,
`validateName`/`normalizeName` (trim+colapso, não-vazio, `NAME_MAX=20`), operações imutáveis
`createProfile`/`setActive`/`renameProfile`/`activeProfile`, e helper visual `avatarFor(profile)→
{initial, hue}` com hue determinístico do `id` — sem IO/aleatoriedade). `storage.ts` (casca IO
injetável): interface `ProfileStorage {load,save}` com `memoryProfileStorage` (testes+fallback) e
`localStorageProfileStorage` (chave versionada `jurassicrun.profiles.v1`, payload `{version:1,...}`,
`parseState` robusto ⇒ qualquer JSON/forma inválida vira `emptyState()`; se há perfis mas `activeId`
não resolve, cai no 1º perfil em vez de forçar re-onboarding; `save` best-effort engolindo erro de
storage indisponível). `index.ts` (`ProfileService` reativo, singleton como i18n/router): sinais
`ReadonlySignal` `profiles`/`activeProfile` via `@preact/signals` `computed`; `init(storage?)`
(síncrono, default localStorage), `create`/`switchTo`/`renameActive`/`validateName`; **id via
`crypto.randomUUID()` e tempo via `Date.now()` vivem SÓ na casca** (permitido fora de `src/core/`,
como `seedSource`), cada mutação passa por `commit(state)`=set-sinal+persist. UI: `main.tsx` chama
`profileService.init()` no bootstrap; **gate de primeiro acesso** no `App` (`activeProfile===null`
⇒ `OnboardingScreen`, fora da pilha do router); `OnboardingScreen` (form controlado, cria perfil);
`ProfileScreen` na rota `profile` (avatar+ativo, renomear com resync via `useEffect([active?.id])`,
lista de troca com selo Active, criar, voltar). Chaves i18n `onboarding.*`/`profile.*` nos 10 locales
(REGRA 4). **Core intocado** ⇒ determinismo 64 intacto. Suíte verde (`check` limpo, 369 testes;
execução SDD por subagentes: 6 tasks + review por task + 1 fix de review de task (bug do campo
renomear stale ao trocar de perfil) + review final "READY TO MERGE" + 1 hardening pós-review do
load). Verificação visual (Playwright): onboarding→Home→persiste no reload→Perfil criar/trocar com
Rename resincronizando ao vivo. **Gotcha (herdado do 4.1, reconfirmado):** `@preact/signals` faz
monkey-patch GLOBAL de `shouldComponentUpdate` ⇒ em teste de componente happy-dom, após um evento
DOM que dispara `useState`, um `render()` manual síncrono pode não flushar (usar `await
Promise.resolve()`; `useEffect` precisa de macrotask real, `setTimeout`); e submit de form no mesmo
tick lê estado stale ⇒ ler o input vivo via `useRef` no submit (mantendo o input controlado no
display). **Adiados:** avatar-pterodáctilo real (4.4 Ninho); stats agregados moedas/troféus/nível
(4.5/4.7, montados no topo da Home em 4.3); excluir perfil; wiring do avatar-como-botão na barra de
topo (4.3); ID global/sync (Fase 6). Minors de backlog: `switchTo(id inexistente)` faz save
redundante; `version` do storage escrito mas não lido (migração usaria `.v2`); `avatarFor` `charAt(0)`
pode partir par surrogate (cosmético); nota de convenção do padrão form controlled+ref e do gotcha
de teste signals.

4.3 (Home): a `HomeScreen` provisória do 4.1 virou um **hub** real, padrão puro×casca, só na
camada de apresentação (core intocado ⇒ determinismo 64 inalterado). Duas zonas: **barra de topo**
(`.home__topbar`) com a identidade do perfil ativo — botão `data-testid="home-identity"` que navega
para `profile` (fecha a pendência de 4.2: avatar-como-botão) reusando `avatarFor` — e 3 `StatChip`
(moedas/troféus/nível máx Endless); e o **menu** (`.home__menu`) com o CTA primário **Novo Jogo**
(`home.newGame` → `navigate('play')`, Endless) + grid de navegação (daily, weekly, nest, shop,
expansions, leaderboard, settings) + ações (Compartilhar, Doação). Os stats vêm de um **seam puro**
`getHomeStats()` (`src/app/home/stats.ts`) que retorna placeholders `{coins:0, trophies:0,
maxLevel:1}` — ÚNICO ponto a religar quando a carteira (4.5) e os troféus (4.7) existirem (sem
abstração morta). **Compartilhar** é real e mínimo: `src/app/home/share.ts` com `shareGame(deps)`
PURO/injetável (fallback `navigator.share` → `clipboard.writeText` → `'unsupported'`, best-effort
engolindo cancelamento/erro) + casca `defaultShareDeps()` (lê `navigator`/`location`/`i18n`; constrói
deps condicionalmente por causa de `exactOptionalPropertyTypes`). **Doação** é stub **desabilitado**
("em breve") — URL Ko-Fi/BMC + `EntitlementsService` chegam no 4.6 (ADR-0004; precedente do "Sair"
2.6). Rotas novas `daily`/`weekly` adicionadas ao `Screen` e mapeadas a `PlaceholderScreen` (menu
completo já; modos reais na Fase 5). i18n: chaves `home.*`, `nav.{daily,weekly,share,donate}`,
`screen.{daily,weekly}`, `share.{title,text}` nos 10 locales (REGRA 4; paridade no teste). A11y:
`h1.sr-only` com o título do app, `aria-label` nos chips, `aria-hidden` nos glyphs decorativos. CSS
por design tokens (sem cor hardcoded), mobile-first retrato+paisagem, sem scroll horizontal, toque
≥44px. Home é DOM estático (fora do loop do jogo) ⇒ sem trabalho por frame. Suíte verde (`check`
limpo, **379 testes**; determinismo 64 intacto; review final "READY TO MERGE", 4 Minors de a11y — 3
aplicados, 1 adiado: toast de confirmação do Compartilhar, sem primitivo de toast ainda). **Nota de
execução:** a execução SDD por subagentes esbarrou em **limite de sessão**; o item foi implementado
**inline** pelo controlador (TDD, testes reais, commit por task, self-review) com a **review final por
subagente** (`reviewer`/opus) quando o limite liberou. **Adiados:** dados reais dos stats (4.5/4.7);
Doação real (4.6); modos Diário/Semanal + Leaderboard (Fase 5); Ninho/Loja/Expansões/Configurações
reais (4.4–4.8); toast de feedback do Compartilhar; roteamento por URL/hash (Fase 7).

4.4 (Ninho / Hangar): primeiro item da Fase 4 a **tocar `src/core`** (determinístico). Um Ninho
com 10 pterodáctilos, cada um com um **traço** que altera a simulação como **estado inicial** da
partida. Módulo-folha puro `src/core/dino/`: `DinoTrait` (`none|magnet|doubleFood|tripleFood|
startLife|headStart`) + `traitModifiers(trait)` → `{magnetAlways, foodMultiplier, startExtraLives,
startShieldSteps}` (catálogo `Object.freeze`, lookup alocação-zero por referência congelada; tuning
placeholder, `HEAD_START_SHIELD_STEPS=180`). Integração: `WorldConfig.trait?`/`WorldState.trait`
(default `'none'`, copiado por `cloneWorld`); `createWorld` aplica os start-modifiers (`extraLives=
startExtraLives`; `startShieldSteps>0` ⇒ `activateEffect(shield)`); `step` dispara ímã se
`magnetAlways || isEffectActive(magnet)`; `collect` = `(doubleCoin? DOUBLE_COIN_FOOD_GAIN:1) *
foodMultiplier`. Eixo horizontal (scroll/distância/dificuldade/spawns) **byte-idêntico**; só a
trajetória/coleta muda ⇒ dinos distintos na mesma seed divergem de propósito, mesmo dino é
reprodutível. Registro determinístico: `hashState` absorve `d.string(world.trait)`; completude
26→**27 chaves**; **4 goldens de replay re-pinados** (asserções relacionais GOLD1≠GOLD2 / difficulty
on≠off intactas ⇒ sem vazamento); novo `tests/determinism/dino.determinism.test.ts`
(reprodutível + traços divergem de `none`). Services `src/services/nest/` (puro×casca, molde de
`ProfileService`): `roster.ts` (`DINO_ROSTER` de 10 dinos: id/traitKind/preço/nameKey/hue; starter
grátis trait `none`), `store.ts` (`purchase` imutável `ok|alreadyOwned|insufficient|unknown` + `setActive`
guard), `storage.ts` (localStorage `jurassicrun.nest.v1`, `parseState`/`sanitize` robusto), `wallet.ts`
(**seam** `getCoinBalance`→0 / `spendCoins` no-op; carteira real é o 4.5), `index.ts` (`NestService`
reativo com signals). `NestScreen` (grid de cards: selecionar/comprar/selo Ativo; pago desabilitado
enquanto saldo 0) + rota `nest` + i18n `nest.*`/`dino.<id>.name`/`trait.<kind>.desc` nos 10 locales
(REGRA 4). `startGame` passa `nestService.activeTrait()` ao `createWorld`; `app/main.tsx` faz
`nestService.init()`. Asset-specs dos 10 dinos (REGRA 5) + registro. **Consequência de produto:** o
Ninho é "browse-only" (só starter ativo, nada comprável) até o 4.5 ligar a carteira — intencional,
seam documentado. Execução SDD por subagentes (7 tasks: implementador + review por task +
determinism-guardian **"CONTRATO INTACTO"** + review final opus **"READY TO MERGE"**). Suíte verde
(`check` limpo, **408 testes**, determinismo **67**). **Adiados (backlog/Minors):** carteira
persistente + compra funcional (4.5); cosmético do dino ativo dentro da partida (Fase 8); Ninho
por-perfil (hoje global); tuning de traços/preços (placeholder); chave i18n `nest.owned` morta;
deep-import de `getCoinBalance` no `NestScreen`; teste unitário direto de `sanitize`/`parseState`;
`nest.back` duplica `nav.back`; `tripleFood` não exercitado no teste de hash distinto.

Próximo: **4.5 (Economia persistente + Loja in-game)** — ver `docs/roadmap/PHASE-04-meta-offline.md`
e `docs/roadmap/ROADMAP.md`. É onde a carteira liga o seam do Ninho.
