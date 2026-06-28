---
name: create-asset-spec
description: Use ao introduzir qualquer objeto visual trocável no JurassicRun (dino, obstáculo, fundo, ícone, power-up) — cria a especificação documentada para geração futura por IA.
---

# Criar Asset-Spec

Toda imagem que pode substituir um placeholder geométrico precisa de uma spec, para que
ferramentas de IA gerem a arte depois de forma reproduzível.

## Passos
1. Escolha o `id` (igual à chave do manifesto de assets, ex.: `obstacle.stalactite`).
2. Copie `docs/assets/asset-spec-template.md` para `docs/assets/specs/<id>.md`.
3. Preencha **todos** os campos:
   - dimensões alvo, pivô/âncora, **hitbox lógica associada** (a arte não muda a hitbox),
     frames de animação, atlas de destino, formato de exportação;
   - direção de arte (estilo, paleta, iluminação, coerência com o pack);
   - **prompt pronto em inglês** para geração por IA (fundo transparente, vista lateral 2D, etc.);
   - checklist de aceite.
4. Atualize `docs/assets/asset-registry.md`: adicione/atualize a linha do `id` com status `spec`.
5. Veja `docs/assets/specs/dino.default.md` como exemplo de referência.

## Lembrete
O pivô e as proporções da arte DEVEM bater com a hitbox definida no core. Ver
`docs/architecture/RENDERING-AND-ASSETS.md`.
