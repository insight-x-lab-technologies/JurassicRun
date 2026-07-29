# Briefing de geração de arte — Fase 9 (JurassicRun)

> **Para quem executa:** um agente de IA com geração de imagem. Este arquivo é auto-contido:
> contém o estilo travado, as restrições técnicas do pipeline, os prompts prontos e a tabela de
> entrega com o caminho exato de cada arquivo.
>
> **Escopo:** fechar toda a arte pendente da Fase 9 — parallax em camadas (9.1), **os 4
> obstáculos** originais (9.2/9.4) e a moeda coletável. **27 imagens obrigatórias + 6 opcionais**
> (Lotes A–F, já entregues). O **Lote G** (§12), adicionado depois que a lógica do item 9.8 fechou
> no core, cobre os **3 obstáculos novos** (`spire`, `gate`, `rock_arch`) — é um addendum, ainda
> pendente de geração.
>
> **Regra inegociável do projeto (REGRA 2):** a arte **nunca** define a colisão. A hitbox lógica é
> fixa no core. Por isso várias restrições abaixo falam em "preencher a moldura inteira" — é a arte
> que precisa cobrir a caixa de colisão, não o contrário.

---

## ⚠️ Tudo é gerado 3 vezes — uma por expansão

O jogo tem **3 expansões (temas)**, e cada uma tem seu **conjunto completo e independente** de arte.
O jogador troca de expansão e o mundo inteiro muda de material.

| Chave (usada nos caminhos de arquivo) | Nome no jogo | Mundo |
|---|---|---|
| `classic` | Clássica | Cânion de selva pré-histórica, luz dourada |
| `volcano` | Vulcão | Terras ardentes, basalto e lava |
| `glacier` | Geleira | Tundra congelada, gelo e aurora |

**Nenhum asset deste briefing é compartilhado entre temas.** Toda vez que aparecer `<tema>` num
caminho ou `<colar paleta do tema>` num prompt, produzir **as 3 versões**. O enquadramento, a
proporção e o formato ficam **idênticos** entre os 3 — muda só material, cor e ambientação.

> Este briefing existe em parte porque `boulder` e `stalactite` **hoje violam essa regra**: os três
> temas exibem a mesma pedra de selva. O Lote C corrige isso.

---

## 0. Bloco de estilo — colar em TODOS os prompts

```
STYLE (locked): ultra-realistic photoreal CG game asset, physically based materials, high
micro-detail (bark grain, rock pitting, ice crystal, lava crust), cinematic quality but NEUTRAL
even lighting — no colored key light, no lens flare, no depth-of-field blur, no ground shadow
unless explicitly requested. Matches an existing photoreal set (a photoreal pterodactyl sprite
sheet and photoreal basalt/lava power-up icons). NOT cartoon, NOT flat vector, NOT cel-shaded,
NOT painterly illustration, NOT outlined.
NO text, NO watermark, NO logo, NO signature, NO decorative border or frame, NO UI elements.
```

**Por que iluminação neutra:** o jogo multiplica um *tint* de hora-do-dia (manhã/tarde/noite) por
cima destes assets em tempo real. Luz colorida embutida briga com o tint e some a leitura.

### Legibilidade (assets de jogo — "Tier 2")

O campo lógico do jogo é **320×180 unidades**. Um obstáculo ocupa ~12–28 unidades de largura na
tela. Consequência prática: **silhueta e contraste de valor mandam**; detalhe fino some. Não use
detalhe menor que ~3% da dimensão do objeto, nem escuro-sobre-escuro.

### Paletas por tema (gerar **um tema por vez**, trocando só este bloco)

| Tema | PALETTE (colar no prompt) |
|------|---------------------------|
| `classic` | `prehistoric jungle canyon at golden hour — warm greens #3a7d34, olive, warm brown bark #6b4a2b, weathered tan rock #7a6b5a, hazy amber horizon` |
| `volcano` | `volcanic wasteland — dark basalt grey-black, charred wood, glowing ember-orange cracks #ff5a1e, ash haze, red-black rock` |
| `glacier` | `frozen tundra — pale ice blue #bfe6f2, packed white snow, cold grey rock, frost rime, faint aurora teal glow` |

---

## 1. Formato de saída — leia antes de gerar

O regime de fundo muda por lote — e errar o regime quebra o pipeline. A cor-chave de cada lote é a
que aquele arquivo já usa hoje; trocar por conta própria contamina a borda do recorte.

| Lote | Fundo | Motivo |
|------|-------|--------|
| **Parallax** (Lote A) | **Alpha real** (PNG RGBA, topo 100% transparente). Se a ferramenta não emitir alpha: **magenta puro `#FF00FF`**, chapado, sem gradiente/vinheta/sombra — e **avisar na entrega**. | O jogo empilha 4 camadas; a de trás precisa vazar pela de cima. |
| **Tiras segmentadas** (Lote B) | **NENHUM.** Imagem **100% opaca**, conteúdo em cada pixel. Sem magenta, sem transparência. | A arte precisa cobrir a hitbox inteira; qualquer pixel vazado vira "colisão no vazio". |
| **Obstáculos 1-sprite** (Lote C) | **Magenta puro `#FF00FF`** chapado (ou alpha real, se disponível). | Convenção já usada pelo resto da arte do projeto (chroma-key automático). |
| **Moeda** (Lote D) e **dino.hit** (Lote E) | **Verde puro `#00FF00`** chapado (ou alpha real). | Assets dourados/avermelhados — magenta contaminaria a borda. É a chave que esses dois arquivos já usam hoje. |
| **Folha de power-ups** (Lote F) | **Magenta puro `#FF00FF`** chapado (ou alpha real). | Chave que a folha atual já usa. |

**Regras do chroma (quando usado):**
- O pixel do canto superior esquerdo `(0,0)` **precisa** ser a cor-chave pura — o pipeline
  auto-detecta a chave por ali.
- Magenta chapado, **sem** gradiente, vinheta, sombra projetada sobre o fundo nem glow colorido.
- Se o objeto tiver rosa/magenta na paleta, usar **verde puro `#00FF00`** e avisar na entrega.

**Dimensões são exatas.** Entregar em pixel diferente do especificado obriga recalibração de
constantes no código. Não arredondar, não fazer upscale "melhorado".

---

## 2. Lote A — Parallax em camadas (12 imagens) — **prioridade 1**

Substitui placeholder procedural. Cada tema tem 4 faixas horizontais que rolam em velocidades
diferentes (0.15 / 0.35 / 0.6 / 0.85) criando profundidade.

### Restrições comuns (todas as 12)

1. **Faixa horizontal tileável (seamless left↔right)** — crítico. A imagem se repete
   infinitamente no scroll; a coluna 0 precisa continuar a coluna 2047 sem emenda visível.
   *Dica de execução:* preferir composições cujas bordas caiam em área vazia/plana; depois do
   render, verificar deslocando a imagem 50% na horizontal e conferindo o meio.
2. **Sem céu.** O céu é outra imagem (backdrop de tela cheia) que vaza **por trás**. Estas camadas
   são só o relevo/objetos. Nada de gradiente de céu, nuvem de fundo, sol ou estrelas.
3. **Conteúdo ancorado no rodapé**, topo transparente. A altura ocupada é o principal controle de
   profundidade — respeitar a coluna "banda de conteúdo" da tabela. Encher demais vira parede
   opaca e mata a legibilidade do jogo.
4. **Vista lateral 2D plana**, sem perspectiva forte, sem ponto de fuga, sem linha de chão pintada.
5. **Perspectiva atmosférica:** `far` mais claro/dessaturado/enevoado → `impact` mais escuro e
   saturado. É o que dá profundidade quando as 4 se sobrepõem.

### Tabela do lote

| Camada | Dimensão exata | Banda de conteúdo (a partir do rodapé) | Densidade |
|--------|----------------|----------------------------------------|-----------|
| `far` | **2048 × 384** | ocupa até **~22%** da altura (~85 px) | contínua |
| `mid` | **2048 × 384** | até **~30%** (~115 px) | contínua |
| `near` | **2048 × 448** | até **~40%** (~180 px) | contínua |
| `impact` | **2048 × 512** | elementos até **~45%** (~230 px) | **esparsa: ~70% da largura vazia** |

### Prompts

**far** — horizonte distante
```
Seamless horizontal side-scrolling parallax strip, 2048x384. Distant mountain ridge / canyon rim
on a fully transparent background: the mountain silhouette occupies only the bottom ~22% of the
canvas, everything above is empty transparency (no sky whatsoever). Left and right edges tile
seamlessly. Hazy, desaturated, low-contrast — this is the farthest depth plane. Flat 2D side view,
no perspective, no ground line, no characters.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

**mid** — colinas/rochas médias
```
Seamless horizontal parallax strip, 2048x384. Mid-distance rolling hills, boulders and rock
formations rising from the bottom edge, occupying the bottom ~30% of the canvas; everything above
is fully transparent (no sky). Left and right edges tile seamlessly. Moderate contrast and
saturation — one depth plane closer than a hazy far range. Flat 2D side view, no perspective,
no characters.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

**near** — relevo/vegetação próxima
```
Seamless horizontal parallax strip, 2048x448. Near foreground terrain with dense vegetation and
rock rising from the bottom edge, occupying the bottom ~40% of the canvas; everything above fully
transparent (no sky). Strong readable silhouette with irregular top contour. Left and right edges
tile seamlessly. Higher contrast and saturation than the distant planes. Flat 2D side view, no
perspective, no characters.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

**impact** — objetos de destaque esparsos
```
Seamless horizontal foreground overlay strip, 2048x512, MOSTLY EMPTY: about 70% of the horizontal
span is fully transparent. A few large, widely separated foreground elements (big fronds, a thick
trunk, hanging vines, a jagged rock) anchored to the bottom edge, each up to ~45% of the canvas
height, with wide transparent gaps between them. No continuous ground, no sky, no horizon. Left
and right edges tile seamlessly. Darkest and most saturated depth plane.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

---

## 3. Cobertura dos obstáculos — os 4 tipos, nos 3 temas

O jogo tem **exatamente 4 tipos de obstáculo**, e **todos** entram neste briefing. Cada um em 3
versões (uma por expansão) ⇒ **12 arquivos de obstáculo**. A forma da colisão manda no formato da
arte:

| Obstáculo | Onde nasce | Forma da colisão (fixa no core) | Tamanho em tela | Formato da arte | Lote |
|---|---|---|---|---|---|
| `obstacle.tree` | sobe do chão | retângulo, largura 12, **altura variável 48–80** | alto e estreito | tira de 3 segmentos (empilha) | **B** |
| `obstacle.vine` | pende do teto | retângulo, largura 8, **altura variável 40–68** | alto e estreito | tira de 3 segmentos (empilha) | **B** |
| `obstacle.boulder` | flutua no ar | **círculo**, diâmetro 20–36 | compacto | 1 sprite que enche o círculo | **C** |
| `obstacle.stalactite` | pende do teto | **triângulo**, ponta para baixo, 16–28 × 22–36 | compacto | 1 sprite triangular | **C** |

**Por que dois formatos diferentes:** árvore e cipó têm altura sorteada a cada instância — um
sprite único esticado distorceria e deixaria buracos, então eles são **montados por segmentos**.
Pedregulho e estalactite têm proporção estável e a forma da arte já casa a forma da colisão ⇒
1 sprite basta.

**Fora deste capítulo (mas não mais fora de escopo):** os 3 obstáculos novos do item 9.8
(`spire`, `gate`, `rock_arch`) — a lógica e a hitbox **já existem no core** desde que o 9.8 fechou;
os prompts ficam no **Lote G (§12)**, um addendum a este briefing.

---

## 4. Lote B — Obstáculos segmentados: `tree` e `vine` (6 tiras) — **prioridade 1**

Substitui placeholder de cor chapada. O obstáculo tem **altura aleatória a cada instância**, então
o jogo **monta** o objeto empilhando: `cap` (ponta) + N × `body` (miolo repetido) + `base`
(onde encosta). Por isso a arte vem como uma **tira horizontal de 3 células**.

### Formato (idêntico para os 6 arquivos)

- **Dimensão exata: 1536 × 512** = três células **quadradas de 512 × 512**, lado a lado.
- **Ordem das células, da esquerda para a direita: `cap` | `body` | `base`.**
- **Imagem 100% OPACA.** Sem transparência, sem magenta, sem borda vazia, sem margem interna. Cada
  célula preenchida de ponta a ponta, incluindo os cantos.
- **Sem separador** entre as células (nem linha, nem moldura, nem gap).
- **A célula `body` precisa tilear na VERTICAL:** a borda de baixo continua a borda de cima sem
  costura, porque ela é repetida N vezes empilhada.
- **Continuidade lateral entre células:** `cap`→`body`→`base` são empilhados na vertical no jogo, e
  a largura é a mesma; manter diâmetro/textura coerentes para a junta não aparecer.

> **Por que "opaco e preenchendo tudo" e não uma silhueta orgânica recortada:** o objeto tem uma
> caixa de colisão retangular; qualquer área transparente dentro dela é lugar onde o jogador morre
> "no vazio". O charme vem de **textura, relevo e iluminação**, não de recorte de silhueta. Além
> disso o obstáculo **balança** levemente em jogo (animação idle) e é desenhado com uma sangria
> lateral — a arte precisa ser full-bleed para o balanço nunca descobrir a caixa.

### `obstacle.tree` — tronco subindo do chão

```
A single 1536x512 image split into three equal 512x512 cells side by side, NO gaps, NO separators,
NO transparency anywhere — every pixel opaque, content bleeding to all four edges of every cell.
This is a vertical tiling set for a prehistoric tree trunk seen from the side, viewed straight on
(orthographic, no perspective).
CELL 1 (left) = CAP: the top of the tree — dense fern/cycad canopy foliage packed edge to edge,
completely filling the square, no sky and no gaps between fronds.
CELL 2 (middle) = BODY: a repeatable trunk section, thick bark filling the full width, VERTICALLY
SEAMLESS (its top edge continues its bottom edge exactly when stacked).
CELL 3 (right) = BASE: the foot of the trunk with thick roots flaring into packed forest floor,
filling the full width, no cast shadow.
Consistent bark width, color and lighting across the three cells so they read as one object when
stacked (cap on top, several bodies in the middle, base at the bottom).
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### `obstacle.vine` — cipó pendendo do teto

Atenção: aqui a **`cap` é a fixação no teto** (fica em cima) e a **`base` é a ponta livre** (fica
embaixo, pendurada). Mesmo assim, ambas preenchem a célula inteira.

```
A single 1536x512 image split into three equal 512x512 cells side by side, NO gaps, NO separators,
NO transparency anywhere — every pixel opaque, content bleeding to all four edges of every cell.
This is a vertical tiling set for a thick hanging jungle liana seen from the side, orthographic.
CELL 1 (left) = CAP: the anchor where the vine fuses into overhanging ceiling rock — rock mass and
knotted vine roots packed edge to edge, filling the square.
CELL 2 (middle) = BODY: a repeatable braided vine section with clinging leaves, filling the full
width, VERTICALLY SEAMLESS (top edge continues bottom edge when stacked).
CELL 3 (right) = BASE: the dangling lower end — a dense cluster of leaves and tendrils packed edge
to edge, filling the square.
Consistent thickness, color and lighting across the three cells so they read as one hanging vine
when stacked (cap at the top, bodies in the middle, base hanging at the bottom).
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

---

## 5. Lote C — `boulder` e `stalactite` por tema (6 imagens) — **prioridade 2**

Hoje estes dois são cartoon-vetorial da rodada antiga **e são compartilhados pelos 3 temas** (o
vulcão e a geleira exibem a pedra da selva). Regerar photoreal, um por tema.

Formato: **1024 × 1024**, fundo **magenta `#FF00FF`** chapado (ou alpha real).

### `obstacle.boulder` — pedregulho flutuante (colisão circular)

O jogo usa um **círculo** como colisão ⇒ a pedra tem que **encher o círculo inscrito**, tocando os
quatro lados da moldura. Nada de pedra pequena centralizada com margem.

```
A single massive weathered boulder, roughly spherical, filling a 1024x1024 square frame edge to
edge — the rock touches the top, bottom, left and right borders of the frame. Photoreal rock
surface with deep pitting, fracture lines and mineral grain. Seen from the side, orthographic,
lit evenly. No ground, no cast shadow, no debris around it.
BACKGROUND: solid pure magenta #FF00FF, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### `obstacle.stalactite` — estalactite (colisão triangular, ponta para baixo)

Colisão é um **triângulo**: aresta larga colada no teto, **ápice exatamente no centro inferior**.
A arte precisa casar essa forma.

```
A single stone stalactite hanging from a cave ceiling, occupying a 1024x1024 frame: its widest
part is the TOP EDGE, spanning the full width of the frame, and it tapers down to ONE sharp tip
touching the exact bottom-center of the frame — an inverted triangle silhouette. Photoreal rock
with layered mineral striations, wet sheen near the tip, fracture detail. Seen from the side,
orthographic, lit evenly. No ceiling slab above it, no cast shadow.
BACKGROUND: solid pure magenta #FF00FF, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

---

## 6. Lote D — Moeda coletável `bird.coin` (3 imagens) — **prioridade 2**

**Mudança de forma, decidida agora:** o coletável hoje é um **pássaro dourado de asas abertas** —
silhueta larga e vazada dentro de uma colisão **circular** de raio 7–9, ou seja, ~14–18 px na tela.
Resultado: metade do círculo é ar, o jogador coleta "no vazio" e o bicho vira um borrão nesse
tamanho. **Passa a ser uma moeda de verdade** — disco circular, que enche a colisão exatamente e
lê à distância.

> A ficção da "comida = pássaro-moeda" continua: a moeda tem um **pterodáctilo em alto-relevo**
> cunhado na face. A folha de power-ups do tema Vulcão já traz uma peça exatamente assim (medalhão
> de bronze com ave em relevo) — usar como referência de acabamento.
>
> O identificador interno segue `bird.coin` (mudá-lo mexeria no core). Só a arte muda.

**Formato:** **1024 × 1024**, fundo **verde `#00FF00`**, moeda **de frente** (sem perspectiva,
sem inclinação 3/4), **encostando nos quatro lados da moldura**, perfeitamente circular e simétrica.
Nada de moeda pequena centralizada com margem, nada de pilha de moedas, nada de brilho/estrelinha
flutuando fora do disco.

```
A single large circular coin seen perfectly face-on, filling a 1024x1024 square frame edge to edge
— the coin's rim touches the top, bottom, left and right borders. Struck metal with a raised
beveled rim, milled/reeded edge, and a flying pterodactyl in high relief on the face, with visible
strike marks, micro-scratches and wear in the metal. Perfectly symmetrical, no perspective, no
tilt, no stack, no floating sparkles, no ground shadow.
BACKGROUND: solid pure green #00FF00, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema — ver acabamento por tema abaixo>
```

**Acabamento por expansão** (substitui o `PALETTE` neste lote):

| Tema | Acabamento da moeda |
|---|---|
| `classic` | `warm yellow gold, polished high-relief pterodactyl, aged patina in the recesses` |
| `volcano` | `dark basalt-and-bronze coin, glowing ember-orange #ff5a1e cracks running through the field, gold rim` |
| `glacier` | `pale silver-white gold coin rimed with frost, ice-blue #bfe6f2 sheen in the recesses, faint aurora teal reflection` |

---

## 7. Lote E — `dino.hit` (3 imagens) — **OPCIONAL, prioridade 3**

A animação de morte já existe e é **procedural** (giro, queda, partículas, tremor de tela) sobre o
frame de voo congelado. Estes frames são upgrade de arte, e **exigem uma alteração de código** para
entrar (4 passos documentados em `docs/assets/specs/dino.hit.md`). Gerar só se sobrar orçamento.

- **Dimensão exata: 1810 × 724** = tira horizontal de **5 quadros de 362 × 724**.
- Enquadramento e escala **idênticos** aos do sprite de voo existente (`<tema>_dino.default.flap.
  chromakey.png`, 2172×724 = 6 quadros de 362) — o mesmo pterodáctilo, mesma distância de câmera.
- **Não pré-rotacionar os quadros:** o jogo aplica a rotação por conta.
- Fundo **verde `#00FF00`** (é o que o sprite de voo já usa).

```
A 5-frame horizontal sprite strip, 1810x724, of the SAME photoreal pterodactyl being struck and
tumbling, side view, each frame in an identical 362x724 cell with identical framing and creature
scale: frame 1 = impact recoil (eyes shut, wings swept back, body compressed); frames 2-3 =
tumbling mid-air, wings loose; frames 4-5 = falling limp with a few feathers/membrane fragments
breaking away. The creature is NOT rotated between frames — keep it upright in each cell; only
pose and wing position change.
BACKGROUND: solid pure green #00FF00, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo> — identical species, colors and materials as the existing
pterodactyl flap sheet.
PALETTE: <colar paleta do tema>
```

---

## 8. Lote F — Folha de power-ups (3 imagens) — **OPCIONAL, prioridade 3**

A folha atual (6 peças por tema) **já está aprovada e é a referência de qualidade do projeto**.
O único motivo para refazê-la é coerência com a moeda nova do Lote D: a peça `doubleCoin` mostra
moedas do desenho antigo. **Só gerar se a moeda nova destoar de forma perceptível** — o risco de
perder qualidade nas outras 5 peças é real.

**Não dá para trocar uma peça só:** o pipeline fatia a folha como uma grade fixa **3 colunas × 2
linhas**, então refazer implica reproduzir as 6 posições na mesma ordem.

- **Dimensão exata: 1536 × 1024** (células de 512 × 512), fundo **magenta `#FF00FF`**.
- **Ordem das células, obrigatória** — linha 1: `shield` (escudo), `extraLife` (coração),
  `magnet` (ímã em ferradura); linha 2: `doubleCoin` (duas moedas), `slowMo` (ampulheta),
  e a 6ª célula é **descartada pelo pipeline** (peça extra livre, sugestão: um medalhão).
- Cada peça centralizada na sua célula, com folga, **sem encostar nas vizinhas**.

```
A 1536x1024 sheet of 6 photoreal game power-up icons arranged in a strict 3x2 grid (each icon
centered in its own 512x512 cell, generous margin, never touching a neighbour), all lit
identically, all at the same visual scale:
TOP ROW: 1) a heater shield, 2) a heart, 3) a horseshoe magnet.
BOTTOM ROW: 4) two overlapping struck coins with a pterodactyl in relief, 5) an hourglass,
6) a round medallion.
Each object rendered in the same material language so the set reads as one collection.
BACKGROUND: solid pure magenta #FF00FF, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

---

## 9. Tabela de entrega — caminho exato de cada arquivo

Salvar **exatamente** nestes caminhos (relativos à raiz do repositório). Nomes e dimensões são
contrato com o pipeline. **Todo lote se repete nos 3 temas** (`classic` / `volcano` / `glacier`).

### Lote A — parallax (12) · alpha real (ou magenta, avisando)

| # | Arquivo | Dimensão |
|---|---------|----------|
| 1–4 | `public/art/themes/classic/parallax/{far,mid,near,impact}.png` | 2048×384 / 384 / 448 / 512 |
| 5–8 | `public/art/themes/volcano/parallax/{far,mid,near,impact}.png` | idem |
| 9–12 | `public/art/themes/glacier/parallax/{far,mid,near,impact}.png` | idem |

### Lote B — tiras segmentadas (6) · **100% opacas**

| # | Arquivo | Dimensão |
|---|---------|----------|
| 13 | `public/art/themes/classic/obstacles/classic_obstacle.tree.segments.png` | 1536×512 |
| 14 | `public/art/themes/classic/obstacles/classic_obstacle.vine.segments.png` | 1536×512 |
| 15 | `public/art/themes/volcano/obstacles/volcano_obstacle.tree.segments.png` | 1536×512 |
| 16 | `public/art/themes/volcano/obstacles/volcano_obstacle.vine.segments.png` | 1536×512 |
| 17 | `public/art/themes/glacier/obstacles/glacier_obstacle.tree.segments.png` | 1536×512 |
| 18 | `public/art/themes/glacier/obstacles/glacier_obstacle.vine.segments.png` | 1536×512 |

### Lote C — obstáculos 1-sprite por tema (6) · magenta

| # | Arquivo | Dimensão |
|---|---------|----------|
| 19 | `public/art/themes/classic/obstacles/classic_obstacle.boulder.chromakey.png` | 1024×1024 |
| 20 | `public/art/themes/classic/obstacles/classic_obstacle.stalactite.chromakey.png` | 1024×1024 |
| 21 | `public/art/themes/volcano/obstacles/volcano_obstacle.boulder.chromakey.png` | 1024×1024 |
| 22 | `public/art/themes/volcano/obstacles/volcano_obstacle.stalactite.chromakey.png` | 1024×1024 |
| 23 | `public/art/themes/glacier/obstacles/glacier_obstacle.boulder.chromakey.png` | 1024×1024 |
| 24 | `public/art/themes/glacier/obstacles/glacier_obstacle.stalactite.chromakey.png` | 1024×1024 |

### Lote D — moeda coletável (3) · verde

| # | Arquivo | Dimensão |
|---|---------|----------|
| 25 | `public/art/themes/classic/collectibles/classic_bird.coin.chromakey.png` | 1024×1024 |
| 26 | `public/art/themes/volcano/collectibles/volcano_bird.coin.chromakey.png` | 1024×1024 |
| 27 | `public/art/themes/glacier/collectibles/glacier_bird.coin.chromakey.png` | 1024×1024 |

> Sobrescreve o arquivo do pássaro dourado (mesmo nome, mesmo caminho) — o pipeline não muda.

### Lote E — `dino.hit`, OPCIONAL (3) · verde

| # | Arquivo | Dimensão |
|---|---------|----------|
| 28–30 | `public/art/themes/<tema>/dinos/<tema>_dino.hit.chromakey.png` | 1810×724 |

### Lote F — folha de power-ups, OPCIONAL (3) · magenta

| # | Arquivo | Dimensão |
|---|---------|----------|
| 31–33 | `public/art/themes/<tema>/powerups/<tema>_powerups.chromakey.png` | 1536×1024 |

### Lote G — obstáculos novos do item 9.8 (12), PENDENTE · prompts em §12

| # | Arquivo | Dimensão | Regime |
|---|---------|----------|--------|
| 34–36 | `public/art/themes/<tema>/obstacles/<tema>_obstacle.spire.segments.png` | 1536×512 | opaco (tira cap/body/base) |
| 37–39 | `public/art/themes/<tema>/obstacles/<tema>_obstacle.gate.segments.png` | 1536×512 | opaco (tira cap/body/base) |
| 40–42 | `public/art/themes/<tema>/obstacles/<tema>_obstacle.rock_arch.leg.segments.png` | 1536×512 | opaco (tira cap/body/base) |
| 43–45 | `public/art/themes/<tema>/obstacles/<tema>_obstacle.rock_arch.span.chromakey.png` | 1024×1024 | magenta `#FF00FF` (1 sprite) |

### Resumo por expansão

Cada uma das 3 expansões recebe **9 arquivos obrigatórios**: 4 de parallax + 2 tiras de obstáculo
segmentado + 2 obstáculos de sprite único + 1 moeda. Total **27**. Os opcionais somam 2 por
expansão (**+6**). O **Lote G** (9.8, §12) soma **+4 arquivos por expansão** (3 tiras segmentadas +
1 sprite único) quando for gerado — não está contado nos totais acima, que descrevem o briefing
original já entregue.

### NÃO gerar (já está pronto e aprovado)

`dino.default.flap` (6 quadros) · `bg.screen.*` · capas de expansão · todo o chrome de UI (painel,
botões, 10 ícones, medalhas, barra de nav, emblema, logo) · os 11 retratos de dino do Ninho ·
`icon.*` · a folha de power-ups (a menos que o Lote F seja acionado).
Também **não** regerar `<tema>_ui-parallax.chromakey.png` nem `<tema>_obstacle.tree.chromakey.png`
— são formatos **aposentados** (o parallax virou 4 camadas alpha; a árvore virou tira segmentada).

### Lote G — obstáculos novos do item 9.8 (12), pendente · ver §12

O item 9.8 fechou no core depois deste briefing original (Lotes A–F): 3 tipos de obstáculo novos —
`obstacle.spire`, `obstacle.gate`, `obstacle.rock_arch` — com hitbox e asset-spec definidos
(`docs/assets/specs/obstacle.{spire,gate,rock_arch}.md`). Prompts e tabela de arquivos no
**§12** abaixo. Ainda **não gerado**.

---

## 10. Checklist de aceite (rodar por arquivo, antes de entregar)

- [ ] Dimensão em pixel **exatamente** a da tabela.
- [ ] Regime de fundo correto para o lote (alpha / opaco / magenta) e pixel `(0,0)` puro quando é chroma.
- [ ] Zero texto, marca d'água, moldura, borda ou elemento de UI.
- [ ] Estilo photoreal — sem contorno preto, sem cel-shading, sem visual vetorial.
- [ ] Iluminação neutra, sem luz colorida embutida nem sombra projetada.
- [ ] **Parallax:** topo transparente; sem céu; banda de conteúdo dentro do percentual; borda
      esquerda casa com a direita (testar deslocando 50%).
- [ ] **Tiras segmentadas:** 3 células iguais de 512, sem separador, opacas até os cantos; `body`
      costura na vertical; largura/tom coerentes entre as três células.
- [ ] **Boulder:** toca os 4 lados da moldura. **Estalactite:** topo na largura cheia, ápice único
      no centro inferior.
- [ ] **Moeda:** disco circular de frente, encostando nos 4 lados, simétrico, sem inclinação nem
      pilha; relevo legível a ~16 px.
- [ ] **Os 3 temas** do asset existem, e compartilham enquadramento e proporção (só material e cor
      mudam). Nenhum arquivo faltando na matriz do capítulo 9.

---

## 11. Depois da entrega — o que o repositório precisa fazer

1. `npm run gen:atlas` — reempacota os 3 atlas de entidade (`entities`, `entities.volcano`,
   `entities.glacier`).
2. `npm run gen:ui` — regera as texturas de parallax de runtime em `public/ui/`.
3. `npm test && npm run check`.
4. Marcar `placeholder`/`spec` → `art` em `docs/assets/asset-registry.md`.
5. Atualizar os asset-specs que ainda descrevem o look antigo (cartoon vetorial): `bird.coin.md`
   (vira moeda — atualizar forma, prompt e a linha de "Categoria"), `obstacle.*.md` e
   `bg.layer.*.md`. O Style Bible (`ART-DIRECTION.md`) também descreve o Tier 2 como cartoon —
   alinhar com o photoreal efetivamente adotado.

**Ajustes de código previstos (pequenos):**

- **Lote C** exige adicionar as fontes por tema em `themeSources()` de `scripts/gen-atlas.mjs` —
  hoje `obstacle.boulder`/`obstacle.stalactite` apontam para `public/art/final/` (arte única
  compartilhada). Entradas novas: `{ id: 'obstacle.boulder', root: R, file:
  'obstacles/<tema>_obstacle.boulder.chromakey.png', frames: 1, chroma: true }` e a equivalente da
  estalactite.
- **Lote A**, se vier em magenta em vez de alpha: adicionar `chroma: true` às entradas
  `parallax.*` de `UI_SOURCES` em `scripts/gen-ui.mjs` (hoje elas assumem alpha de origem).
- Se alguma dimensão do parallax mudar, recalibrar `dispHeight` em `PARALLAX_LAYERS`
  (`src/render/parallax.ts`): `dispHeight = alturaPx / (larguraPx / 1024)`.

> ⚠️ **Armadilha:** `npm run gen:parallax` e `npm run gen:obstacle-placeholder` **sobrescrevem a
> arte real com placeholder** — são os geradores provisórios. Depois que a arte entrar, não rodar
> mais; o ideal é remover os dois scripts do `package.json`.

---

## 12. Lote G — Obstáculos novos do item 9.8 (12 imagens) — addendum

O 9.8 fechou 3 tipos de obstáculo novos no core, com asset-spec própria
(`docs/assets/specs/obstacle.{spire,gate,rock_arch}.md`). Os arquivos seguem os **mesmos regimes de
fundo e as mesmas regras técnicas dos Lotes B e C** deste briefing (§1): tiras segmentadas =
**100% opacas**, sem transparência, `body` **tileável na vertical**; sprite único = fundo
**magenta `#FF00FF`** chapado. Regras gerais válidas para todos: **sem texto**, **sem sombra
projetada**, iluminação neutra, mesmo bloco de `STYLE`/`PALETTE` do §0.

| Obstáculo | Peça(s) | Forma da colisão | Formato da arte |
|---|---|---|---|
| `obstacle.spire` | 1 (flutua, sem chão/teto) | aabb estreita, altura variável 48–68 | tira segmentada (cap/body/base), como `tree`/`vine` |
| `obstacle.gate` | 2 (teto + chão, **mesma tag/asset**) | aabb, altura variável por peça e por spawn | tira segmentada única, reaproveitada nas duas orientações |
| `obstacle.rock_arch` | `leg` ×2 (espelhada) + `span` ×1 | `leg`: aabb altura variável 34–50 · `span`: aabb fixa 46×8 | `leg` = tira segmentada · `span` = 1 sprite único |

> **Por que segmentado para `spire`/`gate`/`leg` e não 1 sprite único** (mesmo raciocínio do Lote
> B): a altura sorteada varia por instância — um sprite esticado distorceria ou deixaria vazios. O
> `span` do arco tem dimensão FIXA (nunca varia entre spawns) ⇒ 1 sprite único basta, como
> `boulder`/`stalactite` do Lote C.
>
> **`obstacle.gate` é um caso especial:** as peças de teto e de chão **compartilham a mesma tag no
> core** — não há uma tira "de teto" e outra "de chão", é **uma única tira** usada nas duas
> orientações (a peça de teto usa o `cap` da tira encostado na rocha do teto e o `base` solto perto
> da fresta; a peça de chão usa o `cap` solto perto da fresta e o `base` cravado no chão). O prompt
> abaixo já pede um design plausível nas duas pontas por esse motivo (ver detalhe no asset-spec).

### `obstacle.spire.segments` — agulha rochosa/cristal flutuante

Formato idêntico ao Lote B: 1536×512, três células de 512×512, **cap | body | base**, 100% opacas,
sem separador, `body` tileável na vertical.

```
A single 1536x512 image split into three equal 512x512 cells side by side, NO gaps, NO separators,
NO transparency anywhere — every pixel opaque, content bleeding to all four edges of every cell.
This is a vertical tiling set for a narrow floating rock/crystal spire seen from the side,
orthographic, viewed straight on. It floats free in the air — it does NOT attach to any ground or
ceiling, so both ends should read as fractured/tapering rock, not roots or ceiling fusion.
CELL 1 (left) = CAP: the top tapering tip of the spire, filling the square, fractured rock texture.
CELL 2 (middle) = BODY: a repeatable mid-section of the spire, filling the full width, VERTICALLY
SEAMLESS (top edge continues bottom edge when stacked).
CELL 3 (right) = BASE: the bottom tapering tip of the spire, mirroring the fractured look of the
cap, filling the square, no cast shadow, no ground beneath it.
Consistent rock texture, color and lighting across the three cells so they read as one floating
spire when stacked.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### `obstacle.gate.segments` — pilar chão+teto que estreita a passagem

Formato idêntico ao Lote B: 1536×512, três células de 512×512, **cap | body | base**, 100% opacas,
sem separador, `body` tileável na vertical. **Mesma tira usada tanto encostada no teto quanto
encostada no chão** (ver nota acima) — as duas pontas precisam ler bem em qualquer das duas
orientações.

```
A single 1536x512 image split into three equal 512x512 cells side by side, NO gaps, NO separators,
NO transparency anywhere — every pixel opaque, content bleeding to all four edges of every cell.
This is a vertical tiling set for a rough stone-and-wood pillar segment used in a prehistoric
gateway/passage: the SAME strip is used once hanging from a cave ceiling and once rising from the
ground, so both end cells must plausibly read as either a ceiling fusion or a ground anchor without
looking wrong either way (e.g. a rough fractured rock joint at each end works for both).
CELL 1 (left) = CAP: one end of the pillar, fractured/weathered rock joint, filling the square.
CELL 2 (middle) = BODY: a repeatable pillar mid-section, filling the full width, VERTICALLY
SEAMLESS (top edge continues bottom edge when stacked).
CELL 3 (right) = BASE: the other end of the pillar, matching fractured/weathered rock joint,
filling the square, no cast shadow.
Consistent stone-and-wood texture, color and lighting across the three cells.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### `obstacle.rock_arch.leg.segments` — perna do arco de pedra

Formato idêntico ao Lote B: 1536×512, três células de 512×512, **cap | body | base**, 100% opacas,
sem separador, `body` tileável na vertical. A mesma tira é usada nas duas pernas do arco (a
esquerda é a direita espelhada pelo jogo, sem imagem duplicada).

```
A single 1536x512 image split into three equal 512x512 cells side by side, NO gaps, NO separators,
NO transparency anywhere — every pixel opaque, content bleeding to all four edges of every cell.
This is a vertical tiling set for one leg (pillar) of a prehistoric stone archway, seen from the
side, orthographic.
CELL 1 (left) = CAP: the top of the leg where it will meet the archway's horizontal span, flat
weathered rock, filling the square.
CELL 2 (middle) = BODY: a repeatable stone pillar mid-section, filling the full width, VERTICALLY
SEAMLESS (top edge continues bottom edge when stacked).
CELL 3 (right) = BASE: the foot of the leg planted in the ground, filling the square, no cast
shadow.
Consistent stone texture, color and lighting across the three cells so they read as one pillar leg
when stacked, and coherent with a matching horizontal archway span piece.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### `obstacle.rock_arch.span.chromakey` — trave/lintel do arco

Formato idêntico ao Lote C: 1024×1024, fundo magenta `#FF00FF` chapado, proporção larga e baixa
(a hitbox lógica é 46×8 unidades de mundo, razão ≈5,75:1) preenchendo a moldura sem margem interna.

```
A single horizontal stone archway lintel/span connecting two rock pillars, wide and low
proportions filling a 1024x1024 frame with generous empty magenta margin above and below (the
object itself is a thin horizontal slab, roughly 6x wider than tall), seen from the side,
orthographic, lit evenly, coherent stone texture and color with a matching pillar-leg piece.
No cast shadow.
BACKGROUND: solid pure magenta #FF00FF, perfectly flat, no gradient, no vignette, no shadow.
STYLE (locked): <colar bloco de estilo>
PALETTE: <colar paleta do tema>
```

### Tabela de entrega do Lote G

Ver tabela em §9 (linhas 34–45). Depois de gerado: rodar `npm run gen:atlas`, adicionar as fontes
por tema em `themeSources()`/`ATLAS_VARIANTS` de `scripts/gen-atlas.mjs` (modo `parts` para
`spire`/`gate`/`rock_arch.leg`; entrada simples com `chroma:true` para `rock_arch.span`), trocar as
entradas `obstacle.spire`/`obstacle.gate`/`ARCH_LEG_TAG`/`ARCH_SPAN_TAG` de `src/render/manifest.ts`
de `kind:'primitive'` para `kind:'sprite'` (`segmented:true` nas 3 primeiras), e marcar
`spec` → `art` em `docs/assets/asset-registry.md`.
