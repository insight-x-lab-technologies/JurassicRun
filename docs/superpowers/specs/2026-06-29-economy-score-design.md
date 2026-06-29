# Spec — Item 1.8: Economia e score (distância base + comida + near-miss × multiplicador)

> Fase 1 (núcleo determinístico headless). Esta feature dá ao jogo a sua **pontuação**: a
> distância percorrida é o score base, comida e near-misses adicionam pontos, e um
> **multiplicador** escala o que é ganho. O score é acumulado **incrementalmente** para que
> multiplicadores temporários (power-ups da Fase 3) banquem pontos à taxa ativa no momento em
> que foram ganhos. Pura, determinística e alocação-zero no hot path.

## Objetivo

1. **Módulo `src/core/economy/`** puro: função de pontuação `scoreDelta(...)` sem RNG, sem
   tempo, sem transcendentais — só aritmética IEEE-754 portável.
2. **Distância como score base.** Cada step adiciona `dx · DISTANCE_SCORE_WEIGHT` ao score.
3. **Comida e near-miss pontuam.** Cada pássaro-moeda coletado e cada near-miss adicionam
   pontos com pesos próprios (dá significado de score ao near-miss contado em 1.6).
4. **Multiplicador de score** (`WorldState.scoreMultiplier`, default 1, mutável): escala os
   pontos ganhos por step. Sem fonte interna nesta fase — a fonte são os power-ups (Fase 3);
   testes o ajustam diretamente (mesmo fluxo de um power-up).
5. **Acúmulo incremental** do score (não recomputado do total), para semântica correta de
   multiplicadores temporários.
6. Integração no `step` (acúmulo por passo) + `createWorld`/`cloneWorld`.
7. Testes: unidade (fórmula/bordas), integração (`step`/acúmulo/morte) e determinismo
   (reprodutibilidade + independência de fps).

## Não-objetivos (fora de escopo, itens futuros)

- **Golden master / replay** (1.9).
- **Power-ups** que produzem multiplicadores ou "moeda dobrada" (Fase 3). Em 1.8,
  `scoreMultiplier` existe e é mutável, mas nada no core o altera; `collect` mantém
  `food += 1` (a moeda-dobrada vira multiplicador de comida na Fase 3 — YAGNI agora).
- **Conversão comida → moedas da loja / persistência de saldo** (Fase 4). `food` continua
  sendo a contagem de pássaros coletados na partida.
- **Multiplicador de combo/streak** (encadear coletas/near-misses) — não pedido; YAGNI.
- **HUD / Game Over** exibindo o score (Fase 2). Aqui só o valor canônico no `WorldState`.
- Tuning fino dos pesos (placeholders; afinados na Fase 2).

## Modelo conceitual: por que acúmulo incremental (e não recomputar do total)

Um score recomputado a cada step como `(distância·w + comida·v + nearMiss·u) · multiplicador`
parece mais simples, mas **quebra com multiplicador temporário**: um power-up de 2× ativo por
alguns segundos deve **dobrar os pontos ganhos naquela janela** e mantê-los; recomputar do
total faria o score inteiro *cair de volta* quando o 2× expira (o multiplicador volta a 1).

A semântica correta é **bancar por passo**:

```
score += scoreDelta(distanceDelta, foodDelta, nearMissDelta, scoreMultiplier)
```

onde os *deltas* são o que foi ganho **neste** step e `scoreMultiplier` é a taxa **ativa
agora**. Pontos ficam "presos" à taxa do momento. Quando o multiplicador é constante = 1 (o
caso de 1.8, sem power-ups) o resultado coincide com a soma simples — mas a fundação já é
correta para a Fase 3. Esta é também a razão de `score` ser acumulado no `WorldState`, não uma
função do estado total.

## Arquitetura

### Novo módulo: `src/core/economy/`

Pasta já existente (só `.gitkeep`). Matemática pura, sem estado, sem IO, sem RNG, sem tempo.
Módulo-folha: opera sobre primitivos (`number`), sem importar de `@core/sim` ⇒ sem ciclo.

```
src/core/economy/
  constants.ts   # pesos de pontuação (placeholders Fase 2)
  score.ts       # scoreDelta(...)
  index.ts       # barrel
```

#### Função

```ts
/**
 * Pontos ganhos num passo, dados os incrementos do passo e o multiplicador ativo.
 * Puro: só +, −, ·. Distância, comida e near-miss entram cada um com seu peso; a soma é
 * escalada pelo multiplicador (acúmulo incremental ⇒ multiplicador temporário banca correto).
 */
export function scoreDelta(
  distanceDelta: number,
  foodDelta: number,
  nearMissDelta: number,
  multiplier: number,
): number;
```

Implementação:

```
(distanceDelta · DISTANCE_SCORE_WEIGHT
  + foodDelta · FOOD_SCORE_VALUE
  + nearMissDelta · NEAR_MISS_SCORE_VALUE) · multiplier
```

Os pesos são lidos das constantes do módulo (fonte única; mesmo padrão de `difficultyAt`).

### Constantes (`src/core/economy/constants.ts`) — placeholders Fase 2

- `DISTANCE_SCORE_WEIGHT = 1` (1 ponto por unidade de distância).
- `FOOD_SCORE_VALUE = 10` (pontos por pássaro-moeda).
- `NEAR_MISS_SCORE_VALUE = 5` (pontos por near-miss).

### `WorldState` — novos campos

- `score: number` — pontuação canônica acumulada da partida (float; inicia 0). É o valor que a
  Fase 5 (leaderboards) lê ao fim da partida; a apresentação (HUD/Game Over, Fase 2) faz o
  `floor` para exibir.
- `scoreMultiplier: number` — multiplicador de score ativo (inicia 1). Mutável em runtime
  (power-ups da Fase 3 ligam/desligam; em 1.8 só testes o alteram).

### Integração no `step` (`src/core/sim/step.ts`)

O acúmulo de score acontece **no fim do step**, depois das passadas de spawn/cull/colisão
(que é quando `food`/`nearMisses` deste step já foram atualizados), e é **incondicional** ao
chegar lá (o guard `if (!world.alive) return` no topo já impede steps de mundo morto):

1. Logo após computar `dx` (avanço horizontal deste step), capturar as contagens-base:
   ```
   const foodBefore = world.food;
   const nearMissBefore = world.nearMisses;
   ```
   (Nada entre esse ponto e as passadas de colisão altera `food`/`nearMisses`.)
2. No fim do step, calcular os deltas e bancar:
   ```
   const foodDelta = world.food - foodBefore;
   const nearMissDelta = world.nearMisses - nearMissBefore;
   world.score += scoreDelta(dx, foodDelta, nearMissDelta, world.scoreMultiplier);
   ```

**Step da morte:** o step que mata (chão ou colisão) ainda avançou `dx` e por isso credita a
distância daquele passo; comida/near-miss não são contados em step de morte (já estão dentro de
blocos `if (world.alive)`), então `foodDelta`/`nearMissDelta` desse passo são 0 — exatamente o
desejado. Steps posteriores não rodam (mundo congelado).

**Sem alocação por frame:** `scoreDelta` retorna um `number`; captura de `foodBefore`/
`nearMissBefore` são leituras escalares. O hot path (cull/colisão por entidade) continua
alocação-zero (REGRA 3).

### `createWorld` / `cloneWorld`

- `createWorld`: `score = 0`, `scoreMultiplier = 1`.
- `cloneWorld`: copia `score` e `scoreMultiplier`.
- `WorldConfig`: **sem** novos campos. O multiplicador é dinâmico (mutado em runtime por
  power-ups na Fase 3) — não um parâmetro de construção; testes mutam `world.scoreMultiplier`
  diretamente, espelhando o fluxo real de um power-up. (YAGNI: não adiciono override de config
  que ninguém consome ainda.)

## Decisões de design (firmadas)

- **Acúmulo incremental, não recomputação do total** — única forma correta com multiplicador
  temporário (ver "Modelo conceitual"). `score` mora no `WorldState`.
- **Near-miss pontua** — dá consumidor ao stat de 1.6 e recompensa perícia (gênero). Peso
  próprio (placeholder), independente de comida.
- **Um multiplicador, de score** — escala a soma dos componentes (incl. distância). Mapeia
  direto num power-up "2× score". Default 1 ⇒ comportamento sem surpresa. "Moeda dobrada"
  (multiplicador de **comida**, não de score) é distinto e fica para a Fase 3.
- **`score` é float canônico** (determinístico). Não faço `floor` no core: arredondar é decisão
  de apresentação (Fase 2) e arredondar cedo perderia precisão no acúmulo. Comparações de
  leaderboard sobre floats determinísticos são exatas e reprodutíveis.
- **Multiplicador escala distância também** — um "2× score" dobra tudo o que se ganha enquanto
  ativo, inclusive progressão. Simples e previsível.
- **`scoreMultiplier` não é clampado no core** — `scoreDelta` é aritmética pura/burra; validar
  faixa (ex.: ≥ 0) é responsabilidade de quem o seta (power-ups). Testes documentam 0 e >1.
  Não preveem-se negativos em jogo.

## Adiados (conscientemente, não são bugs)

- **Multiplicador de comida ("moeda dobrada")** e fontes de `scoreMultiplier` (power-ups):
  Fase 3. Gancho pronto (`collect` centraliza o ganho de comida; `scoreMultiplier` mutável).
- **Conversão comida → saldo de moedas persistente** e economia de loja: Fase 4.
- **Exibição/Breakdown de score** (HUD, Game Over com componentes): Fase 2. Os componentes
  brutos (`distance`, `food`, `nearMisses`) já vivem no `WorldState` para um breakdown futuro.
- **Tuning dos pesos**: placeholders; Fase 2.

## Plano de testes

- **`tests/core/economy/score.test.ts`** — unidade (`scoreDelta`):
  - Componentes isolados: só distância, só comida, só near-miss ⇒ peso correto.
  - Soma combinada com multiplicador 1 (default) = soma simples dos pesos.
  - Multiplicador 2 ⇒ dobra; multiplicador 0 ⇒ 0; fração (ex.: 1.5) ⇒ escala correta.
  - Deltas zero ⇒ 0. Pureza/idempotência (mesmos argumentos ⇒ mesmo resultado).
  - Borda: valores grandes (sanidade aritmética, sem overflow inteiro — é float).
- **`tests/core/sim/economy-step.test.ts`** — integração:
  - Mundo recém-criado: `score === 0`, `scoreMultiplier === 1`.
  - Voar N steps sem coletar/morrer ⇒ `score` cresce monotônico, igual à soma de
    `dx · DISTANCE_SCORE_WEIGHT` (consistente com a velocidade efetiva da dificuldade).
  - Coletar comida adiciona `FOOD_SCORE_VALUE` no step da coleta (delta de score = peso).
  - Near-miss adiciona `NEAR_MISS_SCORE_VALUE` no step do cruzamento.
  - **Multiplicador temporário banca correto:** com `scoreMultiplier = 2` durante alguns
    steps e depois `= 1`, os pontos ganhos na janela 2× permanecem (score não regride ao
    voltar para 1). Esta é a prova da escolha incremental.
  - **Congelamento na morte:** após morrer, `score` não muda em steps subsequentes; o step da
    morte credita a distância daquele passo e não credita comida/near-miss.
- **`tests/determinism/economy.determinism.test.ts`**:
  - Reprodutibilidade: mesma seed+timeline ⇒ `score` idêntico (incluído no hash do estado).
  - Independência de fps: 1/2/5 steps por "frame" ⇒ `score` idêntico.
  - Duas partidas frescas com a mesma seed atingem o mesmo `score` na mesma `distance`.

## Definição de pronto

- `npm run check` limpo, `npm test` verde, bateria de determinismo verde
  (`npm run test:determinism`), `verify-determinism` ok; `determinism-guardian` "contrato
  intacto".
- `scoreDelta` pura e coberta; `score`/`scoreMultiplier` no `WorldState`, acumulados no `step`,
  copiados no `cloneWorld`, reiniciando a cada partida (score 0, mult 1 em `createWorld`).
- Sem alocação por-entidade-por-frame no hot path (cull/colisão continuam alocação-zero).
- Item 1.8 marcado `[x]` em `PHASE-01`; "Estado atual" do `CLAUDE.md` atualizado.
