# Asset Spec — powerup.slowMo

## Identidade
- **id:** `powerup.slowMo`
- **Categoria:** power-up (efeito temporário — câmera lenta)
- **Substitui o placeholder geométrico:** círculo flutuante.

## Especificação técnica
- **Dimensões alvo (px):** 32 × 32 (@1x para mobile; exportar também @2x)
- **Pivô / âncora:** centro (sem âncora a teto/chão)
- **Hitbox lógica associada:** círculo — raio 7–9 (variável por instância). Definida no core (`POWERUP_CATALOG`, `src/core/powerup/catalog.ts`); a arte NUNCA a altera.
- **Animação:** opcional oscilação/brilho sutil (2–4 frames); 1 frame aceitável no placeholder.
- **Atlas de destino:** `powerups`
- **Formato de exportação:** PNG com alpha, @1x e @2x
- **Margens/padding seguros:** 3px

## Direção de arte
> **Coerência de mundo:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.
- **Estilo:** cartoon vetorial chapado, contorno definido, sombreamento simples (coerente com `dino.default`/`bird.coin`).
- **Paleta:** corpo verde-menta `#66ffcc`, contorno `#1a805f`, realce `#d6fff0`.
- **Iluminação/ângulo:** vista frontal, luz superior suave.
- **Coerência:** ícone de ampulheta (ou relógio/caracol, tema câmera lenta), silhueta legível num círculo pequeno; distinta cromaticamente dos outros 4 power-ups (escudo=ciano, vida-extra=rosa, ímã=roxo, moeda-dobrada=amarelo).

## Prompt para geração por IA
> "2D game icon of a small mint-green hourglass, flat cartoon vector style, bold dark outline, simple cel shading, transparent background, centered, no text, no shadow."

## Checklist de aceite
- [ ] Fundo transparente; pivô centralizado.
- [ ] Proporções batem com a hitbox circular (simétrico).
- [ ] Empacotado no atlas `powerups`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `spec`.
