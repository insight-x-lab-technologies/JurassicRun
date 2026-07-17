# Asset Spec — powerup.extraLife

## Identidade
- **id:** `powerup.extraLife`
- **Categoria:** power-up (carga acumulável — revive após colisão fatal)
- **Substitui o placeholder geométrico:** círculo flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 32 × 32 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`POWERUP_CATALOG`, `src/core/powerup/catalog.ts`); a arte NUNCA a altera.
- **Animação:** opcional batimento suave (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `powerups`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`/`bird.coin`).
- **Paleta:** corpo rosa-vermelho `#ff5a7a`, contorno `#7a1f30`, realce `#ffc2cf`.
- **Iluminação/ângulo:** vista frontal, luz superior suave.
- **Coerência:** silhueta de coração (ou ovo de dinossauro, alternativa temática) pequena e legível num círculo.

## Prompt para geração por IA
> "2D game icon of a small pink-red heart (or a speckled dinosaur egg as an alternative), flat cartoon vector style, bold dark outline, simple cel shading, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `powerups`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
