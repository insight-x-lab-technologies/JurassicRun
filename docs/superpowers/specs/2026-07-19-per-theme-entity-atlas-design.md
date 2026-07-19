# Design — Atlas de entidades por-tema (gen-atlas multi-atlas + GameScene ref.key)

**Data:** 2026-07-19
**Objetivo:** habilitar um tema (pack) a ter seu **próprio atlas de entidades** (dino/obstáculos/
moeda/power-ups redesenhados), fechando as 2 lacunas que o 8.1 in-game deixou: (1) `gen-atlas.mjs`
gera só 1 atlas; (2) o `GameScene` usa `ATLAS_KEY` de módulo em vez do `ref.key` do pack ativo.
Sem tocar `src/core/` ⇒ **determinismo 67**.

## Contexto

- O seam de dados já existe: `LookPack.atlas?: AtlasRef` (8.1/8.2) + `atlasRefFor(pack)` (`sprites.ts`)
  + `preload` já carrega `atlasRefFor(activePack)` (`GameScene.ts:80`). O que falta é o **consumo**:
  as entidades são desenhadas com a constante `ATLAS_KEY`, não com a key do pack.
- O atlas é escolhido **por sessão de Play** (o `startGame` cria um `Phaser.Game` novo a cada mount
  de `PlayScreen`; `preload` roda 1× por sessão lendo o pack ativo). Não há troca de atlas no meio de
  uma partida (não dá p/ abrir menus sem sair de Play, o que destrói o jogo). ⇒ a key é fixa por cena.
- Frames: todos os atlases usam **os mesmos ids do manifesto** (`dino.default`, `obstacle.tree`, …).
  Um atlas de tema tem os mesmos ids, com arte diferente.

## Componentes

### 1. `gen-atlas.mjs` — multi-atlas parametrizado

- `renderAtlas(sources = ATLAS_SOURCES)` passa a receber a lista de fontes (default = a atual) ⇒
  `renderAtlas()` sem arg continua byte-idêntico (retrocompat total; o teste commitado-bate segue).
- Novo `ATLAS_VARIANTS = [{ key: ATLAS_KEY, sources: ATLAS_SOURCES }]` (só `entities` hoje). `main()`
  itera as variantes: `renderAtlas(v.sources)` → escreve `public/atlas/<v.key>.{png,json}`.
- **Adicionar um atlas de tema** = adicionar `{ key:'sunset', sources:[...paths do tema] }` ao
  `ATLAS_VARIANTS` (mesmos ids, arquivos diferentes em `public/art/final/`) + `npm run gen:atlas`.
  O pack aponta `atlas:{ key:'sunset', png:'atlas/sunset.png', json:'atlas/sunset.json' }`.

### 2. `GameScene` — consumir a key do pack ativo

- Campo novo `private atlasKey!: string;` setado no `preload`: `this.atlasKey = ref.key;` (o `ref` já
  é computado ali via `atlasRefFor(packForId(activeExpansion))`).
- Substituir as 4 usadas de `ATLAS_KEY` por `this.atlasKey`: criação do `dinoSprite` (:119),
  `generateFrameNames` da anim (:124), `acquireSprite` (:320), `setTexture` do pool (:350).
- **Anim `dino.flap` por-atlas (bug sutil):** o `AnimationManager` do Phaser é global e a anim é
  guardada por `if (!this.anims.exists('dino.flap'))`. Com 2 atlases, a 1ª sessão cria `dino.flap`
  ligada ao atlas dela e a 2ª **reusa** (frames errados). Fix: a key da anim inclui o atlas —
  `const animKey = 'dino.flap.' + this.atlasKey;` (create guardado por `!exists(animKey)`, `play(animKey)`).
- `import { ATLAS_KEY }` deixa de ser usado no GameScene (segue exportado por `sprites.ts` p/
  `DEFAULT_ATLAS`); remover do import se o eslint reclamar.

### 3. Docs

- `docs/assets/asset-registry.md` (ou nota no Style Bible): passo-a-passo "atlas de entidades por
  tema" (3 passos: arte → `ATLAS_VARIANTS` → `gen:atlas` → `pack.atlas`).

## Testes

- `tests/render/atlas.test.ts`: `renderAtlas()` (default) segue byte-idêntico ao commitado; `ATLAS_VARIANTS`
  contém `entities`; **`renderAtlas(subset)`** gera um atlas válido (assinatura + frames dos ids do subset)
  — prova a parametrização sem commitar um 2º atlas.
- `tests/render/sprites.test.ts`: `atlasRefFor` já cobre pack-com-atlas → ref próprio (existente).
- GameScene: sem teste de unidade (casca Phaser). Regressão pela suíte + Playwright.
- Determinismo: **67** (core intocado).
- Validação (controlador): (a) **regressão** — classic renderiza as entidades reais + 60fps (caminho
  `ref.key==='entities'==atlasKey`); (b) **prova de capacidade** — gerar um 2º atlas TEMPORÁRIO (mesmas
  fontes, key `entities.demo`, não commitado), apontar um pack de rascunho `atlas` a ele, Playwright
  confirma que as entidades carregam sob a key nova, depois reverter. Prova o roteamento por `ref.key`
  + a anim por-atlas ponta-a-ponta.

## Fora de escopo / notas

- **Arte alternativa real de entidades**: o usuário gera depois (não há set alternativo hoje) — este
  item entrega a CAPACIDADE + prova.
- UI chrome / parallax / medalhas / capas por-tema seguem compartilhados (backlog; padrão análogo se
  desejado).
- Sem dep nova; hot path do render inalterado (só troca a origem da key; REGRA 3 intacta).
