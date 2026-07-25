# Asset Spec — bg.layer.far

## Identidade
- **id:** `bg.layer.far`
- **Categoria:** fundo (parallax, camada distante) — 1ª de 4 (Fase 9.1: far/mid/near/impact)
- **Substituiu o placeholder geométrico:** linha de triângulos (cordilheira) azul-acinzentada
  `0x6b7a8f`, tile 160×180, pico 55px, base a 40px do fundo, `scrollFactor 0.2`.
- **Status atual:** **placeholder alpha** (silhueta translúcida gerada proceduralmente por
  `scripts/gen-atlas.mjs` `renderPlaceholder`), aguardando a arte real do usuário em
  `public/art/themes/<tema>/parallax/far.png`.

## Variantes (trocadas pelo tema/pack ativo)
Como as outras camadas Tier 2 realistas (2026-07-21), a arte é **por tema** — 3 arquivos-fonte,
1 asset conceitual:

| Arquivo-fonte | Tema | Saída runtime |
|---|---|---|
| `public/art/themes/classic/parallax/far.png` | Clássica (jungle canyon, hora dourada) | `public/ui/parallax.far.classic.png` |
| `public/art/themes/volcano/parallax/far.png` | Vulcão | `public/ui/parallax.far.volcano.png` |
| `public/art/themes/glacier/parallax/far.png` | Geleira | `public/ui/parallax.far.glacier.png` |

`LookPack.parallaxTextures[0]` aponta para a saída do tema ativo (`src/render/packs.ts`).

## Especificação técnica (modelo alpha, 4 camadas — Fase 9.1)
- **Dimensão-fonte alvo:** 2048 × 384 px.
- **Tileável na horizontal** (borda esquerda casa com a direita) — **crítico**: é a única camada
  atrás de tudo, qualquer costura fica muito visível no scroll infinito.
- **Topo 100% transparente**; a silhueta da cordilheira/horizonte ocupa só a metade inferior —
  o `bg.screen` (backdrop de tela cheia) **vaza** pelo topo transparente.
- **Sem céu opaco embutido** (o céu é o backdrop, não esta camada).
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), tile ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via `tilePositionX`, `scrollFactor 0.15`).
- **Formato de exportação:** PNG com alpha real (não chroma-key — ver nota abaixo).
- **Runtime:** carregada direto como `Image`/`TileSprite` (não vai em atlas empacotado; a saída de
  `gen-ui.mjs` já é o PNG final servido de `public/ui/`).

> **Nota — alpha real, não chroma:** ao contrário das entidades in-game (2026-07-21, chroma-key
> magenta/verde), as camadas de parallax devem ter **canal alpha nativo** no PNG-fonte (o pipeline
> de `gen-ui.mjs` para esta lista de fontes NÃO aplica chroma/hardAlpha/padBottomTo — só trim de
> conteúdo + downscale, preservando o alpha do arquivo).

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Camada de parallax
> in-game (Tier 1.5): silhueta neutra que aceita o tint de daynight; alinhar ao mundo pintado sem
> cor saturada que brigue com o tint.
- **Estilo:** silhueta/recorte por plano, baixo contraste (sensação de distância); vista lateral
  2D plana (sem perspectiva forte); iluminação neutra (aceita tint de daynight por cima, sem
  gradiente de céu embutido).
- **Coerência:** camada mais distante das 4; fica atrás de `bg.layer.mid`/`near`/`impact` e do
  mundo jogável.

## Prompt para geração por IA
```
Seamless horizontal side-scrolling parallax layer, distant mountain range silhouette on a fully
transparent background, only the lower half contains the mountain ridge, upper half completely
transparent (no sky), tileable left to right edges matching, flat 2D game art, neutral even
lighting, no text, no characters. PALETTE: <tokens do tema>.
```

**PALETTE por tema:**
- **classic:** jungle canyon at golden hour, warm greens #3a7d34, olive, warm brown rock, hazy
  amber horizon.
- **volcano:** volcanic wasteland, dark basalt greys, ember orange #ff5a1e glow, ash haze,
  red-black rock.
- **glacier:** frozen tundra, pale ice blue #bfe6f2, white snow, cold grey rock, aurora teal glow.

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura visível durante o scroll.
- [ ] Topo transparente (o backdrop `bg.screen` vaza por cima da silhueta).
- [ ] As 3 variantes de tema (classic/volcano/glacier) presentes e coerentes com a paleta.
- [ ] 60fps preservado (camada estática só ajusta `tilePositionX`, sem alocação por frame).
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Tempo do dia (3.3)

Esta camada é tingida por horário (`parallaxTint` das paletas em `src/render/daynight.ts`:
manhã/tarde/entardecer/noite) **por cima** do tema/pack ativo — os dois eixos (pack e daynight)
são ortogonais (`src/render/packs.ts`). A arte deve funcionar como silhueta neutra que aceita
tint multiplicativo; evite cores saturadas embutidas que briguem com o tint.
