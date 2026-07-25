# Asset Spec — dino.hit (FUTURO / opcional)

> Frames de **morte** do pterodáctilo (impacto → giro → queda). A animação de morte do item 9.3
> já está no jogo e é **procedural** (giro, queda em arco, flash de impacto, partículas e
> screen-shake calculados no render sobre o frame de flap congelado). Estes frames são o **upgrade
> de arte**: quando existirem, substituem o frame congelado sem mudar a lógica da animação.

## Identidade
- **id:** `dino.hit`
- **Categoria:** personagem (animação de estado)
- **Substitui:** o frame de flap congelado usado hoje durante a fase cosmética `dying`.

## Especificação técnica
- **Fonte:** `public/art/themes/<tema>/dinos/<tema>_dino.hit.chromakey.png` (tira horizontal 1×5),
  um arquivo por tema (`classic` / `volcano` / `glacier`).
- **Dimensões alvo (px):** mesma moldura por frame de `dino.default.flap` (enquadramento e escala
  idênticos ⇒ nenhum "pulo" ao trocar do flap para o hit).
- **Pivô / âncora:** centro do corpo — o mesmo do `dino.default` (o render aplica rotação própria
  em torno do centro; os frames NÃO devem já vir rotacionados).
- **Hitbox lógica associada:** nenhuma mudança. A colisão já ocorreu; a arte é puramente cosmética
  (REGRA 2).
- **Animação:** `hit` — 5 frames, ~7 fps, **sem repeat** (a fase `dying` dura 0,75 s).
- **Atlas de destino:** `entities` (+ variantes `entities.volcano` / `entities.glacier`), via
  `scripts/gen-atlas.mjs`.
- **Formato de exportação:** PNG, chroma-key como as demais fontes por tema.

## Como entra no jogo (quando a arte existir)
1. Salvar a tira em `public/art/themes/<tema>/dinos/<tema>_dino.hit.chromakey.png`.
2. Em `scripts/gen-atlas.mjs`, adicionar em `themeSources`:
   `{ id: 'dino.hit', root: R, file: 'dinos/<tema>_dino.hit.chromakey.png', frames: 5, chroma: true }`.
3. `npm run gen:atlas` (gera os 3 atlas com os frames `dino.hit.0..4`).
4. Em `GameScene`, criar a anim `dino.hit.<atlasKey>` (`repeat: 0`) e tocá-la na transição para
   `dead` no lugar do `dinoSprite.stop()`. O resto da animação (giro/queda/partículas/shake)
   continua igual.

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2**
> (in-game): legibilidade a 320×180, silhueta forte, sem detalhe fino.
- **Estilo:** idêntico ao `dino.default` (cartoon vetorial chapado, contorno escuro, cel shading).
- **Paleta:** a mesma do `dino.default` do tema.
- **Leitura:** frame 1 = recuo do impacto (olhos fechados, asas para trás); 2–3 = giro; 4–5 = queda
  mole com algumas penas se soltando.

## Prompt para geração por IA
> "5-frame horizontal sprite strip of a cartoon pterodactyl getting hit and tumbling: frame 1
> impact recoil (eyes shut, wings back), frames 2-3 spinning/tumbling, frames 4-5 falling limp with
> a few feathers coming loose. Flat cartoon vector, bold dark outline, consistent framing and size
> per frame, transparent background, no text. PALETTE: match the existing dino sprite."

## Checklist de aceite
- [ ] 5 frames, moldura e escala idênticas às de `dino.default.flap`.
- [ ] Frames NÃO pré-rotacionados (a rotação é aplicada pelo render).
- [ ] Empacotado nos 3 atlas de tema; 60fps preservado.
- [ ] `asset-registry.md` atualizado (`spec` → `art`).
