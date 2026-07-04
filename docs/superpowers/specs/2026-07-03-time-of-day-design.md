# Design — Tempo do dia (cosmético) — Fase 3, item 3.3

**Data:** 2026-07-03
**Item do roadmap:** `docs/roadmap/PHASE-03-powerups-and-weather.md` § 3.3
**Escopo:** manhã/tarde/entardecer/noite — paletas/iluminação de fundo. **NÃO afeta a simulação.**

## 1. Objetivo e restrições

Dar atmosfera visual às partidas com uma paleta de "tempo do dia", **sem tocar em nada
determinístico**. Restrições inegociáveis:

- **REGRA 1 (determinismo):** `src/core/` **não é tocado**. O tempo do dia não lê nem escreve
  `WorldState`, não altera `step`, não muda spawns/score/dificuldade. A bateria de determinismo
  (61 testes) fica **inalterada** — é uma feature de camada de render, como parallax (2.3),
  HUD (2.4) e os cosméticos de slow-mo pendentes.
- **REGRA 2 (arte desacoplada):** paletas são dados; trocar por arte real (gradientes/sprites de
  céu, Fase 8) é editar o catálogo, não a lógica.
- **REGRA 3 (performance):** aplicar a paleta é trabalho de **transição** (na criação da cena e
  quando a seed da partida muda no restart), nunca por frame. Hot path continua zero-alloc.
- **REGRA 4 (i18n):** nenhuma string visível ao usuário — só cores. Nada a traduzir (como 3.1/3.2).

## 2. Modelo: derivado da seed, puro, só render

O tempo do dia de uma partida é **função determinística da seed da partida** (o rótulo que o
`MatchController` já expõe via `seedLabel` e que o HUD já mostra):

```
timeOfDayForSeed(seed) = TIME_OF_DAY_ORDER[ hashSeed(seed) % TIME_OF_DAY_ORDER.length ]
```

`hashSeed` (de `@core/rng`) é o hash `xmur3` **portável** já usado pelo core (só `Math.imul`/
`>>>0`), então a seleção é estável entre plataformas. Consequências:

- **Endless:** cada partida nasce com uma seed aleatória (token Crockford), então a paleta varia
  de partida para partida "de graça".
- **Diário/Semanal (Fase 5):** mesma seed ⇒ mesma atmosfera para todos os jogadores — propriedade
  desejável e reproduzível, sem custo extra.
- **Testável 100% sem Phaser:** a escolha e o catálogo são puros.

Alternativas descartadas:

- **Relógio de parede** (`Date`/hora real do jogador): quebra reprodutibilidade, exige fonte de
  tempo real na camada de render, e não agrega ao gameplay determinístico. Rejeitado.
- **Ciclo por distância dentro da partida** (amanhecer→dia→anoitecer conforme voa): mais vistoso,
  porém mais complexo (interpolação de paletas por frame, decisão de "quão rápido passa o dia") e
  sem pedido no spec. Fica como evolução futura possível sobre este mesmo catálogo. Rejeitado por
  YAGNI para o primeiro item cosmético.

## 3. Componentes

### 3.1 `src/render/daynight.ts` (PURO — sem `phaser`, testável em env node)

```ts
export type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night';

/** Cores de uma fase do dia. parallaxTint é multiplicativo (0xffffff = sem alteração). */
export interface DayNightPalette {
  readonly sky: number;          // fundo da câmera
  readonly ground: number;       // faixa de chão
  readonly ceiling: number;      // faixa de teto
  readonly parallaxTint: number; // tint aplicado às silhuetas de parallax
}

/** Ordem estável usada na seleção por módulo. Trás→frente do dia. */
export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] =
  ['morning', 'afternoon', 'dusk', 'night'];

export const DAY_NIGHT_PALETTES: Readonly<Record<TimeOfDay, DayNightPalette>> = { … };

export function timeOfDayForSeed(seed: string): TimeOfDay { … }
export function paletteFor(tod: TimeOfDay): DayNightPalette { … }
```

- **`afternoon`** herda o visual atual (sky = `SKY_COLOR` de hoje, `parallaxTint = 0xffffff`,
  ground/ceiling = as cores atuais) ⇒ o look presente vira uma das fases, sem regressão visual.
- **`morning`**: céu levemente rosado/quente, tint morno suave.
- **`dusk`**: céu laranja/pôr-do-sol, tint quente mais forte.
- **`night`**: céu azul-marinho escuro, tint frio/escuro nas silhuetas, chão/teto escurecidos.
- Valores concretos são **placeholders de tuning** (cosmético, Fase 8 refina), documentados no
  catálogo.

### 3.2 Casca na `GameScene` (não testada por unidade — como parallax/HUD)

- Guardar refs: a `Graphics` das faixas chão/teto (hoje anônima em `create()`) vira `this.bandsGfx`;
  um `this.appliedDayNightSeed: string | null` para detectar troca.
- Método `applyDayNight(seed: string)`:
  1. `const p = paletteFor(timeOfDayForSeed(seed))`.
  2. `this.cameras.main.setBackgroundColor(p.sky)`.
  3. redesenha `this.bandsGfx` (clear + faixas com `p.ceiling`/`p.ground`).
  4. `for (tile of this.parallaxTiles) tile.setTint(p.parallaxTint)`.
- Chamado em `create()` com a seed inicial e no `update()` **apenas quando**
  `match.seedLabel !== this.appliedDayNightSeed` (restart trouxe nova seed) ⇒ trabalho só na
  transição, zero-alloc por frame (REGRA 3). Compara-e-aplica é barato; a comparação de strings por
  frame não aloca.
- `game.ts` mantém `backgroundColor: SKY_COLOR` como fallback inicial; a cena sobrescreve por partida.

## 4. Determinismo

Nenhum arquivo de `src/core/` muda. `WorldState`, `hashState`, os goldens e a bateria de
determinismo ficam **byte-idênticos**. Ainda assim, roda-se `verify-determinism` ao final como
prova (esperado: 61 verdes, inalterados). `daynight.ts` importa apenas `hashSeed` (função pura,
já portável) de `@core/rng` — sem violar a fronteira (render pode importar do core; o proibido é o
core importar de render/DOM).

## 5. Testes (Vitest, `tests/render/daynight.test.ts`, env node — módulo puro)

1. **Completude do catálogo:** todo `TimeOfDay` de `TIME_OF_DAY_ORDER` tem entrada em
   `DAY_NIGHT_PALETTES`, e vice-versa (nenhuma fase órfã). Guarda de exaustividade para que uma
   fase nova não passe silenciosamente sem paleta.
2. **Determinismo de `timeOfDayForSeed`:** a mesma seed devolve sempre a mesma fase; o resultado
   está sempre em `TIME_OF_DAY_ORDER`.
3. **Variedade:** um conjunto representativo de seeds (ex.: vários `endless:<token>`) cobre mais de
   uma fase — sanidade de que a seleção não colapsa numa fase só.
4. **Paletas válidas:** cada paleta expõe os 4 campos como inteiros de cor (0..0xffffff).

Sem testes de Phaser (a casca segue o padrão sem-teste-de-unidade de 2.3/2.4).

## 6. Fora de escopo (adiado)

- **Ciclo dinâmico dia→noite dentro da partida** (transição suave por distância). Possível evolução
  sobre este catálogo; não pedido no 3.3.
- **Indicador textual/HUD do tempo do dia** e rótulos i18n — cosmético não precisa; se um dia
  precisar, entra com chaves nos 10 locais.
- **Arte real de céu** (gradientes, nuvens, estrelas à noite, lua/sol) e tint refinado — Fase 8;
  o ramo `sprite` de parallax e o catálogo de paletas são os ganchos.
- **Clima (3.4)** — este item é só cosmético; clima afeta física e é o próximo item.

## 7. Definição de pronto

- `daynight.ts` puro + testes verdes; catálogo com 4 fases; seleção determinística por seed.
- `GameScene` aplica a paleta na criação e no restart (nova seed), sem custo por frame.
- `npm run check` limpo, `npm test` verde, `npm run test:determinism` **inalterado** (61 verdes).
- Verificação visual: fases distintas produzem céus/silhuetas distintos; restart pode trocar a fase.
- Nota nos asset-specs `bg.layer.*` de que os fundos são tingidos por tempo do dia (REGRA 2/5).
