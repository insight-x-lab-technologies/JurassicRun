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

### 10.6 Avatares de perfil (#3)
- [ ] Hoje o avatar é `avatarFor(profile)` = inicial + `hsl(hue)` — a "bola vermelha" do relato
      (`src/app/screens/ProfileScreen.tsx:9`).
- [ ] Entregar uma **grade de ~12 avatares pré-criados** (pterodáctilos/ícones do tema), com
      **asset-spec** (`docs/assets/specs/ui.avatars.md`) e entrada no pipeline `gen-ui.mjs`/atlas de
      UI. Vale o **padrão contra placeholder**: seletor e persistência entram já; a arte AAA dropa
      depois trocando os PNG-fonte (REGRA 2).
- [ ] Campo novo `Profile.avatarId` com **migração**: perfil sem o campo deriva um índice
      determinístico do id/nome (`avatarFor` vira fallback, nada quebra).
- [ ] Seletor na tela de Perfil + reflexo no topo da Home e na lista de jogadores.
- [ ] **Sub-item opcional 10.6b — upload de foto local:** `<input type="file">` → canvas 128×128 →
      dataURL guardada no perfil, com teto de bytes e tratamento de quota cheia. **Recomendação:
      não fazer agora** (quota do localStorage é ~5 MB para tudo, e a grade já resolve o pedido).

**Toca:** `src/services/profile/`, `ProfileScreen.tsx`, `HomeScreen.tsx`, pipeline de assets de UI,
i18n. **Aceite:** trocar de avatar persiste entre reloads e entre trocas de perfil; perfis criados
antes da mudança continuam com avatar válido; nenhuma string hardcoded.

---

## Frente C — Conteúdo e meta

### 10.7 Mais 15 troféus (#6)
- [ ] Catálogo atual: **8 troféus** (`src/services/trophy/catalog.ts`) sobre 6 campos de
      `TrophyStats` + `dailyRank`. Meta: **+15 ⇒ ≥ 23**.
- [ ] Ampliar o agregado vitalício com os fatos que faltam (cada campo novo = um `foldMatch`
      testado): `bestLevel`, `totalNearMisses`, `totalPowerups`, `totalCoinsEarned`,
      `challengesPlayed`, `dailyPodiums`, `weeklyPodiums`, `bestChallengeScore`, `daysPlayed`.
      Fatos de outros serviços (expansões possuídas, traços do Ninho) entram no
      `TrophyEvalContext`, não no agregado.
- [ ] **Migração do storage de troféus**: versão + backfill `0` nos campos novos, sem perder
      desbloqueios já conquistados.
- [ ] **Verificar o lado central (Fase 6)** antes de fechar: os ids novos precisam ser aceitos pela
      tabela/`RLS` de troféus sincronizados — se houver constraint de id conhecido, atualizar.
- [ ] i18n: 15 × (nome + descrição) × 10 idiomas = **300 strings** — skill `add-locale`.
- [ ] Tela de Troféus precisa aguentar 23+ cards (grid/scroll) em paisagem baixa e retrato.
- [ ] Limiares calibrados contra os números reais do jogo (não repetir os placeholders "tuning
      Fase 8" do catálogo atual).

**Toca:** `src/services/trophy/{catalog,store,storage,online}.ts`, `TrophiesScreen.tsx`,
`src/locales/*`. **Aceite:** cada troféu com teste de predicado (abaixo/no/acima do limiar); storage
antigo migra preservando desbloqueios; paridade i18n verde; sync central sem rejeição.

### 10.8 Loja com compra real de moedas (#2)
- [ ] **Matar o crédito grátis:** hoje, sem gateway configurado, o botão do pacote chama
      `walletService.earn(pack.coins)` direto (`ShopScreen.tsx:33`) — 1 clique = moedas.
- [ ] Loja nova, sempre com as 3 seções visíveis: (a) **saldo**; (b) **pacotes** (`COIN_SKU_AMOUNTS`
      small/medium/large) com **preço em dinheiro real** e CTA que abre o **Ko-Fi** (link externo,
      SKU na mensagem); (c) **resgate de código** — o fluxo 8.4 já existente (Edge Function, claim
      atômico single-use). Sem gateway configurado, (c) aparece desabilitado com aviso em vez de
      esconder a loja inteira.
- [ ] Explicitar as **fontes gratuitas** de moeda (jogar, desafios, troféus) para a loja não parecer
      um paywall.
- [ ] Preços/URLs por SKU vêm de configuração (env/JSON), não hardcoded.
- [ ] **Rejeitado:** checkout próprio (Stripe & cia) — custo, KYC e fora do escopo hobby.

**Toca:** `src/app/screens/ShopScreen.tsx`, `src/app/shop/packs.ts`, `src/services/purchase/`,
config de gateway, i18n. **Aceite:** **nenhum** caminho da UI credita moedas sem código válido
(teste que prova que clique em pacote não chama `earn`); resgate válido continua creditando;
offline/sem gateway não quebra a tela.

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
