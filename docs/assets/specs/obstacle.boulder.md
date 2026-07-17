# Asset Spec — obstacle.boulder

## Identidade
- **id:** `obstacle.boulder`
- **Categoria:** obstáculo
- **Substitui o placeholder geométrico:** círculo (pedregulho) flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 72 × 72 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 10–18 (variável por instância). Definida no core (`OBSTACLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** estático (1 frame)
- **Atlas de destino:** `obstacles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 4px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** pedra `#7a7a7a`, sombra `#4a4a4a`, contorno `#3a3a3a`, realce `#9a9a9a`.
- **Iluminação/ângulo:** vista frontal/3/4, luz superior-direita suave, leve volume esférico.
- **Coerência:** rochedo jurássico de pack inicial.

## Prompt para geração por IA
> "Side-view 2D game sprite of a round prehistoric boulder floating in space, flat cartoon vector style, bold dark outline, simple cel shading, gray stone with subtle shading, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `obstacles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
