# Asset Spec — bg.screen

## Identidade
- **id (base):** `bg.screen` — cobre `bg.screen.classic`, `bg.screen.volcano`, `bg.screen.glacier`
- **Categoria:** UI / fundo de tela (Tier 1)
- **Substitui o placeholder:** `background: var(--color-bg)` sólido das telas de menu.

## Variantes (trocadas pela expansão ativa)

O fundo dos menus segue a **expansão ativa** (seam `activeExpansion` de 4.6,
`src/services/entitlements`). `classic` é o default (expansão Clássica).

| id | Tema | Referência |
|----|------|-----------|
| `bg.screen.classic` | jungle canyon + vulcão distante, cachoeiras, luz diurna | `ref/ref_Home.png` |
| `bg.screen.volcano` | terras ardentes, lava, céu de cinzas | `ref/ref_Expansões.png` (card Vulcão) |
| `bg.screen.glacier` | penhascos de gelo, aurora, lago congelado | `ref/ref_Expansões.png` (card Geleira) |

## Especificação técnica
- **Dimensões alvo (px):** 1920 × 1080 (@1x; paisagem). A UI escala por cima; retrato faz
  `cover`/crop central. PNG **opaco** (é a camada de fundo).
- **Pivô / âncora:** cobre a viewport (`background-size: cover`, centro).
- **Hitbox lógica associada:** nenhuma.
- **Animação:** nenhuma (estático; parallax/vinheta é CSS opcional).
- **Atlas de destino:** nenhum — carregado como imagem de fundo cheia, não vai em atlas.
- **Formato de exportação:** PNG (ou JPG/WebP de alta qualidade; sem alpha).
- **Margens/padding seguros:** manter o terço central com **baixo contraste** para os painéis de
  UI (por cima) ficarem legíveis. Detalhe/foco nas laterais.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** pintura AAA fotorrealista-estilizada do mundo pré-histórico; profundidade
  atmosférica; um pterodáctilo pousado numa das laterais é opcional (como nos concepts).
- **Regra crítica:** **contraste central baixo** — os painéis de vidro escuro precisam de fundo
  não-ocupado no meio. Evitar elementos claros/ocupados no centro.
- **Coerência:** as 3 variantes compartilham enquadramento e nível de detalhe; só o bioma muda.

## Prompt para geração por IA
- **classic:** "Wide cinematic painted background of a prehistoric jungle canyon with distant
  volcano and waterfalls under daytime light, dark fantasy AAA game menu backdrop, atmospheric
  depth, low-contrast uncluttered center (space for UI panels), rich detail on the sides,
  landscape 16:9, no text, no UI."
- **volcano:** mesma composição, bioma de terras ardentes com lava e céu de cinzas.
- **glacier:** mesma composição, penhascos de gelo com aurora boreal e lago congelado.

## Checklist de aceite
- [ ] Paisagem 16:9, opaco; terço central de baixo contraste (UI legível por cima).
- [ ] As 3 variantes coerentes em enquadramento/estilo; só o bioma difere.
- [ ] Coerente com o Style Bible; os 3 ids no `asset-registry.md` = `spec`.
