# 3.4 — Clima que afeta o gameplay (determinístico)

> Spec da feature. Fase 3, item 3.4. Modo autônomo (SDD).
> Regras inegociáveis: `CLAUDE.md`. Contrato: `docs/architecture/DETERMINISM.md` (§4, §6).

## Objetivo

Introduzir **condições climáticas que alteram a física da simulação** de forma
**bit-determinística**, derivadas da seed da partida e amostradas por **distância**
(nunca por tempo de parede, nunca por aleatoriedade fora do `Rng` semeado).

Primeiro item da Fase 3 que **volta a tocar `src/core/`** e a simulação. Todo o resto da
fase (slow-mo, tempo do dia) viveu só no render; clima é gameplay determinístico e passa
pela bateria de determinismo + `determinism-guardian`.

DETERMINISM.md §6 já reserva o contrato: *"Vento/tempestade/neve alteram física, mas
sempre como função do estado determinístico — nunca aleatório fora do `Rng` semeado."*

## Escopo

**No escopo:**
- Cinco climas: `clear`, `rain`, `wind`, `storm`, `snow`.
- Efeito de cada clima na **física vertical** (gravidade efetiva + empuxo/vento vertical).
- `WeatherGenerator` determinístico keyed por distância (segmentos), stream RNG dedicado.
- Integração no `step`/`world`/`cloneWorld` e no registro determinístico (`hashState`,
  completeness, goldens re-pinados).
- Indicador textual de clima no HUD (i18n, 10 locales) como feedback ao jogador.

**Fora do escopo (adiado):**
- **VFX real** de clima (partículas de chuva/neve, escurecimento de tempestade, linhas de
  vento, tint dedicado) → **Fase 8** (arte). Consistente com 3.1/3.2/3.3, que adiaram
  indicadores visuais dedicados.
- **Vento horizontal** (mudar `scrollSpeed`/distância) → **rejeitado nesta iteração** por
  acoplar clima ↔ distância ↔ dificuldade ↔ economia. Pode virar tuning futuro.
- **Rajadas contínuas suaves** (windY variando por ruído ao longo da distância) → começamos
  com segmentos **piecewise-constant** (mais simples de testar); suavização é tuning futuro.
- **Distribuição ponderada** de climas (ex.: `clear` mais provável) e tuning dos valores de
  física/duração → placeholders agora, balanceamento na Fase 8 (mesmo padrão dos pesos de
  obstáculo e das durações de power-up).

## Modelo (por que "eixo vertical apenas")

Este é um side-scroller estilo Flappy: o **eixo de gameplay é o vertical** (flap × gravidade).
Fazer o clima atuar só na física vertical:

- **Mantém o clima desacoplado** de distância, dificuldade, economia e spawns. O scroll
  horizontal e `world.distance` são idênticos com ou sem clima ⇒ obstáculos/coletáveis/
  power-ups (keyed por distância, em streams RNG próprios) nascem **byte-idênticos**. Só a
  **trajetória vertical do dino** muda. Mesma filosofia limpa do slow-mo (3.2), que isolou
  o efeito numa única garganta.
- **É testável e verificável**: o efeito é uma diferença clara na aceleração vertical.

`fork('weather')` deriva um stream RNG **independente** dos streams `obstacles`/
`collectibles`/`powerups` já existentes ⇒ adicioná-lo **não perturba** as sequências atuais
desses conteúdos (só re-pinamos goldens porque a *trajetória* do dino e o *formato do hash*
mudam, não porque os spawns mudaram).

## Arquitetura

Novo módulo-folha puro `src/core/weather/` (sem phaser, sem DOM, sem fontes proibidas),
espelhando a organização de `src/core/powerup/` e `src/core/spawn/`.

```
src/core/weather/
  types.ts       WeatherKind, WeatherPhysics, WeatherConfig
  catalog.ts     WEATHER_KINDS (ordem estável), WEATHER_PICK_CATALOG, WEATHER_PHYSICS map,
                 weatherPhysics(kind) → {gravityScale, windY}
  constants.ts   placeholders de tuning (segment min/max, warmup, valores de física)
  generator.ts   WeatherGenerator (keyed por distância)
  index.ts       barrel público
```

### `types.ts`

```ts
export type WeatherKind = 'clear' | 'rain' | 'wind' | 'storm' | 'snow';

/** Modificadores de física vertical de um clima (dados puros). */
export interface WeatherPhysics {
  /** Multiplica a gravidade efetiva do step. clear = 1. */
  gravityScale: number;
  /** Aceleração vertical constante adicional (unidades/s²; +y para baixo). clear = 0.
   * Negativo = empuxo/updraft (sobe); positivo = downdraft (empurra p/ baixo). */
  windY: number;
}

/** Parâmetros de segmentação do WeatherGenerator (dados puros). */
export interface WeatherConfig {
  readonly warmupDistance: number; // distância inicial garantida 'clear'
  readonly segmentMin: number;     // comprimento mínimo de um segmento (distância)
  readonly segmentMax: number;
}
```

### `catalog.ts`

- `WEATHER_KINDS: readonly WeatherKind[]` — **ordem estável** (para HUD/registro), inclui
  os 5.
- `WEATHER_PICK_CATALOG: readonly WeatherKind[]` — o que o gerador sorteia (inclui `clear`,
  para que haja trechos calmos; peso uniforme por ora, ponderação adiada).
- `WEATHER_PHYSICS: Record<WeatherKind, WeatherPhysics>` (`Object.freeze`) + função pura
  `weatherPhysics(kind)`. Placeholders:

  | kind  | gravityScale | windY | intenção |
  |-------|--------------|-------|----------|
  | clear | 1.00 | 0    | baseline (física idêntica a hoje) |
  | rain  | 1.15 | 0    | asas pesadas/molhadas: cai mais rápido |
  | wind  | 1.00 | −120 | updraft: empuxo p/ cima, "flutua" |
  | storm | 1.25 | +90  | pesado + downdraft: mais difícil |
  | snow  | 0.80 | 0    | leve/à deriva: cai devagar |

  (valores em unidades abstratas, +y p/ baixo; tuning adiado à Fase 8.)

### `generator.ts` — `WeatherGenerator` (keyed por distância)

Espelha `SpawnGenerator`: consome **só** o `Rng` dado, avança um **cursor por distância**,
independente de batching/fps.

```ts
class WeatherGenerator {
  constructor(rng: Rng, config?: WeatherConfig)
  get current(): WeatherKind
  /** Avança o cursor até `distance`, atualizando o clima corrente. Idempotente/monótono. */
  advanceTo(distance: number): void
  clone(): WeatherGenerator // rng.clone() + cursor + kind atual
}
```

- Estado interno: `currentKind` (inicia `'clear'`), `nextChangeX` (inicia
  `config.warmupDistance`).
- `advanceTo(distance)`: `while (distance >= nextChangeX) { currentKind = rng.pick(
  WEATHER_PICK_CATALOG); nextChangeX += rng.range(segmentMin, segmentMax); }`.
- **Independência de batching/fps:** o número de saques = número de fronteiras de segmento
  cruzadas = função só de `distance` (monótona). Um step que salte várias fronteiras
  consome todos os saques no laço; idêntico a atravessar de a pouco. (Mesma propriedade que
  já provamos para os spawners.)

### Integração no core

**`WorldState` (types.ts)** — dois campos novos:
- `weather: WeatherKind` — clima ativo (default `'clear'`).
- `weatherGenerator: WeatherGenerator | null` — `null` sem seed (como os spawners).

**`WorldConfig`** — `weather?: boolean` (default `true`; espelha `difficulty?`). `false` ⇒
sem gerador ⇒ clima sempre `'clear'` ⇒ física baseline (permite golden "clima off").

**`createWorld`** — constrói `weatherGenerator` só quando `seed !== undefined && weather`,
via `createRng(seed).fork('weather')`. `weather` inicia `'clear'`.

**`cloneWorld`** — copia `weather` (string) e `weatherGenerator?.clone() ?? null`.

**`step` (step.ts)** — no **início** do step (após `world.tick += 1`, **antes** da
integração vertical), resolve o clima da distância **corrente** (início do step) e aplica:

```ts
if (world.weatherGenerator) {
  world.weatherGenerator.advanceTo(world.distance);
  world.weather = world.weatherGenerator.current;
}
const wp = weatherPhysics(world.weather); // { gravityScale, windY }
...
// integração vertical passa a usar:
vel.y += (world.gravity * wp.gravityScale + wp.windY) * FIXED_DT;
```

- Amostrar em `world.distance` de **início de step** (o clima é `f(distância no início do
  step)`) mantém o efeito aplicado **neste** step, sem lag. Determinístico: `distance` é
  determinística.
- `weatherPhysics('clear')` = `{1, 0}` ⇒ quando não há gerador, a linha vira
  `vel.y += world.gravity * FIXED_DT` (comportamento de hoje). Sem regressão física para
  mundos sem clima.
- Alocação-zero: `weatherPhysics` devolve uma ref de objeto congelado do catálogo (não
  aloca); `advanceTo` só mexe em escalares. Hot path limpo (REGRA 3).

### Registro determinístico (obrigatório)

`hashState` (replay/hash.ts): absorver os dois campos novos, em posição fixa:
- `d.string(world.weather)`
- `d.bool(world.weatherGenerator !== null)` (presença, como os outros geradores; o estado
  interno do gerador se manifesta no `weather` corrente + na trajetória do dino).

`tests/core/replay/hash-completeness.test.ts`: `EXPECTED_WORLD_KEYS` **24 → 26** (adicionar
`weather`, `weatherGenerator`, em ordem alfabética).

`tests/determinism/replay.determinism.test.ts`: **re-pinar os 4 goldens**. Todos mudam: os
seeded porque a trajetória vertical do dino muda; o "sem seed" porque o **formato** do hash
cresceu (`d.string('clear')` + `d.bool(false)`). Regenerar rodando os cenários e capturando
os hashes (documentar no commit que a mudança é esperada). Manter as asserções relacionais
(`GOLD1 ≠ GOLD2`, `difficulty on ≠ off`).

## Render (feedback mínimo ao jogador)

Sem VFX (Fase 8). Único acréscimo: **linha de clima no HUD**.

- `hud.ts`: `HudRaw`/`HudView` ganham `weather: string`; `formatHudValues` faz passthrough
  do kind. O **rótulo/nome traduzido** vem da i18n (não formatar nome no módulo puro).
- `GameScene`: acrescenta a linha `hud.weather` lendo `world.weather`, no mesmo refresh
  throttled (~5 Hz) das demais linhas. Alocação de string só no refresh (fora do hot path).
- **i18n (REGRA 4, 10 locales):** chave-rótulo `hud.weather` (`{{value}}`) + nomes por clima
  `weather.{clear,rain,wind,storm,snow}`. Paridade garantida por
  `tests/i18n/locales.test.ts`.

Isso dá **feedback legível** (o jogador vê por que a física mudou) e um alvo de verificação
visual (Playwright: HUD mostra o clima; trajetória do dino difere entre climas).

## Testes

Core (Vitest, TDD rigoroso):
- **`weatherPhysics`**: mapeia cada kind ao par esperado; `clear` = `{1, 0}`.
- **`WeatherGenerator`**:
  - warmup: `current === 'clear'` antes de `warmupDistance`.
  - determinismo: mesma seed ⇒ mesma **sequência** de `current` amostrada em marcos de
    distância.
  - **independência de batching**: avançar em 1 salto grande vs vários pequenos até a mesma
    distância ⇒ mesmo `current` e mesmo estado (via `clone`/re-simulação).
  - `clone()` produz cópia independente (mutar um não afeta o outro).
- **step/integração**: com seed + `weather:true`, a trajetória vertical difere de
  `weather:false` sob a mesma timeline (efeito real); com `weather:false`, resultado idêntico
  a um mundo sem o conceito (baseline). Um clima de `gravityScale>1`/`windY≠0` move o dino
  de forma esperada num cenário controlado (config de clima injetada para forçar um kind).
- **Determinismo end-to-end** (`tests/determinism/`): reprodutibilidade + independência de
  fps (1/2/5 steps por frame) de uma partida **com clima ativo** ⇒ hash idêntico. Goldens
  re-pinados verdes. `determinism-guardian` confirma contrato intacto.

Render:
- `formatHudValues` inclui `weather` (unit).
- `locales.test.ts` valida as novas chaves nos 10 locales.

## Definição de pronto

- `npm run check` limpo, `npm test` verde, bateria de determinismo verde (com cenário de
  clima ativo), goldens re-pinados.
- `determinism-guardian`: "contrato intacto".
- Item 3.4 marcado `[x]` em `PHASE-03`; "Estado atual" do `CLAUDE.md` atualizado.
- Integrado ao `main` (merge local `--no-ff` se sem remote; PR + auto-merge se houver `gh`).
</content>
</invoke>
