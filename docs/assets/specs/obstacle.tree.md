# Asset Spec — obstacle.tree

## Identidade
- **id:** `obstacle.tree`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** retângulo vertical (tronco) subindo do chão.

## Especificação técnica
- **Dimensões alvo (px):** 96 × 320 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** base centralizada (encosta no chão)
- **Hitbox lógica associada:** aabb estreita e alta — halfW ≈ 6, halfH 24–40 (variável por instância). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** idle PROCEDURAL no render (9.4) — balanço lateral (`idle: { kind:'sway', anchor:'bottom', amp:0.6 }` no manifesto), base cravada e copa solta; a arte é 1 frame por parte. Variante futura opcional: tira de 4 frames por parte (Apêndice A.2 do PHASE-09) — exigiria também trocar o manifesto e o caminho de render.
- **Composição:** SEGMENTADO (9.2) — 3 frames `cap`/`body`/`base` (tira horizontal); o render monta `cap + N×body + base` para cobrir qualquer altura da hitbox aabb sem distorção nem vazio. `body` é tileável na vertical. Fonte placeholder: `public/art/themes/<tema>/obstacles/<tema>_obstacle.tree.segments.png` (empacotada via modo `parts` do `gen-atlas`). Arte AAA real: prompts A.2 do PHASE-09.
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** tronco `#6b4a2b`, folhagem `#2f6b2f`, contorno `#2a1a10`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave.
- **Coerência:** pack jurássico inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite of a tall prehistoric tree trunk with sparse fern-like foliage on top, flat cartoon vector style, bold dark outline, simple cel shading, brown trunk, green foliage, transparent background, centered, no text, no ground shadow."

## Checklist de aceite
- [ ] Fundo transparente; base alinhada ao pivô inferior.
- [ ] Proporções batem com a hitbox lógica (estreita e alta).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
