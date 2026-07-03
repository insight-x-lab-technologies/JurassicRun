# Asset Spec — powerup.shield

## Identidade
- **id:** `powerup.shield`
- **Categoria:** power-up (efeito temporário — invulnerabilidade)
- **Substitui o placeholder geométrico:** círculo flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 32 × 32 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`POWERUP_CATALOG`, `src/core/powerup/catalog.ts`); a arte NUNCA a altera.
- **Animação:** opcional pulso/brilho sutil (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `powerups`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`/`bird.coin`).
- **Paleta:** corpo azul-ciano `#4ac0ff`, contorno `#1a5f80`, realce `#bfeaff`.
- **Iluminação/ângulo:** vista frontal, luz superior suave.
- **Coerência:** ícone de escudo (heráldico, arredondado), legível em movimento rápido e num círculo pequeno.

## Prompt para geração por IA
> "2D game icon of a small round cyan-blue shield emblem, flat cartoon vector style, bold dark outline, simple cel shading, glowing rim, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `powerups`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
