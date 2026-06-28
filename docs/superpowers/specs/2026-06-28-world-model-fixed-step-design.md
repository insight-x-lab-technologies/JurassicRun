# Spec — Item 1.3: Modelo de mundo + loop de passo fixo

> Fase 1 (núcleo determinístico headless). Fundação de toda a simulação.
> Spec autônoma (modo `/next-item`): decisões técnicas tomadas pela recomendação, sem gate humano.

## Objetivo

Estabelecer o **modelo de dados do mundo** (`WorldState`, `Entity`, `Hitbox`) e o **loop de
passo fixo** (`step(world, input)`) do JurassicRun, com a física do pterodáctilo (gravidade,
flap) e o scroll horizontal — tudo headless, em TS puro, determinístico e coberto por testes.

Este item **não** inclui geração de obstáculos (1.4), coletáveis (1.5), colisão dino×obstáculo
(1.6), dificuldade (1.7), economia (1.8) nem golden master (1.9). Ele cria a base que esses
itens consomem.

## Contexto e contratos herdados

- `docs/architecture/ARCHITECTURE.md` — "Modelo de dados do mundo" e "Loop de simulação".
- `docs/architecture/DETERMINISM.md` — fontes proibidas, passo fixo, matemática portável.
- `src/core/rng/` e `src/core/seed/` já existem (não usados aqui; RNG entra em 1.4).

## Decisões de design

### Sistema de coordenadas e unidades
- Unidades **abstratas** independentes de resolução; o render escala para o viewport (Fase 7).
- **+y = para baixo** (convenção de tela, alinhada ao Phaser). Eixo x cresce para a direita.
- Mundo vertical limitado: **teto em `y = 0`** (clamp — o pterodáctilo não sai por cima) e
  **chão em `y = WORLD_HEIGHT`** (tocar = morte).
- O pterodáctilo avança em **+x** a `SCROLL_SPEED` (ele voa para frente; o render translada para
  dar a sensação de mundo rolando à esquerda). `distance` acompanha esse avanço.

### Relógio e passo fixo
- `FIXED_DT = 1/60` s. O **`tick` inteiro** é o relógio canônico da simulação
  (`tempo = tick * FIXED_DT` quando necessário). O core **nunca** recebe `dt` variável; o
  acumulador de tempo é responsabilidade da camada de render (ARCHITECTURE).

### Estado e mutação
- `step(world, input): void` **muta `world` in-place** — regra de performance (zero alocação por
  frame no hot path). Determinístico: mesmo `world` inicial + mesma sequência de `InputFrame` ⇒
  estado final idêntico.
- `createWorld(config?)` constrói um mundo inicial; `cloneWorld(world)` faz cópia profunda
  (snapshots para testes/golden master/replay e para o buffer prev↔current do render).
- Hash/golden master fica para o item **1.9**; aqui os testes comparam via deep-equal de clones.

### Física do pterodáctilo
- Integração **Euler semi-implícita**, passo `FIXED_DT` constante:
  - `velocity.y += GRAVITY * FIXED_DT;  position.y += velocity.y * FIXED_DT`
  - `position.x += SCROLL_SPEED * FIXED_DT;  distance += SCROLL_SPEED * FIXED_DT`
- **Flap** = impulso por *set* de velocidade: na borda de subida do botão (false→true entre
  steps), `velocity.y = -FLAP_SPEED` (para cima). O sim detecta a borda guardando o estado
  anterior do botão em `world` (`lastFlap`). Segurar o botão **não** re-dispara o flap.
- **Teto:** se `position.y < 0` ⇒ `position.y = 0` e `velocity.y = 0` (clamp).
- **Chão:** se `position.y >= WORLD_HEIGHT` (com a hitbox tocando o chão) ⇒ `alive = false`.
  Após morto, `step` é **no-op** (estado congelado).
- Apenas `+`, `−`, `*` com `dt` constante — **sem** `Math.sin/cos/pow` (portabilidade IEEE-754).
  As constantes de tuning são placeholders; afinadas na Fase 2. Testes verificam *relações* e
  reprodutibilidade, não números de gameplay específicos (exceto o teste de config fixo).

### Input
- `InputFrame { flap: boolean }` = **estado bruto do botão naquele step** (segurado ou não).
  A borda é detectada no sim. A timeline literal de inputs serve a replay e anti-cheat (1.9 / online).

## Modelo de dados

```ts
// Vetor 2D (dados puros).
interface Vec2 { x: number; y: number; }

// Hitbox lógica — independente da arte (REGRA 2). Polígono entra de fato em 1.6;
// a forma do tipo é definida agora para travar a interface.
type Hitbox =
  | { kind: 'aabb'; halfW: number; halfH: number }      // relativo ao centro do transform
  | { kind: 'circle'; radius: number }
  | { kind: 'polygon'; points: readonly Vec2[] };        // convexo, relativo ao centro

interface Transform { position: Vec2; }
interface Kinematics { velocity: Vec2; }

type EntityType = 'obstacle' | 'collectible';

// Entidade genérica para conteúdo procedural (1.4/1.5). SEM dados visuais.
interface Entity {
  id: number;
  type: EntityType;
  transform: Transform;
  hitbox: Hitbox;
  kinematics: Kinematics;
  tags: readonly string[];
}

// O pterodáctilo é um campo nomeado e tipado do mundo (ARCHITECTURE).
interface Pterodactyl {
  transform: Transform;
  kinematics: Kinematics;
  hitbox: Hitbox;
}

interface WorldState {
  tick: number;            // relógio inteiro (nº de steps já aplicados)
  distance: number;        // distância percorrida (unidades), base de score (1.8)
  scrollSpeed: number;     // velocidade horizontal atual (constante em 1.3; varia em 1.7)
  alive: boolean;
  lastFlap: boolean;       // estado do botão no step anterior (detecção de borda)
  pterodactyl: Pterodactyl;
  obstacles: Entity[];     // vazio em 1.3 (preenchido em 1.4)
  collectibles: Entity[];  // vazio em 1.3 (preenchido em 1.5)
}
```

## API pública (`@core/sim`)

```ts
export const FIXED_DT: number;            // 1/60
export const DEFAULT_WORLD_CONFIG: WorldConfig;

export interface WorldConfig {            // todos opcionais; default = constantes de tuning
  worldHeight?: number;
  gravity?: number;
  flapSpeed?: number;
  scrollSpeed?: number;
  startY?: number;
  pterodactylHitbox?: Hitbox;
}

export function createWorld(config?: WorldConfig): WorldState;
export function cloneWorld(world: WorldState): WorldState;   // cópia profunda
export function step(world: WorldState, input: InputFrame): void;  // muta in-place

// helpers de hitbox (dados, sem matemática de colisão — isso é 1.6)
export function aabb(halfW: number, halfH: number): Hitbox;
export function circle(radius: number): Hitbox;
```

## Estrutura de arquivos

```
src/core/sim/
  constants.ts   # FIXED_DT, GRAVITY, FLAP_SPEED, SCROLL_SPEED, WORLD_HEIGHT, START_Y, hitbox default
  types.ts       # Vec2, Hitbox, Transform, Kinematics, Entity, EntityType, Pterodactyl, WorldState, InputFrame, WorldConfig
  hitbox.ts      # aabb(), circle() (construtores de dados)
  world.ts       # createWorld(), cloneWorld()
  step.ts        # step() — integração + flap + bordas (teto/chão) + tick/distance
  index.ts       # barrel (re-exporta a API pública)
```

## Plano de testes

`tests/core/sim/`:
- **`world.test.ts`** — `createWorld` aplica defaults e config custom; pterodáctilo começa em
  `startY`, vivo, `tick=0`, arrays vazios. `cloneWorld` produz cópia profunda independente
  (mutar o clone não afeta o original).
- **`physics.test.ts`** — sob gravidade, `velocity.y` cresce e o pterodáctilo cai (y aumenta);
  flap na borda de subida zera/inverte a queda (velocity.y vira `-FLAP_SPEED`); segurar o botão
  não re-dispara; teto faz clamp (y nunca < 0); tocar o chão mata (`alive=false`) e congela o
  estado; `distance` e `position.x` avançam `SCROLL_SPEED*FIXED_DT` por step.
- **`step.test.ts`** — `tick` incrementa de 1 por `step`; `step` em mundo morto é no-op;
  detecção de borda do flap usa `lastFlap`.

`tests/determinism/`:
- **`sim.determinism.test.ts`**:
  - *Reprodutibilidade:* dada uma `InputTimeline` (array de `InputFrame`), rodar a simulação
    duas vezes a partir de mundos iniciais idênticos ⇒ estados finais deep-equal.
  - *Independência de fps:* rodar a **mesma** timeline com agrupamentos de **1, 2 e 5** steps por
    "frame" (batching do acumulador de render) ⇒ estado final idêntico nos três casos.
  - *Config fixo (golden de reprodutibilidade):* um `WorldConfig` fixo + timeline fixa produz um
    estado final estável entre execuções (pino de regressão de determinismo).

`tests/determinism/no-forbidden-apis.determinism.test.ts` já cobre `src/core/` inteiro
(inclui `sim/`) contra `Math.random`/`Date`/`performance.now`/timers — nada a adicionar.

## Critérios de aceite (Definição de pronto)
- `WorldState`/`Entity`/`Hitbox` definidos; `createWorld`/`cloneWorld`/`step` implementados.
- Física do pterodáctilo (gravidade, flap, teto, chão) e scroll funcionando headless.
- Teste de independência de fps (1/2/5 steps por frame ⇒ idêntico) **verde**.
- `npm test`, `npm run check` e `npm run test:determinism` limpos.
- `verify-determinism` passa; nenhuma fonte proibida em `src/core/sim/`.

## Fora de escopo (itens futuros)
- Geração de obstáculos/coletáveis e RNG no mundo → 1.4 / 1.5.
- Matemática de colisão (AABB/círculo/polígono) e near-miss → 1.6.
- Dificuldade variável (`scrollSpeed`/gaps/densidade) → 1.7.
- Score/economia → 1.8. Hash de estado / replay-runner / golden master → 1.9.
- Rotação no `Transform` (orientação de polígono) — adicionar só quando 1.6/render exigir.
