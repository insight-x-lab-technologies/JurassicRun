# Spec 2.3 — Parallax multicamadas

> Fase 2 (vertical slice Endless), item 2.3. Objetivo do item no roadmap:
> **≥3 camadas de fundo com `scrollFactor` distintos (profundidade).**

## Contexto

O render (2.1/2.2) já tem uma câmera que segue o dino interpolado: `cameras.main.scrollX`
cresce sem limite conforme a partida avança (`GameScene.update`). Hoje o cenário é só duas
faixas fixas (teto/chão, `scrollFactor 0`) e a cor de céu do `Phaser.Game`
(`SKY_COLOR`). Não há sensação de profundidade nem de movimento do fundo.

Camadas de parallax são **puramente visuais** — não tocam `src/core/`, então o contrato de
determinismo (REGRA 1) permanece intacto por construção. Elas seguem a filosofia de
manifesto/arte-desacoplada (REGRA 2): cada camada é um **tipo lógico trocável** cujo visual
é geométrico agora e vira sprite/atlas depois, sem mudar a lógica. O `asset-registry.md` já
reserva os ids `bg.layer.far`, `bg.layer.mid`, `bg.layer.near` — vamos usar exatamente esses.

## Objetivo e escopo

**Faz:** três camadas de silhueta atrás do mundo, cada uma com `scrollFactor` próprio
(distante move menos que próxima), rolando infinitamente conforme a câmera avança, tudo
geométrico, sem alocação por frame, sem tocar o core.

**Não faz (fora de escopo, itens posteriores):** HUD (2.4), fluxo de partida/seed exibida
(2.5), Game Over (2.6), pooling/culling geral e medição de fps (2.7), arte PNG (Fase 8),
clima/tempo-do-dia (Fase 3), scroll vertical do fundo (o mundo cabe na altura).

## Decisões técnicas

### Divisão pura × casca (padrão de 2.1/2.2)

- **Módulo puro `src/render/parallax.ts`** (env node, sem `phaser`, testável): catálogo de
  camadas + a matemática de deslocamento. Reexportado por `src/render/index.ts`.
- **Casca Phaser** (`GameScene`, sem teste de unidade): gera as texturas de tile uma vez,
  cria os `TileSprite`, e por frame ajusta `tilePositionX` de cada camada.

### Modelo de camada (dado, no módulo puro)

```ts
type ParallaxVisual =
  | { kind: 'primitive'; color: number; tileWidth: number; peakHeight: number; baseFromBottom: number }
  | { kind: 'sprite'; texture: string };            // futuro (Fase 8)

interface ParallaxLayer {
  readonly id: string;          // 'bg.layer.far' | 'bg.layer.mid' | 'bg.layer.near'
  readonly scrollFactor: number;// em [0,1); distante→pequeno, próximo→grande
  readonly visual: ParallaxVisual;
}

const PARALLAX_LAYERS: readonly ParallaxLayer[]; // ordem = trás→frente (índice 0 mais distante)
```

Espelha a união `Renderable` do manifesto de entidades: `primitive` desenha uma silhueta
geométrica agora; trocar para `kind:'sprite'` = usar a arte, sem mudar a lógica (REGRA 2).
A **profundidade** vem da ordem do array (índice 0 = mais distante), evitando um campo
`depth` redundante; a casca deriva `setDepth` do índice.

Três camadas (trás→frente), paleta jurássica, `scrollFactor` estritamente crescente e < 1
(o mundo/primeiro plano é `scrollFactor 1`):

| id | placeholder geométrico | cor | scrollFactor |
|----|------------------------|-----|--------------|
| `bg.layer.far` | cordilheira de montanhas (triângulos largos/altos, tom azul-acinzentado enevoado) | `0x6b7a8f` | 0.2 |
| `bg.layer.mid` | colinas (triângulos médios, verde poeirento) | `0x4f7a5a` | 0.4 |
| `bg.layer.near` | samambaias/vegetação (triângulos estreitos/altos, verde escuro) | `0x2f5233` | 0.7 |

O céu (`SKY_COLOR` no `Phaser.Game`) atua como camada de fundo estática (fator efetivo 0);
com as três de silhueta, o requisito "≥3 camadas com scrollFactors distintos" é atendido
(4 profundidades no total). Silhuetas são triângulos repetidos parametrizados (largura,
altura do pico, base a partir do fundo) — um único gerador na casca, param por camada; o
formato geométrico chapado combina com a Fase 2 ("tudo geométrico"). Valores de cor/altura
são placeholders de tuning.

### Matemática de deslocamento (puro, testável)

```ts
function parallaxTileOffset(cameraScrollX: number, scrollFactor: number): number {
  return cameraScrollX * scrollFactor;
}
```

Contrato: um tile que rola a `tilePositionX = cameraScrollX * scrollFactor` desloca-se mais
devagar que o mundo (que se move a `scrollFactor 1`), criando profundidade. Função trivial,
mas nomeada + testada para documentar o contrato e manter a casca "burra". Fator 0 ⇒ fundo
imóvel; fator 1 ⇒ acompanha o mundo (nenhuma camada usa 1).

### Render infinito (casca Phaser)

Cada camada é um `TileSprite` cobrindo a viewport (320×180), com `setScrollFactor(0)` (fica
preso à câmera) e `setDepth(-(N - index))` para ficar atrás do mundo (mundo/entidades em
depth 0). A **textura de tile** de cada camada é gerada **uma vez** em `create()` via
`Phaser.GameObjects.Graphics` + `generateTexture(key, tileWidth, VIEW_HEIGHT)` desenhando a
linha de silhueta (fundo transparente ⇒ camadas atrás aparecem). No `update` (só quando não
pausado), para cada camada: `tile.tilePositionX = parallaxTileOffset(scrollX, factor)`. Isso
faz o padrão **tilear infinitamente** (a câmera nunca "chega ao fim"), gastando só uma
atribuição de número por camada por frame ⇒ **zero alocação no hot path** (REGRA 3); as
texturas são criadas na inicialização, não por frame.

Ordem de profundidade final: `bg.layer.far` (−3) < `bg.layer.mid` (−2) < `bg.layer.near`
(−1) < faixa de chão/teto e mundo (0) < overlay de pausa (1000). As samambaias (near, −1)
ficam atrás da faixa de chão (0) ⇒ enraízam-se visualmente atrás da linha do solo.

### Pausa

`tilePositionX` deriva de `cameras.main.scrollX`, que só muda quando o loop avança. A
atualização das camadas fica no mesmo ramo "não-pausado" de `update` que já move a câmera ⇒
sob pausa o fundo congela junto com o resto (mantém a semântica de "congela o último frame"
de 2.2).

### i18n

Nenhuma string visível ao usuário nesta feature (REGRA 4 não se aplica; camadas são
puramente gráficas).

## Arquitetura de arquivos

- **Novo:** `src/render/parallax.ts` — `ParallaxLayer`, `ParallaxVisual`, `PARALLAX_LAYERS`,
  `parallaxTileOffset`.
- **Novo:** `tests/render/parallax.test.ts` — invariantes do catálogo + `parallaxTileOffset`.
- **Editar:** `src/render/index.ts` — reexportar o módulo puro de parallax.
- **Editar:** `src/render/GameScene.ts` — criar as texturas + `TileSprite`, atualizar
  `tilePositionX` por frame (ramo não-pausado); ajustar depth da faixa de chão/teto.
- **Editar:** `src/render/constants.ts` — remover o comentário "parallax real é 2.3"
  (mantendo cores de céu/chão); constantes de parallax vivem em `parallax.ts` (são dado
  da camada).
- **Novo:** `docs/assets/specs/bg.layer.far.md`, `bg.layer.mid.md`, `bg.layer.near.md`
  (REGRA 5, via padrão do template).
- **Editar:** `docs/assets/asset-registry.md` — status das três camadas → `spec`.

Core (`src/core/`) **não é tocado**.

## Testes

Cosmético ⇒ testes cobrem a lógica pura (padrão de 2.1/2.2; a casca Phaser não tem teste de
unidade). `tests/render/parallax.test.ts`:

1. `PARALLAX_LAYERS` tem **≥ 3** camadas.
2. `scrollFactor` de cada camada em `[0, 1)`.
3. `scrollFactor` **estritamente crescente** do índice 0 (mais distante) ao último (mais
   próximo) ⇒ ordenação de profundidade coerente.
4. `id`s únicos e casando com os ids reservados no registry (`bg.layer.far/mid/near`).
5. Toda camada tem um `visual` (guarda de completude; `primitive` com `color`/`tileWidth`/
   `peakHeight`/`baseFromBottom`).
6. `parallaxTileOffset`: `f=0 ⇒ 0`; proporcional a `scrollX`; camada distante desloca menos
   que a próxima para o mesmo `scrollX` (`offset(far) < offset(near)`).

Verificação final: `npm run check` + `npm test` verdes; `verify-determinism` como sanidade
(core intacto ⇒ deve permanecer verde); verificação visual por Playwright (o fundo rola com
profundidade ao mover o dino; camadas distantes mais lentas).

## Riscos e mitigações

- **Alocação por frame** — mitigada: texturas na inicialização; por frame só atribui números.
- **Ordem de profundidade errada** (fundo por cima do mundo) — mitigada por depths negativos
  explícitos derivados do índice + verificação visual.
- **`generateTexture` requer contexto de render** — só na casca Phaser (não testada em node),
  consistente com 2.1/2.2.

## Adiados

- Diferenciar silhuetas por formato (arcos/curvas em vez de triângulos) — cosmético, Fase 8.
- Camada de céu com gradiente/sol e nuvens próprias — Fase 3 (tempo-do-dia)/8.
- Culling/pooling explícito das camadas — 2.7 (TileSprite já é O(1) por camada).
