# Spec — 4.2 Perfis de jogador (local)

> Fase 4 (Meta offline), item 4.2. Data: 2026-07-04.
> Objetivo: identidade local do jogador. Primeiro acesso pede nome; criar/trocar jogador
> ativo; tela de Perfil. ID global e stats agregados ficam para fases posteriores.

## Escopo

**Dentro** (o que 4.2 entrega):
- Primeiro acesso: se não há nenhum perfil, o app pede um nome antes de mostrar a Home.
- Criar novo jogador (perfil) e trocar o jogador ativo.
- Renomear o jogador ativo (afordância natural da tela de Perfil).
- Tela de Perfil real (substitui o `PlaceholderScreen` da rota `profile`): mostra o ativo,
  lista os perfis para troca e permite criar/renomear.
- Persistência local (`localStorage`) versionada, com fallback in-memory.
- Cobertura i18n nos 10 locales para todas as strings novas (REGRA 4).

**Fora** (adiado, com razão):
- **Avatar real** (pterodáctilo escolhido) → **4.4 (Ninho)**. Em 4.2 o avatar é um placeholder
  derivado (inicial do nome + cor determinística do id).
- **Stats agregados** (moedas, troféus, nível máx Endless) → seus serviços não existem ainda
  (4.5 economia, 4.7 troféus, progresso Endless). O **topo da Home (4.3)** os montará. O perfil
  em 4.2 é sobre **identidade**, não estatística.
- **Excluir perfil** → adiado (não está na spec do item; baixo custo, entra num polimento futuro).
- **ID global / sincronização** → **Fase 6**. O `id` de 4.2 é puramente local.
- **Entrada pelo avatar no topo da Home** → o wiring visual do avatar-como-botão é **4.3**
  (a barra de topo). Em 4.2 a tela de Perfil já é alcançável pela navegação existente.

## Regras inegociáveis relevantes

- **REGRA 1 (determinismo):** este trabalho **não toca `src/core/`**. `Date.now()` e
  `crypto.randomUUID()`/`crypto.getRandomValues` são permitidos AQUI (camada de serviço/app,
  como já faz `src/render/seedSource.ts`). Determinismo do core permanece intacto (64).
- **REGRA 4 (i18n):** nenhuma string hardcoded; todas as chaves novas nos 10 locales, com o
  teste de paridade (`tests/i18n/locales.test.ts`) verde.

## Arquitetura (puro × casca, seguindo o projeto)

Três módulos em `src/services/profile/`, espelhando o padrão puro×casca do resto do repo
(ex.: `router.ts` sinal + `seedSource.ts` puro×casca):

### 1. `store.ts` — núcleo PURO (sem DOM, sem IO, sem `localStorage`)

Modelo de dados mínimo, focado em identidade:

```ts
interface Profile {
  readonly id: string;        // id local único (crypto.randomUUID na casca); global é Fase 6
  readonly name: string;      // já normalizado (trim + colapso de espaços)
  readonly createdAt: number; // epoch ms (Date.now na casca)
}

interface ProfileState {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
}
```

Funções puras (recebem estado + entradas já geradas na casca ⇒ zero IO/aleatoriedade aqui,
totalmente testáveis e determinísticas):

- `emptyState(): ProfileState` — `{ profiles: [], activeId: null }`.
- `normalizeName(raw: string): string` — trim + colapsa espaços internos.
- `validateName(raw: string): { ok: true; name: string } | { ok: false; error: NameError }`
  onde `NameError = 'empty' | 'tooLong'`. Regras: não-vazio após normalizar; `length ≤ NAME_MAX`
  (20). (Duplicatas são permitidas — o `id` distingue; a UI mostra uma lista tocável.)
- `createProfile(state, id, name, createdAt): { state, profile }` — cria e torna o novo perfil
  o ativo (`activeId = id`). Assume `name` já validado/normalizado.
- `setActive(state, id): ProfileState` — no-op se `id` não existe.
- `renameProfile(state, id, name): ProfileState` — substitui o `name` do perfil `id` (já
  validado/normalizado); no-op se não existe.
- `activeProfile(state): Profile | null` — busca por `activeId`.

Helper visual PURO (reutilizado pelo Perfil agora e pelo topo da Home em 4.3):

- `avatarFor(profile): { initial: string; hue: number }` — `initial` = 1ª letra
  (maiúscula) do nome; `hue` = função determinística do `id` (0–359) para a cor do disco.
  Sem `Math.random`. (O avatar-pterodáctilo real substitui isto em 4.4.)

### 2. `storage.ts` — casca de persistência (IO isolado, injetável)

Interface fina para desacoplar `localStorage` (testabilidade + fallback):

```ts
interface ProfileStorage {
  load(): ProfileState;         // parse robusto; corrupto/ausente ⇒ emptyState()
  save(state: ProfileState): void;
}
```

- `localStorageProfileStorage(): ProfileStorage` — chave `jurassicrun.profiles.v1`,
  serializa `{ version: 1, profiles, activeId }`. `load` valida forma (array de perfis com
  campos do tipo certo; `activeId` string|null coerente) e em qualquer erro/JSON inválido
  devolve `emptyState()`. Se `localStorage` lançar (modo privado/indisponível), degrada para
  um storage **in-memory** (não quebra o app; perfis apenas não persistem entre sessões).
- `memoryProfileStorage(initial?)` — adapter in-memory para testes e para o fallback.

### 3. `index.ts` — `ProfileService` (casca reativa: sinais + wiring)

Serviço singleton (padrão do `i18n`/`router`), com estado reativo via `@preact/signals`:

- Estado interno `ProfileState`; exposto por sinais somente-leitura:
  - `profiles: ReadonlySignal<readonly Profile[]>`
  - `activeProfile: ReadonlySignal<Profile | null>`
- `init(storage?: ProfileStorage): void` — carrega o estado do storage (default:
  `localStorageProfileStorage()`; injeção nos testes). Síncrono (localStorage é síncrono).
- `create(name: string): boolean` — valida; se ok, gera `id`=`crypto.randomUUID()`,
  `createdAt`=`Date.now()`, aplica `createProfile`, persiste, atualiza sinais; retorna sucesso.
- `switchTo(id: string): void` — `setActive`, persiste, atualiza sinais.
- `renameActive(name: string): boolean` — valida; renomeia o `activeId`; persiste; retorna sucesso.
- `validateName(raw): ...` — reexporta a validação pura (a UI a usa para exibir erro sem mutar).

Toda mutação: aplica função pura → persiste (`storage.save`) → seta os sinais. IO e geração
de id/tempo vivem SÓ aqui.

## Fluxo de dados / integração

### Boot (`main.tsx`)
```
i18n.init()  →  profileService.init()  →  render(<App/>)
```
`init()` é síncrono (localStorage). Nenhuma mudança na ordem async do i18n.

### Gate de primeiro acesso (`App.tsx`)
O `App` observa `profileService.activeProfile.value`:
- `null` ⇒ renderiza `<OnboardingScreen/>` (independe da rota; onboarding não entra na pilha
  de histórico e não é navegável-para-trás).
- não-`null` ⇒ `screenFor(route.value)` (comportamento atual).

Como componentes Preact re-renderizam ao ler `.value` de um sinal, criar o 1º perfil no
onboarding troca o gate para a Home automaticamente (a rota inicial já é `home`).

### `OnboardingScreen` (nova)
- Input de nome (controlado via `preact/hooks` `useState`) + botão "Começar".
- Ao submeter: `profileService.create(name)`. Se `create` falhar (validação), exibe a
  mensagem i18n do erro (`onboarding.error.*`) e não avança.
- Sucesso ⇒ perfil criado e ativo ⇒ gate revela a Home.

### `ProfileScreen` (nova, substitui o `PlaceholderScreen` na rota `profile`)
- Cabeçalho: avatar (disco com inicial/cor via `avatarFor`) + nome do ativo.
- Renomear: input + botão "Salvar" (pré-preenchido com o nome ativo) → `renameActive`.
- Lista de jogadores: cada perfil como item tocável; o ativo tem um selo "Ativo" e não é
  tocável para troca; tocar outro chama `switchTo(id)`.
- Criar jogador: input + botão "Criar" → `create(name)` (novo vira ativo).
- Botão "Voltar" (`nav.back`), como as outras telas.
- Erros de validação exibidos inline (reusa `validateName`).

`App.tsx` passa a mapear `case 'profile'` para `<ProfileScreen/>`.

## i18n (chaves novas, 10 locales — REGRA 4)

Reusa `screen.profile` (título) e `nav.back`. Adiciona (namespaces `onboarding`/`profile`):

- `onboarding.title` — ex.: "Welcome"
- `onboarding.prompt` — ex.: "What should we call you?"
- `onboarding.placeholder` — ex.: "Your name"
- `onboarding.start` — ex.: "Start"
- `onboarding.error.empty` — ex.: "Please enter a name."
- `onboarding.error.tooLong` — ex.: "Name is too long (max 20)."
- `profile.rename` — ex.: "Rename"
- `profile.save` — ex.: "Save"
- `profile.players` — ex.: "Players" (título da seção de troca)
- `profile.active` — ex.: "Active" (selo)
- `profile.newPlayer` — ex.: "New player" (label/placeholder do criar)
- `profile.create` — ex.: "Create"

Paridade garantida pelo teste existente `tests/i18n/locales.test.ts`.

## CSS

Reusa `.screen`, `.screen__title`, `.btn`, `.btn--ghost`, tokens existentes. Adiciona classes
BEM mínimas para o avatar-disco e a lista de perfis (ex.: `.avatar`, `.profile-list`,
`.profile-list__item`, `.profile-list__item--active`) em `global.css`. Sem novas dependências.

## Testes

- **`store.ts` (node, puro):** `validateName` (vazio/só espaços/limite/ok), `normalizeName`
  (trim/colapso), `createProfile` (vira ativo; ids distintos preservados), `setActive` (no-op
  em id inexistente), `renameProfile`, `activeProfile`, `avatarFor` (inicial correta; hue
  determinístico e estável por id, no intervalo). Determinístico (sem tempo/aleatoriedade).
- **`storage.ts` (node/happy-dom):** round-trip via `memoryProfileStorage`; `load` robusto
  (JSON inválido, forma errada, chave ausente ⇒ `emptyState`); versão `v1` no payload.
- **`ProfileService` (happy-dom, storage injetado):** `create` gera id/tempo e ativa; persiste
  (verifica via storage mock); `switchTo`; `renameActive`; sinais atualizam; `create` inválido
  retorna `false` sem mutar.
- **`OnboardingScreen` (happy-dom):** com estado vazio, o App renderiza onboarding; submeter
  nome válido cria perfil e revela a Home; nome inválido mostra erro e não avança.
- **`ProfileScreen` (happy-dom):** mostra o ativo; criar adiciona e troca o ativo; tocar outro
  perfil troca; renomear atualiza o nome exibido.

Todos os testes de determinismo existentes (64) permanecem verdes (core intocado).

## Definição de pronto

- `npm run check` limpo; `npm test` verde (incluindo paridade i18n e determinismo 64).
- Primeiro acesso pede nome; criar/trocar/renomear jogador funciona; Perfil real na rota
  `profile`; persistência sobrevive a reload (verificação manual/Playwright).
- Item 4.2 marcado `[x]`; "Estado atual" do `CLAUDE.md` atualizado; integrado no `main`.
