# Design — Tier-1 Rodada C: medalhas + capas + arte dos dinos (+ statchip/emblema)

**Data:** 2026-07-19
**Item:** 8.1 Tier-1, rodada C de A→B→C→D.
**Escopo:** `gen-ui.mjs` ganha **slice por regiões** (rects fracionários, p/ sheets não-uniformes);
integra: **medalhas** (leaderboard 🥇🥈🥉→arte), **capas de expansão** (cards de Expansões), **arte
dos 10 dinos** do Ninho (frame estático), **moldura statchip** (chips da Home) e **emblema**
(divisor decorativo na Home). Deriva os assets de `ui.remaining` (emblema/statchip/3 medalhas — a
**nav-bar é pulada**, sem lugar natural), `expansion.covers` (3 col) e os 10 strips de dino.

## Contexto e restrições

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**. Toca `scripts/`, `src/app/`, `public/ui/`, `tests/`.
- Reusa o pipeline Tier-1: `gen-ui.mjs` (`UI_SOURCES`/`renderUi`, decoder/`cropResize`/`contentBounds`),
  `public/ui/` (runtime, precacheado), custom properties via `theme.ts` com `BASE_URL`.
- REGRA 2 (arte por dados/CSS). REGRA 3 (DOM estático). Sem dep nova.

## Componentes

### 1. `gen-ui.mjs` — slice por regiões

Uma fonte de `UI_SOURCES` passa a aceitar `regions?: {name,x,y,w,h,opaque?}[]` — `x,y,w,h` são
**frações [0,1]** do tamanho da fonte. Para cada região: rect px = `round(frac×dim)`, crop
(**content-trim** por alpha, salvo `opaque:true`), downscale por `maxDim`, emite `name.png`.
Uma fonte tem `grid` OU `regions` OU nenhum (single). (grid/single da Rodada A/B intactos.)

Novas fontes:
```
// ui.remaining (1024×1536): bandas com whitespace claro ⇒ content-trim isola cada asset.
{ out:'remaining', file:'ui/ui.remaining.png', maxDim:512, regions:[
  { name:'emblem',       x:0.00, y:0.05, w:1.00, h:0.28 },
  { name:'statchip',     x:0.12, y:0.35, w:0.76, h:0.16 },
  { name:'medal.gold',   x:0.03, y:0.71, w:0.31, h:0.27 },
  { name:'medal.silver', x:0.34, y:0.71, w:0.31, h:0.27 },
  { name:'medal.bronze', x:0.65, y:0.71, w:0.31, h:0.27 } ] }
// expansion.covers (1680×936, RGB opaco): 3 colunas.
{ out:'covers', file:'expansions/expansion.covers.png', maxDim:512, regions:[
  { name:'cover.classic', x:0.00, y:0, w:0.3333, h:1, opaque:true },
  { name:'cover.volcano', x:0.3333, y:0, w:0.3333, h:1, opaque:true },
  { name:'cover.glacier', x:0.6667, y:0, w:0.3333, h:1, opaque:true } ] }
// 10 dinos do Ninho: frame 0 (1/6 da largura) do strip, content-trim.
{ out:'dino.starter',  file:'dinos/dino.starter.flap.png',  maxDim:160, regions:[{name:'dino.starter', x:0,y:0,w:0.1667,h:1}] }
// … idem: lodestone, goldbeak, midas, nine-lives, aegis, prospector, harvester, phoenix, guardian
```
(nav-bar deliberadamente não extraída.) Saída commitada: `public/ui/{emblem,statchip,medal.gold,
medal.silver,medal.bronze,cover.classic,cover.volcano,cover.glacier,dino.<10 ids>}.png`.
Teste: presença dos novos assets; determinismo; commitados batem.

### 2. `theme.ts` + CSS

- `theme.ts`: seta `--ui-statchip: url(<base>ui/statchip.png)` (constante). Default `none` em `tokens.css`.
- `.stat-chip` (Home) recebe `border-image: var(--ui-statchip) <slice> fill / <w> / 0 stretch`
  (moldura de vidro c/ borda dourada; centro translúcido) + `background:transparent`.
- `.medal { width:1.6em; height:1.6em; vertical-align:middle; }`.
- `.dino-card__avatar`, `.expansion-card__avatar` viram `<img>` (object-fit:cover, mantendo o
  círculo via `border-radius:50%` p/ dinos; capa retangular p/ expansões).
- `.home__emblem { display:block; width:min(70%,18rem); height:auto; margin:0 auto; }`.

### 3. Wiring JSX

- **Leaderboard** (`LeaderboardScreen.tsx`): `rankGlyph`/`MEDALS` viram um componente `RankBadge`:
  `index<3` ⇒ `<img class="medal" src={base+'ui/medal.<tier>.png'} alt="" aria-hidden>`; senão o
  número. Aplicado em `LocalRow` e `CentralRow` (o `aria-hidden` do rank já existe p/ i<3).
- **Expansões** (`ExpansionsScreen.tsx`): `.expansion-card__avatar` div-hue → `<img>` `cover.<exp.id>`
  (`alt=""`). Fallback: `exp.hue` some (cover cobre os 3 ids do catálogo).
- **Ninho** (`NestScreen.tsx`): `.dino-card__avatar` div-hue → `<img>` `dino.<dino.id>` (`alt=""`).
- **Home** (`HomeScreen.tsx`): `<img class="home__emblem" alt="" aria-hidden>` (emblema) entre a
  top-bar e o menu (divisor). `.stat-chip` ganha a moldura via CSS (sem mudança de markup).

Sem string i18n nova (tudo decorativo; rótulos permanecem).

## Testes

- `tests/render/gen-ui.test.ts`: cobre os novos assets (emblem/statchip/medal.*/cover.*/dino.*);
  regiões produzem `regions.length` arquivos; determinismo; commitados batem.
- `src/app/theme.test.ts`: `--ui-statchip` setado.
- Determinismo: **67**.
- Playwright (build prod): leaderboard com medalhas de arte no top-3 (com dados semeados);
  Expansões com capas; Ninho com arte dos dinos; chips da Home com moldura; emblema na Home;
  sem scroll horizontal; precache registrado.

## Fora de escopo

- **D**: parallax real (`bg.layers.png` → far/mid/near no `GameScene`).
- nav-bar de `ui.remaining` (sem lugar natural — a shell é por telas, sem barra fixa).
- Arte dos dinos **dentro da partida** (skin in-game por dino) — segue backlog (Fase 8/6).

## Riscos / decisões

- **Bandas de `ui.remaining`:** whitespace claro entre emblema/statchip/nav-bar/medalhas ⇒
  content-trim isola cada um; as frações têm folga e caem nos gaps. Validar visualmente no Playwright
  (cada asset recortado sem vizinho).
- **Capas opacas com calhas:** as 3 colunas são recortadas sem trim (`opaque`) — se houver costura
  branca nas bordas, `object-fit:cover` no card a esconde. Validar.
- **Medalhas:** `medal.gold/silver/bronze` mapeadas por índice (0/1/2). O rank ≥3 segue número.
