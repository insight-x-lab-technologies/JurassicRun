# Asset Spec — obstacle.vine

## Identidade
- **id:** `obstacle.vine`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** coluna vertical (cipó) pendendo do teto.

## Especificação técnica
- **Dimensões alvo (px):** 64 × 272 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** topo centralizado (prende no teto)
- **Hitbox lógica associada:** aabb fina — halfW ≈ 4, halfH 20–34 (variável por instância). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** estático (1 frame); opcional leve balanço orgânico (cosmético)
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** tronco `#5a6b3d`, folhas `#3d7d3d`, contorno `#2a3d1a`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior suave.
- **Coerência:** vegetação jurássica de pack inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite of a hanging prehistoric vine with organic tendrils and sparse leaves dangling downward, flat cartoon vector style, bold dark outline, simple cel shading, muted green, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; topo alinhado ao pivô superior.
- [ ] Proporções batem com a hitbox lógica (fina e pendente).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
