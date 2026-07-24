# Asset Spec — bg.layer.impact

## Identidade
- **id:** `bg.layer.impact`
- **Categoria:** fundo (parallax, camada de objetos de destaque em 1º plano) — 4ª/nova camada
  (Fase 9.1: far/mid/near/**impact**).
- **Novo asset** (não substitui placeholder geométrico anterior — 9.1 introduz a 4ª camada).
- **Status atual:** **placeholder alpha** (silhueta esparsa translúcida gerada
  proceduralmente por `scripts/gen-atlas.mjs` `renderPlaceholder`), aguardando a arte real do
  usuário em `public/art/themes/<tema>/parallax/impact.png`.

## Papel na composição
`bg.layer.impact` é a camada de parallax **mais rápida das 4 de fundo** (`scrollFactor 0.85`,
entre `bg.layer.near` 0.6 e o mundo jogável em `scrollFactor 1`) — objetos grandes e esparsos
(troncos, folhas grandes, pedras) que cruzam o campo de visão mais rápido que o resto do fundo,
reforçando a sensação de profundidade/velocidade. **Continua sendo uma camada de FUNDO**
(depth negativo, atrás do mundo/entidades jogáveis) — decisão de produto do design da feature:
não interfere na justiça de leaderboard (não é hitbox, não oclui entidades relevantes ao
gameplay), só no *feel* visual.

## Variantes (trocadas pelo tema/pack ativo)
| Arquivo-fonte | Tema | Saída runtime |
|---|---|---|
| `public/art/themes/classic/parallax/impact.png` | Clássica | `public/ui/parallax.impact.classic.png` |
| `public/art/themes/volcano/parallax/impact.png` | Vulcão | `public/ui/parallax.impact.volcano.png` |
| `public/art/themes/glacier/parallax/impact.png` | Geleira | `public/ui/parallax.impact.glacier.png` |

`LookPack.parallaxTextures[3]` aponta para a saída do tema ativo (`src/render/packs.ts`).

## Especificação técnica (modelo alpha, 4 camadas — Fase 9.1)
- **Dimensão-fonte alvo:** 2048 × 512 px.
- **Tileável na horizontal** (borda esquerda casa com a direita) — seamless left↔right.
- **~70% transparente** — ao contrário de `far`/`mid`/`near` (silhueta contínua ancorada numa
  borda), `impact` é **esparsa**: só alguns objetos de destaque espalhados pelo canvas, sem linha
  de chão nem silhueta contínua.
- **Sem céu opaco embutido, sem linha de chão.**
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide (não confundir com
  os obstáculos reais do `src/core/spawn`, que têm hitbox própria).
- **Animação:** nenhuma (estático; rola via `tilePositionX`, `scrollFactor 0.85`).
- **Formato de exportação:** PNG com alpha real (não chroma-key — ver nota em `bg.layer.far.md`).
- **Runtime:** servida direto de `public/ui/` (sem atlas empacotado).

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Camada de parallax
> in-game (Tier 1.5): silhueta neutra que aceita o tint de daynight; alinhar ao mundo pintado sem
> cor saturada que brigue com o tint.
- **Estilo:** poucos elementos grandes e esparsos (troncos, folhas grandes, cipós pendentes,
  pedras) com **alto contraste de silhueta**, distribuídos com bastante vazio entre eles (~70%
  transparente); vista lateral 2D plana; iluminação neutra.
- **Coerência:** camada mais próxima das 4 de fundo; fica à frente de `bg.layer.near` e atrás do
  mundo jogável (dino/obstáculos/coletáveis).

## Prompt para geração por IA
```
Seamless horizontal foreground overlay layer, a few large sparse foreground elements (big leaves,
tree trunks, hanging vines, rocks) spread across a mostly transparent canvas (about 70% empty),
tileable left-right, flat 2D side-scroller art, high contrast silhouette, no sky, no ground line,
no text. PALETTE: <tokens do tema>.
```

**PALETTE por tema:**
- **classic:** jungle canyon at golden hour, warm greens #3a7d34, olive, warm brown rock, hazy
  amber horizon.
- **volcano:** volcanic wasteland, dark basalt greys, ember orange #ff5a1e glow, ash haze,
  red-black rock.
- **glacier:** frozen tundra, pale ice blue #bfe6f2, white snow, cold grey rock, aurora teal glow.

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura visível durante o scroll.
- [ ] ~70% transparente; sem linha de chão nem silhueta contínua (objetos esparsos).
- [ ] As 3 variantes de tema (classic/volcano/glacier) presentes e coerentes com a paleta.
- [ ] Continua atrás do mundo jogável (depth de fundo, não interfere em hitbox/colisão).
- [ ] 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite) por cima do tema/pack ativo. Evite cores saturadas embutidas que
briguem com o tint.
