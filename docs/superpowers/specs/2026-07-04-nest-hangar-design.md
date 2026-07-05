# Design — 4.4 Ninho / Hangar

> Item 4.4 do roadmap (Fase 4, meta offline). Primeiro item da Fase 4 que **toca `src/core/`**.
> Regra inegociável de determinismo se aplica: mesma seed + mesmo dino ativo + mesmos inputs ⇒
> estado idêntico. Ver `docs/architecture/DETERMINISM.md`.

## Objetivo

Um **Ninho** (hangar) com ~10 pterodáctilos, cada um com um **traço** que altera a simulação.
O jogador possui, compra (com moeda) e seleciona um dino ativo; o traço do dino ativo entra na
partida como **parte do estado inicial** — determinístico. O default (starter) é grátis e já
possuído; os demais têm preço.

Escopo do 4.4 (roadmap `PHASE-04`):
- ~10 pterodáctilos com traços (ímã permanente, moeda 2x/3x, vida extra nata, etc.).
- Comprar com moeda; selecionar ativo. Traços entram na simulação deterministicamente.

## Camadas e responsabilidades

Respeita a regra de dependência única `app → services → core` (ARCHITECTURE.md).

```
app/screens/NestScreen  ─►  services/nest (NestService)  ─►  core/dino (traços)
app/game/startGame      ─►  nestService.activeTrait()    ─►  createWorld({ trait })
```

### 1. Core determinístico — `src/core/dino/` (módulo-folha puro, novo)

Módulo puro (sem `phaser`/DOM/IO; sem `Math.random`/`Date`/`performance.now`). Define os **tipos
de traço** e seus **modificadores de simulação**; NÃO conhece preços, nomes nem persistência (isso
é meta, vive em `services/nest`).

- `DinoTrait` — union de string dos traços:
  `'none' | 'magnet' | 'doubleFood' | 'tripleFood' | 'startLife' | 'headStart'`.
- `TraitModifiers` — modificadores puros que um traço aplica:
  ```ts
  interface TraitModifiers {
    readonly magnetAlways: boolean;   // ímã sempre ativo
    readonly foodMultiplier: number;  // multiplicador base de comida por coletável (1/2/3)
    readonly startExtraLives: number; // cargas de vida extra iniciais
    readonly startShieldSteps: number;// escudo de graça nos primeiros N steps
  }
  ```
- `TRAIT_CATALOG: Readonly<Record<DinoTrait, TraitModifiers>>` — registros congelados
  (`Object.freeze`). Tuning é **placeholder** (como difficulty/economy/powerup):
  - `none`      → `{magnetAlways:false, foodMultiplier:1, startExtraLives:0, startShieldSteps:0}`
  - `magnet`    → `{magnetAlways:true,  foodMultiplier:1, startExtraLives:0, startShieldSteps:0}`
  - `doubleFood`→ `{..., foodMultiplier:2}`
  - `tripleFood`→ `{..., foodMultiplier:3}`
  - `startLife` → `{..., startExtraLives:1}`
  - `headStart` → `{..., startShieldSteps: HEAD_START_SHIELD_STEPS}` (placeholder, p.ex. 180)
- `traitModifiers(trait: DinoTrait): TraitModifiers` — lookup **alocação-zero** (retorna a
  referência congelada do catálogo; nunca aloca por chamada ⇒ seguro no hot path do `step`).

### 2. Integração no modelo de mundo (`src/core/sim/`)

O traço vira **parte do estado inicial** da partida. Este é o ponto sensível a determinismo.

- `WorldConfig.trait?: DinoTrait` — traço do dino ativo (de fora do core, via `startGame`).
- `WorldState.trait: DinoTrait` — default `'none'`; copiado por `cloneWorld`.
- `createWorld`:
  - `const trait = config.trait ?? 'none'; const mods = traitModifiers(trait);`
  - `extraLives = mods.startExtraLives` (em vez de `0` fixo).
  - se `mods.startShieldSteps > 0`: `activateEffect(effects, 'shield', mods.startShieldSteps)`
    (reusa o framework de efeitos do 3.1; o escudo tica normalmente e some).
  - grava `trait` no estado.
- `step` (hot path, alocação-zero preservada):
  - lê `const mods = traitModifiers(world.trait)` (referência, sem alocar).
  - ímã: `if (world.alive && (mods.magnetAlways || isEffectActive(effects,'magnet'))) applyMagnet(world);`
- `collect`:
  - ganho de comida = `(isEffectActive(doubleCoin) ? DOUBLE_COIN_FOOD_GAIN : 1) * mods.foodMultiplier`.
  - `collect` lê `traitModifiers(world.trait)` (referência congelada; sem alocação).

Consequência: o traço muda a trajetória/coleta, mas o **eixo horizontal** (scroll/distância/
dificuldade/spawns) permanece função de `(seed, distância)` — inalterado. Dois dinos diferentes na
mesma seed divergem de propósito (estado inicial diferente); o **mesmo** dino na mesma seed +
inputs é byte-idêntico.

### 3. Registro determinístico (`src/core/replay/hash.ts` + goldens)

- `hashState` absorve `d.string(world.trait)` em posição fixa (ao lado de `weather`).
- `cloneWorld` copia `trait` (já coberto acima).
- Guarda de completude (`tests/core/replay/hash-completeness.test.ts`): pino de chaves de
  `WorldState` cresce (26 → 27), incluindo `trait`.
- **4 goldens de replay re-pinados** (formato do hash muda com o novo campo). As asserções
  relacionais (`GOLD1 ≠ GOLD2`, difficulty on ≠ off) devem passar **sem edição** (prova de que o
  novo campo não vazou nos existentes, que usam `trait:'none'`).
- Novo teste de determinismo do traço (`tests/determinism/dino.determinism.test.ts`):
  - reprodutibilidade (mesma seed + trait ⇒ mesmo hash, fps-independente);
  - traços distintos na mesma seed ⇒ hashes distintos (ao menos entre `none` e um traço de
    física/coleta que se manifeste na timeline).

### 4. Services — `src/services/nest/` (padrão puro×casca, espelha `ProfileService`)

- `roster.ts` (PURO): `DinoDef { id, traitKind: DinoTrait, price: number, nameKey: string, hue: number }`
  e `DINO_ROSTER: readonly DinoDef[]` (~10 dinos). `STARTER_DINO_ID` (preço 0, `traitKind:'none'`).
  `dinoById(id)` helper. Nomes/descrições NÃO são strings aqui — só chaves i18n.
- `store.ts` (PURO): `NestState { owned: readonly string[]; activeId: string }`. Operações imutáveis:
  - `initialNestState()` → possui o starter, ativo = starter.
  - `isOwned(state, id)`, `ownedDinos(state)`.
  - `setActive(state, id)` → no-op se não possuído.
  - `purchase(state, id, balance): { state, result }` — resultado
    `'ok' | 'alreadyOwned' | 'insufficient' | 'unknown'`; em `'ok'` adiciona `id` a `owned` e
    devolve `spent = price`. **Não** deduz saldo (a carteira é externa/4.5); só decide e devolve o
    custo. Testável sem IO.
- `storage.ts` (casca IO injetável): `NestStorage { load, save }`, `memoryNestStorage`,
  `localStorageNestStorage` (chave `jurassicrun.nest.v1`, payload `{version:1,...}`, `parseState`
  robusto ⇒ qualquer JSON inválido/dino desconhecido cai em `initialNestState()`; garante que o
  starter esteja sempre possuído e o `activeId` resolva).
- `index.ts`: `NestService` reativo (singleton, como `profileService`): signals
  `activeDino: ReadonlySignal<DinoDef>` e `ownedIds: ReadonlySignal<readonly string[]>`;
  `init(storage?)`, `select(id)`, `buy(id): PurchaseResult`, `activeTrait(): DinoTrait`.
  `buy` lê o **saldo do seam de carteira** e chama `purchase()`; em `'ok'`, persiste e (quando a
  carteira existir, 4.5) debita via seam `spendCoins`.

### 5. Seam de carteira — `src/services/nest/wallet.ts`

A carteira persistente é do item **4.5**. Aqui, um seam mínimo (precedente do `getHomeStats` no 4.3):

- `getCoinBalance(): number` → `0` por ora.
- `spendCoins(amount: number): void` → no-op por ora.

Efeito no 4.4: `buy` de qualquer dino pago retorna `'insufficient'` (saldo 0); só o starter (preço
0, já possuído) resolve. Toda a lógica de compra/seleção/persistência é real e testada — o 4.5
religa o seam num único ponto e a compra acende. **Sem abstração morta.**

### 6. App — `src/app/screens/NestScreen.tsx` + wiring

- Rota `nest` (já existe em `routes.ts`) passa a renderizar `NestScreen` (substitui o
  `PlaceholderScreen` no `App.tsx`).
- UI: grid de cards de dino. Cada card: avatar geométrico (hue do `DinoDef`, no molde do
  `avatarFor` de perfil), nome (i18n), descrição do traço (i18n), e:
  - possuído + ativo → selo "Ativo";
  - possuído + não ativo → botão "Selecionar" → `nestService.select(id)`;
  - não possuído → preço + botão "Comprar" (desabilitado quando `saldo < preço` — sempre, por ora)
    → `nestService.buy(id)`.
- CSS por design tokens (sem cor hardcoded), mobile-first retrato+paisagem, sem scroll horizontal,
  alvo de toque ≥44px, a11y (aria-labels, glyphs decorativos `aria-hidden`). Molde: `HomeScreen`.
- **`startGame`** (`src/app/game/startGame.ts`): a factory de partida passa
  `trait: nestService.activeTrait()` para `createWorld`. É o que faz o traço entrar na simulação.
  `main.tsx` chama `nestService.init()` no bootstrap (como `profileService.init()`).

### 7. i18n + asset-specs

- i18n (REGRA 4, skill `add-locale`): chaves de UI do Ninho (`nest.*`), nomes dos dinos
  (`dino.<id>.name`) e descrições de traço (`trait.<kind>.desc`) nos 10 locales; paridade
  garantida por `tests/i18n/locales.test.ts`.
- Asset-specs (REGRA 5, skill `create-asset-spec`): cada dino do roster é uma imagem trocável
  (geométrico → PNG na Fase 8) ⇒ asset-spec por dino do roster + registro.

## O que fica FORA do 4.4 (adiado, com precedente)

- **Carteira persistente + ganho de moedas** (comida→saldo): item **4.5** (religa o seam).
- **Cosmético do dino ativo dentro da partida** (tint/arte real): Fase 8. O dino em jogo continua o
  triângulo do manifesto; a diferenciação visível no 4.4 é o **traço** (gameplay) + o avatar no
  Ninho.
- **Ninho por-perfil**: 4.4 tem um Ninho **global**. Keying por perfil ativo fica adiado (default
  simples; nenhum requisito do roadmap pede por-perfil agora).
- **Tuning/balance** dos traços (multiplicadores, duração do head-start): placeholders (como
  difficulty/economy/powerup); Fase 8.
- **Excluir dino / vender**: fora de escopo.

## Testes (Definição de pronto)

- `src/core/dino/`: unidade do catálogo + `traitModifiers` (lookup, alocação-zero, congelado).
- `src/core/sim/`: `createWorld` aplica start-modifiers (extraLives/escudo inicial) por traço;
  `step`/`collect` aplicam ímã permanente e multiplicador de comida.
- Determinismo: `verify-determinism` verde; goldens re-pinados; teste de traço distinto ⇒ hash
  distinto; determinism-guardian "contrato intacto".
- `src/services/nest/`: `purchase`/`setActive`/`parseState` puros; `NestService` reativo;
  round-trip de storage.
- App: smoke do `NestScreen` (owned/active/buy-disabled) no molde de teste de componente
  (happy-dom; atenção ao gotcha de signals já documentado).
- `npm test` + `npm run check` verdes; paridade i18n verde.

## Riscos / notas

- **Hot path**: `traitModifiers` DEVE retornar referência congelada do catálogo (não objeto novo)
  para manter alocação-zero no `step`/`collect` (REGRA 3).
- **Goldens**: re-pinar exige rodar a suíte e commitar os hashes novos; validar que as asserções
  relacionais passam sem edição (não-vazamento).
- **Gotcha de teste (signals + happy-dom)**: recorrente desde 4.1/4.2 — render manual pode não
  flushar `useState`; `useEffect` precisa de macrotask. Aplicar o padrão já documentado.
</content>
</invoke>
