# Asset Spec — bird.coin

## Identidade
- **id:** `bird.coin`
- **Categoria:** coletável (comida)
- **Substitui o placeholder geométrico:** círculo (pássaro-moeda) flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 36 × 36 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`COLLECTIBLE_CATALOG`); a arte NUNCA a altera.
- **Animação:** opcional bater de asas (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `collectibles`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`).
- **Paleta:** corpo dourado `#f2c14e`, asa `#e0a92e`, contorno `#7a5a12`, realce `#ffe39b`.
- **Iluminação/ângulo:** vista lateral (perfil de voo), luz superior suave.
- **Coerência:** pequeno pássaro pré-histórico “moeda”, legível em movimento rápido.

## Prompt para geração por IA
> "Side-view 2D game sprite of a small golden prehistoric coin-bird flying, flat cartoon vector style, bold dark outline, simple cel shading, warm gold body, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `collectibles`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
