# Spec — Direção de arte AAA & migração dos concepts (Fase 8.1, parte docs)

> **Data:** 2026-07-17
> **Item de roadmap:** 8.1 (Produção de arte a partir das asset-specs) — **parte de especificação**.
> **Entrega desta spec:** documentação + catálogo de specs prontas-para-IA. **Nenhum código de
> `src/` ou `src/core/` é tocado** ⇒ determinismo 67 intacto por construção.
> **Fora desta entrega:** geração das imagens em si (feita externamente pelo usuário via IA de
> imagem, seguindo as specs), empacotamento em atlases e troca do manifesto para `sprite` (isso
> é o restante de 8.1 + 8.2, sessões futuras).

## Contexto

O usuário produziu 6 imagens conceituais AAA (em `ref/`) mostrando um look "Ptero Ascent":
painéis de vidro escuro com moldura dourada ornamentada, headers dourados, botões primários
azul-glow, fundos pintados fotorrealistas (jungle canyon / vulcão / geleira). As telas são:
Home, GamePlay, Ninho, LeaderBoard, Expansões, GameOver.

Objetivo desta spec: (1) analisar como migrar o estado atual (placeholders geométricos +
telas DOM neutras) para essa proposta, e (2) produzir specs **exatas e copiáveis** para que o
usuário gere cada asset numa IA de imagem, com resultado coerente entre si.

### Decisões de produto já tomadas (com o usuário)
1. **Nome mantido: `JurassicRun`.** O logo é desenhado no estilo ornamentado dos concepts, mas
   o wordmark diz "JurassicRun". Rebrand para "Ptero Ascent" fica como decisão futura separada
   (evita mexer em `manifest.ts`, `en.json`, `index.html`, deploy da Fase 7 agora).
2. **Entrega desta sessão:** doc de migração + catálogo de specs-IA. Sem código de render.
3. **Fundos de tela:** 1 base (`classic`) + 2 variantes (`volcano`, `glacier`) trocadas pela
   expansão ativa (reusa o seam `activeExpansion` de 4.6). Não um fundo por tela.

## Insight central: dois tiers de arte

O campo lógico de jogo é **fixo 320×180** (REGRA travada — determinismo + justiça de
leaderboard). Sprite in-game renderizado a esse tamanho não comporta detalhe pintado
fotorrealista: fica ilegível. Portanto a direção de arte tem **dois tiers**:

- **Tier 1 — UI/menus + fundos de tela.** Renderizados no DOM em resolução total (não passam
  pelo canvas 320×180). Podem ser AAA pintado: painéis, molduras douradas, botões glow, fundos
  pintados. É a maior parte da mudança visual e o "wow" dos concepts.
- **Tier 2 — entidades in-game** (dino, obstáculos, coletáveis, power-ups, camadas de parallax).
  Desenhadas no canvas 320×180. Mantêm o estilo cartoon/vetorial legível dos specs existentes,
  **realinhado à paleta e ao mundo** do novo look, mas SEM detalhe pintado que suma a tamanho
  pequeno. Silhueta forte, contorno definido, leitura instantânea em movimento.

Essa separação é a espinha dorsal do Style Bible e de cada prompt de IA.

## Artefato A — Style Bible (`docs/assets/ART-DIRECTION.md`)

Fonte única do look. Todo prompt de asset referencia estes tokens (garante coerência entre
imagens geradas em chamadas separadas). Conteúdo:

- **Paleta mestra** (extraída dos concepts):
  - Fundo/atmosfera: slate quase-preto `#0e1116` → `#1a1f2b` (casa com `--color-bg`/`--color-surface` atuais).
  - Ouro ornamental: `#c9a227` (base), `#f2d878` (realce), `#8a6d1b` (sombra) — molduras, headers, filigrana.
  - Azul-glow (botão primário/CTA): `#2f6fe0` → `#5aa0ff` gradiente, brilho `#bcd8ff`.
  - Texto: `#eef2f7` (claro), `#9aa6b6` (mudo) — batem com tokens atuais.
  - Acento de perigo/recorde: âmbar quente `#ffcf5c`.
- **Materiais:** vidro escuro semi-translúcido (painel), metal dourado ornamentado (moldura/
  divisor), vidro azul energizado (botão CTA), pedra/folhagem pintada (fundo).
- **Tipografia:** display serif ornamentada (headers de tela + logo — ex.: estilo "Cinzel"/
  "Trajan"); corpo em sans limpa (fica no CSS, não é asset). Nota: fontes reais de UI são CSS,
  não PNG — só o **logo** e headers estilizados viram arte.
- **Iconografia:** ícones de linha/preenchimento dourado sobre vazado, estilo emblema heráldico.
- **Regra dos dois tiers** (acima), explícita, com exemplos do que é Tier 1 vs Tier 2.
- **Regra de desacople (REGRA 2):** a arte NUNCA define hitbox; dimensões da spec são cosméticas,
  a hitbox lógica vive no core. Repetida aqui para quem gera arte.

## Artefato B — Migração concept → atual (este documento, seção abaixo)

### Mapa por tela

Boa notícia: a **estrutura** das telas de menu bate ~1:1 com o implementado. A migração é
majoritariamente re-skin via tokens CSS + assets de moldura/fundo, não reescrita de fluxo.

| Tela | Estrutura vs. atual | Delta de trabalho |
|------|---------------------|-------------------|
| **Home** | Idêntica: chip identidade, 3 stat-chips, CTA "Novo Jogo", grid (Diário/Semanal/Ninho · Loja/Expansões/Placar), Config, Compartilhar/Doação | Skin (tokens + `ui.panel`/`ui.button` + fundo) + `logo.app` + ícones de nav |
| **Ninho** | Idêntica: painel dino ativo + bônus, grid de cards "Comprar · N moedas", nav inferior | Skin + retrato por dino (Tier 2 upres) + `ui.nav.bar` |
| **Placar** | Idêntica: abas Infinito/Diário/Semanal, linhas com medalha, dist/comida/quase-colisões, seed | Skin + `ui.medal.*` |
| **Expansões** | Idêntica: Clássica ATIVA / Vulcão·Geleira DESBLOQUEAR, nota honra, Voltar | Skin + capas `expansion.*` |
| **Game Over** | Quase idêntica + **2 campos novos**: linha **Clima** e badge **"NOVO RECORDE!"** | Skin + 2 campos (dado já existe no core) |
| **GamePlay** | **Diverge fortemente** — ver "Rejeitado" | Só re-skin do HUD atual; NÃO adotar mecânicas novas |

### Remap de tokens CSS (skin sem reescrever componentes)

As telas DOM já usam design tokens (`src/app/styles/tokens.css`), preparados para override. A
migração ajusta os **valores** dos tokens (não os componentes) para o look novo:

| Token | Atual | Proposto (documentado; troca é item de código futuro) |
|-------|-------|-------|
| `--color-bg` | `#0e1116` | mantém (já casa) |
| `--color-surface` | `#1a1f2b` | mantém / leve ajuste p/ vidro |
| `--color-primary` | `#4ea1ff` | `#5aa0ff` (CTA azul-glow) |
| `--color-accent` | `#ffcf5c` | `#f2d878` (ouro realce) |
| (novo) `--color-gold` | — | `#c9a227` p/ bordas/headers |

> **Nota de escopo:** esta spec **documenta** o remap; aplicá-lo no CSS + inserir as imagens de
> moldura/fundo é trabalho de código de 8.2/8.3 (troca do manifesto e do tema), fora desta
> entrega docs-only.

### Game Over — 2 campos novos (registrar como backlog de UI)

O concept de Game Over mostra, além de Distância/Comida/Quase-colisões:
- **Linha "Clima"** com ícone + nome (o dado `world.weather` já existe desde 3.4; o HUD já
  traduz nomes de clima).
- **Badge "NOVO RECORDE!"** quando a partida bate o melhor score do modo (`leaderboard` já sabe
  se é recorde — comparação com `bestEndlessLevel`/top-1 do modo).

Ambos são features de UI pequenas, **não** desta entrega docs; ficam registrados no doc de
migração como itens de 8.2 (quando o Game Over for re-skinado).

### ⚠️ Rejeitado explicitamente: HUD de gameplay do concept

O concept `ref_GamePlay.png` mostra mecânicas que **não existem** e **violariam o design
travado**: barra de XP/nível de jogador, habilidades ativas (Wind Burst / Dive Bomb / Wing
Burst), minimapa, objetivos ("Collect 3 Glowing Eggs"), boost, dive attack, inventário de itens.

O jogo é **flap-only determinístico** (REGRA 1) e o leaderboard exige que todos joguem o mesmo
campo a partir de (seed, inputs). Habilidades/objetivos/boost quebrariam determinismo e justiça.

**Decisão:** essas mecânicas são **fantasia aspiracional de concept art**, registradas mas **não
implementadas**. O HUD real permanece o de 2.4 (distância, comida, fps, nível, velocidade, seed),
apenas re-skinado no estilo novo. O documento de migração deixa isso explícito para não induzir
implementação futura equivocada.

## Artefato C — Catálogo de specs prontas-para-IA

Cada asset abaixo recebe um arquivo `docs/assets/specs/<id>.md` no formato existente (Identidade
/ Especificação técnica / Direção de arte / **Prompt para geração por IA** / Checklist), com
dimensão px exata + @2x, transparência, atlas alvo, e — para molduras — **info de 9-slice**
(insets das bordas que não esticam). Todos os prompts referenciam o Style Bible.

### C.1 — Assets NOVOS (não existem hoje)

**Logo / marca**
- `logo.app` — wordmark "JurassicRun" ornamentado dourado + emblema pterodáctilo. PNG transparente.

**UI chrome (Tier 1)**
- `ui.panel.frame` — painel de vidro escuro com moldura dourada ornamentada. **9-slice** (canto
  ornamentado fixo, centro esticável). PNG transparente.
- `ui.button.primary` — botão CTA azul-glow (estado normal). 9-slice. + variante `:pressed`/`:disabled` descritas.
- `ui.button.secondary` — botão escuro com borda dourada. 9-slice.
- `ui.header.emblem` — divisor/crista de pterodáctilo dourado usado acima dos títulos de tela.
- `ui.statchip.frame` — moldura pequena dos 3 stat-chips (moedas/troféus/nível). 9-slice.
- `ui.medal.gold`, `ui.medal.silver`, `ui.medal.bronze` — medalhas rankeadas do leaderboard (láurea + nº).
- `ui.nav.bar` — barra de navegação inferior (fundo). 9-slice horizontal.
- **Ícones de nav** (linha/preenchimento dourado, transparente, quadrados): `icon.daily`,
  `icon.weekly`, `icon.nest`, `icon.shop`, `icon.expansions`, `icon.leaderboard`, `icon.settings`,
  `icon.share`, `icon.donate`, `icon.back`. (Grade única de tamanho; um atlas `ui-icons`.)

**Fundos de tela (Tier 1)**
- `bg.screen.classic` — fundo pintado base (jungle canyon com vulcão ao fundo, estilo do concept),
  usado em todos os menus por padrão. Opaco, resolução alta, seguro para overlay de painéis por cima.
- `bg.screen.volcano` — variante ardente (expansão Vulcão ativa).
- `bg.screen.glacier` — variante gélida/aurora (expansão Geleira ativa).

**Capas de expansão (Tier 1)**
- `expansion.classic`, `expansion.volcano`, `expansion.glacier` — arte de card (retângulo) para a
  tela de Expansões. (Podem reusar/croppar os `bg.screen.*`; specs próprias para clareza.)

### C.2 — Assets EXISTENTES a realinhar (24 specs)

Os 24 specs atuais (`dino.*`, `obstacle.*`, `bird.coin`, `powerup.*`, `bg.layer.*`, `pwa-icon`)
ganham, na seção "Direção de arte", uma **referência ao Style Bible** e nota de coerência com o
mundo novo (Tier 2: manter legibilidade a 320×180; alinhar paleta ao mundo pintado). Ajuste
**direcionado** (bloco de direção + paleta quando destoar), não reescrita completa. Dimensões,
hitbox e prompts técnicos permanecem — a hitbox NUNCA muda (REGRA 2).

### C.3 — Registro

Todos os ids novos entram em `docs/assets/asset-registry.md` com status `spec`, agrupados em
novas seções ("UI / chrome", "Fundos de tela") e nas seções existentes. A skill
`create-asset-spec` é o formato de referência.

## Critérios de aceite (completude — esta entrega)

- [ ] `docs/assets/ART-DIRECTION.md` (Style Bible) existe com paleta, materiais, tipografia,
      iconografia e a regra dos dois tiers.
- [ ] Este doc de migração cobre as 6 telas (mapa), o remap de tokens, os 2 campos novos de Game
      Over e a rejeição explícita do HUD-fantasia.
- [ ] Cada asset de C.1 tem um `docs/assets/specs/<id>.md` com dimensão exata, @2x, transparência,
      atlas alvo, 9-slice quando moldura, e um **prompt IA copiável** referenciando o Style Bible.
- [ ] Os 24 specs de C.2 referenciam o Style Bible na seção de direção de arte.
- [ ] `asset-registry.md` lista todos os ids novos com status `spec`.
- [ ] Consistência: nenhum prompt contradiz o Style Bible; todo id do registro tem arquivo de spec.
- [ ] `src/` e `src/core/` intocados; `npm run check` e `npm test` verdes (nada de código mudou,
      mas rodamos para provar que a suíte segue verde — evidência antes de afirmar).

## Fora de escopo (sessões futuras)

- Geração real das imagens (usuário, IA externa).
- Empacotamento em atlases + pipeline de build (8.1 restante).
- Troca do manifesto para `kind: "sprite"` + carregamento (8.2).
- Aplicação do remap de tokens no CSS e re-skin dos componentes DOM (8.2/8.3).
- Campos novos de Game Over (Clima, badge recorde) na UI (8.2).
- Rebrand "Ptero Ascent" (decisão de produto futura).
- Gateway de pagamento real (8.4).
