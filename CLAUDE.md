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

**Fase 4 (Meta offline — perfis, ninho, loja, i18n, áudio, UI) — CONCLUÍDA.** Itens 4.1
a 4.10 concluídos.

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

4.5 (economia persistente + Loja in-game): a carteira de moedas — antes um *seam* inerte
(`nest/wallet.ts`, saldo 0) — virou real, no padrão puro×casca, SEM tocar `src/core` (economia é
meta offline ⇒ determinismo 67 intacto). Novo serviço **global** `src/services/wallet/`: `store.ts`
puro (`WalletState{coins}`; `coinsForFood` 1:1 placeholder floor≥0; `addCoins`/`spendCoins`
imutáveis, `sanitizeAmount` clampa negativo/NaN/fração; `spend` nunca deixa saldo negativo e devolve
`ok`); `storage.ts` (localStorage `jurassicrun.wallet.v1`, `parseState` robusto ⇒ inválido/negativo/
não-numérico ⇒ `{coins:0}`, save/load best-effort — molde de `nest/storage`); `index.ts`
(`WalletService` reativo singleton, sinal `balance:ReadonlySignal<number>` computed, `init`/`earn`/
`spend`, `commit`=set-sinal+persist). **Ganho:** `MatchController` (puro) ganhou hook
`onGameOver?(world)` disparado **1× na borda `playing→dead`** em `advance()`; a casca `startGame.ts`
liga `onGameOver:(w)=>walletService.earn(coinsForFood(w.food))` ⇒ a comida da partida é bancada em
moedas ao morrer (o controller NÃO importa serviços). **Gasto:** `nest/wallet.ts` DELETADO;
`NestService.buy` usa `walletService.balance.value` (checagem) + `walletService.spend(spent)` (débito
real, guarda `spent>0` p/ dino grátis futuro conceder sem `spend(0)`) ⇒ Ninho deixou de ser
browse-only; `NestScreen` lê o saldo reativo (botões "comprar" habilitam ao vivo); `getHomeStats().
coins` é real (trophies/maxLevel seguem placeholders 4.7/Fase 5). **Loja:** rota `shop` deixou de ser
placeholder — `src/app/shop/packs.ts` (catálogo `COIN_PACKS` frozen: small/medium/large 100/500/1200,
placeholders) + `ShopScreen` (saldo, pacotes **honor-system** que creditam na hora via `earn`, notas
"honor"/"expansões em breve", back). i18n `shop.*` nos 10 locales (REGRA 4, traduções nativas).
`walletService.init()` no bootstrap do `main.tsx`. **Decisão de produto:** compra/seleção de
**expansões movida ao 4.6** (item dedicado com `EntitlementsService`/ADR-0004); a Loja só mostra
"Expansions arrive soon" — evita entitlements prematuro. Carteira é **global** (espelha o Ninho;
por-perfil adiado à Fase 6). Execução SDD por subagentes (6 tasks: implementador haiku/sonnet +
review por task + review final opus **"READY TO MERGE"**, 0 Critical/Important). Suíte verde
(`check` limpo, **427 testes**, determinismo **67 inalterado**). Verificação real ponta-a-ponta
(Playwright): Loja credita 500 → persiste no reload (Home 500) → Ninho compra goldbeak (−150 ⟺ +1
dino, 350 restante) com re-gate reativo de affordability. **Adiados/Minors:** integração
earn-on-death só testada no nível do hook + Loja sem teste de componente (aceitos, casca fina);
tuning de conversão/preços/pacotes (placeholders, Fase 8); gateway de pagamento real (Fase 8,
ADR-0004); guarda `spent>0` inalcançável hoje (só starter é grátis e pré-possuído).

4.6 (Entitlements + Expansões): fechou as pendências que 4.3/4.5 empurraram — SEM tocar `src/core`
(entitlements/expansões são meta offline cosmética ⇒ determinismo 67 intacto). Novo serviço **global**
`src/services/entitlements/` (puro×casca, molde de `wallet`/`nest`): `catalog.ts` (`ExpansionDef`
+ `EXPANSION_CATALOG` = `classic` free + `volcano`/`glacier` premium placeholders + `expansionById`,
`DEFAULT_EXPANSION_ID='classic'`); `provider.ts` (`EntitlementProvider {requestUnlock(id):
'granted'|'declined'}` + `honorSystemProvider` que concede na hora — **o seam de ADR-0004** p/ um
gateway real assíncrono na Fase 8, sem tocar consumidores); `store.ts` puro (`EntitlementsState
{unlocked,activeId}`, `unlock`/`setActive` imutáveis, no-op devolve o MESMO objeto, `unlock` valida
catálogo `unknown`/idempotente `alreadyUnlocked`, **não** ativa); `storage.ts` (localStorage
`jurassicrun.entitlements.v1`, `parseState`/`sanitize` robusto: filtra ids, garante `DEFAULT`,
resolve `activeId`); `index.ts` (`EntitlementsService` reativo singleton: signals `unlockedIds`/
`activeExpansion` — **`activeExpansion` é o seam do render da Fase 8** —, `unlock` só grava se o
provider concede, `select` no-op preservado; `init` no bootstrap após `walletService`). Tela
`ExpansionsScreen` (rota `expansions` deixa de ser placeholder; grid de cards com 3 estados: ativa→
selo, desbloqueada→Select, premium bloqueada→Unlock honor-system; i18n only; CSS `.expansions`/
`.expansion-card` sem colisão com `.nest`). **Doação** deixou de ser stub: `src/app/home/donate.ts`
(`DONATE_URL` **placeholder** `https://ko-fi.com/jurassicrun` — trocar pelo handle real antes do
deploy/Fase 7; `openDonation` best-effort injetável; `defaultDonateDeps` `window.open(_blank,
noopener)`) ligado ao botão do Home (sem `disabled`). i18n `expansions.*` + `expansion.{classic,
volcano,glacier}.{name,desc}` nos 10 locales (REGRA 4, traduções nativas). **Decisões de produto:**
expansões desbloqueiam por honor-system (não por moedas — moedas compram dinos); efeito visual da
expansão ativa é Fase 8 (aqui só o sistema+seam, como o Ninho fez com traços); entitlements **globais**
(por-perfil → Fase 6). Execução SDD por subagentes (7 tasks impl + review por task + review final opus
**"READY TO MERGE"**, 0 Critical/Important; 3 Minors backlog: `unlock` funde declined/unknown num só
retorno, `alreadyUnlocked` sem teste no service, `DONATE_URL` placeholder). Suíte verde (`check` limpo,
**455 testes**, determinismo **67 inalterado**). **Adiados:** URL de doação real; arte/atlas das
expansões + aplicação visual da expansão ativa (Fase 8); gateway de pagamento real via provider
(Fase 8, ADR-0004); distinguir `declined`×`unknown` na UI quando o gateway async chegar; entitlements
por-perfil (Fase 6).

4.7 (Troféus / conquistas): 4º serviço no molde puro×casca (wallet/nest/entitlements) SEM tocar
`src/core` (determinismo 67 intacto). `src/services/trophy/`: `store.ts` puro — `TrophyStats`
(agregado vitalício: `gamesPlayed`, `totalFood`, `totalDistance`, `bestDistance`, `bestNearMisses`,
`bestScore`; inteiros≥0 via `sanitizeStat`) + `MatchSummary` (resultado de UMA partida, desacoplado
de `WorldState`) + `foldMatch` (incrementa cumulativos, `max` dos best) + `evaluate` (desbloqueia
toda conquista satisfeita e ainda-não-desbloqueada; devolve o MESMO objeto quando nada muda) +
`recordMatch` (fold+evaluate); `catalog.ts` — `TrophyDef {id,nameKey,descKey,condition:(s)=>boolean}`
(**predicado puro** unifica cumulativo × partida-única) + `TROPHY_CATALOG` frozen de 7 (firstFlight/
centurion/forager/daredevil/marathoner/highRoller/persistent; limiares placeholder, tuning Fase 8);
`storage.ts` (localStorage `jurassicrun.trophies.v1`, `parseState` robusto: JSON inválido⇒inicial,
`unlocked` filtra ids do catálogo, `stats` saneado); `index.ts` (`TrophyService` reativo singleton,
sinais `unlockedIds`/`unlockedCount`, `recordMatch` SEMPRE persiste pois `gamesPlayed++`, retorna
`newlyUnlocked` — seam de toast futuro). **Gatilho:** reusa `MatchController.onGameOver` (já existente,
4.5) — `startGame` faz `walletService.earn` E `trophyService.recordMatch({distance,food,nearMisses,
score})` (controller não importa serviços). **Seam religado:** `getHomeStats().trophies` =
`unlockedCount.value` (reativo; `maxLevel` segue placeholder Fase 5). Chip 🏆 da Home vira botão →
rota **`trophies`** com **TrophiesScreen** (grid de cards locked/unlocked, molde de Expansions/Nest).
i18n `trophy.<id>.{name,desc}` + `trophies.{title,locked,empty}` + `nav/screen.trophies` nos 10
locales (REGRA 4, traduções nativas). Sem asset-spec (ícones = emoji 🏆/🔒). Execução SDD por
subagentes: 5 tasks (Task 5 finalizada INLINE pelo controlador — subagente esbarrou em limite de
sessão, como no 4.3) + review por task + review final opus **"READY TO MERGE"** (0 Critical/Important).
Suíte verde (`check` limpo, **474 testes**, determinismo **67 inalterado**). **Adiados/backlog:**
`evaluate` não roda no `init` (conquista nova cujo limiar já é satisfeito só destrava na próxima
partida — ok com limiares placeholder); troféus **globais** (por-perfil → Fase 6); toast de
"conquista desbloqueada" (seam `newlyUnlocked` pronto); `maxLevel` da Home (Fase 5); tuning de
limiares/catálogo (Fase 8); Minors cosméticos (a11y do botão 🏆 no molde `home-identity`,
`.trophy-card__badge` sem regra própria, `version` de storage não lido).

4.8 (Configurações): 5º serviço no molde puro×casca (wallet/nest/entitlements/trophy) SEM tocar
`src/core` (determinismo 67 intacto). `src/services/settings/`: `store.ts` puro (`SettingsState
{volume 0..100, menuMusic, gameplayMusic, language}`; `initialSettingsState` 80/on/on/en;
`sanitizeVolume` clamp[0,100]+round, NaN⇒0/∞⇒100; setters imutáveis, `setLanguage` inválido ⇒ MESMA
ref); `storage.ts` (localStorage `jurassicrun.settings.v1` payload `version:1`; `parseState` robusto
com **saneamento POR CAMPO** — um campo corrompido não descarta os válidos); `index.ts`
(`SettingsService` reativo singleton: sinais computed `volume`/`menuMusic`/`gameplayMusic`/`language`;
`init` async carrega+aplica idioma via `applyLanguage`=`i18n.changeLanguage`+`document.lang`/`title`;
setters síncronos comitam+persistem). **Troca de idioma AO VIVO** (fecha a seam de 4.1): `setLanguage`
chama `changeLanguage` ANTES de comitar o sinal (ordem crítica p/ o re-render ler as strings novas), e
`App.tsx` assina `settingsService.language.value` no topo ⇒ mudar o sinal re-renderiza a árvore inteira.
**Volume e as 2 músicas são seams persistidos INERTES** — consumo é o 4.10 (Áudio), que não existe ainda
(como a carteira foi seam do Ninho antes do 4.5); só o idioma tem efeito real no 4.8. `SettingsScreen`
na rota `settings` (era placeholder): slider de volume, 2 toggles de música, `<select>` de idioma com
`LANGUAGE_NATIVE_NAMES` (nomes nativos, não traduzíveis), botão Voltar. `main.tsx` faz `await
settingsService.init()` no bootstrap (dono único do idioma; removida a fixação manual de
`document.lang`/`title`). Chaves i18n `settings.{title,volume,menuMusic,gameplayMusic,language,on,off,
back}` nos 10 locales (REGRA 4). Execução SDD por subagentes: 5 tasks (implementadores haiku 1–4 /
sonnet 5 + review por task) — **Task 5 caiu por erro de API do subagente ao escrever o relatório MAS já
commitara; o controlador reconstruiu o relatório e verificou independentemente** (precedente 4.3/4.7).
Review final opus **"READY TO MERGE"** (0 Critical/Important). Suíte verde (`check` limpo, **492 testes**,
determinismo **67 inalterado**). Verificação visual (Playwright): 4 controles renderizam; trocar idioma →
UI vira alemão AO VIVO (Einstellungen/Lautstärke/Sprache…); reload → Home em alemão, `html lang=de`,
localStorage `{version:1,volume:80,...,language:"de"}` — troca ao vivo + persistência provadas.
**Adiados/backlog:** consumo dos seams volume/música pelo áudio (4.10); configurações **globais**
(por-perfil → Fase 6); tuning de defaults (placeholder); Minors — sinal `language` é
`ReadonlySignal<string>` (não `SupportedLanguage`); `void setLanguage` rejeição teórica não tratada
(locales bundled); `version` de storage escrito não lido; teste explícito de idioma inválido no service;
checkbox 24px < 44px de alvo de toque (mitigado pela `<label>` de linha inteira).

4.9 (i18n completo — 10 idiomas): item **só de teste** — nenhum arquivo de produção nem `src/core/`
tocado (determinismo 67 inalterado). Uma **auditoria** provou que a cobertura i18n já estava completa
e correta, construída incrementalmente em 4.1–4.8: 130 chaves-folha, paridade nos 10 locales, valores
**nativos** (os 53 valores byte-idênticos ao `en` são todos legítimos — marca `JurassicRun`, nome
próprio `Midas`, cognatos reais como de `Nest`/`Wind` · fr `Glacier`/`Centurion`/`Active` · pt/fr/it
`Volume`, e acrônimos/empréstimos `FPS`/`Lv`/`Dist`/`Seed`/`Shop`/`Game Over`), placeholders `{{value}}`
preservados 130/130, zero strings hardcoded. Como não havia tradução faltando, o deliverable foi
**congelar a completude em guardas de regressão** (molde "dupla camada" do guard de determinismo):
`tests/i18n/locales.test.ts` ganhou (1) paridade de placeholders de interpolação, (2) valores
não-vazios, (3) detecção de **não-traduzido** via `IDENTICAL_TO_EN_ALLOWLIST` auditada (53 pares
legítimos, agrupados por motivo) + (4) detecção de allowlist **obsoleta**; e o novo
`tests/i18n/no-hardcoded-strings.test.ts` varre `src/app`/`src/render` **por AST do TypeScript**
(`ts.createSourceFile`; `typescript` já é dep) contra nós de texto JSX crus (`ts.JsxText` com letra/
dígito; ignora whitespace/entidades/emoji decorativo) e literais no argumento de **conteúdo** de
`add.text`(3º arg)/`.setText`(1º arg) fora de `t(...)` (permite `''` placeholder, separador `'\n'`,
chave em `t()`; objetos de `style` não são conteúdo). O scanner é AST (não regex-por-linha) porque a
**review apontou (Critical)** que um scanner por linha não pegava os padrões reais e dominantes do
repo — JSX multi-linha, `.add.text(...)` encadeado, `.setText([...].join())` em array — nem texto com
dígitos (Important); a reescrita por AST resolve a causa raiz e traz **fixtures permanentes** que
provam em CI a captura desses padrões e a não-captura dos casos legítimos. Execução: inline (TDD com
disciplina "testar o teste" — cada guarda comprovadamente pega uma violação injetada e volta a verde
ao reverter) + **review final por subagente** (`reviewer`/opus): 1ª rodada **NÃO PRONTO** (Critical do
scanner), fix aplicado, 2ª rodada re-verificou de forma independente reinjetando as 3 violações nos
arquivos reais ⇒ **"RESOLVIDO — READY TO MERGE"**. Suíte verde (`check` limpo, **503 testes**,
determinismo **67 inalterado**). **Adiados/backlog:** limitação conhecida do scanner JSX — texto misto
`>Texto {expr}<` num único nó não é coberto (o app usa `{t()}` puro; a fixture cobre o nó totalmente
literal, o risco real de regressão); guarda i18n não cobre `alt`/`title`/`placeholder`/`aria-label`
hardcoded (hoje inexistentes; adicionar se a Fase 5+ introduzir).

4.10 (Áudio): camada de áudio 100% de apresentação (padrão puro×casca em `src/services/audio/`),
consumindo os seams `volume`/`menuMusic`/`gameplayMusic` que o 4.8 persistiu inertes; **`src/core/`
intocado ⇒ determinismo 67 inalterado**. Puros (testados): `tracks.ts` (catálogos congelados —
faixas `menu`/`gameplay` como sequências de notas + `SFX_CATALOG.click` + `beatsToSeconds`),
`policy.ts` (`volumeToGain` curva v² + `resolveAudioTarget({route,volume,menuMusic,gameplayMusic,
unlocked})→{track,musicGain,sfxGain}`; `MUSIC_CEILING 0.35`/`SFX_CEILING 0.6`; `route==='play'`⇒
gameplay, senão menu; `!unlocked`⇒sem música; `volume 0`⇒silêncio). Casca: `engine.ts` (`AudioEngine`
interface + `nullAudioEngine` spy testável + `WebAudioEngine` real — scheduler look-ahead com
`setInterval`, osciladores procedurais, envelopes sem `exponentialRamp(0)`, `ensureCtx` lazy,
`stopMusic` limpa o timer) e `index.ts` (`AudioService` singleton reativo: **um `effect`** combina
`route`+3 sinais de settings+`_unlocked`→`resolveAudioTarget`→engine **idempotente** [só `playMusic`
quando `running!==track`, senão `setMusicGain` ao vivo, `stopMusic` quando `track===null`]; `init()`
descarta o effect anterior ⇒ reentrante; `unlock()` idempotente resolve autoplay). `bindButtonSfx`
= **SFX global por delegação** (`closest('button')`) + unlock no 1º gesto (`pointerdown`/`keydown`
`{once:true}`). Placeholders **procedurais** (zero arquivo/custo); faixas/SFX compostos reais → Fase 8,
guiados por `docs/audio/specs/`. `main.tsx` fia `audioService.init()`+`bindButtonSfx(document.body)`
após o `render`. Sem strings i18n novas (REGRA 4); sem trabalho por frame (REGRA 3; áudio só em
transições). Execução SDD por subagentes (5 tasks: haiku puros / sonnet integração + review por task
+ review final opus **"READY TO MERGE"**, 0 Critical/Important). Suíte verde (`check` limpo, **522
testes**, determinismo **67 inalterado**). Verificação no browser (Playwright, sonda no `AudioContext`):
SFX `square` 660Hz no clique, música de menu `sine` (220/261.63/329.63/293.66 = tabela `menu`), música
de gameplay `triangle` (293.66/329.63/392/440 = tabela `gameplay`) ao entrar em Play, unlock no 1º
gesto, sem erros de áudio. **Adiados (backlog/Fase 8):** faixas/SFX compostos reais (`.ogg` via
`decodeAudioData`, o `AudioEngine` é a costura); SFX além de `click` (flap/coleta/colisão/power-up/
game over — mesmo `playSfx(id)`); toggle dedicado de SFX; áudio por-perfil (Fase 6); tuning de
mixagem/andamentos/notas (placeholders); Minors — `beatsToSeconds(bpm=0)⇒Infinity` (catálogo nunca
usa; guardado por teste), `WebAudioEngine` sem `destroy()` (singleton app-lifetime), scheduler assume
`durBeats>0` (garantido por catálogo/teste), listeners de gesto presos a `window` (decisão de design).

**Fase 4 (Meta offline) — CONCLUÍDA** (itens 4.1–4.10).

**Fase 5 (Desafios & leaderboards locais) — EM ANDAMENTO.** Itens 5.1, 5.2, 5.3 e 5.4 concluídos.

5.1 (Modo Desafio): modos **Desafio Diário** (seed do dia UTC) e **Semanal** (seed da semana
ISO-8601) jogáveis, reaproveitando o Endless. **Só camada de render/app — `src/core/` intocado**
⇒ determinismo **67 inalterado** (todas as peças já existiam desde a Fase 1: `dailySeed`,
`weeklySeed`, `isoWeekOf`, `createWorld({seed,trait})`; sem re-pin de goldens). Três peças no
padrão puro×casca: (1) `src/render/seedSource.ts` estendido com a conversão **relógio→`CalendarDate`
UTC** que a Fase 1 deixou p/ a Fase 5 — puras `utcCalendarDateFromMs(ms)` (via getters `getUTC*`,
determinística), `dailyChallengeSeedForMs(ms)`/`weeklyChallengeSeedForMs(ms)` (compõem as seeds
canônicas do core) + cascas `dailyChallengeSeed()`/`weeklyChallengeSeed()` (leem `Date.now()`, fora
do core). (2) `src/render/matchFactory.ts` PURO: `createMatchFactory(mode, deps)→()=>MatchInit`
(`MatchMode='endless'|'daily'|'weekly'`, `deps` injeta seed sources + `activeTrait` + `createWorld`)
— **endless** sorteia nova seed por (re)start com o **trait do dino ativo**; **daily/weekly** capturam
a seed do desafio **1× na criação** (restart replaya a MESMA) e **forçam `trait:'none'`**. (3) Fiação:
`startGame(container, mode='endless')` monta `deps` reais e passa `mode`; `PlayScreen({mode})` propaga
(`useLayoutEffect` dep `[mode]`); `App` roteia `daily`→`<PlayScreen mode="daily"/>` e `weekly`→idem
(deixaram de ser placeholder; Home já navegava p/ essas rotas). **Decisão de produto:** trait fixado
em `'none'` nos desafios (Endless mantém o ativo) porque 5.4 guardará só **seed + InputTimeline** ⇒ a
corrida precisa ser justa e reproduzível/verificável só a partir disso (clima/dia-noite/dificuldade já
derivam da seed; o trait era a única entrada de estado inicial fora da seed). **HUD mostra a seed do
desafio sem código novo** (já renderiza `seedLabel` desde 2.4; prefixo `daily:`/`weekly:` identifica o
modo; nenhuma string i18n nova). `onGameOver` (comida→moedas + `trophyService.recordMatch`) inalterado
p/ todos os modos. **Regra rankeável definida:** tentativas ilimitadas, **melhor tentativa** rankeia —
a gravação do recorde por período e a tela de leaderboard são 5.2. Execução SDD por subagentes (3 tasks:
implementadores haiku/sonnet + review por task + review final opus **"READY TO MERGE"**; 2 Minors →
backlog: smoke de App não asserta o `mode` passado a `startGame`; chaves i18n `screen.daily`/
`screen.weekly` órfãs, possivelmente reusadas na tela de abertura do desafio em 5.2). Suíte verde
(`check` limpo, **528 testes**, determinismo **67 inalterado**). **Adiados (Fase 5):** leaderboards
locais Endless/Diário/Semanal + tela de 3 abas (5.2); troféu top-3 do diário (5.3); guardar
`seed + InputTimeline` da melhor tentativa (5.4).

5.2 (Leaderboards locais): recordes locais por modo (Endless/Diário/Semanal) + tela de Leaderboard
com 3 abas. **Só meta/apresentação — `src/core/` intocado** ⇒ determinismo **67 inalterado** (sem
re-pin de goldens). Novo serviço **global** `src/services/leaderboard/` no molde puro×casca (espelha
`trophy`/4.7): (1) `store.ts` PURO — `recordMatch(state, LeaderboardResult)` roteia por modo;
**ranking por `score`** desc (desempate `achievedAt` asc, depois `seed`); **Endless** = toda corrida
compete (top-`MAX_ENTRIES=10`); **Diário/Semanal** = deduplicado por `seed` (1 recorde por período,
mantém o maior; tentativa pior devolve a MESMA ref ⇒ realiza "melhor tentativa rankeia" do 5.1);
`bestEndlessLevel` = máximo vitalício (nunca evictado, só Endless); `sanitizeStat` (piso≥0, molde do
`trophy`). (2) `storage.ts` — localStorage `jurassicrun.leaderboard.v1` (payload `{version:1,...state}`),
`parseState` robusto (JSON inválido/forma errada ⇒ inicial; entradas malformadas filtradas, `seed`
não-vazia). (3) `index.ts` — `LeaderboardService` reativo singleton (sinais computed `endless`/`daily`/
`weekly`/`bestEndlessLevel`; `recordMatch` persiste **só se a ref mudar** ⇒ no-op periódico não salva).
**O `score` (composto de 1.8) finalmente é EXIBIDO** — nunca aparecia no HUD/Game Over; é a métrica de
rank. Fiação (casca): `startGame.onGameOver` (já credita moeda+troféu) agora também
`leaderboardService.recordMatch({mode, seed: match.seedLabel, score/distance/food/nearMisses/level,
achievedAt: Date.now()})`; `main.tsx` faz `leaderboardService.init()`; **`getHomeStats().maxLevel`
religado** de placeholder `1` → `bestEndlessLevel.value` (fecha o seam que 4.3 marcou p/ a Fase 5).
UI: `LeaderboardScreen` (rota `leaderboard`, deixa de ser placeholder — **`PlaceholderScreen` ficou sem
consumidores**) com 3 abas (`role=tablist`, `useState`), lista rankeada com medalhas 🥇🥈🥉 + `aria-label`
Score + detalhe distância/comida/near-misses + seed do período, estado vazio, Voltar; CSS por design
tokens (abas ≥44px). Chaves i18n `leaderboard.*` (9 folhas) nos 10 locales (REGRA 4; paridade + scanner
AST verdes; add-locale skill indisponível ⇒ traduções à mão, allowlist justificada). Execução SDD por
subagentes (5 tasks: store/storage/service haiku, fiação/UI sonnet + review por task + review final opus
**"READY TO MERGE"**, 0 Critical/Important; 1 fix pós-review-final: chaves `leaderboard.score`/`nearMisses`
estavam mortas ⇒ agora renderizadas). Suíte verde (`check` limpo, **548 testes**, determinismo **67
inalterado**). Verificação end-to-end (Playwright, bundle real + localStorage semeado): Home "Best Lv: 7"
lê `bestEndlessLevel`; aba Endless 🥇90/🥈40 ranqueado; Diário mostra recorde do período; Semanal estado
vazio; troca de abas OK; chave de storage confere. **Adiados/backlog:** troféu top-3 do diário (5.3);
guardar `seed + InputTimeline` da melhor tentativa (5.4); leaderboards **por-perfil** (hoje globais como
wallet/trophy/nest → Fase 6); housekeeping de dead code — `PlaceholderScreen.tsx` órfão + chaves i18n
órfãs `screen.{daily,weekly,leaderboard,comingSoon}`; Endless persiste mesmo sem melhorar top-10/level
(write redundante); ARIA `aria-controls`/`tabpanel`; tuning de `MAX_ENTRIES`/formatação de data (Fase 8).

5.3 (Troféus de desafio — local): o troféu `dailyPodium` desbloqueia quando a corrida de Desafio
Diário fica no **top-3 do leaderboard diário local** — placeholder do top-3 **central** da Fase 6.
**Só meta/apresentação — `src/core/` intocado** ⇒ determinismo **67 inalterado** (sem re-pin de
goldens). Estende o sistema de troféus (4.7): o predicado puro do troféu passa de
`(stats)=>boolean` para `(ctx)=>boolean` com `TrophyEvalContext {stats, dailyRank?}` — **a mesma
jogada de unificação que o 4.7 fez** (cumulativo × partida-única), agora incluindo um fato
**derivado da partida** além do agregado vitalício. `dailyRank` é **transiente**: não é dobrado em
`TrophyStats` nem persistido (`storage.ts` só grava `stats`+`unlocked`) ⇒ `dailyPodium` só destrava
no **momento** de um Game Over de Diário qualificado (coerente com "evaluate não roda no init"), mas
uma vez ganho permanece. Novo troféu `{ id:'dailyPodium', condition:(c)=>c.dailyRank!==undefined &&
c.dailyRank<=PODIUM_RANK }` com `PODIUM_RANK=3`; `evaluate(state,ctx)` e `recordMatch(state,m,extra?)`
recebem o contexto (o `extra`/contexto é montado **condicionalmente** por `exactOptionalPropertyTypes`,
nunca `{dailyRank:undefined}`); os 7 troféus antigos migram 1:1 para `c.stats.*` (comportamento
idêntico). **Leaderboard (5.2)** ganha `rankOf(list, seed)` (posição 1-based na lista já ranqueada;
`undefined` se ausente ou fora do top-`MAX_ENTRIES=10`) + `LeaderboardService.dailyRankForSeed(seed)`.
**Fiação** (`startGame.onGameOver`): reordenado para gravar o leaderboard **antes**, calcular
`dailyRank` **só** no modo `daily` (senão `undefined` ⇒ endless/semanal nunca ganham pódio: dupla
proteção — guarda de modo + `dailyRankForSeed` só consulta a lista `daily`) e injetar em
`trophyService.recordMatch(summary, {dailyRank})`. `TrophiesScreen` renderiza o novo troféu de graça
(catálogo genérico); só precisou das chaves i18n `trophy.dailyPodium.{name,desc}` nos 10 locales
(REGRA 4, traduções nativas, paridade + scanner AST verdes, 0 allowlist nova). **Semântica do "top-3
local":** diário é dedup por seed = 1 recorde por dia ⇒ top-3 = a corrida de hoje entre os 3 melhores
dias já pontuados; leniente nos 1ºs dias (1º Diário ⇒ rank 1 ⇒ destrava na hora), **placeholder
intencional** que a Fase 6 endurece para top-3 global. Execução SDD por subagentes (3 tasks:
leaderboard rankOf haiku, contexto+catálogo sonnet, i18n+fiação sonnet + review por task + review
final opus **"READY TO MERGE"**, 0 Critical/Important). Suíte verde (`check` limpo, **554 testes**,
determinismo **67 inalterado**). **Desvio de plano legítimo (Task 2):** a asserção de idempotência
`toBe(first.state)` era inatingível (`recordMatch` sempre incrementa `gamesPlayed` ⇒ nova ref) →
trocada por `.unlocked.toEqual` (ainda prova o desbloqueio idempotente; `unlocked` mantém a ref no
early-return de `evaluate`). **Adiados/backlog:** teste de unidade da orquestração `onGameOver`
afirmando que só `daily` injeta `dailyRank` (casca fina, coberto indiretamente); pódio semanal
análogo (fora de escopo); tuning de `PODIUM_RANK` e endurecimento p/ top-3 global (Fase 6).

5.4 (Integridade): replays verificáveis — grava `seed` + `InputTimeline` + âncora `finalHash` da
melhor tentativa de cada desafio (Diário/Semanal) para permitir re-simular e verificar (prepara a
verificação **online** da Fase 6). **Só camada render/app/serviços — `src/core/` intocado** ⇒
determinismo **67 inalterado** (sem re-pin de goldens; reusa `simulate`/`hashState`/`buildTimeline`
de `@core/replay`, a maquinaria de golden-master da Fase 1.9). Quatro peças no padrão puro×casca:
(1) **captura da timeline** — `FixedStepLoop` (`src/render/loop.ts`) grava cada `flap` consumido
(booleano primitivo por step no hot path ⇒ REGRA 3; monta `InputFrame[]` sob demanda no game-over,
cold path); auto-reset por partida (loop fresco a cada `startMatch`). `MatchController.recordedTimeline()`
delega. (2) **store** `src/services/replay/store.ts` PURO — `StoredReplay {mode,seed,timeline:boolean[],
score,distance,food,nearMisses,finalHash,achievedAt}`; `recordReplay` dedup por seed (max score),
top-`MAX_REPLAYS=10` por modo, imutável (mesma ref se não melhora — molde de `leaderboard/store`).
(3) **verificação** `verify.ts` PURO — `verifyReplay(replay)` reconstrói a config de desafio
`{seed, trait:'none'}` (dificuldade/clima defaults; DEVE bater com `createMatchFactory`), roda
`simulate`, recomputa `hashState` do estado final e compara com `finalHash` ⇒ `{valid, expectedHash,
actualHash}`. É o **seam da verificação online** (o servidor da Fase 6 fará o mesmo). (4) **storage +
serviço** — `storage.ts` (localStorage `jurassicrun.replays.v1`, `parseState` robusto: rejeita timeline
não-booleana/`finalHash` vazio/seed vazia, `mode` derivado do bucket, cap no load) + `index.ts`
(`ReplayService` reativo singleton; `record` só persiste se a ref mudou; `verify` delega). **Fiação:**
`buildReplayPayload` em `src/app/game/replayPayload.ts` PURO (extraído p/ NÃO arrastar Phaser ao teste
node; `null` p/ endless — fora do escopo, trait aleatório não reconstrutível só da seed) chamado no
`startGame.onGameOver` **após** leaderboard+trophy (só se non-null); `main.tsx` faz `replayService.init()`.
Sem strings i18n novas (feature de serviço, sem UI). Execução SDD por subagentes: 6 tasks
(implementadores haiku/sonnet + review por task) + review final opus **"READY TO MERGE"** (0
Critical/Important). **Hardening pós-review-final:** guarda de completude `InputFrame` × gravação de
replay (runtime + `Record<keyof InputFrame, true>` em compilação; no idioma da guarda de `hashState`
de 1.9 — se um campo afetar a sim e não for gravado, o teste quebra em vez de validar replay parcial).
Suíte verde (`check` limpo, **585 testes**, determinismo **67 inalterado**). **Decisão de produto:**
verificação de integridade ancora o **estado final** (hash), não o input — timelines equivalentes que
levam ao mesmo estado final são ambas válidas (não dá p/ reclamar score maior com outra timeline).
**Adiados/backlog:** replays de Endless (trait aleatório ⇒ guardar o trait junto, Fase 6); UI de
"assistir replay" (Fase 6/8); empacotamento compacto da timeline (bitset/base64/RLE — hoje `boolean[]`
em JSON, ~1 valor/step); envio/verificação server-side real via Supabase (Fase 6); Minors cosméticos
(`insert()` aloca ref nova quando seed nova falha o corte top-N ⇒ escrita redundante idempotente,
espelha leaderboard; `rank()` muta o argumento via `.sort()` seguro; `achievedAt` sem `sanitizeStat`
como no leaderboard; `Date.now()` chamado 2× no `onGameOver`; nome de teste "um flap virado"
desatualizado; falta teste explícito do filtro de `finalHash` vazio).

**Fase 6 (Online — Supabase) — CONCLUÍDA.** Itens 6.1–6.5 concluídos.

6.1 (Schema): schema do banco online — **só DDL/infra, `src/core/` intocado** ⇒ determinismo 67
inalterado (sem re-pin de goldens). Banco Supabase **compartilhado entre projetos**
(`InsightXLabGamesHub`); isolamento por **schema Postgres dedicado `jurassicrun`** (supera prefixo
`jr_` — zero colisão de tabelas/tipos/funções/triggers/policies num banco multi-jogo).
**Identidade** via Supabase Auth **anônimo**: cada dispositivo faz anonymous sign-in ⇒ ganha
`auth.users.id` = ID global único; `players.id = auth.uid()` habilita **RLS por linha real** (o
sign-in em si é 6.2). 4 tabelas espelhando os modelos locais das Fases 4–5: `players`
(id/name≤20/avatar/created_at), `scores` (leaderboard todos os modos: mode/seed/score
`double precision`/distance/food/near_misses/level/verified), `challenge_entries` (replays
verificáveis Diário/Semanal: +timeline `jsonb`/final_hash, `unique(player_id,seed)`), `trophies`
(player_id/trophy_id, PK composta). **RLS** ligada em todas: SELECT público (leaderboards mostram
nomes/troféus), INSERT/UPDATE/DELETE só do dono (`= auth.uid()`); `scores` imutável (sem policy de
update/delete ⇒ deny-by-default). **Anti-cheat seam:** flag `verified` (em scores/challenge_entries)
travada em `false` para o cliente por trigger `lock_verified` (`before insert or update`, reseta
`verified` quando `auth.role() <> 'service_role'`) — só a Edge Function de verificação (6.4,
service_role) marca `true` após re-simular `(seed, timeline)` e conferir `final_hash` (a maquinaria
de re-simulação é o `verifyReplay`/`hashState` de 5.4). Artefatos versionados: migração **idempotente**
`supabase/migrations/20260708000000_jr_schema.sql` (create/drop-if-exists), módulo puro de constantes
`src/services/online/schema.ts` (`SUPABASE_SCHEMA`/`TABLES`/`ONLINE_MODES`/`VERIFIED_TABLES`/
`TABLE_COLUMNS`, tipado estrito p/ guarda de completude), **guarda de contrato** `tests/online/
schema-contract.test.ts` (casa o texto do `.sql` com as constantes TS — schema/tabelas/colunas/RLS/
policies select+insert/trigger; sem Postgres no CI, é a defesa contra divergência SQL↔TS), `.env.example`
(só URL + publishable/anon key, segura no cliente por RLS; `!.env.example` no `.gitignore`, `.env` real
ignorado) e `supabase/README.md` (como aplicar + passos de dashboard). Execução SDD por subagentes
(3 tasks coder/haiku + review por task sonnet + review final opus **"READY TO MERGE"**, 0
Critical/Important). Suíte verde (`check` limpo, **595 testes** [+10], determinismo **67 inalterado**).
**Pré-requisito do usuário para 6.2+:** aplicar a migração no banco (SQL Editor ou `supabase db push`)
e, no dashboard, adicionar `jurassicrun` a _Exposed schemas_ + habilitar _Anonymous sign-ins_ (o
agente não tem senha do Postgres/service_role p/ aplicar). **Adiados/backlog:** `set search_path` na
função de trigger (hardening, irrelevante a este seam — 6.4); empacotamento compacto da `timeline`
(hoje `jsonb` de booleanos); dados por-perfil (hoje globais como wallet/trophy).

6.2 (ID global de jogador): identidade global do dispositivo via Supabase Auth **anônimo**
(`players.id = auth.uid()`, como 6.1 previu), vinculada ao **perfil local ativo** (nome/avatar),
**offline-first** — **só camada de serviços/app, `src/core/` intocado** ⇒ determinismo **67
inalterado** (sem re-pin de goldens). Módulo `src/services/online/` no padrão puro×casca (molde
wallet/trophy/settings): (1) `config.ts` PURO — `parseOnlineConfig(env)` devolve `{url,anonKey}` só
quando **ambas** `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` são strings não-vazias, senão `null`
(⇒ modo offline); casca `onlineConfig()` lê `import.meta.env`. (2) `client.ts` — **seam de IO**
`OnlineClient {signInAnonymously():Promise<string>; upsertPlayer(p):Promise<void>}` +
`memoryOnlineClient` (spy determinístico: `uid` fixável, `failSignIn`, conta `signInCount`/`upserts`;
sem rede) + casca real `createSupabaseClient(config)` que embrulha `@supabase/supabase-js`
(`createClient(url,key,{db:{schema:SUPABASE_SCHEMA}, auth:{persistSession:true,autoRefreshToken:true}})`);
`signInAnonymously` **reusa a sessão persistida** (`getSession`) antes de criar nova, p/ não
multiplicar usuários anônimos por boot; `upsertPlayer` faz upsert no `TABLES.players`. (3) `index.ts`
— `OnlineService` reativo singleton: sinais `globalPlayerId:ReadonlySignal<string|null>` e
`status:ReadonlySignal<'offline'|'connecting'|'online'|'error'>`; `init(deps?)` injetável
(`{config?,client?,profile?}`, defaults reais) é **async não-bloqueante** e **nunca lança**: config
`null`/client `null` ⇒ `offline` e retorna sem sign-in; senão `connecting`, `await
signInAnonymously()`, on success seta id + `online` + 1º `syncActiveProfile()` + monta um `effect`
que assina `profile.activeProfile` p/ re-sync em troca/rename; on error ⇒ `error` (id `null`, engole
o erro). `syncActiveProfile` monta `avatar=String(hue)` de `avatarFor`, **dedup por assinatura
`id|name|avatar`** (sem upsert redundante), best-effort (catch de rede não derruba status). `init`
**reentrante** (descarta o `effect` anterior, molde `AudioService`). **O "vínculo" é o sync de
nome/avatar** — não persistimos mapa próprio perfil↔uid (o `supabase-js` mantém a sessão). **1 ID
global por dispositivo** (múltiplos perfis locais compartilham a identidade online; o ativo empresta
nome/avatar). Fiação: `main.tsx` faz `void onlineService.init()` após `profileService.init()`
(fire-and-forget); `ProfileScreen` mostra bloco read-only de status + `globalPlayerId` truncado
(`slice(0,8)`) como evidência. i18n `online.{title,status.{offline,connecting,online,error},globalId}`
nos 10 locales (REGRA 4; 9 pares "Online"/"Offline" pt-BR/it/de na allowlist como empréstimos padrão;
paridade + scanner AST verdes). Dep nova `@supabase/supabase-js`. **Sem config/`.env` ⇒ status
`offline` e o jogo funciona 100% igual** (comportamento testado). Execução SDD (retomada de sessão
anterior: config Task 1 já commitada + client Task 2 implementado): Tasks 2–4 executadas INLINE (TDD,
commit por task) + review final por subagente. Suíte verde (`check` limpo, **607 testes** [+22],
determinismo **67 inalterado**). **Pré-req do usuário (herdado de 6.1):** migração aplicada +
`jurassicrun` em _Exposed schemas_ + _Anonymous sign-ins_ habilitado + `.env` preenchido; sem isso,
6.2 roda em `offline` (correto). **Adiados:** submeter/ler scores no servidor (6.3); verificação
anti-cheat Edge Function (6.4); troféus centrais (6.5); multi-perfil-online (1 identidade por perfil);
editar nome global independente do perfil; retry/backoff de reconexão (1 tentativa por boot, reload
re-tenta); dados por-perfil (hoje globais).

6.3 (Leaderboard central): submeter e ler rankings globais Endless/Diário/Semanal via Supabase,
com fallback local **offline-first** — **só camada de serviços/app, `src/core/` intocado** ⇒
determinismo **67 inalterado** (sem re-pin de goldens). Seis peças no padrão puro×casca + seam de
IO + reatividade `@preact/signals`: (1) **seam** — `OnlineClient` (`online/client.ts`) ganhou
`submitScore(input)`/`fetchScores(mode,seed?)` na MESMA instância supabase (mesma sessão anônima do
`upsertPlayer`) + tipos `OnlineMode`/`OnlineScoreInput`/`OnlineScoreRow`; `memoryOnlineClient` spy
(`submittedScores` + filtro por mode/seed) e casca real (`insert` em `scores`; `select('*, players(name,
avatar)')` ordenado por score, `limit MAX_ONLINE_ROWS=80` = folga p/ dedup no cliente; `mapScoreRow`
do join). (2) **mapeamento puro** `leaderboard/central.ts` — `toCentralEntries(rows, max=MAX_ENTRIES)`:
**dedup por `playerId` (mantém o melhor score)**, ordena score desc (desempate `createdAt`/`playerId`),
top-10, saneia (`sanitizeStat`); tipo `CentralEntry` (+ `playerName`/`playerAvatar`). (3) **interface
injetável** `leaderboard/online.ts` — `LeaderboardOnline {online, submitScore, fetchScores, currentSeeds}`
+ `memoryLeaderboardOnline` (double de teste) ⇒ `LeaderboardService` NÃO importa `OnlineService` nem
render. (4) **`OnlineService`** (`online/index.ts`, agora `export class`) expõe sinal `online`
(=`status==='online'`) + delegadores `submitScore(Omit<…,'playerId'>)` (anexa o próprio `globalPlayerId`
= `auth.uid()` ⇒ RLS `player_id=auth.uid()`; cliente nunca injeta id nem `verified`) e `fetchScores`,
ambos guardados e **best-effort (nunca lançam)**. (5) **`LeaderboardService`** online-aware
(`export class`): sinais `centralEndless/Daily/Weekly` + `centralAvailable`; `init(storage?, online?)`
monta um `effect` que dispara `refreshCentral()` na **borda offline→online** (guarda `lastOnline`,
reentrante); `recordMatch` mantém o local intacto (store+localStorage) e, se online, faz
`void submitScore(r).then(refreshMode).catch(()=>{})` (fire-and-forget); Diário/Semanal central =
**período atual** (mesma seed que o submit usa — `currentSeeds()` = `dailyChallengeSeed`/`weeklyChallengeSeed`
de `@render/seedSource`, idêntico ao `matchFactory`). (6) **adapter+UI** — `src/app/online/leaderboardAdapter.ts`
(`createLeaderboardOnline` sobre `onlineService`+seedSource, injetável); `main.tsx` faz
`leaderboardService.init(undefined, createLeaderboardOnline())`; `LeaderboardScreen` alterna
**Global×Local** por `centralAvailable` (linha-fonte i18n, nome do jogador, destaque "você" via
`globalPlayerId`); i18n `leaderboard.source.{global,local}` + `leaderboard.player` nos 10 locales
(REGRA 4; allowlist só p/ "Local" idêntico em es/pt-BR/fr; scripts nativos em ja/zh/ko/hi; paridade +
scanner AST verdes). **O `score` (composto de 1.8) é a métrica de rank exibida.** **Offline-first: sem
`.env`/offline ⇒ `centralAvailable=false`, tela usa boards locais, zero submit, sem exceção — jogo
idêntico ao anterior.** Execução SDD por subagentes (6 tasks: seam/puros haiku + integração/UI sonnet +
review por task + review final opus **"READY TO MERGE"**, 0 Critical/Important; 2 polimentos pós-review
aplicados inline: CSS do me-highlight/player/source antes inerte + `.catch` defensivo). Suíte verde
(`check` limpo, **624 testes** [+17], determinismo **67 inalterado**). **Pré-req do usuário (herdado
6.1/6.2):** migração aplicada + `jurassicrun` em _Exposed schemas_ + _Anonymous sign-ins_ + `.env`;
sem isso 6.3 roda offline (correto). **Adiados/backlog:** verificação anti-cheat da Edge Function
marcar `verified=true` + selo ✓ na tela (6.4); troféus centrais top-3 (6.5); agregação server-side
(hoje dedup no cliente sobre janela de 80 — jogador prolífico pode subpreencher o top-10); refetch
pós-submit usa período corrente (score de partida diária cruzando meia-noite UTC não aparece no board
de hoje); realtime/paginação/histórico de períodos; leaderboards por-perfil (hoje globais); Minors —
casts `as` no adapter (`OnlineScoresLike`/`svc.online`) erodem type-safety; `raw.mode as OnlineMode`
sem validação de runtime na casca.

6.4 (Verificação de desafio — anti-cheat): verificação server-side de replays de desafio
(Diário/Semanal) — **só serviços/app/infra, `src/core/` intocado** ⇒ determinismo **67
inalterado** (reusa `simulate`/`hashState` de `@core/replay`, read-only). Cinco peças: (1)
**verificação pura** `src/services/online/verifyChallenge.ts` — única fonte da verdade,
importa só `@core/replay`; re-simula `{seed, trait:'none'}` + timeline e exige BOTH
`hashMatches` (o `finalHash` recomputado bate ⇒ timeline legítima) AND `fieldsMatch`
(`score/distance/food/nearMisses` submetidos batem com a re-sim ⇒ colunas não infladas
independentemente do hash); ambos necessários porque o hash é da re-sim, não das colunas.
`challenge_entries` não tem `level` ⇒ não verificado. (2) **Bundle ESM autocontido** p/ Deno:
`src/core/` usa aliases `@core/*` + imports relativos sem extensão que o Deno cru não resolve,
então esbuild (`npm run build:edge` + devDep `esbuild`) empacota o verificador num único
`supabase/functions/verify-challenge/_verify.bundle.js` (commitado, tree-shake do grafo do
core) + **guarda de equivalência** `tests/online/edge-bundle.test.ts` (fonte↔bundle idênticos
em casos fiéis+adulterados ⇒ detecta staleness). (3) **Edge Function** Deno
`supabase/functions/verify-challenge/index.ts` (casca não-testada, molde da SQL de 6.1): com
`SUPABASE_SERVICE_ROLE_KEY` (único papel que passa o trigger `lock_verified` de 6.1) varre
`challenge_entries` `verified=false` em lote, re-verifica pelo bundle e marca `verified=true`
nos fiéis (idempotente ⇒ HTTP pós-submit ou `pg_cron`); + `deno.json` + `README` de deploy. (4)
**Cliente submete `challenge_entries`** (antes só `scores`): `OnlineClient.submitChallengeEntry`
(upsert `onConflict player_id,seed`) + `fetchVerifiedPlayers(mode,seed)` (+ spy no
`memoryOnlineClient`), delegadores best-effort no `OnlineService` (anexam o próprio `auth.uid()`,
guardados por `online`, nunca lançam), fiados no `startGame.onGameOver` reusando o
`buildReplayPayload` de 5.4 (fire-and-forget, só daily/weekly). (5) **Selo ✓ no leaderboard
central**: `CentralEntry.verified` (default false); `LeaderboardService.refreshMode` cruza o
conjunto verificado (`fetchVerifiedPlayers` via seam `LeaderboardOnline` + adapter) com as
entradas daily/weekly da seed corrente (Endless sempre false, sem replay); `LeaderboardScreen`
renderiza ✓ na aba Global; i18n `leaderboard.verified` nos 10 locales (REGRA 4). **Não posso
fazer deploy** (pré-req do usuário: `npm run build:edge` + `supabase functions deploy
verify-challenge`; regenerar+re-deploy o bundle sempre que `src/core/`/verificador mudar).
**Offline-first:** sem `.env` ⇒ delegadores no-op, `centralAvailable=false`, sem selo, jogo
idêntico. Execução SDD por subagentes (5 tasks: haiku puro / sonnet integração+UI + review por
task + review final opus **"READY TO MERGE"**, 0 Critical/Important). Suíte verde (`check`
limpo, **637 testes** [+13], determinismo **67 inalterado**). **Decisão de produto:** o ✓ é
**sinal, não gate** — atesta que o jogador tem um `challenge_entry` verificado da seed; o score
**exibido** vem de `scores` (não-verificado nesta fase) ⇒ o par honesto é consistente, mas
endurecer p/ gate (esconder/ordenar por verificados + verificar a coluna exibida) fica p/
backlog. **Adiados:** auto-invocação pós-submit (hoje HTTP/cron manual); "manter só a melhor
tentativa" no upsert (hoje overwrite, trigger re-zera `verified`, re-verificação corrige);
verificação de Endless (trait aleatório ⇒ guardar o trait); empacotamento compacto da timeline;
gate real; observabilidade da Edge Function (erro de update por linha engolido; `BATCH=100` sem
paginação intra-chamada — cron cobre).

6.5 (Troféus centrais sincronizados + pódio diário global): troféus locais passam a ser
**sincronizados** ao perfil online (tabela `jurassicrun.trophies` de 6.1) e o `dailyPodium`
endurece para o **top-3 CENTRAL** quando online — **só serviços/app, `src/core/` intocado** ⇒
determinismo **67 inalterado** (sem re-pin de goldens). Duas peças no molde do leaderboard
online (6.3): (1) **Sync bidirecional** — seam `OnlineClient.submitTrophies(playerId,ids)`/
`fetchTrophies(playerId)` (upsert **insert-only** `{onConflict:'player_id,trophy_id',
ignoreDuplicates:true}` porque a RLS de `trophies` só tem `select_public`+`insert_own`, sem
UPDATE) + spy `submittedTrophies`; delegadores best-effort no `OnlineService` (anexam o próprio
`auth.uid()`, guardados por `online`, nunca lançam); interface injetável `TrophyOnline` +
adapter `createTrophyOnline` (o `TrophyService` **não importa** `OnlineService`); `TrophyService`
online-aware (`init(storage?,online?)`): `pushToServer(newlyUnlocked)` após cada
`recordMatch`/`recordDailyPodium`, e `mergeFromServer` na **borda offline→online** (effect+
`lastOnline`, reentrante) que **une** os ids do servidor (filtrados por `isKnownTrophyId`) ao
local e **empurra os locais-só** de volta ⇒ reconciliação cross-device na mesma identidade
anônima. (2) **Pódio central** — `LeaderboardService.centralDailyRank(result)` computa o rank
global 1-based da seed do dia **injetando uma `OnlineScoreRow` sintética do score recém-jogado**
antes do `toCentralEntries` (dedup por melhor score ⇒ elimina a corrida com o `submitScore`
fire-and-forget e dá rank correto na 1ª jogada), via novo seam `LeaderboardOnline.playerId`
(→`onlineService.globalPlayerId`); novo `TrophyService.recordDailyPodium(rank)` reavalia só o
pódio (função pura `evaluate`, sem dobrar stats). Fiação no `startGame.onGameOver`: **online ⇒
só o rank central destrava o pódio** (`localRank` fica `undefined`, ramos mutuamente exclusivos);
**offline ⇒ rank local** (fallback leniente, comportamento do 5.3). i18n: `trophy.dailyPodium.desc`
perde "local" nos 10 locales (REGRA 4, paridade+scanner verdes; sem chaves novas).
**Offline-first:** sem `.env`/offline ⇒ `pushToServer`/`mergeFromServer` no-op, `centralAvailable`
false, pódio usa rank local, jogo 100% igual (best-effort, nunca lança). Execução SDD por
subagentes (6 tasks: haiku seams / sonnet integração + review por task; **Task 3 finalizada
INLINE** — subagente esbarrou em limite de sessão após só criar o test file, precedente 4.3/4.7/
4.8) + determinismo 67 confirmado + review final opus **"READY TO MERGE"** (0 Critical/Important;
5 Minors → backlog). Suíte verde (`check` limpo, **652 testes**, determinismo **67 inalterado**).
**Decisão de produto:** `dailyPodium` online = top-3 **global** (estrito) / offline = top-3
**local** (leniente) — dupla natureza offline-first, não bug. **Pré-req do usuário (herdado
6.1–6.4):** migração aplicada + `jurassicrun` em _Exposed schemas_ + _Anonymous sign-ins_ +
`.env`; sem isso 6.5 roda offline (correto). **Adiados/backlog:** troféu online cuja
avaliação/push falha só re-tenta no próximo ciclo offline→online (best-effort, "sinal não gate");
troféus **por-perfil** (hoje globais como wallet/nest); pódio semanal análogo; `recordDailyPodium`
reavalia catálogo inteiro (inerte hoje); casca real de `submitTrophies`/`fetchTrophies`
untested-by-unit (precedente de casca IO).

**Fase 6 (Online — Supabase) CONCLUÍDA** (itens 6.1–6.5).

**Fase 7 (PWA, responsividade & deploy) — EM ANDAMENTO.** Itens 7.1, 7.2, 7.3 e 7.4
concluídos (resta só 7.5 = wrappers de loja, futuro/fora do MVP).

7.1 (PWA — instalável + offline): manifesto Web App + service worker com precache ⇒ jogo
instalável (Android/desktop) e jogável offline. **Só build/infra/app, `src/core/` intocado**
⇒ determinismo **67 inalterado** (sem re-pin de goldens). Padrão puro×casca: (1)
`src/pwa/manifest.ts` PURO testável exporta `pwaOptions: Partial<VitePWAOptions>` (manifesto —
nome, `display:'standalone'`, `theme_color`/`background_color` `#0e1116` dos design tokens,
ícones 192/512 `any`+512 `maskable` com **caminhos relativos**; workbox `globPatterns` +
`maximumFileSizeToCacheInBytes:4MB` p/ caber o chunk Phaser ~1.4MB no precache; `navigateFallback`
index.html; `registerType:'autoUpdate'`+`injectRegister:'auto'` ⇒ registro do SW **injetado pelo
plugin**, `main.tsx` intocado; `devOptions.enabled:false`), consumido pela casca `vite.config.ts`
(`VitePWA(pwaOptions)` no lugar de `disable:true`). (2) **Ícones placeholder** (arte real = Fase 8):
`scripts/gen-icons.mjs` = encoder PNG **puro node-native** (só `node:zlib`+CRC32 manual, zero dep
nova, molde de `scripts/build-edge.mjs`) — `encodePng`/`renderIcon` (fundo sólido + triângulo,
ecoando o dino cosmético; safe-zone ~76% no maskable) geram os 3 PNGs **comitados** em
`public/icons/` (`npm run gen:icons`; `.d.mts` sibling p/ o teste `.ts` tipar o import do `.mjs`).
(3) `index.html` ganha meta `theme-color`/`description` (inglês, app inglês-first) + `<link>` de
ícone/apple-touch (o `<link rel="manifest">` é injetado, não hardcodado). Asset-spec
`docs/assets/specs/pwa-icon.md` + registro (REGRA 5). **`base` de subdiretório fica p/ 7.3** — o
plugin deriva `scope`/`start_url` do `base` do Vite (default `/` hoje) ⇒ não fixar absolutos aqui.
Sem strings de UI i18n novas (nome do manifesto é metadado OS-level, não passa pelo scanner AST).
Testes: `src/pwa/manifest.test.ts` (contrato do manifesto, endurecido contra regressão
`manifest:false`) + `tests/pwa/icons.test.ts` (assinatura PNG+IHDR+determinismo do encoder + os 3
PNGs comitados). Verificação de build: `npm run build` gera `dist/manifest.webmanifest`+`dist/sw.js`
+`dist/icons/*` e injeta o registro do SW no HTML (precache 12 entradas/1744 KiB). Execução SDD por
subagentes (3 tasks: coder haiku 1–2 / sonnet 3 + review por task + review final opus **"READY TO
MERGE"**, 0 Critical/Important; fixes aplicados: hardening de teste, status do registro, description
EN). Suíte verde (`check` limpo, **665 testes**, determinismo **67 inalterado**). **Pré-req do
usuário p/ prompt de instalação real:** deploy HTTPS (7.3 GitHub Pages) — SW só ativa em
HTTPS/localhost. **Adiados/backlog:** `base` de subdiretório + deploy (7.3/7.4); arte real dos
ícones (Fase 8, substitui `public/icons/` sem tocar código); Minors — `THEME`/`BACKGROUND`
duplicam `#0e1116` em `manifest.ts`; `includeAssets:['icons/*.png']` levemente redundante com o
glob; localização do manifesto (mono-idioma por plataforma).

7.2 (responsividade final): responsividade transversal fechada — **só camada app/render,
`src/core/` intocado** ⇒ determinismo **67 inalterado**. Padrão puro×casca: (1)
`src/render/orientation.ts` PURO (`shouldSuggestRotate({portrait,coarsePointer})` = só toque
em retrato) + (2) casca `src/app/hooks/useRotateHint.ts` que assina `matchMedia('(orientation:
portrait)')`+`(pointer:coarse)` (reage a `change`, sem polling — REGRA 3; cleanup no unmount) e
(3) overlay `.rotate-hint` na PlayScreen — **`pointer-events:none`** (não bloqueia flap/tap, só
sugere girar; some em paisagem) com chave i18n nova `rotateHint.message` nos 10 locales (REGRA 4).
**Decisão de produto:** campo lógico do jogo **fixo 320×180** (determinismo + justiça de
leaderboard: todos jogam o mesmo campo) ⇒ a resposta a telas variadas é escalar+letterbox, nunca
redimensionar o mundo; em celular retrato o 16:9 vira faixa fina ⇒ dica de girar (escolha do
usuário: não-bloqueante). **Fix descoberto na validação Playwright (Task 5, o cerne do item):** o
`Scale.FIT` do Phaser NÃO escalava — o container `.play-screen__canvas` com `height:100%`
colapsava para 180px (quirk de flex item flexível não propagar altura definida) ⇒ FIT media
180-alto ⇒ escala 1.0 ⇒ canvas ficava nativo 320×180 descentralizado. Correção (`src/app/styles/
global.css`): container do canvas vira caixa de dimensão DEFINIDA (`position:absolute; inset:0`;
`autoCenter:CENTER_BOTH` do Phaser centraliza — sem dupla centralização do flex); `#app` ganha
**altura fixa** `100dvh` (fallback `100vh`) em vez de `min-height` (senão a shell crescia com o
conteúdo e o `overflow-y` das telas ficava inerte, clipando o topo em paisagem curta); `.screen`/
`.home__menu` ganham `min-height:0` + `justify-content: safe center` (centraliza quando cabe,
alinha ao topo quando estoura — evita o bug clássico de clip do `center`); `overflow-x:hidden` em
html/body/#app trava scroll horizontal; barras de letterbox na cor do tema (`--color-bg`
`#0e1116`, casa com `theme-color`); Voltar respeita `env(safe-area-inset-*)`. Execução SDD por
subagentes (4 tasks: orientation/i18n/overlay/CSS haiku+sonnet + review por task + review final
opus **"READY TO MERGE"**, 0 Critical/Important) + Task 5 (validação) INLINE pelo controlador com
o fix de escala descoberto ali. Suíte verde (`check` limpo, **669 testes**, determinismo **67
inalterado**). Verificação visual (Playwright, matriz): canvas escala/centra simétrico (retrato
390×844→390×219, paisagem 844×390→693×390, desktop 1440×900→1440×810 aspect 1.778=16:9 exato,
barras no tema); dica de girar aparece só em toque+retrato com `pointer-events:none` provado;
Nest em 844×390 rola sem clipar topo (topo 24, último card alcançável); zero scroll horizontal em
todos os alvos. **Adiados/backlog:** Minors do review — `.rotate-hint` (z-20) escurece o Voltar
(z-10) em retrato (cosmético, clique intacto); `.play-screen` mantém flex-center agora inerte
(canvas/back/hint são absolutos); notch testado só por CSS `env()` (insets 0 no headless);
tablet-paisagem 1024×768 coberto por analogia ao desktop. Merge (7.2).

7.3 (deploy GitHub Pages): build da PWA publicado no GitHub Pages via GitHub Actions com base
path correto para o subdiretório do repo de projeto — **só build/infra, `src/core/` intocado**
⇒ determinismo **67 inalterado**. Padrão puro×casca: `src/pwa/base.ts` PURO testável
`resolveBasePath(env)` resolve o `base` do Vite a partir da env var `BASE_PATH` — ausente/vazio
⇒ `'/'` (dev/testes, sem regressão); começa com `.` (`.`/`./`/`..`/`../algo`) ⇒ passthrough
relativo (caso legítimo do Vite p/ host em path arbitrário, ex.: itch.io 7.4 — um `..`
acidental não vira absoluto inválido); absoluto ⇒ normalizado com barra inicial+final
(guarda contra o footgun de assets 404 quando falta a barra final). `vite.config.ts` (casca)
passou a `base: resolveBasePath(process.env)`. Workflow `.github/workflows/deploy.yml` (deploy
oficial de Pages: `configure-pages@v5`/`upload-pages-artifact@v3`/`deploy-pages@v4`,
`permissions` mínimas `contents:read`+`pages:write`+`id-token:write`, `concurrency:pages`
`cancel-in-progress:false`, push em `main` + `workflow_dispatch`) roda `npm run build`
(`tsc && vite build` ⇒ erro de tipo falha o deploy) com `BASE_PATH=/JurassicRun/`; publica
`dist/`. Separado do `ci.yml` (suíte completa em paralelo; gate `needs: ci` adiado). Doc
`docs/deploy/README.md` (mecanismo `BASE_PATH` + pré-req). Sem strings i18n (metadados de
infra). Execução INLINE (item pequeno de infra, TDD) + review final por subagente
**APROVADO** (0 bloqueadores; Minor `..` aplicado com teste). Suíte verde (`check` limpo,
**677 testes**, determinismo **67 inalterado**). Verificação de build local: `BASE_PATH=/
JurassicRun/ npm run build` ⇒ `dist/index.html` referencia `/JurassicRun/assets/…`,
`/JurassicRun/registerSW.js`, `/JurassicRun/manifest.webmanifest`; manifest `start_url`/
`scope` = `/JurassicRun/`, ícones em path relativo (resolvem sob o scope); build default (`/`)
sem prefixo. **Pré-req manual do usuário (não automatizável, `gh` não autenticado):
Settings → Pages → Source = GitHub Actions** no repo `insight-x-lab-technologies/JurassicRun`;
sem isso o job `deploy` falha "Pages não habilitado". **Adiados:** deploy itch.io (7.4, reusa
`BASE_PATH=./`); domínio customizado (CNAME); gate `needs: ci`; arte real dos ícones (Fase 8).

7.4 (deploy itch.io): empacotamento do build estático para publicação no itch.io como jogo
HTML5 — **só build/infra, `src/core/` intocado** ⇒ determinismo **67 inalterado**. Reusa
`resolveBasePath` (7.3): `BASE_PATH=./` (base relativa) já é passthrough p/ host em path
arbitrário. **Publicar de fato = ação manual do usuário** (exige conta itch + API key butler);
o item entrega tooling + automação inerte + docs. Três peças: (1) `scripts/package-itch.mjs`
(npm `package:itch`, molde `build-edge.mjs`): roda `npm run build` com `BASE_PATH=./` e zipa o
**conteúdo** de `dist/` (não a pasta) em `jurassicrun-itch.zip` com `index.html` na **raiz do
zip** (requisito do player HTML5 do itch), via `zip` do sistema; `.zip` no `.gitignore` (saída
de build). (2) `.github/workflows/itch.yml`: `butler push dist "<ITCH_TARGET>:html5"` em tag
`v*` + `workflow_dispatch`, **gated por `vars.ITCH_TARGET`** (offline-first, inerte até
configurar) — gate na *variable* porque o contexto `secrets` NÃO é permitido em `if` de job no
GitHub Actions; secret `BUTLER_API_KEY` no passo do push. (3) `docs/deploy/README.md` estende
com a seção itch.io (criar página Kind=HTML "jogado no browser"/viewport 640×360, upload manual
do zip **ou** setup butler [API key → secret+var], e a **limitação PWA**: itch embute em iframe
sandbox de subdomínio aleatório ⇒ SW pode não registrar; jogo roda igual, precache offline é
bônus do Pages). Sem strings i18n. Execução **INLINE** (item pequeno de infra, precedente 7.3);
TDD-por-build (verificação por build real, não unit test de script de empacotamento). Verificado:
`npm run package:itch` ⇒ zip com `index.html` na raiz (sem prefixo `dist/`), `dist/index.html`
com refs relativas (`./assets/…`, `./registerSW.js`, `icons/…`), zero path absoluto. Suíte verde
(`check` limpo, **678 testes**, determinismo **67 inalterado**). **Pré-req do usuário p/ publicar:**
criar a página HTML no itch.io + (opcional automação) API key butler → `BUTLER_API_KEY` secret +
`ITCH_TARGET` variable no repo. **Adiados:** publish real (ação do usuário); wrappers de loja
TWA/Capacitor (7.5, futuro); empacotamento compacto/otimização do zip; testar SW dentro do iframe
do itch (ambiente externo, documentado). **Fase 7: resta só 7.5 (futuro, fora do MVP).**

**7.5 (wrappers de loja) — ADIADO por decisão do usuário** (fora do MVP: custo de contas de
loja + tooling nativo colidem com "hobby web sem custo"). Fica registrado `[ ]`. **Fase 7
essencialmente fechada** (MVP instalável/offline/responsivo/deploy pronto).

**Fase 8 (Arte AAA & packs) — EM ANDAMENTO.** Item 8.1 (parte de ESPECIFICAÇÃO) concluída.

8.1 (specs de arte — docs-only): a partir de 6 imagens conceituais AAA do usuário (`ref/`, look
"Ptero Ascent"), produzido o sistema de especificação para geração externa por IA — **`src/` e
`src/core/` intocados ⇒ determinismo 67 inalterado** (a geração das imagens em si e o atlas ficam
para sessão futura / usuário). **Decisões de produto:** (1) **nome mantido "JurassicRun"** (logo
ornamentado, mas wordmark diz JurassicRun; rebrand "Ptero Ascent" é decisão futura separada); (2)
**regra dos dois tiers** — Tier 1 (UI/menus + fundos de tela) = AAA pintado full-res no DOM; Tier
2 (entidades in-game) = sprite legível a 320×180 no canvas (campo lógico fixo é REGRA travada);
(3) **HUD-fantasia do concept de gameplay REJEITADO** (`ref_GamePlay.png` mostra habilidades/
minimapa/objetivos/boost/dive/XP que violam o flap-only determinístico + justiça de leaderboard —
usado só como referência de *look*); (4) **fundos de tela** = 1 base `classic` + variantes
`volcano`/`glacier` trocadas pela expansão ativa (reusa o seam `activeExpansion` de 4.6). Cinco
artefatos: **Style Bible** `docs/assets/ART-DIRECTION.md` (paleta mestra slate+ouro+azul-glow,
materiais, tipografia, iconografia, regra dos dois tiers, REGRA 2); **catálogo de specs
prontas-para-IA** dos assets novos (`logo.app`; UI chrome `ui.panel.frame`/`ui.button`[primary+
secondary, 9-slice]/`ui.header.emblem`/`ui.statchip.frame`/`ui.medals`[gold/silver/bronze]/
`ui.nav.bar`/`ui.icons`[conjunto de 10 ícones de nav]; fundos `bg.screen`[classic/volcano/glacier]
+ `expansion.covers`) — cada spec no formato existente com dimensão exata @1x/@2x, transparência,
9-slice quando moldura, atlas alvo e **prompt IA copiável** referenciando o Style Bible;
**realinhamento** dos 24 specs existentes (nota de coerência + tier ao Style Bible, hitbox/prompts
técnicos intactos); **registro** `asset-registry.md` com seções novas "UI / chrome" e "Fundos de
tela" (todos os ids `spec`); **guarda de paridade** `tests/assets/registry-specs.test.ts` (todo
spec-path do registro existe em disco + todo spec novo tem bloco de prompt IA — testada com dente:
quebra→FAIL, revert→PASS). Migração concept→atual em `docs/superpowers/specs/2026-07-17-art-
direction-migration-design.md`: telas de menu são re-skin ~1:1 via remap de tokens CSS (documentado,
aplicação é 8.2); Game Over ganha linha Clima + badge "NOVO RECORDE!" (dado já no core, UI futura).
Execução **INLINE** (autoria dos prompts exige o contexto das 6 imagens que subagentes frescos não
teriam) + verificação real. Suíte verde (`check` limpo, **681 testes** [+3 da guarda], determinismo
**67 inalterado**). **Resta em 8.1:** gerar as imagens (usuário, IA externa) + empacotar em atlases;
**8.2** troca o manifesto para `kind:"sprite"` + aplica o remap de tokens no CSS.

8.2 (trocar manifesto geométrico → sprite): as 11 entidades in-game (Tier 2) passaram a renderizar
por **sprites de um texture atlas**, sem tocar `src/core/`/hitboxes ⇒ determinismo **67 inalterado**
(sem re-pin de goldens). **Decisão de escopo:** a arte AAA real (8.1-restante) é gerada externamente
pelo usuário; em vez de bloquear, o pipeline foi construído contra um **atlas PLACEHOLDER gerado
proceduralmente** (mesma filosofia de placeholders do projeto — áudio procedural, ícones PWA,
honor-system). A arte real entra depois **só trocando o PNG/JSON do atlas** (REGRA 2, zero retrabalho
de código). Padrão puro×casca. Quatro peças: (1) **gerador** `scripts/gen-atlas.mjs` (encoder PNG puro
node-native **reusando `encodePng` de `gen-icons.mjs`**, zero dep; `ATLAS_FRAMES` = 11 ids do manifesto
com cor/forma, grid `CELL=64`/`COLS=4`; `renderAtlas()` determinístico) que escreve
`public/atlas/entities.{png,json}` (formato **Phaser JSONHash**, frames nomeados pelos ids do manifesto;
`npm run gen:atlas`). (2) **helpers puros** `src/render/sprites.ts` (`spriteSizeFor(hitbox)→{w,h}` =
bounding box da hitbox via switch exaustivo `default:never` — hitboxes são aleatórias por instância, o
sprite cobre; `frameFor(typeId)→string|null` resolve o frame do manifesto ou null p/ fallback;
`ATLAS_KEY`/`ATLAS_PNG`/`ATLAS_JSON` relativos ao `BASE_URL`). (3) **manifesto** — as 11 entradas de
`ASSET_MANIFEST` viraram `{kind:'sprite',atlas:'entities',frame:'<id>'}`; `FALLBACK` primitivo (magenta)
mantido como segurança; guarda de completude do teste passou a cruzar manifesto↔atlas de fato. (4)
**casca** `GameScene` — `preload()` faz `this.load.atlas(ATLAS_KEY, BASE_URL+ATLAS_PNG, +ATLAS_JSON)`
(respeita base de Pages/itch); render por **pool de `Image`** (cresce 1× até o pico ⇒ alocação-zero no
hot path, REGRA 3; `sizeCache` por tipo; culling existente preservado; sprites em world-space
scrollFactor 1; dino = `Image` dedicado na posição interpolada, nunca cullado; ordem de pintura
obstáculos→coletáveis→power-ups→dino) + `drawPrimitive`/`drawEntity` mantidos p/ o fallback
(`frameFor===null`); o antigo `drawVisible` removido. Sem strings i18n novas; sem trabalho por frame
além dos mutadores. Execução SDD por subagentes (4 tasks impl: haiku puros/transcrição + sonnet
integração da casca + review por task + review final opus; T5 validação INLINE pelo controlador com
Playwright). **Evidência de fps** (Playwright, rAF real, mobile emulado 390×844, partida ativa com
flap): sprites do atlas renderizam (círculos p/ moedas/power-ups, retângulos p/ obstáculos, dino
vermelho); **p50 16,7ms = 60fps, 0 frames >50ms** (sem jank/GC; a média ~53fps é o cap de vsync
~57Hz do headless, não custo do jogo — idêntico ao achado de 2.7); **6 draw calls por frame** = prova
de batching (1 textura de atlas compartilhada pelas 11 entidades). Suíte verde (`check` limpo, **692
testes**, determinismo **67 inalterado**). **Adiados/backlog:** parallax e fundos de tela seguem
geométricos (Tier 1 / `ParallaxVisual` separado — 8.1/futuro); arte AAA real + atlas real (8.1-restante,
usuário); packs cosméticos (8.3); gateway real (8.4); Minors de review — dino usa frame literal em vez
de `frameFor()` (funciona por coincidência `frame===typeId`, footgun latente), sprites do pool em depth
0 uniforme (ordem de pintura entre tipos não garantida frame-a-frame, mas depth uniforme **ajuda o
batching** — objetivo do 8.2 — e colisão usa hitbox, não ordem de desenho); tuning das cores/formas
placeholder do atlas. **Resta na Fase 8:** 8.1 (arte real), 8.2-CONCLUÍDO, 8.3 (packs), 8.4 (gateway).

8.3 (packs look&feel): sistema de reskin cosmético trocável do jogo inteiro, **`src/core/` intocado**
⇒ determinismo **67 inalterado** (spec `docs/superpowers/specs/2026-07-18-look-and-feel-packs-design.md`,
plano `docs/superpowers/plans/2026-07-18-look-and-feel-packs.md`). **Decisão-chave: pack ≡ expansão
ativa** — reusa o seam `entitlementsService.activeExpansion` (4.6, anotado como "o render lê a expansão
ativa daqui") em vez de criar `PackService`/storage/tela paralelos; `classic`/`volcano`/`glacier` viram
os packs (unlock honor-system agora, gateway 8.4). Módulo puro `src/render/packs.ts`: `LookPack
{theme(custom properties CSS), dayNight(4 paletas do mundo), parallax(cor por camada), entityTint}` +
`packForId(id)` (fallback `classic`) + guarda de completude expansão↔pack. `classic` **reexporta**
`DAY_NIGHT_PALETTES`/`PARALLAX_LAYERS`/tokens padrão ⇒ **zero regressão** (provado byte-a-byte no teste).
Tema CSS reativo `src/app/theme.ts`: `applyPackTheme(pack)` seta as custom properties em `:root`;
`bindPackTheme()` é um `effect` que assina `activeExpansion` ⇒ **reskin dos menus AO VIVO** (molde do
`audioService`); `main.tsx` chama no bootstrap após `entitlementsService.init()`; `tokens.css` guarda os
defaults (= classic) + novo `--color-gold`. `GameScene` (casca) lê o pack ativo em `applyDayNight`:
paleta = `pack.dayNight[timeOfDayForSeed(seed)]` (**a seleção segue derivada da seed** ⇒ pack cosmético e
dia/noite justo são ortogonais/componíveis), cores de parallax (regeneradas por pack; chave de textura
inclui `packId`) e tint de entidade (`setTint`, **cacheado em `appliedEntityTint` na transição** ⇒
alocação-zero por frame, REGRA 3; guarda `appliedPackId`+`appliedDayNightSeed`). **Recolor procedural**
(volcano quente / glacier frio, placeholders coerentes com o Style Bible) SEM arte nova: atlas/áudio/
locale próprios por pack são o **ponto de extensão** documentado (`asset-registry.md`, REGRA 2) — um pack
futuro entra trocando os arquivos, sem tocar consumidores; sem código morto. Sem strings i18n novas
(nomes de expansão já existem). Execução SDD por subagentes (4 tasks: puros haiku / integração sonnet +
review por task — **T2 reprovada** (teste reinventava setup happy-dom com 3 `any` → fix pragma
`@vitest-environment happy-dom`); **T3 reprovada** (Critical REGRA 3: `packForId`/`Array.find` por frame
→ fix cacheia `appliedEntityTint`); **T4 INLINE** pelo controlador: docs + verificação visual). Suíte
verde (`check` limpo, **698 testes**, determinismo **67 inalterado**). Verificação Playwright (bundle
real; **gotcha 7.2 reconfirmado**: SW servia dist antigo em cache → unregister+clear caches+`?nocache`):
troca de tema CSS ao vivo (classic `--color-primary` #4ea1ff → volcano #ff7a3c, `--color-gold`
#c9a227→#d98a2b) + persistência (`activeId:volcano`); canvas recolorido ponta-a-ponta (classic céu creme
+ parallax cinza-verde + árvores verdes vs volcano céu vermelho-escuro + parallax basalto-vermelho).
**Adiados/backlog:** arte AAA real por pack (atlas/áudio próprios, 8.1-restante + futuro); cache de
textura de parallax cresce por pack visitado (desprezível a 3 packs); fallback primitivo de entidade não
recebe tint (caminho inatingível hoje); dead sprite-branch em `CLASSIC_PARALLAX` (para quando 8.1 trocar
camadas para sprite); tuning das paletas volcano/glacier (arte). **Resta na Fase 8:** 8.1 (arte real),
8.4 (gateway).

8.4 (monetização — gateway plugável): provider real de compra por trás do seam ADR-0004, **`src/core/`
intocado ⇒ determinismo 67** (spec `docs/superpowers/specs/2026-07-18-monetization-gateway-design.md`,
plano `docs/superpowers/plans/2026-07-18-monetization-gateway.md`). **Decisão de produto: Ko-Fi + código
de resgate single-use** (não Stripe — fora do ethos hobby-sem-custo). Compra/doação no Ko-Fi (externo) gera
um código; jogador cola na Loja/Expansões; Edge Function `redeem-code` (Deno, service_role, claim atômico
single-use contra `jurassicrun.redemption_codes`, **guard por `redeemed_at is null`** — não `redeemed_by`,
que pode ser null quando o JWT falha) valida e devolve o SKU; cliente aplica LOCAL (moedas→
`walletService.earn`; expansão→`entitlementsService.grantAndSelect`, que bypassa o provider honor-system —
este fica só de fallback). Peças puro×casca (molde 6.3/6.4): `src/services/purchase/sku.ts` puro (catálogo
SKU `coins:{small,medium,large}`/`expansion:{volcano,glacier}`, `parseSku`/`skuEffect`, `COIN_SKU_AMOUNTS`
fonte única dos coin packs), seam `RedemptionGateway` (`available` reativo + `unavailableGateway`/
`memoryRedemptionGateway`), casca `OnlineClient.redeemCode` (`functions.invoke`) + delegador best-effort
`OnlineService.redeemCode`, `PurchaseService` reativo (aplica SKU, nunca lança; ordem trim→available→
gateway→reason→parseSku; **SKU desconhecido do servidor ⇒ error SEM aplicar**), adapter
`createRedemptionGateway`, UI `RedeemCodeForm` (ref ao nó DOM p/ ler o código no submit — gotcha 4.2). Wire
type `RedeemResponse` único em `client.ts`. **Honor-system = fallback:** ShopScreen/ExpansionsScreen mostram
os botões de crédito/unlock grátis SÓ quando `!purchaseService.available` (offline); online ⇒ campo de
código. **Offline-first:** sem `.env` ⇒ `available=false` ⇒ jogo idêntico. Migração **append-only** (arquivo
NOVO `20260718000000_redemption_codes.sql`, não edita o `20260708` já-aplicado; RLS deny-by-default, só
service_role; `REDEMPTION_TABLE`/`REDEMPTION_COLUMNS` fora de `TABLE_NAMES` na guarda de contrato). i18n
`purchase.*`+`expansions.locked` nos 10 locales (REGRA 4). Execução SDD por subagentes (7 tasks + review por
task; **Task 1 corrigida** — implementador editou migração já-aplicada ⇒ fix p/ arquivo novo; review final
opus **"READY TO MERGE"** + 1 Important corrigido: guard de uso-único `redeemed_by`→`redeemed_at`).
**Gotcha:** `git commit -am` de subagente varreu trabalho pré-existente do usuário (arte 8.1/plans/scripts)
p/ o commit final ⇒ reescrevi o commit p/ só os 3 arquivos do fix, restaurando o resto ao working tree.
Suíte verde (`check` limpo, **721 testes**, determinismo **67 inalterado**). **Pré-req do usuário (igual
Supabase 6.x):** migração aplicada + `supabase functions deploy redeem-code` + conta Ko-Fi + inserir
`(code, sku)` em `redemption_codes` ao fulfillar + `.env`; sem isso roda honor-system (correto).
**Adiados:** Ko-Fi Webhook auto-grant; geração/painel de códigos; Stripe/cartão direto; reembolso; auditoria
de `redeemed_by` quando JWT falha; entitlements/wallet por-perfil.

8.1 (arte real de entidades in-game — PARTE in-game): as 11 entidades in-game (Tier 2) passaram do
atlas placeholder procedural para **arte real** gerada pelo usuário (`public/art/final/`), com o
**dino animado** (flap de 6 frames), e foi criado o **seam de atlas por tema**. **`src/core/`
intocado ⇒ determinismo 67** (spec `docs/superpowers/specs/2026-07-19-real-entity-art-and-theme-atlas-
design.md`, plano `.../plans/2026-07-19-real-entity-art-and-theme-atlas.md`). Validação (feita, decoder
PNG próprio + amostra de alpha): os PNGs do usuário são corretos (transparência OK; backgrounds RGB
opaco); NÃO drop-in (dinos são strips de 6 frames; UI/covers/parallax são sheets sem JSON de slice).
`scripts/gen-atlas.mjs` reescrito de gerador-de-shapes → **empacotador de PNGs reais** (reusa
`encodePng`, decoder próprio, zero dep): trim por conteúdo + slice do strip do dino com **bbox-união**
(registro estável) + downscale box-average peso-alpha + shelf-pack → `public/atlas/entities.{png,json}`
(JSONHash, 512×522, **17 frames** = 10 singles + `dino.default.0..5` + alias `dino.default`=frame 0). O
**dino virou `Sprite` animado** (`GameScene` cria anim `dino.flap` 12fps de `generateFrameNames`
prefix `dino.default.`; alocação-zero — anim roda no motor Phaser). **Seam de tema** (o que o usuário
pediu p/ futuras artes séria/cartoon): `LookPack.atlas?:AtlasRef` + `atlasRefFor(pack)` em
`sprites.ts` (classic=atlas real=default; volcano/glacier omitem ⇒ fallback+entityTint); `preload`
carrega o atlas do pack ativo. Registro: 11 ids `spec`→`art` + guarda de fonte. **Fix de precache**
(controlador): arte-fonte em `public/art/` é insumo de build (só o atlas é runtime) ⇒
`workbox.globIgnores:['**/art/**']` (precache 61MB→**1,9MB**, atlas 232KB segue cacheado). Execução SDD
por subagentes (4 tasks + review por task + review final opus **"READY TO MERGE"**, 0
Critical/Important; 5 Minors→backlog). Suíte verde (`check` limpo, **730 testes**, determinismo **67**).
Playwright (build de produção, 390×844): entidades reais renderizam (dino/moeda/power-ups/obstáculos);
atlas real servido (512×522, 17 frames); **p50 16,7ms/60fps steady, 0 frames >50ms** (max=1 frame
perdido=cadência de vsync do headless); atlas único ⇒ batching. **DECISÃO do usuário: construir o seam
de tema AGORA** (este set = tema default) + **escopo só entidades in-game**. **Adiados/backlog:**
Tier-1 (logo/UI 9-slice/ícones/medalhas/fundos de tela por bioma/parallax real com `bg.layers.png`) +
os 10 dinos do Ninho + capas de expansão (rodada futura, arte já gerada em `public/art/final/`); **mover
arte-fonte p/ fora de `publicDir`** (ainda copiada pro `dist`, só não precacheada) antes da rodada
Tier-1; fiar `ref.key` no pipeline de render (`acquireSprite`/`drawSpriteEntity`/dino usam `ATLAS_KEY`
de módulo — inerte hoje, quebra se um pack tiver atlas próprio); Minors T1 (constraint 8-bit do decoder
sem doc; teste de bbox-apertada; suíte +~19s por `renderAtlas` sem memoize).

8.1 (Tier-1 **rodada A/D**: fundos de tela + painéis 9-slice + logo) — `src/core/` intocado ⇒ **det 67**
(spec `docs/superpowers/specs/2026-07-19-tier1-A-backgrounds-and-panels-design.md`, plano `.../plans/2026-07-
19-tier1-A-backgrounds-and-panels.md`). A rodada Tier-1 da arte AAA de UI foi decomposta em **A→B→C→D**
(decisão do usuário: sequencial autônomo; menus legíveis por **painéis 9-slice**, não scrim). **Rodada A feita.**
Peça-chave nova `scripts/gen-ui.mjs`: **processador** que lê a arte-fonte de `public/art/final/` e emite runtime
PNGs pequenos (trim+downscale, reusa `decodePng`/`contentBounds`/`cropResize` de `gen-atlas`, exportados) em
**`public/ui/`** (fora de `art/` ⇒ **precacheados**; separa insumo-de-build de asset-de-runtime — o fix do
precache de PR #6). `UI_SOURCES` extensível (rodadas B/C adicionam grid-slice de sheets aqui). `LookPack.bgScreen`
+ `theme.ts` (`applyPackTheme` seta `--bg-screen`/`--ui-panel`, URLs com `import.meta.env.BASE_URL`) por expansão
ativa ⇒ **fundo de tela pintado por bioma, troca AO VIVO** (reusa o effect `bindPackTheme` do 8.3). CSS:
`.screen`/`.home` (NÃO `.play-screen`) sobre **painel 9-slice** (`border: 22px solid transparent; border-image:
var(--ui-panel) 12% fill / 22px / 0 stretch` — o `fill` pinta o centro translúcido escuro ⇒ legibilidade sem
scrim); `body` com `background-image: var(--bg-screen)` cover/fixed; **logo** `<img>` na Home (`public/ui/logo.png`,
`alt=""`, título acessível segue na `h1.sr-only`); defaults `--bg-screen/--ui-panel: none` em `tokens.css`.
Execução SDD por subagentes (3 tasks + review por task, 0 Critical/Important). Suíte verde (`check` limpo,
**735 testes**, det **67**). Playwright (build prod 390×844 + 844×390): logo dourado + painel ornamentado 9-slice
com centro escuro (menu legível) + fundo `bg.screen.classic`; **troca ao vivo** classic→volcano→glacier confirmada
(`getComputedStyle(body).backgroundImage`); sem scroll horizontal; `.play-screen` sem painel (border-image none).
**Gotcha:** o `coder` agente do projeto NÃO commita (regra) ⇒ controlador commita os arquivos staged. **Adiado:**
rodadas **B** (botões 9-slice/ícones de nav 10/statchip/emblema — grid-slice dos sheets `ui.buttons`/`ui.icons`/
`ui.remaining`), **C** (medalhas no leaderboard/capas de expansão/arte dos 10 dinos do Ninho), **D** (parallax real
`bg.layers.png` → far/mid/near no `GameScene`, ramo sprite do `ParallaxVisual`); **otimizar peso dos fundos**
(precache 1,9→**8MB**, fundos RGBA uncompressed ~6MB — reduzir maxDim/comprimir/JPEG).

8.1 (Tier-1 **rodada B**: botões 9-slice + ícones de nav) — `src/core/` intocado ⇒ **det 67** (spec/plano
`.../2026-07-19-tier1-B-buttons-and-icons*`). `gen-ui.mjs` ganhou **grid-slice uniforme** (`grid:{cols,rows,
names}` em `UI_SOURCES`; corta célula row-major + content-trim + downscale): `ui.buttons`(1×2→`button.primary/
secondary`), `ui.icons`(5×2→10 `icon.<rota>`: row1 daily/weekly/nest/shop/expansions, row2 leaderboard/settings/
share/donate/back = ordem do spec `ui.icons.md`). `theme.ts` seta `--ui-button`/`--ui-button-ghost` (URLs
BASE_URL); `.btn`(primary)/`.btn--ghost`(secondary) viram `border: 14px solid transparent; border-image:
var(--ui-button[-ghost]) 30% fill / 14px / 0 stretch` (fundo transparente, box-shadow removido); `HomeScreen`
ganha mapa `NAV_ICON` + `<img class="nav-icon" alt="" aria-hidden>` antes de cada rótulo do menu (New Game sem
ícone). **Otimização:** fundos `bg.screen.*` maxDim 1280→900 ⇒ **precache 8→5,5MB** (apesar de +12 PNGs). Execução
SDD por subagentes (3 tasks + review por task + review final; T3 review levantou **Important** de overflow em
locale de palavra longa). Suíte verde (`check` limpo, **737 testes**, det **67**). Playwright (build prod 390×844):
New Game azul brilhante 9-slice + botões ghost dourados + 9 ícones dourados corretos à esquerda dos rótulos;
**Important REFUTADO** — alemão @360px (`Wöchentliche Herausforderung`/`Einstellungen`) `docScrollWidth==win`,
zero botão em overflow (labels multi-palavra quebram no espaço). **Gotcha reconfirmado:** `coder` agente não
commita ⇒ controlador commita staged. **Adiado:** rodada **C** (`ui.remaining` = emblema/statchip/nav-bar/medalhas
via **rects não-uniformes** — grid uniforme não serve; + capas de expansão `expansion.covers` 3-col + arte dos 10
dinos do Ninho como frame estático), **D** (parallax real `bg.layers.png`); Minor: `NAV_ICON: Record<string,string>`
(podia ser `Partial<Record<Screen,...>>` p/ checagem em compilação); melhoria profunda de compressão PNG (filtragem
de scanline no `encodePng`, mexe em gen-icons/atlas/pwa) segue backlog.

8.1 (Tier-1 **rodada C**: medalhas + capas + arte dos dinos + statchip + emblema) — `src/core/` intocado ⇒
**det 67** (spec/plano `.../2026-07-19-tier1-C-medals-covers-dinos*`). `gen-ui.mjs` ganhou **slice por regiões**
(`regions:[{name,x,y,w,h,opaque?}]` com x/y/w/h em **frações [0,1]** da fonte + content-trim; 3ª via ao lado de
grid/single): de `ui.remaining` (1024×1536, bandas com whitespace) extrai `emblem`/`statchip`/`medal.{gold,silver,
bronze}` (nav-bar **pulada** — a shell é por telas, sem barra fixa), de `expansion.covers` (3 col opaco) as capas
`cover.{classic,volcano,glacier}`, e o **frame-0** (1/6 da largura) dos 10 strips de dino → `dino.<id>` (roster
starter…guardian) — 18 assets novos em `public/ui/`. `theme.ts` seta `--ui-statchip`; `.stat-chip` vira
`border-image` 9-slice; wiring JSX: Leaderboard `rankBadge(i)` (i<3 ⇒ `<img class="medal" src=medal.<tier>>`,
senão `i+1`, nos dois rows) substitui os emojis 🥇🥈🥉; `ExpansionCard`/`DinoCard` trocam o `<div>`-hue por
`<img class="…-card__avatar" src=cover.<id>/dino.<id>>` (object-fit cover); `HomeScreen` ganha `<img
class="home__emblem">` entre top-bar e menu. Execução SDD por subagentes (3 tasks + review por task + review
final; T3 atualizou 1 asserção de teste do leaderboard emoji→img). Suíte verde (`check` limpo, **739 testes**,
det **67**). Playwright (build prod 390×844, leaderboard semeado): Home com emblema-pterodáctilo + chips
emoldurados + Best Lv 7; Ninho com **10 dinos distintos** (frame-0 extraído — Scout ciano/Lodestone roxo/Goldbeak
dourado…); Expansões com 3 capas; Leaderboard com medalhas ouro/prata/bronze no top-3; sem scroll horizontal.
**Adiado:** rodada **D** (parallax real `bg.layers.png` → far/mid/near no `GameScene`, ramo sprite do
`ParallaxVisual`); Minor: `medal.*`/`statchip` grossos em elementos pequenos (tuning cosmético); **backlog
recorrente:** compressão dos PNGs de `public/ui/` (precache ~7,6MB — filtragem de scanline no `encodePng`, mexe
em gen-icons/atlas/pwa); arte de dino **dentro da partida** (skin in-game).

8.1 (Tier-1 **rodada D**: parallax real) — **fecha a rodada Tier-1** (A+B+C+D). `src/core/` intocado ⇒ **det
67** (spec/plano `.../2026-07-19-tier1-D-parallax*`). `gen-ui.mjs` fatia `bg.layers.png` (2172×724, 3 bandas
empilhadas) em 3 terços verticais (`regions`) → `public/ui/parallax.{far,mid,near}.png`. `ParallaxVisual`
ganhou o ramo **`sprite`** (`{texture,baseFromBottom,dispHeight}`) — o stub reservado desde 2.3; os 3
`PARALLAX_LAYERS` viraram sprite (`parallax.far` bf64/h52, `mid` bf34/h44, `near` bf0/h56; scrollFactor
0.2/0.4/0.7 mantidos). `packs.ts` `CLASSIC_PARALLAX` já tratava não-primitivo→0xffffff (o recolor por pack/dia
vem do `parallaxTint` via `setTint`, como antes) ⇒ sem mudança; testes `parallax.test`/`packs.test`
atualizados p/ sprite (não-vácuo). `GameScene`: `preload` carrega as 3 imagens; `ensureLayerTexture` retorna
`layer.visual.texture` p/ sprite (ramo primitivo fica de fallback); `create()` posiciona cada `TileSprite` em
`y=VIEW_HEIGHT-baseFromBottom-dispHeight`, `h=dispHeight`; `applyDayNight` só re-tinta (posição fixa do
create); `update()` por frame **só** `tilePositionX` (REGRA 3 intacta). Execução SDD por subagentes (3 tasks +
review por task + review final). Suíte verde (`check` limpo, **740 testes**, det **67**). Playwright (build prod
390×844, partida): 3 camadas de arte real — montanhas azuis (far) / colinas verdes (mid) / selva+palmeiras
(near) — empilhadas com profundidade + tint dia/noite; **60,1fps, over50=0, max 16,8ms** (parallax não adiciona
custo por frame). Posições placeholder ficaram boas (sem tuning). **RODADA TIER-1 DO 8.1 COMPLETA (A→B→C→D).**
**Backlog restante do 8.1/Fase 8:** compressão dos PNGs de `public/ui/` (precache ~7,7MB — filtragem de
scanline no `encodePng`, mexe em gen-icons/atlas/pwa); a11y do rank top-3 (medal aria-hidden); arte de dino
**in-game** (skin por dino na partida); mover arte-fonte p/ fora de `publicDir` (ainda copiada pro dist);
fiar `ref.key` do atlas de entidades no pipeline de render (8.1 in-game); costura de tiling do parallax se a
arte não for perfeitamente tileável (não observada). **Fase 8 essencialmente COMPLETA** (arte AAA integrada:
entidades in-game + Tier-1 UI/fundos/parallax; packs 8.3; gateway 8.4).
