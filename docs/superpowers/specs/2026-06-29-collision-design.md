# Spec — Item 1.6: Colisão (dino×obstáculo, dino×coletável, near-miss)

> Fase 1 (núcleo determinístico headless). Esta feature fecha o laço de gameplay headless:
> o pterodáctilo morre ao bater em obstáculo, coleta pássaros-moeda por sobreposição, e
> registra near-misses. Tudo determinístico e alocação-zero no hot path.

## Objetivo

Detecção de colisão geométrica entre hitboxes lógicas (REGRA 2: nunca pixels) e sua
integração ao `step`:

1. **Colisão precisa** entre `Hitbox` de qualquer tipo (`aabb` / `circle` / `polygon`).
2. **Gatilho dino×obstáculo** ⇒ morte (`alive = false`, simulação congela — comportamento de
   morte já existente).
3. **Gatilho dino×coletável** ⇒ chama `collect(world, entity)` (o `collect` de 1.5 já
   incrementa `food` e remove o coletável).
4. **Near-miss**: passar perto de um obstáculo sem colidir incrementa `WorldState.nearMisses`.
5. Testes: unidade (geometria), integração (gatilhos no `step`) e determinismo.

## Não-objetivos (fora de escopo, itens futuros)

- Dificuldade/densidade/velocidade (1.7), economia/multiplicadores/score (1.8), golden master (1.9).
- Dar ao pterodáctilo hitbox não-AABB (não há feature que peça isso ainda) — ver "Adiados".
- Resposta física de colisão (knockback, etc.). Aqui colisão com obstáculo = morte binária.
- Tuning fino das constantes (placeholders; afinados na Fase 2).

## Arquitetura

### Novo módulo: `src/core/collision/`

Pasta já existente (só `.gitkeep`). Geometria pura, sem estado, sem IO.

```
src/core/collision/
  overlap.ts   # overlaps(ha, pa, hb, pb): boolean  — predicado central
  index.ts     # barrel
```

`overlap.ts` importa **apenas tipos** de `@core/sim/types` (`Hitbox`, `Vec2`) via
`import type` ⇒ sem ciclo de runtime (o `step` importa de `@core/collision`, mas
`@core/collision` só importa *tipos* de `sim`).

#### `overlaps(ha: Hitbox, pa: Vec2, hb: Hitbox, pb: Vec2): boolean`

`pa`/`pb` são as posições de mundo (centros do transform). Despacho por par de tipos:

- `aabb × aabb` → sobreposição de intervalos em x e y (direto).
- `circle × circle` → distância² ≤ (r₁+r₂)² (direto).
- `aabb × circle` → ponto mais próximo do aabb ao centro do círculo; dist² ≤ r² (direto).
- qualquer par **com polígono** (`polygon×polygon`, `polygon×aabb`, `polygon×circle`) →
  **SAT** (Separating Axis Theorem) para convexos.

**SAT alocação-zero (REGRA 3).** Sem construir arrays de vértices/eixos. Para cada eixo
candidato `(ax, ay)` (não-normalizado — basta para o teste booleano de separação), testa-se
`axisSeparates(...)` comparando os intervalos projetados de cada hitbox via `projectMin` /
`projectMax` (puros, escalares):

- `aabb`: projeção = centro·eixo ± (|ax|·halfW + |ay|·halfH).
- `circle`: projeção = centro·eixo ± r·hypot(ax, ay).
- `polygon`: min/max de (vértice+pos)·eixo sobre os ≤4 vértices.

Eixos candidatos:
- normais das arestas de cada polígono (calculadas inline: `normal = (−edge.y, edge.x)`),
- eixos `(1,0)`/`(0,1)` para aabb,
- para `polygon×circle`: eixo do centro do círculo ao **vértice mais próximo** do polígono.

Se **algum** eixo separa ⇒ `false` (sem colisão). Caso contrário ⇒ `true`.

Justificativa: 3 tipos × poucas entidades ativas; os casos quentes (aabb-aabb / aabb-circle)
são diretos e baratos; o SAT escalar cobre os polígonos sem alocar.

### Integração no `step` (`src/core/sim/step.ts`)

Após a geração+cull (laços existentes), e **apenas se `world.alive`**, uma passada de
colisão. O pterodáctilo é o agente; obstáculos/coletáveis estão em coords de mundo (estáticos).

1. **Obstáculos** (laço único, cobre colisão **e** near-miss):
   - Se `overlaps(dino.hitbox, dino.pos, obs.hitbox, obs.pos)` ⇒ `world.alive = false`
     (morte; pode parar o laço de obstáculos).
   - Senão, **near-miss**: detectar a transição de "ultrapassagem" deste step.
     - `obsRight = obs.pos.x + rightExtent(obs.hitbox)` (escalar, sem alocação).
     - `dinoLeft = dino.pos.x − halfW`; `dinoLeftBefore = dinoLeft − dx` (dx = scroll deste step).
     - Cruzou se `dinoLeftBefore ≤ obsRight < dinoLeft`.
     - **No** step do cruzamento (raro, ~1× por obstáculo), computa o gap vertical entre os
       envelopes (via `boundsOf`, alocação tolerável por ser pontual, **não** por frame):
       `gap = max(0, max(dinoTop − obsBot, obsTop − dinoBot))`. Se `0 < gap ≤ NEAR_MISS_MARGIN`
       ⇒ `world.nearMisses += 1`.
2. **Coletáveis**: iterar **de trás para frente** (índice decrescente) — `collect` faz
   `splice`. Se `overlaps(dino, col)` ⇒ `collect(world, col)`.

Ordem e congelamento: se a morte no chão já zerou `alive` neste step, a passada de colisão é
pulada (guard `if (!world.alive) return` no topo já garante steps futuros congelados; dentro
do step, a passada é guardada por `world.alive`).

### Estado: `WorldState.nearMisses`

- `types.ts`: novo campo `nearMisses: number` (previsto na ARCHITECTURE.md).
- `world.ts`: `createWorld` inicia `0`; `cloneWorld` copia.
- `constants.ts`: `NEAR_MISS_MARGIN` (placeholder; unidades abstratas).

## Decisões de design (firmadas)

- **`overlaps` é simétrico e geral.** Embora hoje o dino seja sempre AABB, o predicado cobre
  os 6 pares para suportar futuras hitboxes (power-ups) sem retrabalho. Despacho normaliza a
  ordem (ex.: aabb×circle e circle×aabb caem no mesmo caminho).
- **Near-miss stateless, contado no cruzamento.** Sem flag por entidade: a transição de
  ultrapassagem ocorre em **um** step ⇒ conta naturalmente 1×. O gap é amostrado no step do
  cruzamento (x≈0 de separação ⇒ domina o gap vertical). Simplificação consciente: o ponto de
  maior aproximação vertical pode ter ocorrido um pouco antes; aceitável no core, refinável na
  Fase 2. Sobreviventes têm `gap > 0` (gap 0 com x sobreposto teria sido morte antes).
- **Near-miss só para obstáculos.** Coletáveis sobrepostos são coletados, não "quase".
- **Eixos SAT não-normalizados.** O teste de separação é invariante a escala do eixo (compara
  intervalos no mesmo eixo) ⇒ dispensa `sqrt` por aresta (exceto o termo do círculo, que usa
  `hypot` no próprio eixo, consistente entre as duas projeções).
- **Sem broadphase dedicada.** Lista de entidades ativas é pequena (lookahead 400 + cull 100);
  os casos diretos já filtram barato. Otimização por x fica para quando medirmos necessidade.

## Adiados (conscientemente, não são bugs)

- **Footgun do dino não-AABB** (de [[deferred-core-sim-1-3]]): o clamp teto/chão no `step` usa
  `halfH` só para AABB. O dino continua AABB em 1.6; computar extents verticais reais alocaria
  por frame (`boundsOf`) ou exigiria helpers escalares novos. Trato quando uma feature der
  hitbox não-AABB ao pterodáctilo. Sem mudança de comportamento agora.
- **Ponto de maior aproximação do near-miss** amostrado no cruzamento (acima). Fase 2 pode
  rastrear o mínimo se o tuning pedir.
- **Multiplicador/score do near-miss**: 1.8. Aqui apenas conta.

## Plano de testes

- **`tests/core/collision/overlap.test.ts`** — unidade. Para cada par (aabb-aabb, circle-circle,
  aabb-circle, aabb-polygon, circle-polygon, polygon-polygon): sobrepondo, separado, encostando
  na borda, e contenção (um dentro do outro). Com deslocamentos de posição (`pa`/`pb` ≠ origem).
  Casos do catálogo real (stalactite triângulo, boulder círculo, dino aabb).
- **`tests/core/sim/collision-step.test.ts`** — integração:
  - dino entra em obstáculo ⇒ `alive=false` e estado congela (tick não avança em steps seguintes).
  - dino sobrepõe coletável ⇒ `food` incrementa e o coletável some da lista (gatilho de 1.5).
  - obstáculo passado dentro da margem sem colisão ⇒ `nearMisses` incrementa **uma** vez (não
    duplica em steps subsequentes).
  - obstáculo passado **fora** da margem ⇒ `nearMisses` não muda.
  - colisão real **não** gera near-miss (morte, não "quase").
- **`tests/determinism/collision.determinism.test.ts`**:
  - reprodutibilidade: mesma seed+timeline ⇒ `alive`/`food`/`nearMisses` idênticos (hash do estado).
  - independência de fps: 1/2/5 steps por "frame" ⇒ idêntico, incluindo colisões e near-misses.

## Definição de pronto

- `npm run check` limpo, `npm test` verde, bateria de determinismo verde
  (`npm run test:determinism`), `verify-determinism` ok.
- `overlaps` cobre os 6 pares; gatilhos integrados; `nearMisses` no `WorldState`.
- Sem alocação por frame no hot path (SAT escalar; `boundsOf` só no cruzamento pontual).
- Item 1.6 marcado `[x]` em `PHASE-01`; "Estado atual" do `CLAUDE.md` atualizado.
