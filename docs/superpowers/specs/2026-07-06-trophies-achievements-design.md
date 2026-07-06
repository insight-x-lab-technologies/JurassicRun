# Design — 4.7 Troféus / conquistas

**Item do roadmap:** Fase 4 (Meta offline), item 4.7 — `TrophyService` + catálogo de
conquistas. Religa o placeholder `trophies` do `getHomeStats`. (Top-3 diário → Fase 5/6.)

**Data:** 2026-07-06

## Objetivo

Dar ao jogador um conjunto de conquistas desbloqueáveis a partir do desempenho nas partidas,
persistidas offline, com contagem exibida na Home e uma tela para ver o progresso. Meta offline
puramente de apresentação/serviço — **não toca `src/core/`** ⇒ determinismo (67) intacto.

## Não-objetivos (fora de escopo)

- Top-3 diário / troféu por ranking (Fase 5/6 — depende de leaderboards).
- Notificação/toast de "conquista desbloqueada" (não há primitivo de toast ainda; o serviço
  já **retorna** os ids recém-desbloqueados para religar quando o toast existir).
- Religar `getHomeStats().maxLevel` (continua placeholder — é da Fase 5, leaderboards).
- Troféus por-perfil (globais por ora, como carteira/ninho/entitlements; por-perfil → Fase 6).
- Arte dedicada de troféu (usa emoji, como os StatChips). PNG trocável seria Fase 8.
- Tuning de limiares/catálogo (placeholders desta fase).

## Arquitetura (puro×casca — molde de `wallet`/`nest`/`entitlements`)

Novo serviço **global** `src/services/trophy/`:

- **`catalog.ts`** (puro) — `TrophyDef { id, nameKey, descKey, condition }`, onde
  `condition: (stats: TrophyStats) => boolean` é um **predicado puro** sobre o agregado.
  `TROPHY_CATALOG: readonly TrophyDef[]` congelado + `trophyById(id)`. Ícone é emoji resolvido
  na UI (não no modelo). Nenhuma dependência de IO/aleatoriedade.
- **`store.ts`** (puro) — o núcleo determinístico do serviço:
  - `MatchSummary { distance, food, nearMisses, score }` — resultado de UMA partida
    (desacoplado de `WorldState`; a casca extrai do mundo).
  - `TrophyStats` — agregado vitalício: `gamesPlayed`, `totalFood`, `totalDistance`,
    `bestDistance`, `bestNearMisses`, `bestScore`. Todos inteiros ≥ 0 (distância/score sofrem
    `Math.floor` ao dobrar — apresentação já floora esses floats).
  - `TrophyState { stats: TrophyStats, unlocked: readonly string[] }`.
  - `emptyStats()` / `initialTrophyState()`.
  - `foldMatch(stats, summary): TrophyStats` — puro/imutável: incrementa cumulativos
    (`gamesPlayed+1`, `totalFood += food`, `totalDistance += floor(distance)`) e faz `max` dos
    melhores (`bestDistance`, `bestNearMisses`, `bestScore`). Saneia entradas inválidas
    (NaN/negativo ⇒ 0), no molde de `sanitizeAmount` da carteira.
  - `evaluate(state): { state, newlyUnlocked: readonly string[] }` — percorre o catálogo,
    coleta ids ainda não desbloqueados cuja `condition(state.stats)` é verdadeira, e devolve
    o estado com eles adicionados (imutável; se nada muda, devolve o MESMO objeto).
  - `recordMatch(state, summary): { state, newlyUnlocked }` — compõe `foldMatch` + `evaluate`.
- **`storage.ts`** (casca IO injetável) — `TrophyStorage {load, save}`;
  `memoryTrophyStorage` (testes/fallback) e `localStorageTrophyStorage`
  (chave versionada `jurassicrun.trophies.v1`, payload `{version:1, stats, unlocked}`).
  `parseState` robusto: qualquer JSON/forma inválida ⇒ `initialTrophyState()`; filtra `unlocked`
  para ids conhecidos do catálogo; saneia cada campo de `stats` para inteiro ≥ 0. `save`
  best-effort (engole storage indisponível). Molde de `wallet/storage.ts` e `nest/storage.ts`.
- **`index.ts`** (`TrophyService` reativo singleton, como os demais serviços):
  - Sinais `ReadonlySignal`: `unlockedIds` (para a tela) e `unlockedCount` (`computed` do
    tamanho — para a Home).
  - `init(storage?)` (síncrono, default localStorage) carrega o estado.
  - `recordMatch(summary): readonly string[]` — aplica `recordMatch` do store,
    `commit`(set-sinal + persist) **só se** algo mudou, e retorna `newlyUnlocked`.
  - `commit(state)` = set-sinal + `storage.save`.
  - Reexporta `TROPHY_CATALOG`/`trophyById`/tipos.

### Fiação (casca)

- **`src/app/game/startGame.ts`** — o `onGameOver` existente ganha uma 2ª ação:
  ```ts
  onGameOver: (w) => {
    walletService.earn(coinsForFood(w.food));
    trophyService.recordMatch({
      distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score,
    });
  }
  ```
  O `MatchController` continua sem importar serviços (dispara o hook 1× na borda `playing→dead`).
- **`src/app/main.tsx`** — `trophyService.init()` no bootstrap (após os demais `init()`).
- **`src/app/home/stats.ts`** — `trophies: trophyService.unlockedCount.value` (religa o seam;
  `maxLevel` segue placeholder).
- **`src/app/screens/HomeScreen.tsx`** — a chip 🏆 vira um botão que navega para `trophies`
  (precedente: a identidade → `profile` no 4.3). `data-testid="home-trophies"`.
- **`src/app/router/routes.ts`** — adiciona `'trophies'` ao union `Screen`; `App.tsx` mapeia
  para `TrophiesScreen` no switch exaustivo.

### Tela

`src/app/screens/TrophiesScreen.tsx` — grade de cards (um por `TrophyDef`), cada card mostra
nome/descrição (i18n) e o estado **desbloqueado** (emoji 🏆 + destaque) ou **bloqueado**
(cadeado 🔒 + esmaecido, `aria`), lido reativamente de `trophyService.unlockedIds.value`.
Botão Voltar. CSS por design tokens (sem cor hardcoded), mobile-first, sem scroll horizontal,
molde de `ExpansionsScreen`/`NestScreen` (classe própria `.trophies`/`.trophy-card`, sem colidir).

## Catálogo inicial (placeholders — tuning Fase 8)

| id | condição (sobre `TrophyStats`) | tipo |
|----|--------------------------------|------|
| `firstFlight` | `gamesPlayed >= 1` | cumulativo |
| `centurion` | `bestDistance >= 1000` | partida-única |
| `forager` | `totalFood >= 50` | cumulativo |
| `daredevil` | `bestNearMisses >= 10` | partida-única |
| `marathoner` | `totalDistance >= 10000` | cumulativo |
| `highRoller` | `bestScore >= 5000` | partida-única |
| `persistent` | `gamesPlayed >= 25` | cumulativo |

Cobre os dois modos de avaliação (cumulativo × melhor-de-uma-partida) para provar o modelo.

## i18n (REGRA 4 — 10 locales)

- `trophy.<id>.name` e `trophy.<id>.desc` para os 7 ids.
- `trophies.title`, `trophies.locked`, `trophies.empty` (dica quando 0 desbloqueados),
  `trophies.back` (ou reusa `nav.back`), `screen.trophies`.
- Paridade garantida por `tests/i18n/locales.test.ts` (todas as chaves em todos os locales).

## Determinismo

`src/core/` **intocado** ⇒ determinismo 67 inalterado. O `TrophyService` lê o `WorldState`
apenas como leitura no game over (via `MatchSummary`), nunca escreve nele. Sem asset-spec novo
(ícones são emoji). A avaliação de conquistas é pura e determinística por construção (predicados
sobre um agregado), embora não faça parte do contrato do core.

## Estratégia de testes

- `store.test.ts` — `foldMatch` (cumulativo + `max` + saneamento de inválidos), `evaluate`
  (desbloqueia só condições satisfeitas e ainda-não-desbloqueadas; idempotente ⇒ mesmo objeto),
  `recordMatch` (composição; múltiplas partidas acumulam e destravam nos limiares).
- `storage.test.ts` — round-trip; `parseState` robusto (JSON quebrado, forma inválida,
  `unlocked` com id desconhecido filtrado, `stats` negativo/NaN saneado, versão ausente).
- `index.test.ts` — `TrophyService` reativo com `memoryTrophyStorage`: `recordMatch` atualiza
  sinais e persiste; `unlockedCount` acompanha; `newlyUnlocked` correto; `init` carrega.
- `stats.test.ts` (home seam) — `getHomeStats().trophies` reflete `unlockedCount`.
- Componente `TrophiesScreen` — smoke (happy-dom): renderiza N cards, marca desbloqueados
  (respeitando o gotcha signals+happy-dom já documentado).
- Suíte i18n garante paridade de chaves.

## Plano de execução

Subagent-driven (um implementador fresco por task + review por task + review final), branch de
feature `feat/4.7-trophies`, um commit por task. Tasks direita-dimensionadas:

1. `catalog.ts` + `store.ts` (puro: fold/evaluate/recordMatch) + testes.
2. `storage.ts` (localStorage + parseState robusto) + testes.
3. `index.ts` `TrophyService` reativo + `init` no bootstrap + testes.
4. Fiação: `startGame.onGameOver` + `getHomeStats` religado + rota `trophies` + chip 🏆 botão + testes do seam.
5. `TrophiesScreen` + chaves i18n (10 locales) + CSS + smoke de componente.

## Definição de pronto

`npm run check` limpo, `npm test` verde (incl. i18n de paridade e determinismo 67 inalterado),
contagem de troféus real na Home, tela de Troféus navegável, conquistas persistindo no reload.
Item 4.7 marcado `[x]`; "Estado atual" do `CLAUDE.md` atualizado (próximo = 4.8). Merge no `main`.
