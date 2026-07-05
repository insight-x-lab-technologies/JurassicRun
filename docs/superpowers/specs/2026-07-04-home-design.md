# 4.3 — Home (hub) — Design

> Fase 4 (Meta offline), item 4.3. Tela inicial navegável que hospeda o jogador ativo e
> dá acesso a tudo. Só camada de apresentação (Preact); `src/core/` intocado ⇒ determinismo
> inalterado (64).

## Objetivo

Substituir a `HomeScreen` provisória (menu de stubs do 4.1) por uma **Home real**: uma barra de
topo com a identidade do jogador + stats agregados e um menu com todas as opções do jogo.
Fecha a pendência de 4.2: **o avatar da barra de topo é o botão para a tela de Perfil**.

## Escopo (e o que fica de fora)

Dentro:
- Barra de topo: avatar + nome do perfil ativo (clique → rota `profile`) e 3 chips de stats
  (moedas, troféus, nível máx Endless).
- Menu: CTA primário **Novo Jogo (Endless)** + botões de navegação (Diário, Semanal, Ninho,
  Loja, Expansões, Leaderboard, Configurações) + ações (Compartilhar, Doação).
- Rotas novas `daily`/`weekly` como telas placeholder ("em breve"), para o menu ficar completo.
- Compartilhar: implementação real mínima (`navigator.share` + fallback de clipboard), offline.
- i18n de todas as strings novas nos 10 locales (REGRA 4).

Fora (adiado, com *seam* documentado):
- **Dados reais dos stats**: carteira de moedas (4.5), troféus (4.7) e nível máx Endless
  (persistência, 4.5). Em 4.3 vêm de um *seam* puro `getHomeStats()` com placeholders
  (`coins:0, trophies:0, maxLevel:1`).
- **Doação real**: URL Ko-Fi/BMC + `EntitlementsService` (ADR-0004, item 4.6). Em 4.3 o botão
  Doação é um stub "em breve".
- Modos Diário/Semanal reais e Leaderboard (Fase 5); Ninho/Loja/Expansões/Configurações reais
  (4.4–4.8) — reusam os placeholders atuais.
- Roteamento por URL/hash + back-button do browser (Fase 7); transições animadas e temas de
  pack (Fase 8).

## Arquitetura (padrão puro × casca, como 4.1/4.2)

Camadas:
- **Puro/testável** — nenhum acesso a DOM/IO na lógica:
  - `src/app/home/stats.ts`: tipo `HomeStats { coins; trophies; maxLevel }` e
    `getHomeStats(): HomeStats` retornando os placeholders. Ponto único a religar em 4.5/4.7.
    Sem `Math.random`/`Date` — determinístico e trivial de testar.
  - `src/app/home/share.ts`: `shareGame(deps): Promise<ShareResult>` com dependências
    **injetáveis** (`share?`, `clipboard?`, `payload`) para testar sem APIs do browser. Ordem
    de fallback: `navigator.share` → `clipboard.writeText` → `'unsupported'`. Casca fina
    `defaultShareDeps()` lê `navigator`/`i18n`. Retorna `'shared' | 'copied' | 'unsupported'`
    e engole erros/cancelamento do usuário (best-effort, não quebra a UI).
- **Casca (componentes Preact)** — sem teste de unidade além de smoke:
  - `HomeScreen.tsx`: compõe `HomeTopBar` + menu; lê `profileService.activeProfile` (sinal),
    `getHomeStats()` e dispara `navigate(...)` / `shareGame(...)`.
  - `HomeTopBar` (dentro de `screens/home/` ou inline em `HomeScreen`): identidade (botão →
    `navigate('profile')`, reusa `avatarFor`) + `StatChip`s.

Roteamento: `Screen` ganha `'daily' | 'weekly'`; `App.tsx` mapeia ambos para
`PlaceholderScreen` (títulos `screen.daily`/`screen.weekly`). O switch exaustivo com
`default: never` continua garantindo cobertura em `tsc`.

## Menu — estrutura e destinos

Ordem (espelha o roadmap 4.3):

| Rótulo (i18n)        | Ação                         | Estado |
|----------------------|------------------------------|--------|
| `home.newGame` (Endless) | `navigate('play')`       | real (Endless já joga) |
| `nav.daily`          | `navigate('daily')`          | placeholder (Fase 5) |
| `nav.weekly`         | `navigate('weekly')`         | placeholder (Fase 5) |
| `nav.nest`           | `navigate('nest')`           | placeholder (4.4) |
| `nav.shop`           | `navigate('shop')`           | placeholder (4.5) |
| `nav.expansions`     | `navigate('expansions')`     | placeholder (4.6) |
| `nav.leaderboard`    | `navigate('leaderboard')`    | placeholder (Fase 5) |
| `nav.settings`       | `navigate('settings')`       | placeholder (4.8) |
| `nav.share`          | `shareGame()`                | real (mínimo) |
| `nav.donate`         | stub "em breve"              | placeholder (4.6) |

Acesso ao Perfil: pela barra de topo (identidade), não como item de menu.

## Layout / estilo

Mobile-first, retrato + paisagem, **sem scroll horizontal**, alvos de toque ≥ 44px. Novas
classes em `global.css` reusando os design tokens (sem cores hardcoded):
- `.home` (coluna: topo fixo no topo, menu ao centro, rola vertical se faltar altura).
- `.home__topbar` (identidade à esquerda, stats à direita; quebra p/ coluna em telas estreitas).
- `.home__identity` (botão: avatar + nome), `.home__stats`, `.stat-chip` (label + valor;
  emoji decorativo `aria-hidden`).
- `.home__primary` (CTA grande), `.home__menu` (grid responsivo de botões ghost),
  `.home__actions` (linha compartilhar/doação).

## Reatividade & performance

- Home reage ao sinal `activeProfile` (troca de perfil reflete no topo sem remontar).
- `getHomeStats()` é chamado no render (barato, constante). Sem trabalho por frame — Home é
  DOM estático, fora do loop do jogo.
- `App` só renderiza Home quando `activeProfile !== null` (gate de onboarding do 4.2), então o
  topo assume perfil ativo; guarda defensiva mesmo assim.

## i18n (novas chaves, 10 locales)

- `home.newGame` (CTA), `home.coins`, `home.trophies`, `home.level` (labels dos chips).
- `nav.daily`, `nav.weekly`, `nav.share`, `nav.donate`.
- `screen.daily`, `screen.weekly` (títulos dos placeholders).
- `share.title`, `share.text` (payload do `navigator.share`).
- Feedback de doação reusa `screen.comingSoon`.

Paridade garantida por `tests/i18n/locales.test.ts`.

## Testes

- **Puro**: `stats.test.ts` (defaults do seam). `share.test.ts` (ordem de fallback com deps
  injetadas: usa `share` quando existe; cai no clipboard; `unsupported` sem nenhum; engole
  rejeição/`AbortError`).
- **Casca (smoke, happy-dom)**: Home renderiza nome do perfil ativo e os 3 chips; renderiza
  todos os botões de menu; clique em "Novo Jogo" ⇒ `route.value==='play'`; clique num secundário
  ⇒ sua rota; clique na identidade ⇒ `route.value==='profile'`. Respeita o gotcha
  signals+happy-dom (flush via `await Promise.resolve()`).
- `App` renderiza `daily`/`weekly` como placeholder ("em breve").

## Determinismo

`src/core/` **não é tocado** e nada em `src/app/home/` importa do core ⇒ bateria de
determinismo (64) inalterada. Sem `Math.random`/`Date` nos módulos puros novos.

## Riscos / decisões abertas

- **Doação sem URL**: default = stub "em breve". Assim que houver Ko-Fi/BMC, vira `open(url)`
  atrás do `EntitlementsService` (4.6).
- **Stats placeholder**: mostrar 0/0/Lv 1 é honesto enquanto as fontes não existem; o *seam*
  evita abstração morta e localiza a religação futura num único módulo.
