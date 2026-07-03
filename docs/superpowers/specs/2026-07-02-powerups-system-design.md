# Design — 3.1 Sistema de power-ups (core + render)

> Fase 3, item 3.1. Framework de efeitos temporários (duração em steps) + power-ups
> coletáveis, tudo **determinístico** (REGRA 1). Render desenha os pickups (REGRA 2/5).

## Objetivo e escopo

Dar profundidade ao gameplay com power-ups que o pterodáctilo coleta em voo. Entregar:

1. **Framework de efeitos temporários** com duração medida em *steps* da simulação.
2. **4 power-ups funcionais**: escudo, vida extra, ímã, moeda-dobrada. Ganchos para mais.
3. **Geração determinística keyed por distância** (reusa `SpawnGenerator` num 3º stream de RNG).
4. **Testes de cada efeito** (determinísticos) + suíte de determinismo (reprodutibilidade +
   independência de fps) + goldens de replay atualizados.

### Decisões de escopo (autônomas)

- **Câmera lenta (slow-mo) fica para o item 3.2.** O roadmap dedica o 3.2 inteiro a
  "câmera lenta sem quebrar determinismo" (o efeito exige um modelo de percepção de tempo no
  loop de render). 3.1 deixa o **gancho** pronto: `PowerupKind` é extensível e o framework
  aceita um efeito temporário novo sem retrabalho. 3.1 **não** spawna slow-mo (seria pickup
  inerte). 3.2 adiciona a entrada no catálogo + a lógica de percepção.
- **Vida extra salva qualquer morte** (colisão com obstáculo **e** chão): reviver o dino no
  centro vertical, zerar a velocidade e conceder uma janela curta de escudo (invulnerabilidade).
  Alternativa (salvar só de obstáculo) foi descartada por ser menos esperada pelo jogador.
- **Moeda-dobrada** = cada pássaro-moeda coletado vale `food += 2` enquanto ativo (casa com a
  nota adiada do item 1.8: "multiplicador de comida ('moeda dobrada')"). Não é o
  `scoreMultiplier` genérico (que segue disponível para outras fontes).
- **Sem texto novo de UI em 3.1** (nenhuma string i18n nova). Renderizamos só os pickups como
  primitivas geométricas coloridas. Indicadores de efeito ativo (aura de escudo, timer/ícones no
  HUD) e rótulos textuais ficam para polimento de render posterior (nota nos adiados).

## Arquitetura

Segue os padrões já firmados nas Fases 1–2: **lógica pura em `src/core/`, casca fina no render**;
conteúdo procedural via `SpawnGenerator` keyed por distância com um stream de RNG dedicado por
feature; estado do mundo é **dados puros** (sem funções) para preservar `cloneWorld`/`hashState`.

### Novo módulo-folha: `src/core/powerup/`

Dados + comportamento puros, sem DOM/Phaser, sem APIs proibidas (`Math.sqrt` é permitido — já
usado em `@core/collision`).

- **`types.ts`**
  - `PowerupKind = 'shield' | 'extraLife' | 'magnet' | 'doubleCoin'` (extensível; `'slowMo'` em 3.2).
  - `ActiveEffect = { kind: PowerupKind; remaining: number }` — efeito temporário ativo (steps
    restantes). Vida extra **não** é um efeito temporário: é uma carga (contador) em
    `WorldState.extraLives`, não entra em `ActiveEffect[]`.
- **`effects.ts`** — o *framework* (funções puras sobre `ActiveEffect[]`):
  - `activateEffect(effects, kind, durationSteps)` — se já existe efeito do `kind`, faz
    `remaining = Math.max(remaining, durationSteps)` (re-pickup estende, determinístico); senão
    dá `push`.
  - `tickEffects(effects)` — decrementa `remaining` de todos; remove os que chegam a 0 (itera de
    trás para frente por causa do splice). Chamado **1× por step, no fim**.
  - `isEffectActive(effects, kind): boolean` — busca linear com `for` (array ≤ 4; sem closure ⇒
    zero alocação).
  - `cloneEffects(effects)` — cópia rasa de cada `{kind, remaining}` (para `cloneWorld`).
- **`catalog.ts`** — o "menu" de power-ups (análogo a `OBSTACLE_CATALOG`):
  - `POWERUP_CATALOG: readonly SpawnType[]` — 4 tipos flutuantes (`anchor:'floating'`), hitbox
    circular. `id`s: `powerup.shield`, `powerup.extraLife`, `powerup.magnet`, `powerup.doubleCoin`.
  - `powerupKindForTag(tag: string): PowerupKind | null` — mapeia o `id` (tag da entidade) para o
    `PowerupKind`. Tabela explícita (não parsing de string).
- **`constants.ts`** — durações (placeholders de tuning) e parâmetros:
  - `SHIELD_DURATION_STEPS`, `MAGNET_DURATION_STEPS`, `DOUBLE_COIN_DURATION_STEPS`.
  - `EXTRA_LIFE_GRACE_STEPS` (escudo curto concedido ao reviver).
  - `MAGNET_RADIUS`, `MAGNET_PULL_SPEED` (unidades/s).
  - `DOUBLE_COIN_FOOD_GAIN = 2` (vs 1 normal).
  - `DEFAULT_POWERUP_CONFIG: SpawnConfig` — gaps grandes (power-ups são raros).

O **comportamento** de cada efeito vive em código (funções puras), não em dados no estado
(mesma disciplina de `Hitbox` + `overlaps`). Adicionar um power-up = entrada no catálogo +
`powerupKindForTag` + um caso no dispatch de pickup/efeito + (se novo kind) a união + manifesto +
asset-spec. Os `switch` exaustivos com `default: never` forçam completude ao compilar.

### Estado do mundo (`src/core/sim/types.ts` + `world.ts`)

Novos campos em `WorldState` (todos com clone profundo e hashing):

| Campo | Tipo | Init | Papel |
|-------|------|------|-------|
| `powerups` | `Entity[]` | `[]` | pickups de power-up materializados no mundo |
| `powerupSpawner` | `SpawnGenerator \| null` | `null` sem seed | gerador keyed por distância |
| `effects` | `ActiveEffect[]` | `[]` | efeitos temporários ativos |
| `extraLives` | `number` | `0` | cargas de vida extra acumuladas |

`buildPowerupSpawner(seed, worldHeight)` usa `createRng(seed).fork('powerups')` — **stream
independente** de `obstacles` e `collectibles` (mesma seed ⇒ sequências independentes e estáveis).
`cloneWorld` copia `powerups.map(cloneEntity)`, `effects` via `cloneEffects`, `extraLives`, e
`powerupSpawner?.clone()`.

### Integração no `step` (`src/core/sim/step.ts`)

Ordem dentro do step (mantendo o hot path alocação-zero — REGRA 3):

1. Física / scroll / dificuldade (inalterado).
2. **Chão/teto:** a morte no chão passa a rotear por `killOrRevive(world)` (ver abaixo).
3. Spawn + cull de obstáculos, coletáveis **e power-ups** (espelha os dois existentes; cull por
   `rightExtent`).
4. **Ímã:** se `isEffectActive(effects,'magnet')`, `applyMagnet(world)` — puxa cada coletável
   dentro de `MAGNET_RADIUS` em direção ao dino por até `MAGNET_PULL_SPEED*FIXED_DT`
   (normaliza com `Math.sqrt`; move `position` do coletável). Antes da passada de coleta ⇒ moeda
   puxada pode ser coletada no mesmo step.
5. **Colisão dino×obstáculo:** se `isEffectActive(effects,'shield')`, **ignora** a colisão (passa
   através); senão, colisão letal → `killOrRevive(world)`. Near-miss inalterado.
6. **Coleta dino×coletável:** `collect(world, c)` — o ganho de comida vira
   `isEffectActive(effects,'doubleCoin') ? DOUBLE_COIN_FOOD_GAIN : 1`.
7. **Pickup dino×power-up:** para cada `powerups[i]` que sobrepõe o dino, `pickupPowerup(world, e)`
   — remove do mundo (splice) e despacha por kind: temporário → `activateEffect(kind, duração)`;
   `extraLife` (carga) → `extraLives += 1`.
8. Acúmulo de score (inalterado).
9. **`tickEffects(effects)`** no fim (decremento de duração).

`killOrRevive(world)`: se `extraLives > 0` → `extraLives -= 1`; mantém `alive`; `vel.y = 0`;
`pos.y = worldHeight/2`; `activateEffect(effects,'shield', EXTRA_LIFE_GRACE_STEPS)` (evita morte
imediata no mesmo obstáculo/no chão). Senão → `alive = false` (comportamento atual).

**Semântica de duração (fixada por teste):** ativar em step T seta `remaining = N`; o decremento
é no **fim** de cada step. Escudo/ímã/moeda-dobrada valem enquanto `remaining > 0` no ponto de
checagem. Como o pickup ocorre *depois* das passadas de colisão/coleta do step T, o efeito começa
a valer no step T+1 e dura N steps. Testes pinam a contagem exata.

### Determinismo (`hashState` + guardas)

`hashState` (`src/core/replay/hash.ts`) passa a codificar, em ordem fixa: `powerups` (lista de
`Entity`, já suportada por `encodeEntity`), `effects` (comprimento + cada `{kind:string,
remaining:number}`), `extraLives` (number), e a presença de `powerupSpawner` (bool). Atualizar:

- `EXPECTED_WORLD_KEYS` em `tests/core/replay/hash-completeness.test.ts` (20 → 24 campos).
- Re-gerar os pinos dourados em `tests/determinism/replay.determinism.test.ts`.

O `default: never` do switch de `Hitbox` continua valendo. (Se um novo *kind* de efeito
discriminado fosse introduzido, valeria um `never` análogo — não é o caso aqui; `ActiveEffect`
é um struct plano.)

### Render (`src/render/`)

Casca fina, sem tocar a simulação (REGRA 1):

- `ASSET_MANIFEST` (`manifest.ts`): 4 entradas `primitive` (cores dos asset-specs) para
  `powerup.{shield,extraLife,magnet,doubleCoin}`. A guarda de completude do manifesto
  (`tests/render/manifest.test.ts`) passa a exigir os ids de `POWERUP_CATALOG`.
- `GameScene.update`: mais uma linha `this.drawVisible(g, world.powerups, scrollX)` — culling e
  desenho por hitbox reaproveitados (zero alocação por frame).

Sem indicadores de efeito ativo nem HUD de power-up nesta iteração (adiado).

## Componentes e interfaces (resumo)

- `src/core/powerup/` — `PowerupKind`, `ActiveEffect`, `activateEffect/tickEffects/isEffectActive/
  cloneEffects`, `POWERUP_CATALOG`, `powerupKindForTag`, `applyMagnet`, `pickupPowerup`,
  `killOrRevive`, constantes. Reexport via `index.ts`.
- `src/core/sim/` — novos campos de estado, wiring no `step`, `collect` respeita moeda-dobrada.
- `src/core/replay/hash.ts` — encode dos novos campos.
- `src/render/manifest.ts` + `GameScene.ts` — desenho dos pickups.
- Asset-specs: `docs/assets/specs/powerup.{shield,extraLife,magnet,doubleCoin}.md` (REGRA 5) +
  registro.

## Testes

- **Unit (core/powerup):** `activateEffect` (novo/estende), `tickEffects` (decremento/expiração),
  `isEffectActive`, `powerupKindForTag`, `applyMagnet` (puxa dentro do raio, ignora fora),
  catálogo (kinds cobertos).
- **Unit (core/sim):** pickup ativa efeito/incrementa vida; escudo ignora colisão; vida extra
  revive (obstáculo e chão) e decrementa; moeda-dobrada dá +2; ímã coleta moeda puxada.
- **Determinismo:** `tests/determinism/powerups.determinism.test.ts` — mesma seed ⇒ mesma
  sequência de power-ups e mesmo estado final; independência de fps (1/2/5 steps por frame) numa
  timeline que exercita pickup + efeitos > 0; independência de stream (power-ups não perturbam
  obstáculos/coletáveis). Goldens de replay re-pinados.
- **Render:** guarda de completude do manifesto inclui os ids de power-up.

## Definição de pronto

`npm run check` limpo, `npm test` verde, bateria de determinismo verde
(`npm run test:determinism`), guarda de completude do hash/manifesto atualizadas. Power-ups
aparecem e funcionam em jogo (verificação visual). Item 3.1 marcado `[x]`; slow-mo explicitamente
transferido para 3.2.

## Não-objetivos / adiados

- **Slow-mo** (item 3.2) — efeito + modelo de percepção de tempo.
- Indicadores visuais de efeito ativo (aura, timer, ícones) e rótulos i18n de power-up.
- Tuning real de durações/raio/frequência de spawn e distribuição ponderada de tipos (placeholders).
- Conversão comida→saldo de moedas e persistência (Fases 4).
