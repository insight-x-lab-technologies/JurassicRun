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

**Fase 2 (vertical slice jogável Endless) — EM ANDAMENTO.** Itens 2.1 (render Phaser sobre
o core), 2.2 (input), 2.3 (parallax) e 2.4 (HUD) concluídos; faltam 2.5 (fluxo de partida) …
2.7 (performance).

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

Próximo: **2.5 (fluxo de partida)** — iniciar Endless com seed aleatória (exibida), morte ao
colidir, dificuldade crescente, reinício do zero a cada partida (resolve a morte-imediata da
demo). Ver `docs/roadmap/PHASE-02-endless-vertical-slice.md`.
