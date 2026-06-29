# Task 3 Report — Testes de Determinismo da Economia (Item 1.8)

## Arquivo criado

- `tests/determinism/economy.determinism.test.ts`

## Saída de `npm test -- tests/determinism/economy.determinism.test.ts`

```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Start at  19:14:02
  Duration  758ms
```

Todos os 3 testes passaram:
1. reprodutibilidade: mesma seed+timeline => score idêntico
2. independência de fps: 1, 2 e 5 steps por frame => score idêntico
3. duas partidas frescas com a mesma seed => mesmo score na mesma distância

## Saída de `npm run test:determinism`

```
Test Files  11 passed (11)
     Tests  48 passed (48)
  Duration  4.63s
```

Total: 48 testes de determinismo (era 45 antes da Task 3; +3 novos).

## Saída de `npm run check`

Limpo (sem erros de typecheck nem lint).

## Hash do commit

`ea94824` — "test(determinism): score reprodutível e fps-independente (1.8)"

## Concerns

Nenhum. O arquivo de teste replica exatamente o padrão do harness de `difficulty.determinism.test.ts`, usando `runBatched` com batches 1/2/5 para provar independência de fps. O `toEqual` do segundo teste já exercita o contrato completo do `WorldState` (incluindo `score`/`scoreMultiplier`), reforçando que nenhuma alocação ou referência instável quebrou a comparação profunda.

---

## Fix do Critical

### Problema

O teste original usava `worldHeight: 100000, startY: 50000`. Com esse mundo gigante, o pterodáctilo voa num corredor estreito (~y=50000 ± poucos pixels) enquanto os coletáveis e obstáculos floating são distribuídos uniformemente em [8, 99992] — probabilidade praticamente zero de interceptação. Resultado: `food=0`, `nearMisses=0` em toda execução; `score === distance` sempre; os caminhos `FOOD_SCORE_VALUE`/`NEAR_MISS_SCORE_VALUE` jamais eram exercitados.

### Config final escolhida

- `worldHeight: 180` (padrão do jogo), `startY: 90`
- `seed: 'endless:GAME1'`
- Timeline: `flap: i % 25 === 0` (flap a cada 25 steps — mantém trajetória nivelada atravessando o corredor das entidades)
- Steps: 2000 (dino morre antes de concluir; estado congela; executar mais steps é idempotente)

**Valores medidos ao final da execução (`runBatched(SEEDED, t, 1)`):**

| campo       | valor     |
|-------------|-----------|
| food        | 2         |
| nearMisses  | 1         |
| distance    | ≈ 665.14  |
| score       | ≈ 690.14  |
| alive       | false     |

Verificação da fórmula: `665.14 × 1 + 2 × 10 + 1 × 5 = 690.14` ✓

### Mudanças no teste

O terceiro teste (redundante com o primeiro) foi substituído por **"score agrega os três componentes: distância + comida + near-miss"**, que:
1. Asserta `food > 0` e `nearMisses > 0` (guarda de cobertura primária).
2. Verifica a fórmula `score ≈ distance + food × FOOD_SCORE_VALUE + nearMisses × NEAR_MISS_SCORE_VALUE` via `toBeCloseTo(expected, 6)`.
3. Asserta `score > distance` (prova que comida+near-miss contribuem positivamente).

O primeiro teste foi fortalecido com os mesmos guards (`food > 0`, `nearMisses > 0`) antes das asserções de igualdade entre runs.

### Saída dos comandos após o fix

```
npm test -- tests/determinism/economy.determinism.test.ts
  Test Files  1 passed (1)
       Tests  3 passed (3)
    Duration  625ms

npm run test:determinism
  Test Files  11 passed (11)
       Tests  48 passed (48)
    Duration  2.32s

npm run check
  (limpo — sem erros de typecheck nem lint)
```

### SHA do commit

`c1f07ac` — "test(determinism): exercita comida+near-miss no score determinístico (1.8)"
