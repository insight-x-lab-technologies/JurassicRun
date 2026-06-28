# Asset Spec — obstacle.tree

## Identidade
- **id:** `obstacle.tree`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** retângulo vertical (tronco) subindo do chão.

## Especificação técnica
- **Dimensões alvo (px):** 96 × 320 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** base centralizada (encosta no chão)
- **Hitbox lógica associada:** aabb estreita e alta — halfW ≈ 6, halfH 24–40 (variável por instância). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** estático (1 frame); opcional leve balanço de folhas (cosmético)
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
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
