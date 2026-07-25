# 9.1 — Parallax em camadas com transparência (design)

**Data:** 2026-07-24 · **Item:** ROADMAP Fase 9, 9.1 (#1) · **Toca `src/core/`?** Não (determinismo **67** intocado).

## Problema

As 3 tiras de parallax (`parallax.{far,mid,near}.<tema>`) são **bandas opacas** fatiadas de uma
folha fotorreal (`<tema>_ui-parallax.chromakey.png`) via chroma-key + `hardAlpha` + `padBottomTo`.
Sendo retângulos opacos, empilham como 4 planos isolados (inclui o backdrop `bg.screen`) e as
"colunas" que o usuário reporta são as **costuras de tiling** — cada banda opaca não deixa a de
trás vazar, então não há sensação de profundidade e a emenda da tira aparece no scroll.

## Correção

Camadas **transparentes independentes** (silhueta/recorte por plano, canal alpha) que deixam a
camada de trás vazar. **4 camadas** por tema (adiciona `impact`), scrollFactor crescente =
profundidade. O `bg.screen` (backdrop de tela cheia) fica atrás de tudo com o céu, vazando pelos
topos transparentes.

## Dependência de arte — decisão

Os 4 PNGs alpha por tema (`far/mid/near/impact`, Apêndice A.1 da fase) **não existem** — só a
folha opaca legada. Não gero imagens. **Decisão do usuário (confirmada): construir o pipeline
completo agora contra placeholders alpha procedurais que eu gero**; a arte real dropa depois **só
trocando os PNG-fonte** (REGRA 2). Precedente forte do projeto: atlas placeholder (8.2), áudio
procedural (4.10), ícones PWA (7.1).

- Novo `scripts/gen-parallax-placeholder.mjs` gera **12 PNGs-fonte alpha** (silhuetas tileáveis,
  topo transparente, paleta por tema) em `public/art/themes/<tema>/parallax/{far,mid,near,impact}.png`.
  Reusa `encodePng` (node-native, RGBA, zero dep). Committados (precedente de placeholder).
- Substituir esses 12 arquivos pela arte real (mesmos paths/dims) + `npm run gen:ui` = swap limpo.

## Decisões travadas (minhas, autônomas)

1. **As 4 camadas ficam TODAS de fundo** (depth negativo, atrás das entidades do mundo em depth ≥0).
   `impact` é a **frontmost-atrás-do-mundo** (não foreground-na-frente-do-jogo).
   **Porquê:** a premissa de **justiça/legibilidade é TRAVADA** (campo lógico fixo 320×180; nada
   pode ocluir obstáculos). Uma camada foreground a scrollFactor 0.85 passando na frente do dino
   desincronizaria (mundo=1.0) e esconderia obstáculos que o jogador precisa reagir ⇒ injusto.
   `impact` a 0.85 como camada de fundo mais próxima honra "à frente do near" sem esse risco.
   Foreground-na-frente real fica de backlog (exigiria gating à faixa fora do corredor de voo).
2. **Placeholder alpha, não fotorreal.** O visual regride a silhueta até a arte real chegar —
   aceito pelo usuário. O `bg.screen` fotorreal permanece como backdrop de céu.
3. **Aposentar o pipeline legado de parallax opaco:** remover de `gen-ui.mjs` as 3 entradas
   chroma per-tema e a entrada legada `bg.layers.png` (consumida por nada além de 1 asserção de
   teste). `chroma`/`hardAlpha`/`padBottomTo`/`trimChromaEdges` param de ser usados pelo parallax
   (código pode ficar para outros usos, mas nenhuma fonte de parallax os invoca).

## Arquitetura

Fluxo (todo em render/build, `src/core/` intocado):

```
public/art/themes/<tema>/parallax/{far,mid,near,impact}.png   (placeholder alpha, commit)
      │  scripts/gen-parallax-placeholder.mjs (gera as 12 fontes)
      ▼
scripts/gen-ui.mjs  (modo single alpha-preservando: sem chroma/hardAlpha/trim/pad)
      ▼
public/ui/parallax.{far,mid,near,impact}.<tema>.png          (runtime, commit)
      ▼
packs.ts  LookPack.parallaxTextures: [far,mid,near,impact] por tema
      ▼
src/render/parallax.ts  PARALLAX_LAYERS (4 sprites, scrollFactor 0.15/0.35/0.6/0.85)
      ▼
GameScene  4 TileSprites (depth negativo, atrás do mundo) + bg.screen atrás de tudo
```

### Peças e mudanças

- **`scripts/gen-parallax-placeholder.mjs` (novo):** gera 12 fontes alpha tileáveis. Cada tira:
  largura 2048 (topo casa com base p/ tiling horizontal seamless), silhueta na parte inferior,
  topo 100% transparente; `impact` ~70% transparente (elementos esparsos). Dims Apêndice A.1:
  far/mid 2048×384, near 2048×448, impact 2048×512. Paleta por tema (classic verde/âmbar,
  volcano basalto/ember, glacier gelo/aurora). Determinístico. `npm run gen:parallax` (script npm).
- **`scripts/gen-ui.mjs`:** trocar as 3 entradas `parallax.theme.<tema>` (chroma) e a entrada
  legada `parallax`/`bg.layers.png` por **12 entradas single alpha** — uma por tema×camada —
  `{ out:'parallax.<layer>.<tema>', file:'parallax/<layer>.png', root:'public/art/themes/<tema>',
  maxDim:2048, opaque:true }`. `opaque:true` = **sem content-trim** (preserva o frame tileável
  inteiro; `cropResize` preserva o alpha). SEM `chroma`/`hardAlpha`/`padBottomTo`.
- **`src/render/parallax.ts`:** `PARALLAX_LAYERS` vira 4 camadas
  (`bg.layer.{far,mid,near,impact}`), scrollFactor `0.15 / 0.35 / 0.6 / 0.85`,
  `dispHeight`/`baseFromBottom` recalibrados para as dims novas (calibração Playwright).
- **`src/render/constants.ts`:** `PARALLAX_SOURCE_WORLD_WIDTH` recalibrado (fonte agora 2048;
  valor exato por calibração — controla a frequência da emenda no scroll).
- **`src/render/packs.ts`:** `LookPack.parallaxTextures` de 3-tupla → 4-tupla
  `[far,mid,near,impact]`; adicionar `parallax.impact.<tema>` nos 3 packs; array `parallax`
  (ParallaxPaint) de volcano/glacier de 3→4 entradas (classic deriva de `PARALLAX_LAYERS.map` ⇒
  auto-4).
- **`src/render/GameScene.ts`:** já é **data-driven** (mapeia `PARALLAX_LAYERS` × `parallaxTextures[index]`;
  depth = `-(PARALLAX_LAYERS.length - index)`, bg.screen = `-(length+1)` ⇒ auto-estende p/ 4).
  Verificar `preload` carregando as 4 texturas do pack. Nenhuma alocação por frame nova (REGRA 3;
  só `tilePositionX` por frame como hoje).
- **Assets:** deletar órfãos `public/ui/parallax.{far,mid,near}.png` (legado não-tema) e regerar
  os `public/ui/parallax.*.<tema>.png` (12). `docs/assets/asset-registry.md` + specs `bg.layer.*.md`.

## Determinismo

`src/core/` **intocado** ⇒ determinismo 67 inalterado, sem re-pin de goldens. `verify-determinism`
não é gatilho obrigatório (nada em core), mas a suíte completa roda.

## Testes (atualizações)

- `tests/render/parallax.test.ts`: ids `toEqual([...4])` incluindo `bg.layer.impact`; scrollFactor
  crescente e em [0,1) (0.85<1 ok); `>=3` continua válido.
- `tests/render/gen-ui.test.ts`: a asserção "gera as 3 tiras" passa a checar as 4 tiras por tema
  (`parallax.<layer>.<tema>`); `expectedCount`/committed-match auto-adaptam (regerar+commitar PNGs).
- `tests/render/parallax-chroma.test.ts`: layers `['far','mid','near','impact']` × 3 temas (12
  arquivos). Placeholders alpha não têm chroma ⇒ passa trivialmente; mantém o invariante p/ a arte
  real.
- `src/render/packs.test.ts`: auto-adapta (itera `PARALLAX_LAYERS`); classic zero-regressão mantido.
- Novo teste leve do gerador placeholder (assinatura PNG + alpha no topo == 0 + determinismo),
  molde de `tests/pwa/icons.test.ts`.

## Aceite

3–4 camadas visíveis com profundidade e alpha (a de trás/`bg.screen` vaza pelos topos
transparentes), **sem costura de tiling visível no scroll**, tint de daynight preservado,
**60fps** (Playwright, build de produção, partida ativa). Verificação nos 3 temas.

## Backlog / adiado

- Arte AAA real alpha (usuário gera pelos prompts do Apêndice A.1, dropa nos 12 paths).
- `impact` como foreground real (na frente do jogo) com gating à faixa fora do corredor de voo.
- `bg.screen` fotorreal pode ficar "duplicado" atrás de silhuetas placeholder — tuning quando a
  arte real chegar (silhuetas coerentes com o céu do backdrop).
- Recalibração fina de dispHeight/baseFromBottom/PARALLAX_SOURCE_WORLD_WIDTH quando a arte real
  (dims/densidade diferentes) substituir os placeholders.
