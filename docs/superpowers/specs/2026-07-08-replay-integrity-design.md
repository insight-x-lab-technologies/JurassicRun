# 5.4 — Integridade: replays verificáveis (seed + InputTimeline)

**Data:** 2026-07-08
**Fase/Item:** 5 (Desafios & leaderboards locais) — 5.4
**Status:** design aprovado (modo autônomo)

## Objetivo

Gravar, para a **melhor tentativa** de cada desafio (Diário/Semanal), o `seed` + a
`InputTimeline` que a produziu, mais uma **âncora de integridade** (o hash do estado final),
de modo que a corrida possa ser **re-simulada e verificada** de forma determinística. Isto
prepara a verificação **online** (Fase 6): o servidor guardará `seed + timeline + hash` e
re-rodará a simulação para provar que o score reclamado é legítimo.

## Regra inegociável tocada

Nada em `src/core/` muda. A feature **reusa** o núcleo determinístico existente:
`simulate(config, timeline)` e `hashState(world)` (Fase 1.9). Determinismo permanece **67**
(sem re-pin de goldens). A captura da timeline vive na camada de render; o armazenamento e a
verificação vivem na camada de serviços — padrão puro×casca, como os serviços 4.x/5.x.

## Por que isto funciona (o contrato de determinismo já garante)

Mesma seed + mesma sequência de inputs ⇒ estado idêntico (provado pela bateria de
determinismo). Logo:

- Uma partida de desafio nasce de `createWorld({ seed, trait: 'none' })` (via
  `createMatchFactory` — dificuldade e clima usam os defaults `true`).
- Se gravarmos **exatamente** os `InputFrame` que a simulação consumiu, então
  `simulate({ seed, trait: 'none' }, timeline)` reproduz **byte-a-byte** o `WorldState` final,
  e `hashState` do resultado bate com a âncora gravada.
- Adulterar a timeline (ou trocar a seed) muda o hash ⇒ verificação falha.

Isto é precisamente a verificação online: dado `(seed, timeline, hashReclamado)`, re-rode e
compare o hash.

## Arquitetura

Três unidades novas + fiação, cada uma com um propósito único.

### 1. Captura da timeline — `FixedStepLoop` (render, puro-testável)

O loop consome `this.input.sample()` exatamente 1×/step dentro de `advance`. É o ponto exato
onde os frames realmente entram na simulação.

- Novo campo privado `recorded: boolean[]`.
- Dentro do laço de step, após obter o frame consumido, `this.recorded.push(frame.flap)`.
  Grava um **booleano primitivo** (não objeto) ⇒ sem alocação de objeto no hot path (REGRA 3);
  o array cresce de forma amortizada e é descartado a cada nova partida.
- `recordedTimeline(): InputTimeline` — monta `InputFrame[]` a partir dos booleanos **sob
  demanda** (chamado só no game-over, cold path).
- **Auto-reset por partida:** `MatchController.startMatch` já cria um `new FixedStepLoop(...)`
  a cada partida/restart ⇒ o buffer nasce vazio sem reset manual.

Detalhe de correção: durante a pausa o `advance` não é chamado (o gate é na `GameScene`), então
nenhum frame-fantasma é gravado. O 1º flap (o tap que faz `ready→playing`) é consumido no 1º
step via latch do `FlapInputSource` e portanto **entra** na timeline — coerente com
`simulate`, que aplica `timeline[0]` no 1º step de um mundo fresco.

`MatchController.recordedTimeline()` delega para `this._loop.recordedTimeline()`.

### 2. Store de replays — `src/services/replay/store.ts` (puro)

```ts
type ReplayMode = 'daily' | 'weekly';

interface StoredReplay {
  readonly mode: ReplayMode;
  readonly seed: string;
  readonly timeline: readonly boolean[]; // flap por step
  readonly score: number;      // reclamado (exibição/ranqueamento)
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string;  // hashState do WorldState final — âncora de integridade
  readonly achievedAt: number;
}

interface ReplayState {
  readonly daily: readonly StoredReplay[];
  readonly weekly: readonly StoredReplay[];
}
```

- `MAX_REPLAYS = 10` por modo (espelha `MAX_ENTRIES` do leaderboard).
- `recordReplay(state, replay): ReplayState` — dedup por `seed` mantendo o **maior score**
  (mesma semântica de "melhor tentativa por período" do leaderboard); insere e trunca por
  score desc; devolve a **MESMA ref** quando a nova tentativa não supera o recorde daquele
  período (no-op ⇒ sem persistência). Imutável.
- `sanitizeStat` reaproveitado (piso inteiro ≥ 0) para os campos numéricos.

Manter a mesma regra de "max score por seed" que o leaderboard mantém os replays **alinhados**
aos recordes exibidos, sem acoplar os dois módulos.

### 3. Verificação — `src/services/replay/verify.ts` (puro)

```ts
interface ReplayVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // gravado no replay
  readonly actualHash: string;   // recomputado agora
}

function verifyReplay(replay: StoredReplay): ReplayVerification;
```

Reconstrói a config do desafio (`{ seed: replay.seed, trait: 'none' }`), roda
`simulate(config, replay.timeline.map(flap => ({ flap })))`, recomputa `hashState` do resultado
e compara com `replay.finalHash`. `valid = actualHash === expectedHash`.

A reconstrução da config de desafio é a **mesma** que `createMatchFactory` usa para
daily/weekly; um comentário em ambos os pontos amarra a coerência (se a config de desafio
mudar, os dois devem mudar juntos). `difficulty`/`weather` usam os defaults `true`.

### 4. Storage + serviço — `storage.ts` / `index.ts`

- `storage.ts`: `localStorage` chave `jurassicrun.replays.v1`, payload `{ version: 1, ...state }`;
  `parseState` **robusto** (molde do leaderboard): JSON inválido/forma errada ⇒ estado inicial;
  entradas malformadas filtradas (`seed` string não-vazia; `timeline` precisa ser um array de
  booleanos; `finalHash` string; numéricos saneados). `save` best-effort (engole erro de
  storage indisponível). `memoryReplayStorage` para testes.
- `index.ts`: `ReplayService` reativo singleton (molde de `leaderboard`): guarda `ReplayState`,
  `init(storage?)`, `record(payload)` (persiste só se a ref mudar), e reexporta `verifyReplay`.
  (Sinais reativos não são estritamente necessários agora — não há UI que assine replays — mas
  seguimos o molde para consistência e para o "assistir replay" futuro da Fase 6/8.)

### 5. Fiação — `startGame.onGameOver` + `main.tsx`

No `onGameOver`, **após** o leaderboard (que já roda), **só para `mode === 'daily' | 'weekly'`**:

```ts
if (mode === 'daily' || mode === 'weekly') {
  replayService.record({
    mode,
    seed: match.seedLabel,
    timeline: match.recordedTimeline().map(f => f.flap),
    score: w.score,
    distance: w.distance,
    food: w.food,
    nearMisses: w.nearMisses,
    finalHash: hashState(w),   // w é o WorldState final
    achievedAt: Date.now(),
  });
}
```

`main.tsx`: `replayService.init()` no bootstrap (junto de `leaderboardService.init()`).

## Fluxo de dados

```
partida (daily/weekly)
  createWorld({seed, trait:'none'})  ─┐
  FixedStepLoop.advance ── grava cada frame.flap ──► recorded: boolean[]
                                       │
  morte ► onGameOver:                  │
     recordedTimeline() ◄──────────────┘
     hashState(finalWorld) = finalHash
     replayService.record({seed, timeline, finalHash, score, ...})
        └─ store: max score por seed, top-10 por modo ─► localStorage

verificação (agora local; Fase 6 no servidor)
     verifyReplay(replay):
       simulate({seed, trait:'none'}, timeline) ─► world'
       hashState(world') === replay.finalHash ?
```

## O que NÃO está no escopo (adiado)

- **Replays de Endless.** Trait aleatório ⇒ config não é reconstrutível só da seed; sem
  "período". Se necessário na Fase 6, gravar o trait junto. Adiado.
- **UI de "assistir replay".** Nenhuma tela nova neste item; o serviço só grava/verifica.
  A reprodução visual é Fase 6/8.
- **Empacotamento compacto da timeline** (bitset/base64/RLE). `boolean[]` em JSON (~1 valor por
  step; ~3600 numa corrida de 60s) é aceitável para localStorage agora. Otimizar se/quando a
  Fase 6 exigir payloads menores.
- **Envio/verificação server-side real** (Supabase) é Fase 6; aqui só o seam puro `verifyReplay`
  e o dado gravado.
- **Sinais reativos consumidos por UI** — o serviço expõe estado, mas nenhuma tela assina ainda.

## Plano de testes (TDD)

1. **`FixedStepLoop`**: loop fresco ⇒ `recordedTimeline()` vazio; grava 1 booleano por step
   igual ao frame consumido (fonte de input scriptada); `recordedTimeline()` devolve
   `InputFrame[]` correspondente.
2. **`MatchController.recordedTimeline()`**: delega ao loop; restart (nova partida) zera a
   timeline (loop fresco).
3. **`recordReplay` (store)**: insere; dedup por seed mantendo max score; no-op (mesma ref)
   quando não supera; trunca a `MAX_REPLAYS`; imutável.
4. **`storage`**: `parseState` robusto (JSON inválido, timeline não-boolean, campos faltando ⇒
   filtrado/inicial); round-trip save/load.
5. **`verifyReplay` (integridade determinística)**: dado `{seed, trait:'none'}` + uma timeline,
   `simulate`→`hashState` produz a âncora; `verifyReplay` de um replay honesto ⇒ `valid=true`;
   virar um flap da timeline **ou** trocar a seed ⇒ `valid=false`. (É uma prova de determinismo
   viva.)
6. **Fiação** (casca fina): cobertura via verificação end-to-end (Playwright) de que uma
   partida de desafio grava um replay verificável no `localStorage`; unit test do caminho
   `onGameOver→record` se viável sem Phaser.

## Definição de pronto

- `npm run check` limpo, `npm test` verde, bateria de determinismo **67 inalterada**.
- Jogar um desafio (Diário/Semanal) grava um `StoredReplay` cujo `verifyReplay` retorna
  `valid=true`; adulterar a timeline invalida.
- `src/core/` intocado.
