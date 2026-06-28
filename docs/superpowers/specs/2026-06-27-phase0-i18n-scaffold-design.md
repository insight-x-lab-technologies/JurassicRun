# Fase 0.4 — i18n scaffold (design)

> Spec da feature. Item 0.4 do `docs/roadmap/PHASE-00-foundations.md`.
> Objetivo: ter i18next configurado, locales para os 10 idiomas e `t()` disponível no
> app shell — sem nenhuma string visível hardcoded e sem impacto no contrato de determinismo.

## Contexto e objetivo

`CLAUDE.md` (regra 4) proíbe qualquer string visível ao usuário hardcoded: tudo via chaves
i18next. Esta fase entrega a **fundação** de i18n (não a cobertura de telas, que é Fase 4):
o serviço, os 10 arquivos de locale e a função `t()` acessível no shell.

Decisão de escopo resolvida com o usuário: os docs enumeravam **9** idiomas mas o roadmap
exige **10**. O 10º idioma é **Coreano (`ko`)** (mercado mobile gaming forte, sem RTL,
alinhado ao trio CJK `ja`/`zh`/`ko`).

**Lista canônica dos 10 idiomas** (este passa a ser a fonte da verdade):
`en` (default), `es`, `pt-BR`, `fr`, `it`, `de`, `ja`, `zh`, `ko`, `hi`.

## Não-objetivos (YAGNI)

- **Sem detecção de idioma por navegador** agora. Inicializa em `en`; a seleção de idioma
  e persistência entram na Fase 4 (Configurações). O serviço expõe `changeLanguage()` para
  habilitar isso depois sem refactor.
- **Sem cobertura de chaves de telas** (home/settings/shop/…). Só um namespace `app.*`
  mínimo de bootstrap para provar o pipeline e dar base aos testes de paridade.
- **Sem react-i18next/preact bindings.** Usamos `i18next` puro via um serviço fino; a UI
  (Preact, Fase 4) chamará `t()` diretamente.
- **Sem lazy-loading de locales.** Os 10 JSONs são pequenos e empacotados estaticamente.
  Reavaliar se o volume de strings crescer muito (provável: nunca, para um jogo casual).

## Arquitetura

Segue `docs/architecture/ARCHITECTURE.md`: locales JSON em `src/i18n/`, `I18nService` em
`src/services/`. i18n **não** vive em `src/core/` → zero impacto no determinismo (a guarda
anti-não-determinismo continua válida; nenhum import gráfico/DOM entra em core).

### Unidades

1. **Arquivos de locale** — `src/i18n/locales/<lng>.json` (10 arquivos).
   - `en.json` é a fonte da verdade. Bootstrap mínimo com namespace `app.*`
     (ex.: `app.title`, `app.loading`). Traduções reais nos demais idiomas para essas
     poucas chaves triviais; regra geral (skill `add-locale`): se faltar tradução, copiar
     o texto em inglês como placeholder — mas a **chave nunca pode faltar**.
   - O quê: dados estáticos de tradução. Como usar: importados como `resources` do i18next.
     Depende de: nada.

2. **Agregador de recursos** — `src/i18n/locales/index.ts`.
   - Importa os 10 JSONs e exporta um mapa `resources` no formato i18next
     (`{ [lng]: { translation: <json> } }`) e a constante `SUPPORTED_LANGUAGES`
     (tupla readonly dos 10 códigos, `en` primeiro) + `DEFAULT_LANGUAGE = 'en'`.
   - O quê: ponto único que conhece a lista de idiomas e seus recursos. Como usar:
     consumido pelo `I18nService` e pelos testes. Depende de: os JSONs.

3. **`I18nService`** — `src/services/i18n.ts`.
   - Wrapper fino sobre uma instância **isolada** do i18next (`i18next.createInstance()`,
     não o singleton global — evita estado compartilhado entre testes e facilita o reset).
   - API:
     - `init(): Promise<void>` — inicializa com `resources`, `lng: 'en'`,
       `fallbackLng: 'en'`, `supportedLngs: SUPPORTED_LANGUAGES`, `defaultNS: 'translation'`,
       `interpolation: { escapeValue: false }` (Preact já escapa; i18next não injeta HTML),
       `returnNull: false`. Idempotente (chamar duas vezes não recria).
     - `t(key, options?): string` — delega ao i18next. Lança/avisa só conforme padrão do
       i18next (chave ausente → fallback `en` → a própria key).
     - `changeLanguage(lng): Promise<void>` — troca o idioma ativo (valida contra
       `SUPPORTED_LANGUAGES`).
     - `getLanguage(): string` — idioma ativo atual.
     - `SUPPORTED_LANGUAGES` reexportado para a UI montar o seletor (Fase 4).
   - O quê: única porta de entrada para i18n no app. Como usar: `await i18n.init()` no
     bootstrap, depois `i18n.t(...)`. Depende de: agregador de recursos + `i18next`.

4. **App shell** — `src/app/main.ts`.
   - Inicializa `i18n` antes do render; seta `document.documentElement.lang` e
     `document.title = i18n.t('app.title')` (uso real de `t()` sem poluir a tela — o shell
     permanece visualmente vazio até a Fase 4).

## Fluxo de dados

`main.ts` → `await i18n.init()` (carrega `resources` agregados) → `i18n.t('app.title')`
→ define `document.title` e `<html lang>`. Sem IO assíncrono real (recursos empacotados);
`init()` é async só por contrato do i18next.

## Tratamento de erros

- **Chave ausente:** comportamento padrão i18next — fallback para `en`; se ausente também
  em `en`, retorna a própria key. Coberto por teste.
- **Idioma não suportado em `changeLanguage`:** rejeita/ignora (não cai num locale
  inexistente). Coberto por teste.
- **`init()` falha:** propaga a Promise rejeitada; o bootstrap não silencia o erro.

## Estratégia de testes (Vitest, `tests/i18n/`)

Lógica de serviço → testes diretos (não é `src/core/`, então sem bateria de determinismo,
mas com cobertura real):

1. **Paridade de chaves:** todos os 10 locales têm exatamente o mesmo conjunto de key-paths
   (deep) que `en`. Falha listando chaves faltantes/extras — protege a regra "chave em
   todos os locales".
2. **Idiomas suportados:** `SUPPORTED_LANGUAGES` é exatamente os 10 códigos esperados, com
   `en` primeiro, e existe um arquivo JSON para cada um.
3. **`t()` resolve:** após `init()`, `t('app.title')` retorna o valor de `en`; após
   `changeLanguage('pt-BR')`, retorna o valor `pt-BR`.
4. **Chave ausente / fallback:** `fallbackLng: 'en'` configurado. Como a regra de paridade
   garante que nenhuma chave existe só em um locale, o cenário observável é a chave
   inexistente em todos: `t('app.missing')` retorna a própria key (comportamento i18next).
5. **Idioma inválido:** `changeLanguage('xx')` não altera o idioma ativo para um inválido.

## Docs a atualizar (fechar a discrepância 9→10)

- `docs/conventions/CONVENTIONS.md` — adicionar `ko` à lista de idiomas.
- `docs/superpowers/specs/2026-06-27-jurassicrun-design.md` — adicionar `ko` onde lista os
  idiomas.
- `.claude/skills/add-locale/SKILL.md` — adicionar `ko` à lista e corrigir a contagem
  ("outros 9 locales").
- `docs/roadmap/PHASE-00-foundations.md` — marcar 0.4 `[x]` ao concluir.
- `CLAUDE.md` — atualizar "Estado atual".

## Definição de pronto

- 10 locales JSON com paridade de chaves; `I18nService` com `t()`/`changeLanguage()`.
- `main.ts` usa `t()` no bootstrap; shell continua vazio.
- `npm test` e `npm run check` verdes; guarda anti-não-determinismo intacta.
- Docs de idiomas consistentes (10, com `ko`).
