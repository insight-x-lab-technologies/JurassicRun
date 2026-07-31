# Fase 10 — Polimento, meta e retrato

**Objetivo:** fechar 9 lacunas reportadas pelo usuário depois da Fase 9 — higiene de repositório,
consistência de UI (moedas, briefing, versão), identidade de perfil (avatares), economia honesta na
Loja, mais troféus, purga de dados legados e — o item grande — **jogar em retrato**, com adaptação
ao girar o aparelho.

> Cada item vira uma **spec própria** (`docs/superpowers/specs/`) na hora de implementar. Este
> arquivo é o guarda-chuva da fase: escopo, decisões travadas, causa-raiz já investigada e aceite.

## Premissas mantidas (NÃO violar)

- **Determinismo** (REGRA 1): `src/core/` fica **intocado nesta fase inteira** (nenhum item exige).
  Se algum item derivar para o core, re-pina goldens + `verify-determinism` + `npm run build:edge`.
- **Campo lógico 320×180 é imutável.** Retrato (10.9) **não** muda o mundo — muda só a
  apresentação. Justiça de leaderboard: todos jogam exatamente o mesmo campo.
- **Arte desacoplada** (REGRA 2) e **asset-spec obrigatório** (REGRA 5): a grade de avatares (10.6)
  e qualquer arte nova entram com spec em `docs/assets/specs/`.
- **i18n** (REGRA 4): nenhuma string nova hardcoded; 10 idiomas, guarda de paridade verde.
- **Hobby sem custo:** nenhum processador de pagamento próprio (10.8 usa o gateway Ko-Fi + código
  single-use que a 8.4 já entregou).
- **Performance 60fps**, sem alocação por frame no hot path (vale para o retrato).

## Decisões de produto travadas

| # | Pedido | Decisão |
|---|--------|---------|
| 2 | Loja dá moeda de graça | **Remover o crédito por clique.** Pacotes viram CTA externo Ko-Fi + resgate de código (fluxo 8.4). Sem checkout próprio. |
| 3 | Foto no perfil | **Grade de avatares pré-criados** (não upload). Motivo: quota do localStorage, privacidade/moderação e coerência de arte. Upload fica como sub-item opcional. |
| 4 | Game Over mostra comida | **A UI inteira passa a dizer "moedas"**; o campo `food` do core NÃO é renomeado (renome no core = re-pin de hash/goldens sem ganho). |
| 5 | Retrato | **Letterbox do campo inteiro** (escala pela largura), com o espaço livre preenchido por fundo/HUD/área de toque. **Não** recortar a largura do campo. |
| 6 | Mais troféus | **+15 (total ≥ 23)**, exigindo campos novos no agregado vitalício + migração do storage. |
| 8 | Recordes pré-9.9 | **Descartar**, não migrar. Jogo não lançado ⇒ purga de chaves legadas no boot. |

---

## Frente A — Higiene e release (rápidos, risco baixo)

### 10.1 Limpeza de branches remotos (#1) ✅
- [x] Apagar no GitHub os 2 branches remanescentes: `feat/parallax-alpha-layers` e
      `feat/3.1-powerups-system`.
- [x] `git fetch --prune` local — o repositório local ainda carrega **26 refs remote-tracking
      podres** (branches que o GitHub já apagou no merge; `git branch -r` mente sem o prune).
- [x] Ligar **"Automatically delete head branches"** nas settings do repositório, para o problema
      não voltar.
- [x] **Extra (fora do escopo original):** 3 branches **locais** órfãos, todos `--merged main`
      (`feat/ui-parallax-and-png-compression`, `feat/ui-w5-render-resolution`,
      `feat/ui-w6-typography`) — apagados com `git branch -d`.

> **Executado em 2026-07-30.** `ahead_by: 0` reconfirmado nos dois remotos antes de apagar
> (behind 29 e 402). `delete_branch_on_merge` agora `true` via
> `gh api -X PATCH repos/{owner}/{repo}`. Resultado: `gh api .../branches` e `git branch -a`
> devolvem **só `main`**.

> **Já verificado:** o remoto tem hoje só `main`, `feat/parallax-alpha-layers`,
> `feat/3.1-powerups-system`. Os 27 PRs do repositório estão **todos merged, zero abertos**.
> `compare main...<branch>` devolve **`ahead_by: 0`** para os dois (401 e 28 commits atrás) ⇒ o
> conteúdo está 100% dentro de `main`, deletar não perde nada. `feat/3.1-powerups-system` é
> anterior ao uso de PRs (foi merge local), por isso não aparece na lista de PRs.

**Toca:** nada de código (ação de repositório). **Aceite:** `gh api .../branches` lista só `main`;
`git branch -r` local idem.

### 10.2 Versão do jogo visível na Home (#9) ✅
- [x] Injetar a versão em **build time**: `define: { __APP_VERSION__ }` lendo `package.json`
      (via `src/build/appVersion.ts`, que valida o campo e falha alto se faltar) + declaração de
      tipo em `src/types/globals.d.ts` (primeiro `.d.ts` do projeto).
- [x] Exibir discreto no rodapé da Home (`data-testid="app-version"`), estilo texto muted pequeno,
      fora do fluxo do menu (não pode empurrar o CTA em paisagem baixa — precedente 9.9).
- [x] Formato `v1.0.0` **sem palavra traduzível** ⇒ zero chave i18n nova. (Se algum dia levar
      rótulo, aí sim vira chave.)
- [x] Adotar bump manual de `package.json` ao fechar cada fase (documentar em `WORKFLOW.md`).

**Toca:** `vite.config.ts`, **`vitest.config.ts`**, `src/build/appVersion.ts`,
`src/types/globals.d.ts`, `src/app/screens/HomeScreen.tsx`, `src/app/styles/global.css`,
`.gitignore`. **Aceite:** ✅ Home renderiza a versão do `package.json`; o teste **lê o
`package.json` em runtime** (não hardcoda `'1.0.0'`) ⇒ bump não passa despercebido; `dist` contém o
literal `v1.0.0` e zero `__APP_VERSION__`.

> **3 gotchas descobertos aqui** (spec: `docs/superpowers/specs/2026-07-30-10.2-app-version-on-home.md`):
> 1. **`vitest.config.ts` NÃO estende `vite.config.ts`** — são arquivos independentes. `define` só
>    no Vite ⇒ todo teste que renderiza a Home morre com `ReferenceError: __APP_VERSION__`. O
>    `define` vai nos DOIS, alimentado pelo mesmo helper (não dá para dessincronizar).
> 2. **`happy-dom` polyfilla o `URL` global** ⇒ `new URL(x, import.meta.url)` dentro de
>    `appVersion()` resolve contra `http://localhost:3000/` e `fileURLToPath` rejeita
>    ("URL must be of scheme file"). Em teste com DOM, ler arquivo com `node:path`, não com `URL`.
> 3. **`.gitignore` tinha `build/` sem barra inicial** ⇒ casava `src/build/` em qualquer
>    profundidade e tornava o helper novo invisível ao git. Corrigido para `/build/` (nada no
>    projeto gera `build/` na raiz; a saída é `dist/`).

### 10.3 Purga de dados pré-9.9 (#8) ✅
- [x] `jurassicrun.leaderboard.v1` **→ `.v2`** (chave nova, dados antigos ignorados): mata o débito
      conhecido do 9.9 — recorde da mesma seed obtido sob as regras VELHAS aparecendo como
      `yourBest` no briefing, indistinguível de um obtido sob os modificadores.
- [x] `purgeLegacyKeys()` puro + chamada no boot: remove a lista fixa de chaves órfãs
      (`jurassicrun.replays.v1`, `jurassicrun.replays.v2`, `jurassicrun.leaderboard.v1`) dos
      aparelhos de teste que já têm o app instalado, para não deixar lixo ocupando quota.
- [x] Nada de migração/tradução de dados: descarte puro e simples (decisão do usuário; pré-lançamento).

**Toca:** `src/services/leaderboard/storage.ts`, novo helper de storage legado, `src/app/main.tsx`.
**Aceite:** ✅ `localStorage` pré-populado com as chaves velhas ⇒ boot limpo, sem entrada fantasma no
briefing e sem exceção; teste cobrindo storage indisponível (modo privado) sem quebrar o boot.

> **Executado em 2026-07-30** (spec: `docs/superpowers/specs/2026-07-30-10.3-legacy-data-purge.md`).
> Novo `src/services/storage/legacy.ts` no molde puro×casca: `LEGACY_STORAGE_KEYS` (lista
> **explícita**, nunca heurística de prefixo — o custo de apagar dado vivo é assimétrico),
> `purgeLegacyKeys(store, keys?)` puro sobre a interface mínima `LegacyStore` e a casca
> `purgeLegacyStorage()`, que engole erro do `localStorage` **inclusive no acesso à propriedade
> global** (Safari privado lança ali, não só na chamada). Chamado na 1ª linha de `bootstrap()`,
> antes de `i18n.init()` e de qualquer `*.init()` de serviço.
>
> **Gotcha de ORDEM entre as duas tasks:** o teste de invariante "nenhuma chave legada coincide com
> uma chave viva" (cruza a lista contra os 8 `STORAGE_KEY` dos serviços) impede pôr
> `leaderboard.v1` na lista legada **antes** de bumpar a chave viva para `.v2` — a entrada tem de
> vir junto ou depois do bump. Essa invariante é o que impede um bump futuro de reciclar um nome
> antigo e transformar a purga numa apagadora de dados vivos.

---

## Frente B — Consistência de UI (render/app)

### 10.4 "Moedas" no lugar de "comida" na UI (#4) ✅
- [x] Game Over hoje mostra **duas linhas com o MESMO número**: `🍖 comida` e `🪙 moedas ganhas` —
      `coinsForFood()` é **identidade 1:1** (`src/services/wallet/store.ts:17`). Colapsar em uma
      linha só de moedas.
- [x] HUD: `hud.food` → moedas (o HUD DOM não tem glifo — é texto puro; o `🍖` que existia era só
      o do Game Over, que saiu junto com a linha duplicada).
- [x] Chaves i18n novas (`hud.coins`, `gameover.coins`) nos **10 idiomas** e remoção das antigas
      (`hud.food`, `gameover.food`) — mais `leaderboard.food` → `leaderboard.coins`, que a varredura
      achou.
- [x] Núcleo/serviços mantêm os nomes internos (`WorldState.food`, `TrophyStats.totalFood`,
      `coinsForFood`): são invisíveis ao usuário e renomeá-los mexeria em hash/goldens.
- [x] Varrer o resto da UI atrás de "comida/food" visível (Ninho, troféus, leaderboard, share).

**Toca:** `src/app/game/{GameOverOverlay,Hud}.tsx`, `src/render/GameScene.ts`,
`src/app/screens/LeaderboardScreen.tsx`, `src/i18n/locales/*` (10). **Aceite:** ✅ nenhuma string de
comida visível; guarda de paridade i18n + scanner AST verdes; testes de Game Over/HUD atualizados.

> **Executado em 2026-07-30** (spec: `docs/superpowers/specs/2026-07-30-10.4-coins-not-food-ui.md`).
> A varredura achou **duas naturezas** de string, tratadas em tasks separadas:
> **(A) chaves renomeadas** — `hud.food`, `gameover.food` e `leaderboard.food` viram `*.coins` nos 10
> locales e nos 4 pontos de uso (`Hud.tsx`, `GameScene.ts` HUD **e** Game Over in-canvas,
> `LeaderboardScreen.tsx`);
> **(B) só o texto muda** — `trophy.forager.desc`, `trait.doubleFood`, `trait.tripleFood` e
> `powerup.doubleCoin.name` têm id de **código** (`traitKind` do roster, id de power-up) ⇒ a chave
> fica, o valor passa a falar moeda nos 10 idiomas.
>
> O Game Over DOM passou a exibir **só** `gameover.coinsEarned` (`🪙 +N moedas`), lendo `stats.coins`
> — o valor de fato creditado — e não `stats.food`: se `coinsForFood` deixar de ser identidade 1:1, a
> tela continua verdadeira. Não foi preciso criar chave `gameover.coins` para o DOM; a `gameover.coins`
> criada serve o Game Over **in-canvas** (`domOverlays = true` hoje o mantém invisível, mas o caminho
> existe e não pode citar comida).
>
> **Guarda nova** `tests/i18n/no-food-keys.test.ts`: nenhum locale pode ter um segmento de chave
> igual a `food`. A guarda é sobre **chaves**, não sobre textos traduzidos — caçar a palavra "comida"
> em 10 idiomas exigiria um dicionário que o projeto não mantém, e é na chave que a regressão aparece.
> Ids como `trait.doubleFood` seguem válidos (segmento ≠ `food`).

### 10.5 Briefing de desafio ocupando a tela (#7) ✅
- [x] **Causa-raiz já isolada:** `ChallengeBrief` põe `class="screen challenge-brief"` na **raiz**
      (`src/app/screens/ChallengeBrief.tsx:30`) e `.challenge-brief` tem `max-width: 32rem`
      (`global.css:914`). A raiz é filha direta de `#app` (flex column, `align-items` default =
      `stretch`); com `max-width` a caixa deixa de esticar e **encosta à esquerda** — as outras
      telas não limitam a largura da raiz, por isso só esta destoa.
- [x] Correção aplicada: **raiz full-bleed + teto nos blocos de conteúdo**. Em vez do wrapper novo,
      o `max-width: 44rem` + `margin-inline: auto` foi para `.challenge-brief__{stats,rules,actions}`
      — que é literalmente o padrão das outras telas (`.leaderboard__list` 44rem, `.nest__grid` e
      `.expansions__grid` 58rem, `.trophies__grid` 40rem): o teto vive no filho, e é
      `.screen { align-items: center }` que o centraliza. Wrapper novo no JSX seria um nó a mais
      para reproduzir o mesmo efeito. **`ChallengeBrief.tsx` não foi tocado — o fix é 100% CSS.**
- [x] **Verificado por NÚMERO** (`getBoundingClientRect`/`getComputedStyle` no `dist` servido, SW
      desregistrado + caches limpos + `?nocache`).
- [x] Fix de paisagem baixa do 9.9 preservado (CTA "Jogar" acima da dobra em 740×360).

**Toca:** `src/app/styles/global.css`, `tests/app/screen-root-width.test.ts` (novo).
**Aceite:** ✅ medições no `dist` — **740×360**: útil 708px, blocos 704px (**99,4%**), folgas 2px/2px
simétricas, CTA `bottom` 298px < 360 e tela sem rolagem · **640×360**: útil 608px, blocos 608px
(**100%**), folgas 0/0, CTA 301px · **390×844 (retrato)**: útil 342px, blocos 342px (**100%**) ·
**1440×900**: blocos 704px centrados (folgas 344/344 — o teto de 44rem preserva a legibilidade em
desktop) · **Semanal idêntico ao Diário** (seed `2026-W31`, mesmos números).

> **Executado em 2026-07-30** (spec: `docs/superpowers/specs/2026-07-30-10.5-challenge-brief-full-width.md`).
> **Guarda nova `tests/app/screen-root-width.test.ts`** — a lição generalizada, não uma asserção
> sobre esta tela: *toda classe usada como raiz de tela (`class="screen <x>"` varrido dos
> `src/app/screens/*.tsx`) que declare `max-width` no `global.css` precisa declarar
> `margin-inline: auto` ou `align-self: center` no MESMO bloco*. O teto não é o defeito; teto **sem
> centralização** é — dentro de um pai `stretch`, um item de largura resolvida assenta à esquerda.
> O teste roda em ambiente **node** (só lê arquivos com `node:fs`) porque `happy-dom` não faz
> layout: `getBoundingClientRect()` devolve zeros e um teste de renderização não pegaria o bug.
> Vale para qualquer tela futura, inclusive as do 10.6/10.9.

### 10.6 Avatares de perfil (#3) ✅
- [x] Hoje o avatar é `avatarFor(profile)` = inicial + `hsl(hue)` — a "bola vermelha" do relato
      (`src/app/screens/ProfileScreen.tsx:9`).
- [x] Entregar uma **grade de ~12 avatares pré-criados** (pterodáctilos/ícones do tema), com
      **asset-spec** (`docs/assets/specs/ui.avatars.md`) e entrada no pipeline `gen-ui.mjs`/atlas de
      UI. Vale o **padrão contra placeholder**: seletor e persistência entram já; a arte AAA dropa
      depois trocando os PNG-fonte (REGRA 2).
- [x] Campo novo `Profile.avatarId` com **migração**: perfil sem o campo deriva um índice
      determinístico do id/nome (`avatarFor` vira fallback, nada quebra).
- [x] Seletor na tela de Perfil + reflexo no topo da Home e na lista de jogadores.
- [ ] **Sub-item opcional 10.6b — upload de foto local:** `<input type="file">` → canvas 128×128 →
      dataURL guardada no perfil, com teto de bytes e tratamento de quota cheia. **Recomendação:
      não fazer agora** (quota do localStorage é ~5 MB para tudo, e a grade já resolve o pedido).
      **Não feito, por decisão** (fora do escopo desta fase).

**Toca:** `src/services/profile/`, `ProfileScreen.tsx`, `HomeScreen.tsx`, pipeline de assets de UI,
i18n. **Aceite:** ✅ trocar de avatar persiste entre reloads e entre trocas de perfil; perfis criados
antes da mudança continuam com avatar válido; nenhuma string hardcoded.

> **Executado em 2026-07-31** (spec: `.superpowers/sdd/2026-07-31-10.6-profile-avatars/`).
> Catálogo puro `src/services/profile/avatars.ts`: 12 ids `a01`…`a12`, `hue = i*30`, com
> `hashId`/`defaultAvatarId`/`resolveAvatarId` — id desconhecido (ou perfil pré-10.6, sem o campo)
> cai num avatar determinístico derivado do próprio id do perfil, nunca aleatório. `Profile.avatarId`
> passou a ser **obrigatório** no tipo (`createProfile` deriva do id; redutor puro `setAvatar`).
> Storage: `STORAGE_KEY` de perfis **não foi bumpada** (`jurassicrun.profiles.v1` continua a mesma —
> bumpar apagaria perfis existentes, o oposto do que a 10.3 fez de propósito com o leaderboard);
> o payload sobe para `version: 2` e `parseState` normaliza via `resolveAvatarId`, então um perfil
> salvo antes da mudança carrega com avatar válido sem migração destrutiva.
> Arte **placeholder** (não a arte AAA final): `scripts/gen-avatar-placeholder.mjs`
> (`npm run gen:avatars`) compõe 12 medalhões 128×128 — disco radial por matiz + aro dourado + o
> pterodáctilo real de `public/ui/dino.starter.png` tingido — com a mesma guarda anti-sobrescrita da
> Fase 9 (não regrava PNG existente sem `--force`). `tests/assets/avatars.test.ts` cruza o catálogo
> TS × arquivos e prova que o gerador nunca diverge em ids/ordem/matiz do catálogo real.
> Render: `src/app/components/Avatar.tsx` compartilhado por Home e Perfil (`<img>` com fallback de
> `onError` para a inicial do nome) + seletor `role="radiogroup"` de 12 tiles na tela de Perfil.
> i18n: `profile.avatar`/`profile.avatarOption` ("Avatar {{n}}") nos 10 idiomas — as 5 línguas
> latinas foram para a `IDENTICAL_TO_EN_ALLOWLIST` de `tests/i18n/locales.test.ts` porque "Avatar" se
> escreve igual em inglês. Online: `players.avatar` agora carrega o `avatarId` (coluna `text` sem
> `check` ⇒ zero migração de schema). **10.6b (upload de foto) não foi feito**, por decisão
> registrada na spec — a grade de 12 já resolve o pedido original sem o custo de quota/moderação.
> **`src/core/` intocado** ⇒ determinismo segue **73**. Asset-spec: `docs/assets/specs/ui.avatars.md`
> (com bloco de prompt para geração por IA e a entrada de pipeline `UI_SOURCES` a acrescentar quando
> a arte real chegar — nessa hora, apagar `scripts/gen-avatar-placeholder.mjs`, precedente dos
> geradores de placeholder da Fase 9).

---

## Frente C — Conteúdo e meta

### 10.7 Mais 15 troféus (#6) ✅
- [x] Catálogo atual: **8 troféus** (`src/services/trophy/catalog.ts`) sobre 6 campos de
      `TrophyStats` + `dailyRank`. Meta: **+15 ⇒ ≥ 23**. **Entregue: 23.**
- [x] Ampliar o agregado vitalício com os fatos que faltam (cada campo novo = um `foldMatch`
      testado): **10 campos** — `bestLevel`, `totalNearMisses`, `totalPowerups`, `totalCoins`,
      `challengesPlayed`, `dailyPodiums`, `weeklyPodiums`, `bestChallengeScore`, `daysPlayed` e
      `lastPlayDay` (estado de suporte do `daysPlayed`). `TrophyStats` vai de 6 → **16 campos**.
- [x] **Migração do storage de troféus**: `version` do payload `1 → 2` com backfill `0`, **sem
      bumpar a `STORAGE_KEY`** — ela continua `jurassicrun.trophies.v1` (bumpar apagaria os
      desbloqueios; é o oposto do requisito, e o contrário da 10.3, onde descartar era o objetivo).
- [x] **Verificar o lado central (Fase 6):** `supabase/migrations/…_jr_schema.sql:50-55` tem
      `trophy_id text not null` **sem `check`/enum/FK** ⇒ ids novos aceitos, zero migração. O único
      filtro é o do cliente (`isKnownTrophyId`), derivado do próprio catálogo.
- [x] i18n: 15 × (nome + descrição) × 10 idiomas = **300 strings** + `trophies.progress` — skill
      `add-locale`.
- [x] Tela de Troféus aguenta 23+ cards, com linha de progresso `n/23`.
- [x] Limiares calibrados contra os números reais do jogo (nível = `1 + floor(dist/500)`, score =
      `dist + 10·comida + 5·near-miss`), com os 8 troféus originais como degrau de baixo da escada.

**Toca:** `src/services/trophy/{catalog,store,storage,index}.ts`, `src/render/{pickups,audioEvents,
match}.ts`, `src/services/leaderboard/index.ts`, `src/app/game/startGame.ts`, `TrophiesScreen.tsx`,
`src/app/styles/global.css`, `src/i18n/locales/*` (10). **`src/core/` intocado.**
**Aceite:** ✅ cada um dos 15 novos com teste abaixo/no/acima do limiar; payload v1 migra
preservando `unlocked`; paridade i18n verde; sync central sem rejeição; `npm test` **1030** verdes,
`check` limpo, determinismo **73** inalterado.

> **Executado em 2026-07-30/31** (spec: `docs/superpowers/specs/2026-07-30-10.7-more-trophies-design.md`;
> plano: `docs/superpowers/plans/2026-07-30-10.7-more-trophies.md`). 7 tasks, 11 commits.
>
> **Os 15 troféus** (id → condição): `explorer` bestLevel≥5 · `skyLord` bestLevel≥10 ·
> `globetrotter` totalDistance≥50 000 · `legend` bestScore≥20 000 · `veteran` gamesPlayed≥100 ·
> `stuntPilot` bestNearMisses≥25 · `closeShave` totalNearMisses≥250 · `treasurer` totalCoins≥500 ·
> `tycoon` totalCoins≥5000 · `empowered` totalPowerups≥25 · `powerHungry` totalPowerups≥200 ·
> `challenger` challengesPlayed≥10 · `challengeAce` bestChallengeScore≥5000 · `weeklyPodium`
> weeklyPodiums≥1 · `dedicated` daysPlayed≥7.
>
> **Decisões e gotchas:**
> 1. **Power-ups contados FORA do core.** `WorldState` não tem contador de pickups e criá-lo tocaria
>    `src/core/` (proibido nesta fase). `src/render/pickups.ts` deriva o fato por diff de bitmask —
>    o `effectMask` saiu de `audioEvents.ts` (9.6) e passou a morar aqui, com dois consumidores.
>    Dono: `MatchController` (`observe` **depois** do `_loop.advance` e **antes** do teste de
>    `alive`, senão o pickup do frame da morte se perde; `reset` no `startMatch`).
>    **Gotcha caro:** `killOrRevive` (`core/powerup/apply.ts`) consome uma vida **e acende um
>    `shield` de graça** no mesmo step ⇒ a 1ª versão contava bloquear um hit como pickup. Guarda:
>    quando `extraLives` cai na mesma observação, o bit de `shield` recém-aceso é descartado.
> 2. **`daysPlayed` é marca d'água, não conjunto.** `epochDay(playedAt)` só avança `lastPlayDay`
>    para frente ⇒ relógio para trás não decrementa nem duplica (custo: um dia perdido; preferível a
>    troféu farmável mudando a data do aparelho). `gamesPlayed === 0` é o caso "nunca jogou", em que
>    qualquer dia — inclusive o 0 — é novo.
> 3. **Pódio conta uma vez só.** Rank local e rank central alimentam o MESMO contador. `startGame`
>    lê `centralAvailable` **uma vez** e usa local ⊻ central. O **semanal não tem contraparte
>    central** (a Fase 6 só fez rank diário) ⇒ usa sempre o local; se um `centralWeeklyRank` nascer,
>    precisa da mesma guarda.
> 4. **`MatchSummary` com campos obrigatórios de propósito:** um call site que esqueça `mode`
>    quebra a compilação em vez de silenciar o troféu. O fallout de tipos foi planejado e fechado
>    numa task só.
> 5. **`sanitizeStats` varre `Object.keys(emptyStats())`** em vez de listar campos à mão ⇒ campo
>    novo esquecido é impossível; `emptyStats()` é tipado como `TrophyStats`, então o TS quebra lá.
> 6. **Fora do escopo por decisão:** troféus de coleção (expansões possuídas, traços do Ninho)
>    acoplariam o serviço a `nest`/`wallet`/`entitlements` para premiar gastar moeda, não jogar.
>    `TrophyEvalContext` continua sendo o lugar certo se isso mudar.
>
> **Validação de layout POR NÚMERO** no `dist` (SW desregistrado + caches limpos + `?nocache`):
> o documento **não rola por design** (shell de viewport fixo) — quem rola é `.screen`
> (`overflow-y:auto`). **740×360:** 23 cards, nenhum com altura 0, `overflowX` 0, `scrollHeight`
> 1803 > `clientHeight` 270, último card e "Voltar" alcançáveis. **390×844 (retrato):** 23 cards,
> grid 342 px em 390 px, `maxScroll` 1998, progresso visível no topo, último card e "Voltar"
> alcançáveis. *(Medir `document.documentElement` aqui dá falso negativo — é `.screen` que rola.)*

### 10.8 Loja com compra real de moedas (#2) ✅
- [x] **Matar o crédito grátis:** hoje, sem gateway configurado, o botão do pacote chama
      `walletService.earn(pack.coins)` direto (`ShopScreen.tsx:33`) — 1 clique = moedas.
- [x] Loja nova, sempre com as 3 seções visíveis: (a) **saldo**; (b) **pacotes** (`COIN_SKU_AMOUNTS`
      small/medium/large) com **preço em dinheiro real** e CTA que abre o **Ko-Fi** (link externo,
      SKU na mensagem); (c) **resgate de código** — o fluxo 8.4 já existente (Edge Function, claim
      atômico single-use). Sem gateway configurado, (c) aparece desabilitado com aviso em vez de
      esconder a loja inteira.
- [x] Explicitar as **fontes gratuitas** de moeda para a loja não parecer um paywall — **duas**,
      não três: ver o desvio consciente abaixo.
- [x] Preços/URLs por SKU vêm de configuração (env), não hardcoded.
- [x] **Rejeitado:** checkout próprio (Stripe & cia) — custo, KYC e fora do escopo hobby.

**Toca:** `src/app/screens/ShopScreen.tsx`, `src/app/shop/packs.ts`, `src/services/purchase/`,
`src/app/openUrl.ts`, `src/app/purchase/RedeemCodeForm.tsx`, `src/app/styles/global.css`,
`.env.example`, `src/i18n/locales/*` (10). **`src/core/` intocado.**
**Aceite:** ✅ **nenhum** caminho da UI credita moedas sem código válido (guarda de fonte +
teste que clica em TODOS os pacotes e prova saldo inalterado); resgate válido continua creditando
(testes 8.4 preservados); offline/sem gateway não quebra a tela; `npm test` **1081** verdes,
`check` limpo, determinismo **73** inalterado.

> **Executado em 2026-07-31** (spec: `docs/superpowers/specs/2026-07-31-10.8-real-coin-purchase-design.md`;
> plano: `docs/superpowers/plans/2026-07-31-10.8-real-coin-purchase.md`). 7 tasks, 10 commits.
>
> **Vitrine é config, não literal:** `src/services/purchase/storefront.ts` puro, no molde de
> `services/online/config.ts` — `parseStorefront(env)` valida **campo a campo** e o que vier
> inválido cai no default (US$ 1,99/4,99/9,99 na página Ko-fi do estúdio), então a Loja funciona
> **sem `.env`** e um env quebrado nunca derruba a tela. Preço em **unidades menores** (inteiro,
> `amountMinor: 199`) e exibido por `Intl.NumberFormat` na língua ativa ⇒ **zero chave i18n para o
> valor monetário**. Chaves documentadas em `.env.example` (`VITE_SHOP_KOFI_URL`,
> `VITE_SHOP_CURRENCY`, `VITE_SHOP_PRICE_SMALL|MEDIUM|LARGE`).
>
> **A guarda é de FONTE, não de clique:** `tests/app/shop/no-free-coins.test.ts` varre
> `ShopScreen.tsx` + `src/app/shop/**` + `src/app/purchase/**` (recursivo) e falha se aparecer
> qualquer `.earn(`. Um teste de clique só cobre os botões que existem hoje; a guarda cobre os que
> alguém acrescentar amanhã. Tem um teste próprio provando que a lista de arquivos não está vazia
> (guarda que passa em vácuo é pior que guarda nenhuma). **Gotcha:** a regex casa o texto literal
> `.earn(` — inclusive **dentro de comentário**; a redação do comentário na tela teve de mudar para
> "chamada a `earn`". Ler o saldo (`walletService.balance.value`) segue permitido.
>
> **`checkoutUrlFor` usa `URL`, não concatenação:** a 1ª versão fazia `base + (? ou &) + jr_sku` e
> uma base com **fragmento** produzia `…#tip?jr_sku=…`, onde a query vira parte do fragmento e some
> para qualquer parser HTTP — o SKU se perderia em silêncio. Achado no review final. Concatenação
> ficou como fallback para base absurda vinda de env.
>
> **A decisão do "sem gateway" mudou de dono:** era um `if` no `ShopScreen` que escondia a Loja
> inteira e mostrava os pacotes grátis no lugar. Agora vive no `RedeemCodeForm`, que se
> auto-desabilita com aviso — as 3 seções coexistem sempre. Comprar no Ko-fi **não** depende do
> nosso servidor, então o botão do pacote continua ativo mesmo offline.
>
> **Desvio consciente do texto acima:** o roadmap pedia citar "jogar, desafios, **troféus**" como
> fontes grátis. `walletService.earn` só tem dois call sites de gameplay (`startGame.ts:99`
> `coinsForFood`, que roda para `endless`/`daily`/`weekly`, e o `purchase`) — **troféu não credita
> moeda nenhuma**. Listá-lo seria texto falso na UI. Ficaram as duas fontes verdadeiras; fazer
> troféu pagar é mudança de economia, item da Fase 11.
>
> **CSS:** não existia **uma única regra** `.shop*`/`.redeem*` no `global.css` — a tela herdava só o
> genérico de `.screen`. Teto de largura nos filhos (invariante do 10.5).
>
> **Validação por NÚMERO** no `dist` (SW desregistrado + caches limpos + `?nocache`):
> **390×844** útil 342 px, pacotes 342 px (**100%**), cards 140 px, `bodyOverflowX` 0, `.screen`
> rola 507 px · **740×360** útil 692 px, pacotes 692 px (**100%**), folgas 0/0, cards 103 px,
> "Voltar" alcançável · **1440×900** blocos 704 px centrados (folgas 344/344) · preços reais
> renderizados (`$1.99`/`$4.99`/`$9.99`) e resgate desabilitado com aviso (caminho sem gateway).

---

## Frente D — Gameplay em retrato (#5)

### 10.9 Jogar em retrato, adaptando ao girar o aparelho
- [ ] Hoje retrato + ponteiro grosso ⇒ **tela de "gire o aparelho"** (`shouldSuggestRotate`,
      `PlayScreen.tsx:114`): não existe jogo em retrato.
- [ ] **Decisão travada — letterbox do campo inteiro, não recorte:** o campo lógico 320×180
      continua idêntico; em retrato a escala é ditada pela **largura** e o jogo vira uma **faixa**.
      O espaço livre acima/abaixo **não** é barra preta: recebe (i) fundo/parallax sangrado na
      vertical (cosmético, fora do campo — mesmo truque da sangria do 9.4), (ii) HUD reposicionado
      acima da faixa, (iii) área de toque generosa abaixo (tap = flap).
- [ ] **Por que não recortar a largura** (a hipótese do pedido): em 9:16, mostrar 180 de altura faria
      a janela visível cair para ~100 unidades de mundo (de 320) ⇒ ~⅓ do tempo de reação. Isso muda
      a dificuldade real e torna incomparáveis os scores entre orientações — o leaderboard é global
      e o campo é travado justamente por isso. Letterbox mantém a partida **idêntica** em qualquer
      aparelho, ao custo de a faixa jogável ser menor na tela.
- [ ] **Girar no meio da partida** deve adaptar o layout **sem reiniciar**: nada de perder estado,
      nada de alterar o passo fixo, nada de recriar a cena do Phaser se der para só re-escalar.
- [ ] Rotate-hint sai do caminho (removido ou vira opção em Configurações).
- [ ] HUD, pause, Game Over e o indicador de power-up (9.5) precisam de layout em retrato.
- [ ] Safe-area (notch/barra de gestos) em retrato.
- [ ] Validar em 390×844 e 360×740, **medindo por número**; 60fps mantido; SW pode servir `dist`
      velho na validação ⇒ unregister + clear caches + `?nocache`.

**Toca:** `src/render/{resolution,constants,game,GameScene}.ts`, parallax, `src/app/screens/
PlayScreen.tsx`, `src/app/hooks/useRotateHint.ts`, `src/app/game/*`, CSS. **`src/core/` intocado.**
**Aceite:** dá para jogar uma partida completa em retrato; girar o aparelho durante a partida
mantém a partida e reflui o layout; o campo visível é o **mesmo** 320×180 nas duas orientações;
nenhuma barra preta pura; 60fps.

---

## Ordem de execução

**A → B → C → D.** Higiene e correções curtas primeiro (destravam validação em aparelho), conteúdo
no meio, retrato por último (maior superfície de render e o único que mexe em escala/câmera).
Execução SDD por subagentes, **um item por PR**, review por task + review final.

## Definição de pronto (fase)

- `npm run check` limpo e `npm test` verde **rodando a suíte inteira** (não só os arquivos-alvo —
  precedente 9.8).
- `src/core/` intocado ⇒ determinismo em **73** testes, sem re-pin de golden. Se algum item derivar
  para o core, `verify-determinism` + `npm run build:edge` viram obrigatórios.
- Remoto só com `main`; versão visível na Home; UI falando "moedas"; briefing full-width; avatares
  selecionáveis; ≥23 troféus; Loja sem moeda grátis; retrato jogável com rotação ao vivo.

---

## Débitos herdados (fora do escopo desta fase, salvo decisão do usuário)

- **Lote G — arte real dos obstáculos do 9.8** (12 imagens): `spire`, `gate` e `rock_arch` ainda
  renderizam **placeholder primitivo** (`manifest.ts:42-45`). Prompts prontos em
  `docs/assets/PHASE-09-ART-BRIEF.md` §12; depende de o usuário gerar as imagens.
- **7.5 — wrappers de loja** (Google/Samsung/Huawei/Microsoft): adiado desde a Fase 7.
