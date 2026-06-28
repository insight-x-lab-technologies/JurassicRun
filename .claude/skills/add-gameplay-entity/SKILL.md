---
name: add-gameplay-entity
description: Use ao adicionar um obstáculo, coletável, power-up ou pterodáctilo ao JurassicRun — garante lógica determinística, hitbox desacoplada, entrada no manifesto de assets, asset-spec e testes.
---

# Adicionar Entidade de Gameplay

Mantém os pilares: separação core/render, determinismo, arte desacoplada.

## Checklist (faça nesta ordem)

1. **Definir o tipo lógico no core** (`src/core/`):
   - Tipo/variante, comportamento, e **hitbox** (AABB/círculo/polígono). Sem dados visuais.
   - Se é gerado em jogo, plugue no gerador determinístico apropriado (keyed por distância,
     consumindo o `Rng`). NUNCA use relógio/`Math.random`.
2. **Testes primeiro (TDD)**:
   - Comportamento da entidade + colisão.
   - Determinismo: mesma seed ⇒ mesma geração/efeito. Ver skill `verify-determinism`.
3. **Manifesto de assets** (`src/assets/`): adicione a entrada do tipo lógico como
   `kind: "primitive"` (placeholder geométrico) — coerente com `RENDERING-AND-ASSETS.md`.
4. **Render**: garanta que a `GameScene` desenha o novo tipo via manifesto (com pooling).
5. **Asset-spec**: crie a spec da imagem futura (skill `create-asset-spec`) e registre em
   `docs/assets/asset-registry.md`.
6. **i18n**: se a entidade aparece em texto (loja, tooltip), adicione chaves (skill `add-locale`).
7. **Verificar**: `npm test` + `npm run check` + `verify-determinism`. Evidência antes de fechar.

## Regra de ouro
A arte nunca define a hitbox. Trocar geométrico→PNG deve ser só editar o manifesto.
