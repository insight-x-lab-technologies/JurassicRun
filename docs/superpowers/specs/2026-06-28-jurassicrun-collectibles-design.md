# Design — Item 1.5: Coletáveis (pássaros-moeda)

> Fase 1 (núcleo determinístico headless). Spec da feature. Modo autônomo (sem gate humano).
> Antecede o plano de implementação (`writing-plans`).

## Objetivo

Gerar **pássaros-moeda** (`bird.coin`) de forma determinística ao longo do mundo e definir o
efeito de **coletar** um deles: incrementar o contador de **comida** (`food`) do mundo.

Escopo do item 1.5 conforme o roadmap (`PHASE-01`):
- Geração determinística de coletáveis (keyed por distância, consumindo o Rng com seed).
- "Coleta incrementa comida" — o **efeito** da coleta (mecanismo `collect` + campo `food`).
- Testes.

**Fora de escopo (itens seguintes):**
- **Quando** a coleta acontece via colisão dino×coletável → **1.6 (Colisão)**. O 1.5 entrega o
  mecanismo de coleta; o 1.6 chama-o quando detectar sobreposição.
- Multiplicadores/score/economia completa → **1.8**. O 1.5 incrementa comida em **1 por pássaro**.
- Padrões/arcos de moedas, distribuição ponderada, densidade por dificuldade → tuning de
  **1.7 / Fase 2**.

## Decisões de design

### 1. Reuso do gerador (DRY, sem destabilizar 1.4)
Coletáveis e obstáculos compartilham exatamente a mesma mecânica: colocação keyed por
distância, cursor que avança **por entidade emitida** (independência de batching/fps), âncora
vertical (`floor`/`ceiling`/`floating`) e `placeY`. Em vez de duplicar o gerador, **generalizamos
`SpawnGenerator`** para aceitar um **catálogo** e um **tipo de entidade**, com defaults
retrocompatíveis (`OBSTACLE_CATALOG`, `'obstacle'`) para **não tocar** os call sites e testes de 1.4.

```ts
// Assinatura generalizada (backward-compatible):
new SpawnGenerator(rng, config, catalog = OBSTACLE_CATALOG, entityType = 'obstacle')
```

Os tipos do catálogo passam a nomes neutros reutilizáveis (`Anchor`, `SpawnType`), pois descrevem
qualquer coisa colocável, não só obstáculos. (Se `ObstacleAnchor`/`ObstacleType` forem
referenciados externamente, mantêm-se como aliases; caso contrário, renomeiam-se.)

### 2. Catálogo de coletáveis
`COLLECTIBLE_CATALOG`, mesmo formato de `SpawnType`:
- `bird.coin` — hitbox **círculo** (raio ~7–9, corpo compacto do pássaro), âncora **`floating`**
  (voa em espaço aberto). Um único tipo basta para 1.5; variações/padrões ficam para Fase 2.

### 3. Stream de RNG dedicado (independência)
Obstáculos usam `createRng(seed).fork('obstacles')`; coletáveis usam
`createRng(seed).fork('collectibles')`. Streams independentes ⇒ **adicionar coletáveis não muda a
sequência de obstáculos** (e vice-versa). Reserva firmada no item 1.4.

### 4. Config de spawn dos coletáveis
Reutiliza a interface `SpawnConfig`. Constantes próprias (`DEFAULT_COLLECTIBLE_CONFIG`) com gaps
menores que os obstáculos (aparecem mais intercalados). Placeholders de tuning — 1.7/Fase 2 afinam.

### 5. Estado do mundo
`WorldState` ganha:
- `food: number` — comida coletada (inicia em `0`).
- `collectibleSpawner: SpawnGenerator | null` — gerador de coletáveis (null quando o mundo não
  tem seed). O gerador de obstáculos permanece em `spawner` (sem renomear, para minimizar churn).

`createWorld`: quando `seed` presente, constrói **ambos** os geradores (forks distintos) e
`food: 0`. Aceita override opcional `WorldConfig.collectibleSpawn?: Partial<SpawnConfig>`
(simétrico ao `spawn` existente). `cloneWorld`: clona `collectibleSpawner` e copia `food`.

### 6. Integração no `step`
Espelha o bloco de obstáculos: se `collectibleSpawner`, gera até `distance + SPAWN_LOOKAHEAD` em
`world.collectibles` e culla os ultrapassados via `rightExtent` (escalar, **sem alocação por
frame** — REGRA 3).

### 7. Mecanismo de coleta — `collect(world, entity): boolean`
Função em `src/core/sim/collect.ts`:
- Se `entity` está em `world.collectibles` (busca por **referência**, evitando colisão de ids
  entre listas — ids de ambos os geradores começam em 0), remove-o da lista e faz `world.food += 1`;
  retorna `true`.
- Se não está presente, é **no-op** e retorna `false` ⇒ **idempotente** (coletar duas vezes não
  conta em dobro).
- Determinística: sem fontes proibidas; muta o mundo como `step`. O **gatilho** (colisão) é 1.6.

### 8. Arte desacoplada (REGRA 2 e 5)
Hitbox é lógica (círculo no core); a arte nunca a altera. Cria-se o asset-spec
`docs/assets/specs/bird.coin.md` e atualiza-se `asset-registry.md` (`bird.coin`:
placeholder → `spec`).

## Componentes e arquivos

| Arquivo | Mudança |
|---|---|
| `src/core/spawn/catalog.ts` | Nomes neutros (`Anchor`, `SpawnType`); novo `COLLECTIBLE_CATALOG` (`bird.coin`). |
| `src/core/spawn/generator.ts` | `SpawnGenerator` aceita `catalog`+`entityType` (defaults retrocompatíveis). |
| `src/core/spawn/constants.ts` | `DEFAULT_COLLECTIBLE_CONFIG` + constantes de gap dos coletáveis. |
| `src/core/spawn/index.ts` | Reexporta os novos símbolos. |
| `src/core/sim/types.ts` | `WorldState.food`, `WorldState.collectibleSpawner`; `WorldConfig.collectibleSpawn?`. |
| `src/core/sim/world.ts` | `createWorld`/`cloneWorld`: 2º gerador (fork `collectibles`) + `food`. |
| `src/core/sim/step.ts` | Bloco de geração+cull de coletáveis. |
| `src/core/sim/collect.ts` (novo) | `collect(world, entity)`. |
| `src/core/sim/index.ts` | Reexporta `collect`. |
| `docs/assets/specs/bird.coin.md` (novo) | Asset-spec. |
| `docs/assets/asset-registry.md` | `bird.coin` → `spec`. |

## Testes

- **Geração** (`tests/core/spawn/`): coletáveis com x crescente, ids 0..n, `type: 'collectible'`,
  tag `bird.coin`; placement dentro das margens; clone isola estado. Obstáculos seguem verdes
  (retrocompat do gerador).
- **Coleta** (`tests/core/sim/collect.test.ts`): `collect` incrementa `food` e remove o coletável;
  idempotente (2ª chamada = no-op, food não dobra); retorna `false` para entidade ausente.
- **Mundo** (`tests/core/sim/`): `createWorld` ⇒ `food === 0`; com seed gera coletáveis no `step`;
  sem seed `collectibleSpawner === null`; `cloneWorld` copia `food` e isola o gerador.
- **Determinismo** (`tests/determinism/`): mesma seed ⇒ mesma sequência de coletáveis; seeds
  diferentes ⇒ diferentes; independência de batching; **stream de coletáveis ≠ stream de
  obstáculos** (forks independentes). `verify-determinism` verde.

## Definição de pronto
`npm run check` limpo, `npm test` verde, bateria de determinismo verde (`verify-determinism`),
asset-spec + registro atualizados, item 1.5 marcado `[x]` na fase e "Estado atual" do CLAUDE.md.
