# Task 2 Report — Integração no WorldState/step (acúmulo de score)

## Arquivos modificados/criados

- `src/core/sim/types.ts` — adicionados campos `score: number` e `scoreMultiplier: number` à interface `WorldState`; comentários de `food` e `nearMisses` atualizados para remover referência futura a 1.8.
- `src/core/sim/world.ts` — `createWorld` inicializa `score: 0, scoreMultiplier: 1`; `cloneWorld` copia `score: w.score, scoreMultiplier: w.scoreMultiplier`.
- `src/core/sim/step.ts` — importa `scoreDelta` de `@core/economy`; captura `foodBefore`/`nearMissBefore` logo após `world.distance += dx`; banca `world.score += scoreDelta(dx, foodDelta, nearMissDelta, world.scoreMultiplier)` no fim da função.
- `tests/core/sim/economy-step.test.ts` — criado (5 testes).

## Testes pré-existentes atualizados

Nenhum teste pré-existente precisou ser atualizado. O `world.test.ts` usa `cloneWorld` e verifica `c.toEqual(w)` — como ambos `createWorld` e `cloneWorld` agora incluem os novos campos com os mesmos valores, o teste continua verde sem alterações.

## Saída de `npm test`

```
Test Files  32 passed (32)
     Tests  177 passed (177)
  Start at  19:07:42
  Duration  13.06s
```

## Saída de `npm run check`

Limpo (sem erros de typecheck ou lint).

## Hash do commit

`376fe5f` — feat(core/sim): acúmulo de score por step + scoreMultiplier no WorldState (1.8)

## Concerns

**Desvio no teste de coleta de comida:** O teste do spec usava `{ worldHeight: 100000, startY: 50000, seed: 'endless:FOODSCORE' }` com 4000 iterações para aguardar uma coleta de coletável. Esse cenário é probabilisticamente inviável: com a âncora `floating` distribuindo coins sobre 100000 unidades de altura e o pterodáctilo se movendo para y≈34900 após 4000 steps (com gravity=540, flapSpeed=240, flap a cada 2 steps), a probabilidade de sobreposição é ~0.032% por coin (≈0.02 coletas esperadas em 4000 steps). O teste falharia de forma determinística.

Adaptação aplicada: substituí por um mundo STATIC (gravity=0, flapSpeed=0, scrollSpeed=60) com uma moeda colocada manualmente em (4, 100) — a mesma linha do pterodáctilo em startY=100. O dino coleta a moeda no primeiro step, e a asserção `scoreGained >= foodGained * FOOD_SCORE_VALUE` é verificada identicamente. A intenção do spec é preservada; apenas o mecanismo de setup é diferente (controlado vs. probabilístico).
