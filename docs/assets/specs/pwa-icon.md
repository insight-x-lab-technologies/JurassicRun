# Asset Spec — pwa-icon

## Identidade
- **id:** `pwa-icon`
- **Categoria:** ui | logo (ícone de instalação/PWA — home screen, splash, tab)
- **Substitui o placeholder geométrico:** fundo sólido `#0e1116` (`--color-bg`) + triângulo
  apontando para a direita na cor `#4ea1ff` (`--color-primary`), ecoando o dino cosmético
  triangular usado no render de jogo (`GameScene`). Gerado por `scripts/gen-icons.mjs`
  (encoder PNG puro via `node:zlib`, sem dependência de imagem).

## Especificação técnica
- **Dimensões alvo (px):** 3 tamanhos, todos quadrados:
  - `icon-192.png` — 192×192 (`sizes: 192x192`, `purpose: any`)
  - `icon-512.png` — 512×512 (`sizes: 512x512`, `purpose: any`)
  - `icon-maskable-512.png` — 512×512 (`sizes: 512x512`, `purpose: maskable`)
- **Pivô / âncora:** centro do canvas quadrado (ícone de app, sem hitbox de jogo associada).
- **Hitbox lógica associada:** nenhuma — é um asset de shell/OS (home screen, splash, tab),
  não uma entidade renderizada pelo `GameScene`/manifesto de assets do core.
- **Animação:** nenhuma (estático).
- **Atlas de destino:** nenhum — servido solto em `public/icons/*.png`, referenciado pelo
  `manifest.webmanifest` (via `src/pwa/manifest.ts` → `pwaOptions.manifest.icons`) e por
  `<link rel="icon">`/`<link rel="apple-touch-icon">` em `index.html`.
- **Formato de exportação:** PNG RGBA (8-bit, sem paleta), fundo OPACO (não transparente —
  ícones de instalação/splash não devem vazar o fundo do SO).
- **Margens/padding seguros:** inset de 14% em `icon-192`/`icon-512` (`purpose: any`); inset
  de 24% em `icon-maskable-512` (**safe-zone ~76% central**, conforme a spec de maskable icons
  — o SO pode aplicar máscaras circulares/squircle/etc. que cortam a borda).

## Direção de arte
- **Estilo:** cartoon vetorial chapado, silhueta única, sem contorno/sombreamento — molde do
  placeholder geométrico do resto do jogo (Fases 1–7, `ASSET_MANIFEST` de `src/render/manifest.ts`).
- **Paleta:** fundo `#0e1116` (`--color-bg`); silhueta `#4ea1ff` (`--color-primary`) no
  placeholder atual — a arte real pode variar dentro da paleta do jogo.
- **Iluminação/ângulo:** nenhuma (silhueta plana, sem luz/sombra).
- **Coerência:** deve remeter ao pterodáctilo protagonista (mesmo conceito visual do dino
  cosmético em `GameScene` e do roster do Ninho em `docs/assets/specs/dino.*.md`).

## Prompt para geração por IA
> "App icon of a stylized pterodactyl silhouette in flight, side or 3/4 view, flat cartoon
> vector style, bold single-color silhouette, solid dark background (#0e1116), centered with
> generous padding for a maskable safe zone, no text, no gradient, no drop shadow, square
> composition, simple and recognizable at small sizes (192px)."

## Checklist de aceite
- [ ] Fundo OPACO (não transparente), recortado corretamente nos 3 tamanhos.
- [ ] Silhueta de pterodáctilo centrada; proporções coerentes nos 3 tamanhos.
- [ ] `icon-maskable-512.png` respeita a safe-zone de ~76% central (conteúdo relevante não
      cortado por máscaras circulares/squircle do SO).
- [ ] Arquivos substituem `public/icons/icon-192.png`, `public/icons/icon-512.png` e
      `public/icons/icon-maskable-512.png` (mesmos nomes/dimensões — `src/pwa/manifest.ts` e
      `index.html` NÃO mudam; troca é só nos arquivos).
- [ ] Entrada no `asset-registry.md` atualizada para `art`.

## Nota de fase
Placeholder atual (triângulo geométrico) gerado programaticamente por
`scripts/gen-icons.mjs` — sem custo, sem dependência de artista, cobre a REGRA 5
("toda imagem trocável precisa de spec") desde a Fase 7 (PWA). A arte real (PNG AAA,
silhueta de pterodáctilo desenhada) entra na **Fase 8** (arte/expansões), substituindo os 3
arquivos em `public/icons/` **sem tocar código** — `manifest.ts`/`index.html` já apontam para
esses caminhos fixos.
