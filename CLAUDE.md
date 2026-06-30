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
difficulty distintos ⇒ hashes distintos. Suíte verde (`check` limpo, 199 testes, determinismo
54; determinism-guardian "contrato intacto"). **Adiado:** cenário golden que exercite
`nearMisses>0` (redundante — já coberto por `economy.determinism.test.ts`).

Próximo: **Fase 2 (vertical slice jogável Endless — 1º milestone: render Phaser, parallax, HUD,
input, loop fixo↔render)**. Ver `docs/roadmap/PHASE-02-endless-vertical-slice.md`.
