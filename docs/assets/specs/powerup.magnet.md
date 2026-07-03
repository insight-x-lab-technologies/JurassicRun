# Asset Spec — powerup.magnet

## Identidade
- **id:** `powerup.magnet`
- **Categoria:** power-up (efeito temporário — atrai coletáveis próximos)
- **Substitui o placeholder geométrico:** círculo flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 32 × 32 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`POWERUP_CATALOG`, `src/core/powerup/catalog.ts`); a arte NUNCA a altera.
- **Animação:** opcional pulso/vibração sutil (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `powerups`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`/`bird.coin`).
- **Paleta:** corpo roxo `#c061ff`, contorno `#4a1f80`, realce `#e6c2ff`.
- **Iluminação/ângulo:** vista frontal, luz superior suave.
- **Coerência:** ímã em ferradura clássico (formato em U, pontas vermelho/azul opcionais), legível num círculo pequeno.

## Prompt para geração por IA
> "2D game icon of a small purple horseshoe magnet, flat cartoon vector style, bold dark outline, simple cel shading, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `powerups`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
