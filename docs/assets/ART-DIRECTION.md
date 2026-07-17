# Direção de Arte — JurassicRun (Style Bible)

> **Fonte única do look.** Todo asset-spec em `docs/assets/specs/*.md` referencia este arquivo.
> Gerar cada imagem em chamadas separadas de IA e ainda obter um conjunto coerente depende de
> todos os prompts partilharem os tokens abaixo. Base visual: as 6 imagens conceituais em `ref/`.

O look-alvo é **AAA fantasia sombria** — painéis de vidro escuro com moldura dourada
ornamentada, headers dourados gravados, botões de vidro azul energizado, sobre fundos pintados
de um mundo pré-histórico (jungle canyon, vulcão, geleira). O nome do jogo é **JurassicRun**
(o logo é ornamentado, mas o wordmark diz "JurassicRun" — NÃO "Ptero Ascent").

## Paleta mestra

| Papel | Cor(es) | Uso |
|-------|---------|-----|
| Fundo / atmosfera | `#0e1116` → `#1a1f2b` | Base de tela, vidro dos painéis (casa com `--color-bg`/`--color-surface`). |
| Ouro ornamental | base `#c9a227`, realce `#f2d878`, sombra `#8a6d1b` | Molduras, headers, filigrana, emblemas, ícones. |
| Azul-glow (CTA) | gradiente `#2f6fe0` → `#5aa0ff`, brilho `#bcd8ff` | Botão primário / "Novo Jogo" / "Desbloquear". |
| Texto claro | `#eef2f7` | Títulos e corpo sobre painel escuro. |
| Texto mudo | `#9aa6b6` | Descrições secundárias, legendas. |
| Âmbar de destaque | `#ffcf5c` | Valores de score, "NOVO RECORDE!", ativo. |
| Prata / bronze | prata `#c8d0d8`, bronze `#b06a2c` | Medalhas de 2º/3º lugar. |

Cores quentes de mundo (lava `#ff5a1e`, folhagem `#3a7d34`, gelo `#bfe6f2`) aparecem só nos
**fundos pintados** e capas de expansão, nunca no chrome de UI.

## Materiais

- **Vidro escuro semi-translúcido** — corpo dos painéis e cards; deixa o fundo pintado vazar sutil.
- **Metal dourado ornamentado** — molduras, divisores, headers; gravado, com realce e sombra.
- **Vidro azul energizado** — botão CTA; gradiente azul com brilho interno e borda clara.
- **Pedra / folhagem / lava / gelo pintados** — fundos de tela e capas de expansão (Tier 1).

## Tipografia

- **Display serif ornamentada** (ex.: Cinzel, Trajan, ou similar gravada) — headers de tela e o
  logo. Dourada, com bisel/gravação. **Só o logo e headers estilizados viram PNG**; os títulos
  de tela renderizados como texto ficam no CSS com fonte serif.
- **Sans limpa** — corpo, botões, listas. Fica no CSS (`--font-family`), não é asset.

## Iconografia

Ícones de UI em **linha/preenchimento dourado** (`#c9a227`/`#f2d878`) sobre vazado transparente,
estilo emblema heráldico, silhueta clara e legível a 64px. Sem cor fora da faixa dourada (o
estado ativo/hover é dado pelo CSS, não por variantes coloridas do PNG).

## Dois tiers de arte

O campo lógico de jogo é **fixo 320×180** (REGRA travada de determinismo/justiça de leaderboard).
Isso divide a produção em dois tiers:

- **Tier 1 — UI/menus + fundos de tela.** Renderizado no DOM em resolução total; NÃO passa pelo
  canvas 320×180. Pode ser AAA pintado com detalhe fino. Inclui: `logo.app`, todo `ui.*`
  (painel, botões, header, statchip, medalhas, barra de nav, ícones), `bg.screen.*`,
  `expansion.*`.
- **Tier 2 — entidades in-game.** Desenhado no canvas 320×180. Mantém o estilo cartoon/vetorial
  **legível a tamanho pequeno**: silhueta forte, contorno definido, sem detalhe pintado que suma.
  Alinha a **paleta** ao mundo novo, mas não a textura. Inclui: `dino.*`, `obstacle.*`,
  `bird.coin`, `powerup.*`. As camadas `bg.layer.*` são um caso intermediário — silhuetas de
  parallax que aceitam tint de daynight (ver o próprio spec).

> **Não copiar mecânica do concept de gameplay.** `ref/ref_GamePlay.png` mostra habilidades
> (Wind Burst/Dive Bomb/Wing Burst), minimapa, objetivos e boost/dive que **não existem** e
> violariam o design flap-only determinístico. Usar essa imagem só como referência de *look*
> (iluminação, atmosfera, molduras), nunca de mecânica. Ver
> `docs/superpowers/specs/2026-07-17-art-direction-migration-design.md`.

## Desacople (REGRA 2)

A arte **nunca** define a hitbox. As dimensões em cada spec são cosméticas; a hitbox lógica
vive no core (`src/core/`) e não muda ao trocar geométrico↔PNG. Trocar o look é editar o
manifesto de assets, não a simulação. As dimensões de spec devem ser proporcionais à hitbox,
mas a colisão sempre usa a hitbox lógica.

## Referências (`ref/`)

As 6 imagens conceituais que definem este look:

| Arquivo | Tela | O que exemplifica |
|---------|------|-------------------|
| `ref/ref_Home.png` | Home | Logo ornamentado, chip de identidade, 3 stat-chips, CTA azul-glow, grid de nav com ícones dourados, fundo jungle canyon. |
| `ref/ref_Ninho.png` | Ninho | Painel de dino ativo + bônus, grid de cards de dino com retrato, barra de nav inferior. Retratos de dino = Tier 2 em alta. |
| `ref/ref_LeaderBoard.png` | Placar | Abas, linhas rankeadas com medalhas (ouro/prata/bronze), header ornamentado. |
| `ref/ref_Expansões.png` | Expansões | 3 cards com capa pintada (clássica/vulcão/geleira), estados ATIVA/DESBLOQUEAR, nota honra. |
| `ref/ref_GameOver.png` | Game Over | Painel de stats + linha Clima + badge "NOVO RECORDE!", botões Reiniciar/Sair. |
| `ref/ref_GamePlay.png` | Gameplay | **Só look** (atmosfera/iluminação). Mecânicas mostradas são fantasia — NÃO implementar. |
