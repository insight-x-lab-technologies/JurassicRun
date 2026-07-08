# 5.3 — Troféu de pódio do Desafio Diário (local)

> Spec da feature. Item 5.3 do `docs/roadmap/PHASE-05-challenges-local.md`.
> Modo autônomo (SDD). Decisões técnicas tomadas segundo os docs e a arquitetura existente.

## Objetivo

Quando a corrida de **Desafio Diário** do jogador fica no **top-3 do leaderboard diário
local**, ele ganha um troféu. É o **placeholder local** do troféu de top-3 do desafio diário
que a Fase 6 substituirá pela versão **central/online** (top-3 global). Ver
`ROADMAP.md` → "Troféus/conquistas; top-3 diário ganha troféu | 4 (sistema), 5 (top-3 local),
6 (central)".

Escopo: **somente o Diário** (o roadmap diz "desafio diário"). Semanal/Endless ficam de fora.

## Contexto — o que já existe

- **Troféus (4.7)** — `src/services/trophy/`: `TrophyDef { id, nameKey, descKey, condition }`
  onde `condition` é um **predicado puro** hoje sobre `TrophyStats` (agregado vitalício).
  `recordMatch(state, MatchSummary)` dobra a partida em `stats` e reavalia todo o catálogo,
  desbloqueando o que passou a ser verdadeiro. Idempotente; devolve a MESMA ref se nada muda.
  A UI (`TrophiesScreen`) renderiza o catálogo genericamente (locked/unlocked) — ganha o novo
  troféu de graça, só precisa das chaves i18n.
- **Leaderboards (5.2)** — `src/services/leaderboard/`: o modo `daily` é **deduplicado por
  seed** (1 recorde por dia, mantém o maior score) e a lista fica **sempre ranqueada** por
  score desc (a `insertPeriodic` chama `rank(...)`). `state.daily` é, portanto, a ordenação
  dos melhores dias já jogados (top-`MAX_ENTRIES=10`).
- **Orquestração** — `src/app/game/startGame.ts`, hook `MatchController.onGameOver(world)`:
  hoje credita moeda, grava troféu e grava leaderboard, na ordem trophy→leaderboard.

## Semântica do "top-3 diário" local

O leaderboard diário guarda **um recorde por dia** (dedup por seed). "Top-3" = o recorde de
**hoje** está entre os **3 melhores dias** que o jogador já pontuou no Diário. Torna-se
significativo depois de alguns dias jogados; nos primeiros 1–3 dias é trivialmente top-3.

Isso é **intencional para um placeholder**: recompensa jogar o Diário e ir bem, e a Fase 6
troca a semântica por "top-3 **global** do dia" sem que os consumidores mudem. Documentado
como ponto de aperto da Fase 6. O troféu, uma vez ganho, **permanece** (lista `unlocked`).

## Design

### 1. Predicado do troféu passa a receber um contexto (não só `stats`)

O "top-3 diário" **não** é função do agregado vitalício `TrophyStats` — depende do **rank da
corrida no leaderboard diário**, um fato **derivado da partida recém-terminada**. Em vez de
um mecanismo paralelo de desbloqueio, estende-se o **mesmo predicado puro** (a mesma jogada
que o 4.7 usou para unificar troféus cumulativos × de partida-única):

```ts
// src/services/trophy/store.ts
export interface TrophyEvalContext {
  readonly stats: TrophyStats;      // agregado vitalício (como hoje)
  readonly dailyRank?: number;      // rank 1-based no leaderboard diário; ausente se a
                                    // partida não foi um Diário
}
// TrophyDef.condition: (ctx: TrophyEvalContext) => boolean
```

- Os 7 troféus existentes passam a ler `ctx.stats.*` (mudança mecânica).
- Novo troféu:
  ```ts
  { id: 'dailyPodium', nameKey: 'trophy.dailyPodium.name', descKey: 'trophy.dailyPodium.desc',
    condition: (ctx) => ctx.dailyRank !== undefined && ctx.dailyRank <= PODIUM_RANK }
  ```
  com `PODIUM_RANK = 3` (constante nomeada no catálogo).

### 2. `dailyRank` é transiente (não persistido, não dobrado)

`dailyRank` **não** entra em `TrophyStats` nem em `MatchSummary` (que é dobrado no agregado).
É um dado **só de avaliação**, presente unicamente no momento de um Game Over de Diário.
Consequência: `dailyPodium` só pode desbloquear **naquele instante** — consistente com o
comportamento já documentado de que `evaluate` **não** roda no `init` (troféus de contexto
transiente só destravam em tempo de partida). Nada muda na persistência (`storage.ts` só
grava `stats` + `unlocked`; `dailyPodium` já é um id conhecido do catálogo ⇒ sobrevive ao
`knownId`).

Assinatura:
```ts
// store.ts
export function recordMatch(
  state: TrophyState, m: MatchSummary, extra?: { readonly dailyRank?: number },
): { state: TrophyState; newlyUnlocked: readonly string[] }
// → foldMatch(stats, m) → evaluate({ stats, unlocked }, { stats, dailyRank: extra?.dailyRank })
```
`evaluate(state, ctx: TrophyEvalContext)` passa a receber o contexto e chamar
`def.condition(ctx)`. Mantém "mesma ref se `newlyUnlocked` vazio".

`TrophyService.recordMatch(m, extra?)` repassa o `extra` a `recordMatchState`.

### 3. Leaderboard expõe o rank de uma seed

```ts
// src/services/leaderboard/store.ts
/** Posição 1-based da entrada com essa seed na lista (já ranqueada); undefined se ausente. */
export function rankOf(list: readonly LeaderboardEntry[], seed: string): number | undefined
```
```ts
// src/services/leaderboard/index.ts
/** Rank 1-based do recorde diário dessa seed; undefined se não houver. */
dailyRankForSeed(seed: string): number | undefined  // = rankOf(this._state.value.daily, seed)
```
A lista `daily` já sai ranqueada da `insertPeriodic`; no caso no-op (não melhorou), continua a
ranqueação anterior — correta.

### 4. Orquestração (`startGame.onGameOver`)

Reordenar para o leaderboard **primeiro** (o rank precisa refletir esta corrida), depois o
troféu com o contexto:

```ts
onGameOver: (w) => {
  walletService.earn(coinsForFood(w.food));
  leaderboardService.recordMatch({ mode, seed: match.seedLabel, ... });   // 1º
  const dailyRank = mode === 'daily'
    ? leaderboardService.dailyRankForSeed(match.seedLabel)
    : undefined;
  trophyService.recordMatch(
    { distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score },
    dailyRank !== undefined ? { dailyRank } : undefined,   // exactOptionalPropertyTypes
  );
}
```
O `extra` é construído **condicionalmente** (por causa de `exactOptionalPropertyTypes`, como
já é padrão no repo). `mode` é a constante do modo da sessão (o Diário replaya a mesma seed a
cada restart, por 5.1).

### 5. i18n (REGRA 4)

`trophy.dailyPodium.{name,desc}` nos 10 locales. Valores nativos; paridade garantida por
`tests/i18n/locales.test.ts`; o scanner AST de hardcoded não é afetado (chaves via `t()`).
Skill `add-locale` para as traduções.

### 6. Determinismo

**Nenhum arquivo de `src/core/` é tocado.** Troféus/leaderboards são meta offline de
apresentação. Determinismo permanece **67**, sem re-pin de goldens. `verify-determinism`
como cinto de segurança.

## O que NÃO muda

- `MatchSummary`, `foldMatch`, `TrophyStats`, `storage.ts` (formato persistido) — inalterados.
- `TrophiesScreen` — renderiza o catálogo genericamente; só precisa das chaves i18n.
- Endless/Semanal — sem troféu de pódio (fora do escopo do roadmap).

## Testes (verificáveis)

1. **`store` do troféu** — `recordMatch` com `{dailyRank:1|2|3}` desbloqueia `dailyPodium`;
   com `{dailyRank:4}` ou sem `extra` **não** desbloqueia; idempotência (mesma ref na 2ª vez);
   os 7 troféus antigos seguem funcionando via `ctx.stats`.
2. **`rankOf`** — seed presente ⇒ posição 1-based correta na lista ranqueada; ausente ⇒
   `undefined`.
3. **`dailyRankForSeed`** no serviço — reflete o estado após `recordMatch`.
4. **i18n** — paridade dos 10 locales (guard existente cobre ao adicionar as chaves).
5. **Orquestração** — coberta pelo comportamento; se houver teste de `startGame`/hook,
   assertar que só o modo `daily` passa `dailyRank`. (Casca fina; teste onde fizer sentido.)

## Riscos / decisões registradas

- **Placeholder leniente**: no 1º Diário o rank é 1 ⇒ desbloqueia de imediato. Intencional
  (recompensa tentar o Diário); a Fase 6 troca por top-3 global e endurece o critério.
- **Só Diário**: Semanal poderia ganhar um pódio análogo no futuro; fora do escopo agora.
- Mudar a assinatura de `condition` toca os 7 defs e `evaluate`/testes do troféu — mudança
  mecânica, contida no módulo `trophy`.
```
