# Design — 4.8 Configurações (Settings)

**Item do roadmap:** Fase 4, 4.8. **Data:** 2026-07-06.

## Objetivo

Uma tela de Configurações funcional offline com quatro preferências persistidas:

1. **Volume** (mestre, 0–100).
2. **Música do menu** (on/off).
3. **Música do gameplay** (on/off).
4. **Idioma** (um dos 10 locales suportados) — **com troca ao vivo**.

## Escopo e não-escopo

- **Idioma é a única preferência com efeito real imediato no 4.8:** trocar o idioma
  re-renderiza toda a UI na hora (fecha a seam de "troca de idioma ao vivo" deixada pronta
  desde o 4.1) e persiste.
- **Volume e as duas músicas são seams inertes**, exatamente como a carteira foi seam do
  Ninho antes do 4.5: o 4.8 os armazena, valida, persiste e expõe reativamente; **quem os
  consome é o 4.10 (Áudio)**, que ainda não existe. Não há sistema de áudio a acionar agora.
- **Fora de escopo:** SFX toggle (é 4.10), volumes separados música/SFX (roadmap pede um
  volume só), detecção automática do idioma do navegador (Fase 7), configurações por-perfil
  (globais agora; por-perfil na Fase 6).
- **`src/core/` NÃO é tocado** ⇒ determinismo intacto (67 golden hashes). Meta offline pura.

## Arquitetura — serviço reativo `src/services/settings/`

Segue o molde puro×casca já consolidado em `wallet`/`nest`/`trophy` (store puro + storage
localStorage injetável + serviço reativo singleton com `@preact/signals`).

### `store.ts` (puro, sem IO)

```ts
interface SettingsState {
  readonly volume: number;          // inteiro 0..100
  readonly menuMusic: boolean;
  readonly gameplayMusic: boolean;
  readonly language: SupportedLanguage;
}
initialSettingsState(): SettingsState  // { volume: 80, menuMusic: true, gameplayMusic: true, language: DEFAULT_LANGUAGE }
```

Operações imutáveis (retornam novo estado):
- `setVolume(state, value)` — `sanitizeVolume`: clampa a `[0,100]`, `Math.round`; NaN/∞ ⇒
  mantém o valor atual? **Não** — inválido ⇒ clampa (NaN ⇒ 0). Simples e previsível.
- `setMenuMusic(state, on: boolean)`, `setGameplayMusic(state, on: boolean)`.
- `setLanguage(state, lng)` — se `lng` não está em `SUPPORTED_LANGUAGES`, retorna o estado
  inalterado (mesma referência); senão troca.

`sanitizeVolume(v)`: `Number.isFinite(v) ? clamp(Math.round(v), 0, 100) : 0`.

### `storage.ts` (casca IO injetável)

- Interface `SettingsStorage { load(): SettingsState; save(state): void }`.
- `memorySettingsStorage(initial?)` para testes/fallback.
- `localStorageSettingsStorage()` — chave versionada `jurassicrun.settings.v1`, payload
  `{ version: 1, volume, menuMusic, gameplayMusic, language }`.
- `parseState(raw)` robusto (molde de `wallet`): qualquer JSON/forma inválida ⇒
  `initialSettingsState()`. Saneamento **por campo** (um campo corrompido não descarta os
  outros): volume via `sanitizeVolume`; booleans só aceitam `true`/`false` (senão default);
  language só aceita valor em `SUPPORTED_LANGUAGES` (senão `DEFAULT_LANGUAGE`).
- `save`/`load` best-effort (engolem erro de storage indisponível).

### `index.ts` (`SettingsService` reativo, singleton)

Sinais `ReadonlySignal` computados a partir de um `_state = signal<SettingsState>`:
`volume`, `menuMusic`, `gameplayMusic`, `language`.

Métodos:
- `async init(storage = localStorageSettingsStorage()): Promise<void>` — carrega o estado,
  seta os sinais, e **aplica o idioma persistido**: `await i18n.changeLanguage(state.language)`
  + atualiza `document.documentElement.lang` e `document.title` (`i18n.t('app.title')`).
  É `async` porque `i18n.changeLanguage` é async; o bootstrap já é async e aguardará.
- `setVolume(v)`, `setMenuMusic(on)`, `setGameplayMusic(on)` — síncronos: `commit(newState)`
  (set-sinal + persist). Sem efeito colateral além de persistir (áudio consome depois).
- `async setLanguage(lng)` — `await i18n.changeLanguage(lng)` PRIMEIRO (para os `i18n.t()`
  já retornarem as strings novas), depois `commit(newState)` (o sinal `language` muda ⇒
  dispara o re-render) e atualiza `document.lang`/`document.title`.
- `commit(state)` privado = set `_state` + `storage.save(state)`.

`i18n` é importado do singleton `@services/i18n` (a casca pode ter IO/efeito, como
`profileService` usa `Date.now()`/`crypto` na casca). O core continua intocado.

## Troca de idioma ao vivo (o ponto não-trivial)

O `I18nService` **não é reativo**: componentes chamam `i18n.t()` no render e não
re-renderizam sozinhos quando o idioma muda. Solução mínima, sem tocar o `I18nService`:

- **`App.tsx` lê `settingsService.language.value` no topo do render.** Como o `App` já é o
  nó-raiz que faz o switch de tela, ao mudar o sinal `language` o `App` re-renderiza e
  reconstrói toda a subárvore de telas ⇒ todos os `i18n.t()` reavaliam com o idioma novo.
- `setLanguage` garante a ordem: `changeLanguage` (async) resolve **antes** de `commit`,
  então quando o sinal dispara o re-render o `i18n` já está no idioma novo. Sem flash, sem
  strings mistas.

Rejeitado: tornar o `I18nService` signal-based / injetar um contexto de i18n em cada
componente — mais invasivo e desnecessário; a raiz única (`App`) já cobre a árvore inteira.

## Tela — `src/app/screens/SettingsScreen.tsx`

Rota `settings` deixa de ser `PlaceholderScreen` (troca no switch do `App.tsx`). Controles:

- **Volume:** `<input type="range" min=0 max=100>` ligado a `settingsService.volume.value` →
  `onInput` chama `setVolume`. Rótulo mostra o valor atual.
- **Música do menu / Música do gameplay:** dois toggles (checkbox estilizado) →
  `setMenuMusic`/`setGameplayMusic`.
- **Idioma:** `<select>` com as 10 opções; cada opção exibe o **nome nativo** do idioma
  (constante estática `LANGUAGE_NATIVE_NAMES`, NÃO traduzível — "Deutsch" é "Deutsch" em
  qualquer locale). `onChange` chama `setLanguage`.
- **Voltar:** `back()` do router.

`data-testid`s para verificação: `settings-volume`, `settings-menu-music`,
`settings-gameplay-music`, `settings-language`.

CSS por design tokens (sem cor hardcoded), mobile-first retrato+paisagem, sem scroll
horizontal, alvos de toque ≥44px — como as demais telas da Fase 4.

## i18n (REGRA 4)

Novas chaves nos **10 locales** (paridade garantida por `tests/i18n/locales.test.ts`):
`settings.title`, `settings.volume`, `settings.menuMusic`, `settings.gameplayMusic`,
`settings.language`, `settings.on`, `settings.off`, `settings.back`.
`nav.settings` e `screen.settings` já existem.

Os nomes nativos dos idiomas são um **mapa estático** (não chaves i18n): `en→English`,
`es→Español`, `pt-BR→Português (BR)`, `fr→Français`, `it→Italiano`, `de→Deutsch`,
`ja→日本語`, `zh→中文`, `ko→한국어`, `hi→हिन्दी`.

## Bootstrap (`src/app/main.tsx`)

Inserir `await settingsService.init()` **depois** de `i18n.init()` e antes do `render`, para
o idioma persistido já valer no primeiro paint. Remover a fixação atual de
`document.lang`/`document.title` do `bootstrap` (passa a ser responsabilidade do
`settingsService.init`), ou mantê-la — `settingsService.init` a sobrescreve corretamente.
Decisão: `settingsService.init` é o dono único do idioma; o bootstrap deixa de setar
`document.lang`/`title` diretamente.

## Testes

- **`store.test.ts`:** sanitização/clamp de volume (negativo, >100, fração, NaN, ∞), toggles,
  `setLanguage` inválido retorna a MESMA referência, válido troca, imutabilidade.
- **`storage.test.ts`:** `parseState` robusto — JSON inválido/forma errada ⇒ defaults;
  saneamento por campo (volume fora de faixa, boolean não-boolean, language desconhecido ⇒
  default, sem descartar os campos válidos); round-trip save→load; `localStorage`
  indisponível não quebra.
- **`SettingsService`:** `init` carrega e seta sinais + chama `i18n.changeLanguage` (i18n
  real inicializado no teste); setters comitam+persistem+atualizam sinais; `setLanguage`
  muda o sinal `language` e o `i18n.getLanguage()`.
- **`tests/i18n/locales.test.ts`:** passa a exigir as novas chaves em 10 locales (paridade).
- **Componente `SettingsScreen`** (happy-dom, leve): renderiza os 4 controles; trocar o
  `<select>` de idioma re-renderiza os rótulos no idioma novo (prova a troca ao vivo).
  Respeita o gotcha recorrente signals+happy-dom (flush via `await Promise.resolve()`).

## Definição de pronto

`npm run check` limpo, `npm test` verde (todos + os novos), determinismo **67 inalterado**
(core intocado). Item 4.8 marcado `[x]`; "Estado atual" do `CLAUDE.md` atualizado (próximo
= 4.9). Verificação visual (Playwright) da troca de idioma ao vivo + persistência no reload.

## Consequências / adiados

- Volume e músicas são **seams**: nenhum áudio toca até o 4.10 os consumir (documentado).
- Configurações **globais** (por-perfil → Fase 6).
- Tuning de defaults (volume 80, músicas on) é placeholder.
- Sem "restaurar padrões", sem detecção de idioma do navegador (fora de escopo/Fase 7).
