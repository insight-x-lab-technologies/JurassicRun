# Asset Spec — obstacle.stalactite

## Identidade
- **id:** `obstacle.stalactite`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** triângulo convexo apontando para baixo (estalactite).

## Especificação técnica
- **Dimensões alvo (px):** 112 × 144 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** topo centralizado (prende no teto)
- **Hitbox lógica associada:** polígono triangular convexo apontando para baixo — halfW 8–14, halfH 11–18 (variável por instância). Vértices em (-halfW, -halfH), (halfW, -halfH), (0, halfH). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** estático (1 frame)
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** estalactite `#8a8a8a`, sombra/profundidade `#5a5a5a`, contorno `#3a3a3a`, realce `#aaaaaa`.
- **Iluminação/ângulo:** vista lateral 2D, luz superior, ápice afiado apontando para baixo.
- **Coerência:** caverna/teto jurássico de pack inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite of a sharp prehistoric stalactite hanging from cave ceiling, triangular pointed downward, flat cartoon vector style, bold dark outline, simple cel shading, gray stone with subtle depth shading, transparent background, centered top-anchored, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; topo alinhado ao pivô superior.
- [ ] Proporções batem com a hitbox triangular (ápice para baixo).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
