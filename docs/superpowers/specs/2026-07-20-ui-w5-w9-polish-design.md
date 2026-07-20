# Design — Redesign de UI, rodada 2 (W5–W9)

> Continuação de W1→W4. Origem: revisão do usuário sobre `ref/print_*.png` (desktop widescreen
> 1366×768 e mobile). `src/core/` **intocado** em todas as frentes ⇒ determinismo **67**.

## Contexto e achados de investigação

Antes de especificar, três coisas foram verificadas empiricamente no build de produção:

1. **`ref/print_GamePlay.png` é build velho em cache.** Mostra HUD monospace in-canvas e
   entidades/parallax **geométricos**. No build atual, `performance.getEntriesByType('resource')`
   confirma `atlas/entities.png`, `atlas/entities.json` e `ui/parallax.{far,mid,near}.png`
   carregando, e o HUD vive em DOM desde W4. Gotcha recorrente do service worker (ver W1/8.3).
   ⇒ Parte da "qualidade ruim" percebida era placeholder antigo. O resto é real e é o item 4.1.

2. **Causa raiz de 4.1 (resolução).** Medido em runtime a 1366×768:
   `canvas.width/height = 320×180` (backing store) contra `1365×768` de CSS ⇒ **upscale 4,27×**.
   O jogo desenha num framebuffer de 320×180 px reais e o browser estica. Nenhuma arte sobrevive
   a isso. Não é o atlas: os frames têm até 128 px de fonte para entidades exibidas a ~10–30
   unidades de mundo — há resolução de sobra sendo jogada fora.

3. **Causa raiz do Ninho mobile (item mobile 2.1).** Não é "dino faltando": o retrato usa
   `object-fit: cover` com `height: 8rem`; no card full-width do mobile (1 coluna) o cover corta
   e dá zoom na ponta da asa. É crop, não falha de carregamento.

## Decisões de produto

- **D1 — Unidades de mundo continuam 320×180.** Regra travada (determinismo + justiça de
  leaderboard: todo mundo joga o mesmo campo). A resolução de render passa a ser um eixo
  **independente** das unidades de simulação.
- **D2 — Fonte de identidade configurável.** Decisão do usuário: as **3** famílias entram no
  seletor (Cinzel padrão, Marcellus, Exo 2) + **Sistema** como fallback leve. Afeta **toda a UI**
  (títulos, botões, corpo). Self-hosted, licença OFL, subset latino — o jogo tem que funcionar
  offline (sem CDN, REGRA de custo zero).
- **D3 — Fonte de gameplay não muda.** O HUD in-game é DOM (W4) e herda o token; nada de fonte
  dentro do canvas.

## W5 — Resolução de render (item 4.1, prioridade máxima)

### Modelo

Separar **unidade de mundo** (simulação, 320×180, travada) de **pixel de render**:

```
render_px = world_unit × RENDER_SCALE
```

`RENDER_SCALE = 6` ⇒ canvas de **1920×1080** com `Scale.FIT`. Cobre 1080p nativo, faz downscale
(nítido) em mobile e upscale suave só acima de 1080p. Simulação, câmera lógica, hitboxes,
culling e `WorldState` seguem em unidades de mundo — **nada** em `src/core/` muda.

### Mecanismo: multiplicação explícita, NÃO `camera.setZoom`

`setZoom(S)` seria uma linha, mas o Phaser aplica o zoom **também** a objetos `scrollFactor(0)`,
escalando-os em torno do centro da câmera: um objeto em world x renderiza em
`(x − centerX)·S + centerX`, que só coincide com `x·S` quando `S = 1`. Como a câmera scrolla em
x, parallax, faixas de chão/teto e overlays sairiam do lugar. Portanto:

- helper puro `toRenderPx(worldValue)` (testável, sem Phaser);
- `GameScene` multiplica por `RENDER_SCALE` ao **escrever** posições/tamanhos em objetos Phaser:
  posição e `displaySize` do dino e dos sprites do pool, `camera.scrollX`, `tileSprite` do
  parallax, `bandsGfx`, retângulos de pausa/game-over;
- **culling continua em unidades de mundo** (compara com `VIEW_WIDTH`), antes da escala;
- REGRA 3 preservada: só multiplicação escalar no hot path, zero alocação nova.

### Resolução de origem da arte

Com S=6 o alvo de pixels sobe; as fontes já existem:

- `scripts/gen-atlas.mjs`: `CELL_MAX` 128 → **256** (entidades exibidas a ~10–30 unidades ⇒ até
  ~180 px de tela).
- `scripts/gen-ui.mjs`: parallax `maxDim` 720 → **1920** (a fonte `bg.layers.png` tem 2172 px de
  largura; 320 unidades × 6 = 1920 px de tela).

Custo: atlas e tiras de parallax mais pesados no precache do service worker (hoje ~7,7 MB). A
compressão dos PNGs (filtragem de scanline no `encodePng`) já está no backlog e vira item
próprio — **não** bloqueia W5.

### Critério de aceite

- `canvas.width/height` = 1920×1080 em desktop; upscale ≤ 1,0× em 1080p (era 4,27× a 1366×768).
- Screenshot de gameplay legível: bordas de sprite sem escada, texto DOM inalterado.
- fps mantido: p50 ≈ 16,7 ms, 0 frames > 50 ms (mesmo protocolo de 2.7/8.1).
- Suíte verde, determinismo 67, `src/core/` intocado.

## W6 — Tipografia e fonte configurável (itens 1.6, 2.4, e base de 1.1/2.2/3.1)

- 3 famílias OFL self-hosted em `public/fonts/` (subset latino, `woff2`, `font-display: swap`),
  + Sistema. Tokens `--font-display` / `--font-body` em `tokens.css`.
- `SettingsService` ganha `fontFamily` (molde exato de `language`, 4.8): sinal reativo,
  persistido em `jurassicrun.settings.v1`, saneado por campo, troca **ao vivo** (aplica no
  `:root` antes de comitar o sinal).
- `SettingsScreen` ganha o seletor. Chaves i18n `settings.font` + nomes das opções nos 10
  locales (REGRA 4). Nomes de família são nomes próprios ⇒ allowlist justificada.
- **Redução do corpo dos botões** (itens 1.1, 2.2, 3.1) entra aqui: escala tipográfica dos
  botões ajustada para rótulo em **uma linha** nos 10 idiomas (o alemão é o pior caso e já foi
  medido em rodadas anteriores — validar a 360 px).

## W7 — Layout desktop widescreen (itens 1.x, 2.x, 3.x)

**Home:** logo **+100%**; chips de identidade/moedas/troféus/nível máx **no topo, em linha**;
botões com **altura uniforme** (grid com linhas iguais), corpo menor, **ícone alinhado à
esquerda** dentro do botão (rótulo centrado ou à esquerda, decidido pela leitura do conceito).

**Ninho:** título maior; grade de **5 colunas** em widescreen (degradando 4→3→2 conforme a
largura); rótulos de botão em uma linha.

**Rodapé/NavBar:** itens **distribuídos uniformemente** (hoje ícones de rótulo curto se
agrupam), corpo menor com **duas linhas permitidas** para nomes longos, e **delimitador
vertical** entre os itens.

**Demais telas** (Configurações, Expansões, Troféus): títulos maiores, botões em uma linha,
**imagem da expansão maior** para valorizá-la.

## W8 — Leaderboard e Perfil (itens 5.1, 6.1)

- **Leaderboard:** sair do "monte de texto" para linhas estruturadas — colunas alinhadas
  (posição/medalha · jogador · score · detalhe), zebra, destaque do "você", selo ✓ de verificado
  legível, cabeçalho de coluna. Sem mudar a fonte de dados nem a ordenação.
- **Perfil:** repaginação completa em **duas colunas** (identidade/avatar/estado online de um
  lado; ações de perfil e agregados do outro). Conteúdo já existe nos serviços; é apresentação.

## W9 — Mobile (itens mobile 1.x, 2.x)

- **Home:** perfil + moedas + troféus + nível máx **na mesma linha** (chips compactos,
  rolagem horizontal só se estourar); botões **menores** e sem quebra de linha; logo maior.
- **Ninho:** corrigir o crop — retrato passa a `object-fit: contain` numa caixa de
  `aspect-ratio` fixa (ou `cover` com `object-position` calibrado), e a grade vai a **2 colunas**
  em mobile. Critério: o dino inteiro é reconhecível no card.

## Fora de escopo (backlog)

Compressão dos PNGs de `public/ui/`; mover arte-fonte para fora de `publicDir`; personagem
pterodáctilo nas telas e transições; skin de dino in-game; ícones dourados de stat no Game Over.
