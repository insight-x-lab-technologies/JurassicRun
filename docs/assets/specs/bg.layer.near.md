# Asset Spec — bg.layer.near

## Identidade
- **id:** `bg.layer.near`
- **Categoria:** fundo (parallax, camada próxima) — 3ª de 4 (Fase 9.1: far/mid/near/impact)
- **Substituiu o placeholder geométrico:** linha de triângulos estreitos (samambaias/vegetação)
  verde escuro `0x2f5233`, tile 64×180, pico 50px, base a 6px do fundo, `scrollFactor 0.7`.
- **Status atual:** **placeholder alpha** (silhueta translúcida gerada proceduralmente por
  `scripts/gen-atlas.mjs` `renderPlaceholder`), aguardando a arte real do usuário em
  `public/art/themes/<tema>/parallax/near.png`.

## Variantes (trocadas pelo tema/pack ativo)
| Arquivo-fonte | Tema | Saída runtime |
|---|---|---|
| `public/art/themes/classic/parallax/near.png` | Clássica | `public/ui/parallax.near.classic.png` |
| `public/art/themes/volcano/parallax/near.png` | Vulcão | `public/ui/parallax.near.volcano.png` |
| `public/art/themes/glacier/parallax/near.png` | Geleira | `public/ui/parallax.near.glacier.png` |

`LookPack.parallaxTextures[2]` aponta para a saída do tema ativo (`src/render/packs.ts`).

## Especificação técnica (modelo alpha, 4 camadas — Fase 9.1)
- **Dimensão-fonte alvo:** 2048 × 448 px.
- **Tileável na horizontal** (borda esquerda casa com a direita) — seamless left↔right.
- **Topo transparente**; vegetação/relevo próximo com **base cheia** (nasce da parte de baixo do
  frame) — deixa as camadas de trás (`mid`/`far`/`bg.screen`) visíveis por cima.
- **Sem céu opaco embutido.**
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via `tilePositionX`, `scrollFactor 0.6`).
- **Formato de exportação:** PNG com alpha real (não chroma-key — ver nota em `bg.layer.far.md`).
- **Runtime:** servida direto de `public/ui/` (sem atlas empacotado).

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Camada de parallax
> in-game (Tier 1.5): silhueta neutra que aceita o tint de daynight; alinhar ao mundo pintado sem
> cor saturada que brigue com o tint.
- **Estilo:** silhueta/recorte por plano, forte legibilidade, maior contraste (camada mais
  próxima das 3 de fundo); vista lateral 2D plana; iluminação neutra.
- **Coerência:** entre `bg.layer.mid` (atrás) e `bg.layer.impact` (à frente, mais perto ainda);
  fica atrás da faixa de chão e do mundo jogável.

## Prompt para geração por IA
```
Seamless horizontal parallax layer, near foreground terrain with dense vegetation/foliage rising
from the bottom edge, transparent background and transparent top, tileable left-right, flat 2D
game art, strong readable silhouette, no sky, no text. PALETTE: <tokens do tema>.
```

**PALETTE por tema:**
- **classic:** jungle canyon at golden hour, warm greens #3a7d34, olive, warm brown rock, hazy
  amber horizon.
- **volcano:** volcanic wasteland, dark basalt greys, ember orange #ff5a1e glow, ash haze,
  red-black rock.
- **glacier:** frozen tundra, pale ice blue #bfe6f2, white snow, cold grey rock, aurora teal glow.

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura visível durante o scroll.
- [ ] Topo transparente; base cheia (nasce do rodapé do frame).
- [ ] As 3 variantes de tema (classic/volcano/glacier) presentes e coerentes com a paleta.
- [ ] 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite) por cima do tema/pack ativo. Evite cores saturadas embutidas que
briguem com o tint.
