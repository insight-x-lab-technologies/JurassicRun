# 4.9 — i18n completo (10 idiomas): design

> Fase 4, item 4.9. Objetivo do roadmap: "Cobertura de todas as strings visíveis em
> en, es, pt-BR, fr, it, de, ja, zh, ko, hi."

## Contexto e achado da auditoria

A cobertura i18n foi construída **incrementalmente** em 4.1–4.8: cada item adicionou suas
chaves aos 10 locales, com `tests/i18n/locales.test.ts` impedindo divergência de chaves. Uma
auditoria feita antes deste design confirma que a cobertura **já está completa e correta**:

- **Paridade de chaves:** 130 chaves-folha, idênticas nos 10 locales. ✅ (já garantido pelo teste existente)
- **Valores nativos:** dos 53 valores byte-idênticos ao `en` entre os 9 locales não-`en`, **todos
  são legítimos** — marca (`app.title`/`share.title` = "JurassicRun"), nomes próprios
  (`dino.midas.name` = "Midas"), cognatos reais na língua (de `Nest`/`Wind`, fr
  `Glacier`/`Centurion`/`Active`, pt/fr/it `Volume`), abreviações/empréstimos de gaming
  universais (`FPS`, `Lv`, `Dist`, `Seed`, `Shop`, `Game Over`). Nenhuma tradução faltando.
- **Placeholders de interpolação:** todos os `{{value}}`/`{{var}}` do `en` estão presentes,
  idênticos, em cada locale (130/130 chaves). ✅
- **Strings hardcoded:** nenhuma. Todo texto visível passa por `i18n.t(...)` (JSX usa
  `{t('chave')}`; a cena Phaser usa `t(...)` em todo `add.text`/`setText`).

**Consequência:** não há tradução nova a produzir. "Traduzir" arquivos já corretos seria
trabalho falso. O valor real do 4.9 é **congelar essa completude em guardas de regressão
permanentes**, para que "i18n completo" continue completo quando a Fase 5+ adicionar muitas
telas novas (Diário/Semanal, Leaderboard, etc.).

## Não-objetivos (YAGNI)

- Não adicionar nem alterar chaves/valores de tradução (nenhuma falta).
- Não tocar `src/core/` — zero impacto em determinismo (permanece em 67).
- Não introduzir dependência de ESLint plugin i18n (ruído alto de falso-positivo em
  atributos/`className`; o scan de fonte abaixo, escopado, cobre o caso real deste código sem
  nova dependência).
- Não mudar comportamento de runtime. Deliverable é **exclusivamente de teste + doc**.

## Design: quatro guardas, camada de teste (Vitest)

Segue o precedente do guard anti-não-determinismo ("dupla camada"): guardas de **dados de
locale** + um guard de **fonte**. Sem novas dependências (só `fs`/regex e os recursos já
importados).

### Guarda 1 — Paridade de placeholders de interpolação
Local: estende `tests/i18n/locales.test.ts`.
Para cada chave-folha e cada locale, o **conjunto** de tokens `{{nome}}` do valor deve ser
exatamente igual ao do `en`. Pega tradutor que largou/renomeou `{{value}}`. (Hoje: passa
130/130.)

### Guarda 2 — Valores não-vazios
Local: `tests/i18n/locales.test.ts`.
Nenhum valor de chave-folha pode ser string vazia ou só-espaço, em nenhum locale. Pega chave
esvaziada por engano.

### Guarda 3 — Detecção de não-traduzido com allowlist documentada
Local: `tests/i18n/locales.test.ts`.
Um valor de locale não-`en` byte-idêntico ao `en` **só é permitido** se:
(a) o valor `en` for pura interpolação (ex.: `"{{value}}"` sozinho — nada a traduzir), **ou**
(b) o par `locale::chave` estiver na **allowlist explícita** com justificativa.

A allowlist codifica os 53 pares legítimos da auditoria, agrupados por motivo no comentário:
- **Marca** (`*::app.title`, `*::share.title`) — "JurassicRun".
- **Nome próprio** (`*::dino.midas.name`) — "Midas" (locales que o localizam — it/zh/ja/ko —
  não entram; só es/pt/fr/de).
- **Acrônimo/abreviação/empréstimo universal** — `*::hud.fps` ("FPS"), `*::hud.distance`
  ("Dist"), `ja|ko::hud.level` ("Lv"), `de::hud.seed` ("Seed"), `it::gameover.title`
  ("Game Over").
- **Cognato real na língua** — `de::nav.nest`/`screen.nest`/`nest.title` + `de::weather.wind`
  ("Nest"/"Wind" são as palavras alemãs); `de::nav.shop`/`screen.shop`/`shop.title` ("Shop",
  empréstimo padrão em alemão); `fr::expansions.active`/`expansion.glacier.name`/
  `trophy.centurion.name` ("Active"/"Glacier"/"Centurion" são francesas);
  `pt-BR|fr|it::settings.volume` ("Volume").

Efeito: se a Fase 5 adicionar `screen.leaderboard` e alguém esquecer de traduzir em `de`
(copiando o inglês), o par `de::screen.leaderboard` não estará na allowlist ⇒ **falha** com
mensagem orientando a traduzir ou justificar na allowlist. A allowlist é a evidência viva da
auditoria.

### Guarda 4 — Scan de strings hardcoded (fonte, por AST)
Local: novo `tests/i18n/no-hardcoded-strings.test.ts`.
Varre os fontes de `src/app/**` e `src/render/**` (`.ts`/`.tsx`) via **AST do TypeScript**
(`ts.createSourceFile`, `typescript` já é dependência) — não por regex de linha, que seria
frágil contra o estilo real e **multi-linha** deste código (JSX com texto em linha própria;
`this.add\n.text(...)` encadeado; `.setText([...].join('\n'))` em array). Falha se achar texto
visível fora do i18n:
1. **Nós de texto JSX** (`ts.JsxText`) com conteúdo humano (tem letra/dígito), ignorando
   espaços, entidades HTML puras (`&nbsp;`) e glifos/emoji decorativos. `{t('chave')}` é
   `JsxExpression`, não `JsxText` ⇒ não dispara.
2. **Texto Phaser** — o argumento de **conteúdo** de `add.text(x, y, ⟨conteúdo⟩, {style})`
   (3º arg) e `.setText(⟨conteúdo⟩)` (1º arg) não pode conter literal de string visível.
   Literal é permitido quando: está dentro de uma chamada `t(...)`/`i18n.t(...)` (é chave de
   tradução, incl. concatenação para montar a chave), é vazio (`''` placeholder inicial) ou é
   só separador/whitespace (`'\n'` do `.join`). Objetos de `style` (`color`, `fontSize`) não
   são o argumento de conteúdo ⇒ não disparam.

O arquivo fatora os scanners em funções `scanJsxText(file, src)`/`scanPhaserText(file, src)` e
inclui **fixtures permanentes** que provam, em CI, que os scanners **pegam** os padrões reais
multi-linha (e ignoram os casos legítimos) — travando a própria correção do guarda, não só a
ausência de violações hoje. Estado atual: 0 ocorrências nos fontes reais.

## Arquitetura / isolamento

- Guardas 1–3 são funções puras sobre os recursos de locale (import de `@i18n/locales/index`),
  no arquivo de teste já existente — coesas com o teste de paridade de chaves.
- Guarda 4 é um scanner de fonte isolado em arquivo próprio (responsabilidade distinta: lê o
  disco, não os recursos), evitando misturar leitura de FS com asserção de dados.
- A allowlist vive **no arquivo de teste**, como constante `readonly` com comentário-motivo por
  grupo — auto-documentada, sem produção nova.

## Testar as guardas ("testar o teste")

Cada guarda deve provar que **pega** a violação, não só que passa hoje. Para cada uma:
injetar temporariamente um caso ruim (ex.: `de::screen.nest` reescrito para um valor inventado
não-cognato; um `{{value}}` removido; um `<h1>Hardcoded</h1>` num componente de teste
descartável) e confirmar RED; reverter e confirmar GREEN. Isso substitui o ciclo TDD clássico
para um deliverable cujo produto **são** os testes.

## Definição de pronto

- `npm run check` limpo; `npm test` verde (os 4 guardas passam com os locales atuais).
- Bateria de determinismo **inalterada** (67) — nada em `src/core/` tocado.
- Cada guarda comprovadamente detecta uma violação injetada (evidência registrada).
- `docs/roadmap/PHASE-04-meta-offline.md` 4.9 marcado `[x]`; "Estado atual" do `CLAUDE.md`
  atualizado.
