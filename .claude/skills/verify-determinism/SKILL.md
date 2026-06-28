---
name: verify-determinism
description: Use ao tocar src/core/ do JurassicRun ou antes de fechar qualquer feature de gameplay, para provar que a simulação continua determinística (mesma seed + inputs ⇒ mesmo resultado).
---

# Verificar Determinismo

Garanta o contrato em `docs/architecture/DETERMINISM.md`.

## Passos

1. **Grep de proibições** em `src/core/`:
   ```bash
   grep -rnE "Math\.random|Date\.now|new Date|performance\.now|setTimeout|requestAnimationFrame" src/core/ && echo "VIOLAÇÃO" || echo "OK: sem fontes proibidas"
   grep -rnE "from ['\"](phaser|preact|@preact)" src/core/ && echo "VIOLAÇÃO: import gráfico no core" || echo "OK: core sem deps gráficas"
   ```
2. **Rodar a bateria** (quando existir):
   ```bash
   npm run test:determinism
   ```
   Deve cobrir: reprodutibilidade (rodar 2x ⇒ mesmo hash), independência de fps
   (1/2/5 steps por frame ⇒ mesmo estado), e golden master de seeds fixas.
3. Se algum teste de determinismo ainda não existir para o código novo, **crie-o** antes de
   considerar a feature pronta (ver agente `tester`).
4. Reporte: OK ou a violação com arquivo:linha e como corrigir.

## Quando usar
Sempre que adicionar/alterar RNG, spawn, física, dificuldade, clima, economia ou seeds.
