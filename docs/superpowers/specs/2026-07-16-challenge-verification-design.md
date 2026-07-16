# 6.4 — Verificação de desafio (anti-cheat) — Design

> Fase 6 (Online — Supabase), item 6.4. Edge Function que re-simula `(seed, InputTimeline)`
> e valida o score submetido de um desafio (Diário/Semanal), marcando `verified=true`.

## Contexto

Desde a Fase 1.9 existe a maquinaria de golden-master (`simulate`/`hashState` em `@core/replay`).
Em 5.4 o cliente já grava **localmente** o replay verificável de cada melhor tentativa de desafio
(`seed + InputTimeline + finalHash`) e `verifyReplay` re-simula e compara o hash. Em 6.1 o schema
online criou a tabela `challenge_entries` (`timeline jsonb`, `final_hash`, `verified`) com a flag
`verified` **travada ao `service_role`** por trigger (`lock_verified`) — o seam deste item. Em 6.2/6.3
o cliente já autentica (auth anônimo, `players.id = auth.uid()`) e submete/lê `scores`.

O que **falta** para o anti-cheat funcionar de ponta a ponta:
1. O cliente **nunca submete `challenge_entries`** (só `scores`). Sem a timeline no servidor, não há o
   que re-simular.
2. Não existe a **verificação server-side** que re-simula e marca `verified=true`.
3. O leaderboard não distingue entradas **verificadas** das não-verificadas.

## Objetivo e não-objetivo

**Objetivo:** um jogador só recebe o selo "verificado" num desafio quando o servidor re-simula a
timeline submetida e confirma que ela reproduz exatamente o estado final (hash) e os campos de score
declarados. Degrada graciosamente offline (sem `.env`/Supabase ⇒ jogo 100% local, sem selo, sem erro).

**Não-objetivo:** bloquear/remover scores não-verificados do ranking (a Fase 6 exibe "verificado" como
sinal de confiança, não como gate); verificar Endless (trait aleatório não é reconstruível só da seed —
fora do escopo, como em 5.4); gateway de pagamento; realtime.

## Regras inegociáveis respeitadas

- **Determinismo (REGRA 1):** `src/core/` **não é tocado**. A verificação só **importa** `@core/replay`
  (read-only). Determinismo permanece **67**. (Rodaremos a bateria mesmo assim.)
- **i18n (REGRA 4):** o selo/tooltip "verificado" entra como chave i18n nos 10 locales.
- **Performance (REGRA 3):** a verificação roda no servidor (batch, cold path) e no cliente só na
  submissão (game-over). Sem trabalho por frame.

## Arquitetura

Quatro camadas, do núcleo puro para fora:

### 1. Verificação pura — `src/services/online/verifyChallenge.ts`

Função **pura**, único ponto da verdade da lógica anti-cheat, importável tanto pelo Vitest (Node)
quanto pela Edge Function (Deno, via bundle). Depende **só de `@core/replay`**.

```ts
export interface ChallengeSubmission {
  readonly seed: string;
  readonly timeline: readonly boolean[]; // 1 flap por step
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string;
}
export interface ChallengeVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // recomputado pela re-sim
  readonly hashMatches: boolean;
  readonly fieldsMatch: boolean;  // score/distance/food/nearMisses batem com a re-sim
}
export function verifyChallengeSubmission(sub: ChallengeSubmission): ChallengeVerification;
```

Re-simula `simulate({ seed, trait: 'none' }, timeline.map(flap => ({ flap })))` — os defaults de
dificuldade/clima **devem** bater com `createMatchFactory` (o que já é verdade em `verifyReplay`/5.4) —,
recomputa `hashState(world)` e lê `world.{score,distance,food,nearMisses}`.

`valid = hashMatches && fieldsMatch`, onde:
- `hashMatches = expectedHash === sub.finalHash` (prova que a **timeline** é legítima e leva ao estado
  declarado);
- `fieldsMatch` = cada campo submetido é **exatamente** o da re-sim (prova que as **colunas** de score
  não foram infladas independentemente do hash).

Ambos são necessários: o `finalHash` é um digest do `WorldState` visível **da re-sim**, não das colunas
submetidas; um trapaceiro poderia enviar `timeline + finalHash` coerentes mas inflar a coluna `score`.

`challenge_entries` **não tem `level`** (nem `buildReplayPayload`) ⇒ não verificamos `level` aqui.

### 2. Bundle portável para Deno + guarda

`src/core/` usa aliases `@core/*` e imports relativos **sem extensão** (`export * from './world'`),
que o Deno cru **não** resolve. Em vez de tornar o core Deno-compatível (invasivo, arriscaria o
contrato de determinismo), **bundlamos** o verificador num único ESM autocontido:

- Entrada: `verifyChallenge.ts`. Build (esbuild, `format=esm`, `bundle`, `platform=neutral`, resolvendo
  o alias `@core`) ⇒ `supabase/functions/verify-challenge/_verify.bundle.js` (commitado).
- Script npm `build:edge` gera o bundle. Nova devDep `esbuild` (o vite@8/rolldown não expõe esbuild
  standalone).
- **Guarda de equivalência** `tests/online/edge-bundle.test.ts`: importa o bundle JS **e** a fonte TS,
  roda os mesmos `(seed, timeline)` (inclui uma timeline adulterada) e assere resultado **idêntico**.
  Isso prova que o que roda no Deno é fiel à fonte testada — se a fonte mudar e o bundle não for
  regenerado, o teste diverge e falha. (`build:edge` também roda no CI antes de `test`.)

### 3. Edge Function — `supabase/functions/verify-challenge/index.ts`

Casca Deno fina (não testada por unidade; molde da casca `createSupabaseClient`/SQL de 6.1):

- `Deno.serve` handler; cria client Supabase com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (env do
  ambiente da função — service_role é quem pode marcar `verified`), schema `jurassicrun`.
- Query: `challenge_entries` com `verified = false`, em lote (`limit` configurável, ex. 100).
- Para cada linha: monta `ChallengeSubmission` e chama `verifyChallengeSubmission` (do bundle).
- Nos **válidos**: `update ... set verified = true where id = ...`. Inválidos ficam `verified = false`
  (não contam como confiáveis; não deletamos — política de exibição, não de gate).
- Responde `{ checked, verified }` (JSON). **Idempotente** (só processa não-verificados) ⇒ pode ser
  chamada por HTTP (pelo cliente após submeter) ou por `pg_cron`/agendador. Documentamos as duas; não
  acoplamos auto-invocação obrigatória.
- Não posso **fazer deploy** (precisa do projeto/segredos do usuário), como em 6.1 entreguei a
  migração sem aplicar. `supabase/functions/README.md` documenta `supabase functions deploy
  verify-challenge` + `supabase secrets set` + opção de agendamento.

### 4. Submissão do cliente + selo no leaderboard

**Submeter `challenge_entries`** (o que dá matéria-prima à verificação):
- `OnlineClient` ganha `submitChallengeEntry(input)` (+ spy no `memoryOnlineClient`, casca real
  `upsert` em `challenge_entries` com `onConflict: 'player_id,seed'` ⇒ 1 entrada por período; o trigger
  reseta `verified=false` no update, forçando re-verificação). Tipo `OnlineChallengeInput`
  (`playerId, mode(daily|weekly), seed, score, distance, food, nearMisses, timeline, finalHash`).
- `OnlineService.submitChallengeEntry(Omit<...,'playerId'>)` delegador best-effort (nunca lança;
  guardado por `online` + `globalPlayerId`, anexa o próprio uid).
- Fiação: em `startGame.onGameOver`, onde `buildReplayPayload` (5.4) já roda para daily/weekly, se o
  payload é não-null, `void onlineService.submitChallengeEntry(payload)` (fire-and-forget). `startGame`
  é casca — pode importar `onlineService`.

**Selo ✓ no leaderboard central** (daily/weekly):
- `OnlineClient` ganha `fetchVerifiedPlayers(mode, seed): Promise<readonly string[]>` (casca real:
  `select player_id from challenge_entries where mode=? and seed=? and verified=true`; spy no memory).
- `LeaderboardOnline` (seam de `LeaderboardService`) ganha `fetchVerifiedPlayers(mode, seed)`; o adapter
  (`src/app/online/leaderboardAdapter.ts`) delega ao `onlineService`.
- `CentralEntry` ganha `verified: boolean`. Ao construir os sinais centrais daily/weekly, o
  `LeaderboardService` cruza o conjunto de player_ids verificados (da seed corrente) com as entradas e
  seta `verified`. Endless: sem replay ⇒ sempre `false`, sem selo.
- `LeaderboardScreen`: renderiza ✓ ao lado do nome quando `entry.verified` (só na aba Global). Chave
  i18n `leaderboard.verified` (rótulo/aria) nos 10 locales.

## Fluxo de dados (feliz)

1. Jogador termina um Diário. `onGameOver` grava local (5.4) + `leaderboardService.recordMatch` (submete
   `scores`, 6.3) + `onlineService.submitChallengeEntry(payload)` (novo: `challenge_entries`,
   `verified=false`).
2. Edge Function (HTTP/cron) varre não-verificados, re-simula, marca `verified=true` nos fiéis.
3. Próxima abertura do leaderboard: aba Global daily busca scores (6.3) **e** o conjunto verificado;
   entradas de jogadores verificados exibem ✓.

## Verificação (evidência antes de "pronto")

- `verifyChallengeSubmission`: testes de submissão fiel (valid), hash adulterado (invalid via
  `hashMatches=false`), coluna de score inflada com hash correto (invalid via `fieldsMatch=false`),
  timeline divergente.
- Guarda de bundle: equivalência JS↔TS.
- `OnlineClient`/`OnlineService`/`LeaderboardService`: novos seams com memory doubles.
- `npm run check` + `npm test` + bateria de determinismo (deve seguir **67**, core intocado).
- Não há deploy/execução ao vivo da Edge Function neste ambiente (documentado; molde 6.1).

## Decisões e alternativas rejeitadas

- **Bundle vs core Deno-compatível:** tornar `src/core` Deno-nativo (extensões explícitas + import maps)
  tocaria dezenas de arquivos do núcleo determinístico e arriscaria o contrato — rejeitado. O bundle
  isola a fricção e mantém o core intocado.
- **Verificar `challenge_entries` vs `scores`:** a timeline vive em `challenge_entries`; verificar lá e
  cruzar o conjunto verificado no leaderboard mantém a Edge Function **single-table** e desacoplada de
  `scores` (que 6.3 usa para ranquear). Marcar `scores.verified` exigiria casar linhas append-only por
  (player, seed) — rejeitado por acoplamento.
- **Gate vs sinal:** não escondemos scores não-verificados do ranking nesta fase — exibimos ✓ como
  sinal. Endurecer para gate é possível depois sem mudar o schema.
- **Trigger da Edge Function:** batch idempotente sobre não-verificados ⇒ funciona por HTTP (cliente
  pós-submit) ou cron. Não obrigamos auto-invocação (mantém desacoplado).

## Adiados / backlog

- Auto-invocação da Edge Function pelo cliente após submit (hoje: manual/cron, documentado).
- "Manter só a melhor tentativa" no upsert de `challenge_entries` (hoje overwrite por período; o trigger
  re-zera `verified`, re-verificação corrige — pior caso: entrada verificada sobrescrita por tentativa
  pior re-verifica).
- Verificação de Endless (guardar o trait junto p/ reconstruir).
- Gate real (esconder não-verificados) e ordenação preferindo verificados.
- Empacotamento compacto da timeline (`jsonb` de booleanos hoje).
- Deploy real da Edge Function + agendamento (pré-req do usuário, como a migração de 6.1).
