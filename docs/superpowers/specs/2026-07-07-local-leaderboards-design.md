# 5.2 — Leaderboards locais (design)

**Item do roadmap:** Fase 5, 5.2. Recordes locais por modo (Endless / Diário / Semanal) +
tela de Leaderboard com três abas.

**Regra rankeável (herdada de 5.1):** tentativas ilimitadas; **a melhor tentativa rankeia**.
A gravação do recorde por período é este item.

## Objetivo

Persistir localmente os melhores resultados de partida em cada modo e mostrá-los numa tela
com três abas. Fechar o *seam* `getHomeStats().maxLevel` (placeholder desde 4.3, marcado para
a Fase 5).

## Regras inegociáveis atendidas

- **Determinismo (REGRA 1):** feature 100% de **apresentação/meta offline**. **NÃO toca
  `src/core/`.** Determinismo permanece **67** — sem re-pin de goldens.
- **i18n (REGRA 4):** toda string nova entra como chave i18next nos 10 locales.
- **Performance (REGRA 3):** leaderboard é DOM estático fora do loop do jogo; gravação
  acontece só na borda `playing → dead` (via `onGameOver`). Sem trabalho por frame.
- **Arte trocável (REGRA 2/5):** ícones são emoji (🥇/🥈/🥉/🏅), como Troféus (4.7) — **sem
  asset-spec** necessário.

## Métrica de ranking: `score`

O **score** (composto `distância·1 + comida·10 + nearMiss·5`, mult. temporário) é computado no
core desde 1.8 mas **nunca foi exibido** (HUD e Game Over mostram distância/comida/near-misses,
não score). O leaderboard finalmente dá propósito ao score: **rankeia por score desc**.

- Ordenação: `score` decrescente; **desempate por `achievedAt` ascendente** (recorde mais antigo
  ganha empates — semântica arcade clássica), depois por seed para estabilidade total.
- Cada recorde guarda também `distance`, `food`, `nearMisses` (exibidos como detalhe secundário)
  e `seed` (identifica o período no Diário/Semanal; token no Endless) e `achievedAt` (timestamp).
- Números são saneados a inteiro ≥ 0 na gravação (mesmo `sanitizeStat` do `trophy`: `Math.floor`,
  rejeita `NaN`/negativo/∞). Score/distância são floats canônicos no core; o leaderboard guarda o
  **piso** (consistente com "presentação faz floor", 1.8) — ranking por score-piso é idêntico para
  fins de jogo, e o desempate por `achievedAt` resolve pisos iguais.

## Modelo por aba

`MAX_ENTRIES = 10` por lista (top-10 local).

- **Endless:** toda corrida é um candidato independente. Insere e mantém as 10 maiores por score.
- **Diário / Semanal:** **deduplicado por `seed`** — 1 recorde por período (dia UTC / semana
  ISO). Ao gravar, se já existe recorde com a mesma seed, mantém o de maior score (substitui só se
  o novo for estritamente maior). Entre os períodos, mantém os 10 maiores por score. Isso realiza
  "melhor tentativa rankeia": todo restart do desafio replaya a MESMA seed (5.1), e só a melhor
  tentativa daquele período sobrevive.

**Por que rankear Diário/Semanal por score (e não por data):** é um leaderboard local de um só
jogador; ranquear por score dá o "meus melhores dias/semanas". A seed exibida em cada linha
(`daily:YYYY-MM-DD` / `weekly:YYYY-Www`) identifica o período — consistente com o `hud.seed` (2.4).

## Arquitetura — `src/services/leaderboard/` (molde puro×casca)

Espelha `trophy` (4.7) / `wallet` (4.5): store PURO + storage IO injetável + service reativo
singleton com `@preact/signals`.

### `store.ts` (PURO — testável, sem IO/aleatoriedade)

```ts
export type LeaderboardMode = 'endless' | 'daily' | 'weekly';

export interface LeaderboardEntry {
  readonly seed: string;
  readonly score: number;      // piso ≥ 0 (métrica de rank)
  readonly distance: number;   // piso ≥ 0
  readonly food: number;       // piso ≥ 0
  readonly nearMisses: number; // piso ≥ 0
  readonly achievedAt: number; // epoch ms (do shell; desempate)
}

/** Resultado de UMA partida a gravar (input; desacoplado de WorldState). */
export interface LeaderboardResult {
  readonly mode: LeaderboardMode;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly level: number;      // para bestEndlessLevel (só Endless)
  readonly achievedAt: number;
}

export interface LeaderboardState {
  readonly endless: readonly LeaderboardEntry[];
  readonly daily: readonly LeaderboardEntry[];
  readonly weekly: readonly LeaderboardEntry[];
  readonly bestEndlessLevel: number; // lifetime, NÃO evictável (para o chip da Home)
}

export const MAX_ENTRIES = 10;

export function initialLeaderboardState(): LeaderboardState;

/** Ordena por score desc, desempate achievedAt asc, depois seed. Imutável. */
// helper interno: rankEntries(list): sorted copy

/** Endless: insere e trunca top-10. */
// insertRanked(list, entry)

/** Diário/Semanal: dedup por seed (mantém maior score), ordena, trunca top-10. */
// insertPeriodic(list, entry)

/**
 * Grava um resultado no modo certo. Imutável. Devolve o MESMO objeto se nada mudou
 * (ex.: tentativa periódica pior que o recorde do período e level não superou).
 */
export function recordMatch(state: LeaderboardState, r: LeaderboardResult): LeaderboardState;
```

- `recordMatch` roteia por `r.mode`; atualiza a lista correspondente; se `mode === 'endless'`,
  atualiza `bestEndlessLevel = max(prev, sanitize(level))`.
- **Retorno de mesma-ref quando nada melhora** permite ao service pular persistência (diferente
  do `trophy`, aqui não há contador sempre-incremental).

### `storage.ts` (casca IO injetável)

Molde de `trophy/storage.ts`: `LeaderboardStorage {load, save}`, `memoryLeaderboardStorage`
(testes/fallback) e `localStorageLeaderboardStorage` (chave `jurassicrun.leaderboard.v1`, payload
`{version:1, ...state}`). `parseState`/`sanitize` **robusto**: qualquer JSON/forma inválida ⇒
`initialLeaderboardState()`; cada lista filtra entradas malformadas (campos numéricos saneados,
`seed` string não-vazia); `save`/`load` best-effort engolindo storage indisponível.

### `index.ts` (`LeaderboardService` reativo singleton)

```ts
class LeaderboardService {
  readonly endless: ReadonlySignal<readonly LeaderboardEntry[]>;
  readonly daily: ReadonlySignal<readonly LeaderboardEntry[]>;
  readonly weekly: ReadonlySignal<readonly LeaderboardEntry[]>;
  readonly bestEndlessLevel: ReadonlySignal<number>;
  init(storage?: LeaderboardStorage): void;
  recordMatch(r: LeaderboardResult): void; // commit só se o estado mudou de ref
}
export const leaderboardService = new LeaderboardService();
```

## Fiação (casca)

- **`startGame.ts`** — no `onGameOver` já existente (que credita moedas + `trophyService`),
  adiciona `leaderboardService.recordMatch({ mode, seed: match.seedLabel, score: w.score,
  distance: w.distance, food: w.food, nearMisses: w.nearMisses, level: w.level, achievedAt:
  Date.now() })`. `mode` vem do parâmetro de `startGame`; `match.seedLabel` da instância em escopo;
  `Date.now()` é da casca (permitido fora do core, como `seedSource`/`profile`).
- **`main.tsx`** — `leaderboardService.init()` no bloco de bootstrap (junto de wallet/trophy/…).
- **`getHomeStats()`** — `maxLevel: leaderboardService.bestEndlessLevel.value` (religa o seam;
  remove o placeholder `maxLevel: 1`).

## UI — `LeaderboardScreen.tsx` (rota `leaderboard`)

A rota `leaderboard` já existe no `Screen` e no `App` (hoje `PlaceholderScreen`). Troca por tela
real, molde de `TrophiesScreen` (4.7):

- **3 abas** (Endless / Diário / Semanal) com `useState` de aba local (default Endless).
- Lista rankeada da aba ativa: cada linha mostra **posição** (🥇/🥈/🥉 nas 3 primeiras, senão nº),
  **score** em destaque, e detalhe secundário (distância/comida/near-misses). Diário/Semanal também
  mostram a **seed** (período). Data via `new Date(achievedAt).toLocaleDateString(i18n.language)`.
- **Estado vazio** por aba (`leaderboard.empty`).
- Botão **Voltar** (`nav.back`).
- CSS por design tokens (sem cor hardcoded), mobile-first retrato+paisagem, sem scroll horizontal,
  alvos de toque ≥ 44px (abas). Classe raiz `.leaderboard` (sem colisão com `.trophies`/`.nest`).

### i18n (10 locales, REGRA 4)

Chaves novas: `leaderboard.title`, `leaderboard.tab.endless`, `leaderboard.tab.daily`,
`leaderboard.tab.weekly`, `leaderboard.empty`, `leaderboard.score`, `leaderboard.distance`,
`leaderboard.food`, `leaderboard.nearMisses`, `leaderboard.seed`, `leaderboard.rank`. (Reusa
`nav.back`.) Paridade garantida por `tests/i18n/locales.test.ts`; scanner AST de 4.9 impede
hardcoded.

## Testes

- **Unit (`store.ts`)**: insere no modo certo; top-10 trunca as menores; dedup por seed no
  Diário/Semanal (só a maior sobrevive; nova pior é no-op de mesma-ref); ordenação por score desc
  com desempate `achievedAt`; `bestEndlessLevel` sobe só no Endless e nunca é evictado; saneamento
  de números inválidos.
- **Unit (`storage.ts`)**: round-trip; JSON inválido/forma errada ⇒ estado inicial; entradas
  malformadas filtradas.
- **Integração leve**: `getHomeStats().maxLevel` reflete `bestEndlessLevel`.
- Suíte i18n (paridade + não-hardcoded) permanece verde.
- **Determinismo 67 inalterado** (nada em `src/core/`).

## Fora de escopo (adiado)

- Troféu top-3 do desafio diário → **5.3**.
- Guardar `seed + InputTimeline` da melhor tentativa → **5.4**.
- Leaderboards por-perfil (hoje **globais**, como wallet/trophy/nest) → **Fase 6**.
- Exibir score no HUD/Game Over fora do leaderboard; tuning de `MAX_ENTRIES`; formatação de data
  mais rica → backlog/Fase 8.
