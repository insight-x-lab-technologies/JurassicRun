# Design — Flap mais suave + arte realista in-game por tema

**Data:** 2026-07-21
**Autor:** sessão autônoma (aprovado pelo usuário)
**Escopo:** dois ajustes de gameplay pedidos pelo usuário — (1) reduzir a força do flap;
(2) elevar o realismo da tela de jogo integrando os novos assets AAA por tema.

## Contexto

O usuário reportou dois problemas:

1. **O voo do dino ao clicar está muito alto e intenso.** `FLAP_SPEED = 240` (contra
   `GRAVITY = 540`) em `src/core/sim/constants.ts` dá um impulso vertical grande por clique.
2. **A tela de gameplay não parece realista.** A arte in-game atual (`public/art/final/`) é
   cartoon plana; o parallax são silhuetas vetoriais planas. O usuário gerou um novo conjunto de
   arte fotorrealista por tema em `public/art/themes/<tema>/` (`classic`, `volcano`, `glacier`).

Análise dos novos assets confirma melhora dramática de realismo: dino pintado com 6 frames de
flap, fundo de selva fotorrealista, parallax de montanhas/selva reais, árvore realista, powerups
e moeda pintados.

### Fatos técnicos apurados

- **Cor de chroma varia por asset.** Powerups, árvore, dino e folhas UI usam **magenta**
  (~`#FF00FF`); `bird.coin` usa **verde** (~`#00FF00`). O pipeline precisa keyar ambas.
- **Cobertura parcial.** Os temas fornecem `dino.default` (strip de 6 frames), `dino.starter`,
  `bird.coin`, `obstacle.tree`, uma **folha de powerups** (grade 3×2), uma folha `remaining-assets`
  (chrome de UI), uma folha `ui-parallax` (chrome + banda de parallax de 3 camadas) e `bg.screen`.
  **Faltam** `obstacle.vine`, `obstacle.boulder`, `obstacle.stalactite` e os 10 dinos nomeados.
- **Layout da folha de powerups:** grade 3×2, ordem row-major:
  `[0]=shield (escudo azul)`, `[1]=extraLife (coração)`, `[2]=magnet (ímã roxo)`,
  `[3]=doubleCoin (moedas)`, `[4]=slowMo (ampulheta)`, `[5]=spare (moeda-pássaro dourada, ignorada)`.
- **Pipeline existente:** `scripts/gen-atlas.mjs` (empacota entidades → `public/atlas/`,
  suporta `ATLAS_VARIANTS` multi-atlas) e `scripts/gen-ui.mjs` (processa arte → `public/ui/`,
  modos `single`/`grid`/`regions`). Ambos usam `alpha>0` para trim — não lidam com chroma.
- **Seams prontos:** `LookPack.atlas?` + `atlasRefFor(pack)` (atlas de entidades por tema);
  `ParallaxVisual` ramo `sprite`; `LookPack.parallax`; `theme.ts` custom properties.
- **Fix de resolução (W5):** o canvas renderiza em px reais do display, então uma entidade de
  ~20 unidades de mundo cai em ~80px num desktop 1366-wide — detalhe pintado sobrevive.

### Decisões de produto (aprovadas)

- **Força do flap:** `FLAP_SPEED` 240 → **170** (redução ~29%; voo mais contido/pesado).
- **Escopo visual:** integrar tudo o que veio (dino, árvore, moeda, powerups, fundo, parallax).
  Obstáculos `vine`/`boulder`/`stalactite` ficam com a arte cartoon atual (mix temporário aceito
  até o usuário gerar o conjunto realista).
- **Cobertura:** os **3 temas** (classic/volcano/glacier), via o seam de packs.

## Arquitetura

Todo o trabalho é **render/build/asset**, exceto a constante de flap. `src/core/` só muda em
`constants.ts` (flap). Determinismo: re-pin dos goldens de replay; nada mais afeta a simulação.

### Parte 1 — Flap (core determinístico)

- `FLAP_SPEED = 240` → `170` em `src/core/sim/constants.ts`.
- Re-pinar os 4 golden hashes de `tests/determinism/replay.determinism.test.ts` (a trajetória
  vertical muda ⇒ hashes mudam; asserções relacionais GOLD1≠GOLD2 / difficulty on≠off continuam
  válidas ⇒ prova de não-vazamento).
- Rodar `npm run test:determinism` verde.

### Parte 2 — Chroma-key no pipeline de arte

Novo helper puro (em `gen-atlas.mjs`, exportado, reusado por `gen-ui.mjs`):
`chromaKeyToAlpha(img)` que **auto-detecta a cor-chave** amostrando um pixel de canto (os cantos
são sempre fundo) e zera o alpha dos pixels próximos à chave:

- Detecta chave = cor do pixel `(0,0)` (fallback: mediana dos 4 cantos para robustez).
- Para cada pixel: distância no espaço RGB até a chave. `dist < INNER` ⇒ `alpha=0`;
  `dist > OUTER` ⇒ `alpha=255`; entre os dois ⇒ rampa linear (feather anti-franja — lição do
  parallax onde franja de alpha ~17 vazou).
- Também descontamina a cor de borda (remove o tingido da chave nos pixels semi-transparentes)
  para evitar halo magenta/verde.
- Idempotente/determinístico; sem dep nova.

A fonte de leitura passa a apontar para `public/art/themes/<tema>/`. Assets já-alpha
(ex.: `bg.screen.png`, que é foto opaca) passam direto (chave detectada não bate ⇒ sem mudança
relevante, ou pulados por config).

### Parte 3 — Atlas de entidades por tema

Via `ATLAS_VARIANTS` já existente, um atlas por tema. Cada variante monta os 11 ids do manifesto:

- **Novo realista** (de `themes/<tema>/`, com chroma-key): `dino.default` (6f, slice do strip),
  `obstacle.tree`, `bird.coin`, e `powerup.{shield,extraLife,magnet,doubleCoin,slowMo}`
  (fatiados da folha 3×2, mapeamento row-major acima).
- **Reuso cartoon** (de `public/art/final/`, já-alpha): `obstacle.vine`, `obstacle.boulder`,
  `obstacle.stalactite`.

Saída: `public/atlas/entities.{png,json}` (classic = default, key `entities`),
`entities.volcano.{png,json}`, `entities.glacier.{png,json}`.

Wiring: `packs.ts` seta `LookPack.atlas` para volcano/glacier (`{key,png,json}`); classic omite
(usa `entities` default). `GameScene` já resolve `atlasRefFor(pack ativo)` e cria a anim
`dino.flap.<atlasKey>` por-atlas.

### Parte 4 — Parallax por tema

Fatia as 3 camadas da banda inferior da folha `ui-parallax` (separadas por linhas de chave) via
`gen-ui.mjs` (modo `regions` com chroma-key) → `public/ui/parallax.{far,mid,near}.<tema>.png`.

Wiring: `packs.ts` `LookPack.parallax` aponta as texturas por tema; `GameScene`/`ParallaxVisual`
(já sprite) carregam pela pack ativa. Posições (`baseFromBottom`/`dispHeight`) reusam as regras
do parallax atual (altura natural, `padBottomTo` da última linha sólida para chegar ao chão).

### Parte 5 — Fundo de gameplay fotorrealista

`bg.screen.<tema>` (já processado em `public/ui/bg.screen.<tema>.png` pela Tier-1) entra como
backdrop distante no `GameScene`: um `Image`/`TileSprite` estático, `scrollFactor(0)`, depth
abaixo das camadas de parallax, cobrindo o viewport, com tint de dia/noite aplicado.

**Ponto de verificar-e-ajustar:** o `bg.screen` da selva tem centro escuro (caverna). Se atrás do
gameplay ficar escuro/carregado demais e prejudicar legibilidade, o fallback é manter o céu sólido
dia/noite + só o parallax realista (descartar a Parte 5). Decisão tomada na verificação Playwright.

## Componentes e limites

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `constants.ts` (flap) | valor do impulso | — (core puro) |
| `chromaKeyToAlpha` (gen-atlas) | fundo-chave → alpha | `decodePng` |
| `gen-atlas.mjs` (ATLAS_VARIANTS) | 3 atlas de entidades por tema | chroma-key, `themes/`, `final/` |
| `gen-ui.mjs` (parallax por tema) | 3×3 PNGs de parallax | chroma-key, `regions` |
| `packs.ts` | mapeia atlas/parallax por tema | ids do manifesto |
| `GameScene` (backdrop) | bg.screen distante + tint | `packs.ts`, day-night |

## Tratamento de erros / bordas

- Chroma-key com feather evita franja colorida; descontaminação de borda evita halo.
- `bg.screen` opaco não deve ser keyado — config por-fonte marca quais assets pulam chroma.
- Frames faltantes (vine/boulder/stalactite realistas) → reuso explícito de `final/`, sem quebrar
  a guarda de completude manifesto↔atlas.

## Testes

- `npm run test:determinism` verde após re-pin (Parte 1).
- Guardas de gen (atlas/ui) atualizadas para as novas fontes/variantes; guarda de completude
  manifesto↔atlas continua cruzando os 11 ids em cada variante.
- Guarda de paridade de pack (expansão↔pack) cobre `atlas`/`parallax` por tema.
- Verificação Playwright (build de produção) nos 3 temas: entidades realistas renderizam, bordas
  de chroma limpas (sem halo magenta/verde), parallax realista até o chão, fps 60/0 jank,
  decisão sobre a Parte 5 (backdrop) registrada.

## Fora de escopo (backlog)

- Obstáculos `vine`/`boulder`/`stalactite` realistas (usuário gera depois).
- 10 dinos nomeados realistas in-game (skin por dino na partida).
- Re-tematizar chrome de UI de menu (painel/logo/medalhas) por tema — já integrado de `final/`.
- Compressão dos PNGs (backlog recorrente).

## Definição de pronto

- Flap 170, goldens re-pinados, `test:determinism` verde.
- 3 atlas de entidades por tema + parallax por tema gerados e commitados.
- Packs volcano/glacier trocam atlas+parallax ao vivo; classic default intacto.
- Playwright confirma realismo in-game a 60fps sem halo de chroma; Parte 5 decidida.
- `npm run check` limpo; determinismo inalterado no contrato (só flap re-pinado).
