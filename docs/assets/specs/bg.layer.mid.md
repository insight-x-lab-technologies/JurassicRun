# Asset Spec — bg.layer.mid

## Identidade
- **id:** `bg.layer.mid`
- **Categoria:** fundo (parallax, camada média) — 2ª de 4 (Fase 9.1: far/mid/near/impact)
- **Substituiu o placeholder geométrico:** linha de triângulos (colinas) verde poeirento
  `0x4f7a5a`, tile 120×180, pico 35px, base a 18px do fundo, `scrollFactor 0.4`.
- **Status atual:** **placeholder alpha** (silhueta translúcida gerada proceduralmente por
  `scripts/gen-atlas.mjs` `renderPlaceholder`), aguardando a arte real do usuário em
  `public/art/themes/<tema>/parallax/mid.png`.

## Variantes (trocadas pelo tema/pack ativo)
| Arquivo-fonte | Tema | Saída runtime |
|---|---|---|
| `public/art/themes/classic/parallax/mid.png` | Clássica | `public/ui/parallax.mid.classic.png` |
| `public/art/themes/volcano/parallax/mid.png` | Vulcão | `public/ui/parallax.mid.volcano.png` |
| `public/art/themes/glacier/parallax/mid.png` | Geleira | `public/ui/parallax.mid.glacier.png` |

`LookPack.parallaxTextures[1]` aponta para a saída do tema ativo (`src/render/packs.ts`).

## Especificação técnica (modelo alpha, 4 camadas — Fase 9.1)
- **Dimensão-fonte alvo:** 2048 × 384 px.
- **Tileável na horizontal** (borda esquerda casa com a direita) — seamless left↔right.
- **Topo transparente**; o corpo (colinas/formações rochosas médias) fica ancorado na parte de
  baixo — deixa `bg.layer.far` e o `bg.screen` visíveis por cima.
- **Sem céu opaco embutido.**
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via `tilePositionX`, `scrollFactor 0.35`).
- **Formato de exportação:** PNG com alpha real (não chroma-key — ver nota em `bg.layer.far.md`).
- **Runtime:** servida direto de `public/ui/` (sem atlas empacotado).

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Camada de parallax
> in-game (Tier 1.5): silhueta neutra que aceita o tint de daynight; alinhar ao mundo pintado sem
> cor saturada que brigue com o tint.
- **Estilo:** silhueta/recorte por plano, contraste médio (mais perto que `far`); vista lateral 2D
  plana; iluminação neutra (sem gradiente de céu).
- **Coerência:** entre `bg.layer.far` (atrás) e `bg.layer.near`/`impact` (à frente).

## Prompt para geração por IA
```
Seamless horizontal parallax layer, mid-distance rolling hills and rock formations, transparent
background, transparent upper area, content anchored to the bottom, tileable left-right, flat 2D
side-scroller art, neutral lighting, no sky, no text. PALETTE: <tokens do tema>.
```

**PALETTE por tema:**
- **classic:** jungle canyon at golden hour, warm greens #3a7d34, olive, warm brown rock, hazy
  amber horizon.
- **volcano:** volcanic wasteland, dark basalt greys, ember orange #ff5a1e glow, ash haze,
  red-black rock.
- **glacier:** frozen tundra, pale ice blue #bfe6f2, white snow, cold grey rock, aurora teal glow.

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura visível durante o scroll.
- [ ] Topo transparente; conteúdo ancorado na base.
- [ ] As 3 variantes de tema (classic/volcano/glacier) presentes e coerentes com a paleta.
- [ ] 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite) por cima do tema/pack ativo. Evite cores saturadas embutidas que
briguem com o tint.
