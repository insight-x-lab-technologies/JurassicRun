# 8.2 — Trocar manifesto geométrico → sprite (pipeline de sprite + atlas)

**Data:** 2026-07-17 · **Fase:** 8 (Arte AAA & packs) · **Item:** 8.2

## Objetivo

Substituir o desenho geométrico em modo imediato das **entidades in-game** (Tier 2) por
**sprites de um texture atlas**, mantendo 60fps, sem tocar `src/core/` nem as hitboxes
(REGRA 1/2). Entregar o **pipeline** (carga de atlas, manifesto `kind:'sprite'`, pooling,
batching, culling, validação de fps). A arte AAA real (8.1-restante) é gerada externamente
pelo usuário e entra depois **só trocando o PNG/JSON do atlas** — zero retrabalho de código.

## Decisão de escopo (produto)

A arte AAA real ainda não existe (só concepts em `ref/` + ícones PWA placeholder). Em vez de
bloquear, construímos o pipeline contra um **atlas PLACEHOLDER gerado proceduralmente** (mesma
filosofia do projeto: áudio procedural, renderer geométrico, ícones placeholder, entitlements
honor-system). O placeholder é um PNG+JSON commitado; a arte real substitui esses dois arquivos
(REGRA 2). Assim 8.2 valida o caminho FIEL de carregamento de atlas desde já.

**Fora de escopo (deferido):**
- Parallax e fundos de tela (Tier 1 / `ParallaxVisual` separado — 8.1/futuro).
- Animações de sprite (frames estáticos agora; `Phaser.GameObjects.Image`, não `Sprite`).
- Packs cosméticos (8.3), gateway real (8.4).
- Atlas com múltiplas resoluções @2x (o campo lógico é fixo 320×180).

## Arquitetura

Divisão puro×casca já usada no render (2.1+): módulos puros testáveis + casca Phaser
não-testada por unidade (validada por Playwright).

### 1. Gerador de atlas placeholder (build/infra) — `scripts/gen-atlas.mjs`
- Encoder PNG puro node-native, **reusa `encodePng` de `scripts/gen-icons.mjs`** (zero dep nova).
- Produz dois artefatos commitados em `public/atlas/`:
  - `entities.png` — grid de células (64×64), uma por id do manifesto, com uma forma colorida
    (retângulo/círculo/triângulo) na cor do manifesto sobre fundo **transparente**; legível a
    320×180. É placeholder — só prova o pipeline.
  - `entities.json` — atlas no formato **Phaser JSONHash** (`{ textures:[{ image, frames... }] }`
    ou `{ frames: { "<id>": { frame:{x,y,w,h} } } }`), nomes de frame = ids do manifesto.
- `npm run gen:atlas`. Determinístico (mesma saída byte-a-byte a cada run).
- **Fonte da verdade das cores/formas** = tabela no script, guardada por teste contra o manifesto.

### 2. Helpers puros de sprite — `src/render/sprites.ts` (testável, sem phaser)
- `ATLAS_KEY = 'entities'`, `ATLAS_PNG`/`ATLAS_JSON` (caminhos relativos ao `BASE_URL`).
- `spriteSizeFor(hitbox): { w: number; h: number }` — dimensões do sprite = **bounds da hitbox**
  (aabb: 2·halfW/2·halfH; circle: 2·r; polygon: min/max dos pontos). Puro, sem alocação de
  objeto intermediário (calcula escalares). Espelha o switch de `drawPrimitive` (mesma geometria,
  agora usada para escalar o Image ao tamanho lógico da hitbox, já que hitboxes são aleatórias
  por instância).
- `frameFor(typeId): string | null` — resolve o nome de frame do atlas a partir do `Renderable`
  do manifesto (`kind:'sprite'` ⇒ `frame ?? typeId`; senão `null`).

### 3. Manifesto — `src/render/manifest.ts`
- As 11 entradas (`dino.default`, 4 obstáculos, `bird.coin`, 5 power-ups) passam de
  `{ kind:'primitive', color }` para `{ kind:'sprite', atlas:'entities', frame:'<id>' }`.
- `FALLBACK` continua `primitive` (magenta) — segurança para id desconhecido/atlas ausente.
- Guarda de completude do teste existente atualizada: todo id do catálogo tem entrada `sprite`
  **e** um frame correspondente no atlas JSON (novo cruzamento manifesto↔atlas).

### 4. Casca de render — `src/render/GameScene.ts`
- **`preload()`** (novo): `this.load.atlas(ATLAS_KEY, BASE_URL+ATLAS_PNG, BASE_URL+ATLAS_JSON)`.
- **Pool de `Image`** (pooling — REGRA 3): array de `Phaser.GameObjects.Image` reusado entre
  frames. Por frame: `poolUsed = 0`; para cada entidade **visível** (culling existente),
  `acquireSprite()` devolve `pool[poolUsed++]` (cresce sob demanda 1× até o pico), seta
  `texture(ATLAS_KEY, frame)`, `position`, `displaySize` (de `spriteSizeFor`, cacheado por
  id no primeiro uso — hitbox por tipo tem tamanho estável dentro do range, e o sprite cobre),
  `depth`, `visible=true`. Após o laço, `pool[poolUsed..]` viram `visible=false`. Estado estável
  ⇒ zero alocação por frame; **1 textura de atlas ⇒ Phaser batcha ⇒ poucos draw calls**.
- **Dino**: um `Image` dedicado, sempre visível, na posição interpolada (`renderX/renderY`),
  depth acima das outras entidades.
- **Fallback primitivo**: o `Graphics` e `drawPrimitive` **permanecem** para `renderable.kind
  !== 'sprite'` (id desconhecido / atlas não carregado) — caminho de segurança, praticamente
  nunca exercitado. Culling e ordem de pintura (obstáculos→coletáveis→power-ups→dino) mantidos.
- Depth: entidades do mundo em ~0, dino logo acima, tudo abaixo do HUD (900) e overlays.

### 5. Fiação
- `game.ts`/`main.tsx`: nada muda estruturalmente (o atlas carrega dentro da cena via `preload`);
  o `BASE_URL` vem de `import.meta.env.BASE_URL` (respeita `BASE_PATH` de Pages/itch — 7.3/7.4).

## Determinismo

`src/core/` **intocado**. Toda geometria de sizing vive no render (espelha o switch já
existente). Determinismo permanece **67** (rodar `verify-determinism` para provar). Sem re-pin
de goldens (não há mudança de simulação).

## Testes
- `tests/render/atlas.test.ts` — assinatura PNG + IHDR do `entities.png`; determinismo do
  encoder; `entities.json` bem-formado; **completude**: todo id sprite do manifesto tem frame no
  atlas (e vice-versa, sem frame órfão). Molde de `tests/pwa/icons.test.ts`.
- `tests/render/sprites.test.ts` — `spriteSizeFor` para aabb/circle/polygon; `frameFor` para
  sprite/primitivo/desconhecido.
- `tests/render/manifest.test.ts` — atualizado: entradas agora `sprite`; completude cruzando
  com o atlas.
- **Validação de fps (Playwright, rAF real)** — partida do início ao Game Over em mobile
  emulado; confirmar 60fps sustentado e batching (poucas draw calls / 1 atlas). Evidência
  registrada, molde de 2.7.

## Definição de pronto
`npm run check` limpo, `npm test` verde, `verify-determinism` = 67 inalterado, evidência de
60fps com sprites de atlas, item 8.2 marcado `[x]`, merge no `main`.
