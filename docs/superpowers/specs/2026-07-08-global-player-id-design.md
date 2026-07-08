# 6.2 — ID global de jogador (design)

> Fase 6 (Online — Supabase), item 6.2. Registrar o jogador no servidor e obter um ID
> único mundial; vincular ao perfil local. Degradação graciosa offline.

## Objetivo

Estabelecer uma **identidade global** para o dispositivo via Supabase Auth **anônimo**
(`players.id = auth.uid()`, como o schema 6.1 já prevê) e vinculá-la ao **perfil local
ativo** (nome/avatar), preparando a submissão/leitura de rankings centrais (6.3). Tudo
**offline-first**: sem configuração de Supabase ou sem rede, o jogo continua 100% local.

Não toca `src/core/` ⇒ determinismo **67 inalterado** (sem re-pin de goldens).

## Decisões de produto (firmadas)

1. **1 ID global por dispositivo.** Auth anônimo dá **um** usuário por navegador/dispositivo
   (uma sessão, persistida pelo próprio `supabase-js` no localStorage). Isso cria **um** row
   em `players`, casando exatamente com o schema commitado (`players.id = auth.uid()`). O
   jogo tem múltiplos perfis locais (4.2), mas eles **compartilham** essa identidade online:
   o perfil **ativo** empresta nome/avatar ao row `players` (re-sincroniza ao trocar/renomear
   perfil). Multi-perfil-online (uma identidade global por perfil) fica **adiado** — exigiria
   várias sessões auth por dispositivo ou repensar o schema.

2. **O "vínculo" é o sync de nome/avatar.** Não persistimos um mapeamento próprio
   perfil↔uid: o `uid` é recuperável a cada reload pela sessão que o `supabase-js` mantém.
   Vincular = fazer **upsert** do `players` row com o nome/avatar do perfil ativo, para que
   o leaderboard central (6.3) mostre o nome certo.

3. **Offline-first, não-bloqueante.** `init()` dispara o sign-in em background; nunca bloqueia
   o boot e nunca lança. Sem `.env` ⇒ status `offline`. Falha de rede/sign-in ⇒ status
   `error`. Nos dois casos o jogo segue local, exatamente como hoje.

## Arquitetura (padrão puro×casca, molde de wallet/trophy/settings)

Novo módulo `src/services/online/` (já contém `schema.ts` de 6.1):

### `config.ts` (puro)
- `OnlineConfig = { url: string; anonKey: string }`.
- `parseOnlineConfig(env): OnlineConfig | null` — puro; recebe um objeto env-like e devolve
  a config quando **ambas** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são strings
  não-vazias; senão `null` (⇒ modo offline). Testável sem `import.meta`.
- `onlineConfig(): OnlineConfig | null` — casca fina: `parseOnlineConfig(import.meta.env)`.

### `client.ts` (casca — seam de IO)
- Interface `OnlineClient` com só o que 6.2 precisa:
  - `signInAnonymously(): Promise<string>` — garante sessão anônima, resolve com o `uid`.
  - `upsertPlayer(player: { id; name; avatar }): Promise<void>` — upsert no `players`.
- `createSupabaseClient(config): OnlineClient` — embrulha `@supabase/supabase-js`
  `createClient(url, anonKey, { db: { schema: SUPABASE_SCHEMA }, auth: { persistSession:
  true } })`. `signInAnonymously` reusa a sessão existente (`getSession`) antes de criar
  uma nova, para não multiplicar usuários anônimos a cada boot.
- `memoryOnlineClient(opts?)` — spy determinístico p/ testes (registra chamadas, `uid`
  fixável, modo de falha injetável). Sem rede.

### `index.ts` (`OnlineService` reativo singleton)
- Sinais: `globalPlayerId: ReadonlySignal<string | null>` e
  `status: ReadonlySignal<OnlineStatus>` (`'offline' | 'connecting' | 'online' | 'error'`).
- `init(deps?)` — injeta `{ client?, config?, profile? }` (defaults reais). Se `config`
  é `null` ⇒ status `offline`, retorna. Senão status `connecting`, chama
  `client.signInAnonymously()`; on success seta `globalPlayerId`, status `online`, e faz o
  primeiro `syncActiveProfile()`; on error status `error` (id fica `null`, engole o erro).
- `syncActiveProfile()` — quando `online`, faz `client.upsertPlayer({ id, name, avatar })`
  a partir do perfil ativo (`avatarFor`). No-op se offline/sem perfil. Best-effort (engole
  erro de rede sem derrubar o status).
- Um `effect` (montado no init bem-sucedido) assina `profileService.activeProfile` e
  re-chama `syncActiveProfile()` em troca/rename. Guarda contra upsert redundante quando
  id+name+avatar não mudam.
- `init` é reentrante (descarta o `effect` anterior), no molde do `AudioService`.

### Fiação
- `main.tsx`: `void onlineService.init()` após `profileService.init()` (perfil precisa
  existir para emprestar nome/avatar; init é fire-and-forget).
- `ProfileScreen`: bloco read-only de status online — rótulo de `status` + `globalPlayerId`
  truncado (evidência visível de 6.2). Só leitura; sem ação.

## i18n (REGRA 4)
Chaves novas nos 10 locales: `online.status.{offline,connecting,online,error}`,
`online.globalId` (rótulo). Traduções nativas; paridade + scanner AST de hardcoded verdes.

## Fora de escopo (adiado)
- Submeter/ler scores no servidor — é o **6.3** (leaderboard central).
- Verificação anti-cheat (Edge Function) — **6.4**.
- Troféus centrais — **6.5**.
- Multi-perfil-online (uma identidade global por perfil local).
- Editar o nome do jogador global independentemente do perfil.
- Retry/backoff de reconexão automática (uma tentativa por boot; reload re-tenta).

## Testes
- `config.test.ts` (puro): ambas presentes ⇒ config; faltando/ vazia ⇒ `null`.
- `online.service.test.ts` (com `memoryOnlineClient` + perfil de memória):
  - sem config ⇒ status `offline`, id `null`, nenhum sign-in.
  - com config ⇒ `connecting` então `online`, `globalPlayerId` = uid, **1 upsert** no
    connect com nome/avatar do perfil ativo.
  - troca/rename de perfil ⇒ re-upsert; sem mudança ⇒ sem upsert redundante.
  - sign-in falha ⇒ status `error`, id `null`, **não lança**, jogo segue.
- Cliente Supabase real (`createSupabaseClient`) é **casca não-testada** por unidade
  (molde `WebAudioEngine`/`localStorage*`); verificação real depende do banco do usuário.

## Verificação (evidência antes de "pronto")
- `npm run check` limpo; `npm test` verde (novos testes inclusos); `npm run test:determinism`
  **67 inalterado**.
- Smoke no browser (Playwright) se o `.env` estiver configurado: status vira `online`, id
  aparece na `ProfileScreen`; sem `.env`, status `offline` e o jogo funciona igual.

## Pré-requisito do usuário (herdado de 6.1)
Migração aplicada + `jurassicrun` em _Exposed schemas_ + _Anonymous sign-ins_ habilitado no
dashboard Supabase, e `.env` preenchido a partir de `.env.example`. Sem isso, 6.2 roda em
modo `offline` (comportamento correto e testado).
