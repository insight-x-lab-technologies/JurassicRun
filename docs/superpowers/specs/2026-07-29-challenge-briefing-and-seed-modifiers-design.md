# 9.9 — Briefing de desafio + modificadores por seed

**Item do roadmap:** Fase 9, Frente D, item 9.9 (`docs/roadmap/PHASE-09-structural-improvements.md`).
**Data:** 2026-07-29. **Toca `src/core/`** ⇒ contrato de determinismo vale integralmente.

## Problema

Os desafios Diário/Semanal hoje entram direto no jogo: o jogador não sabe qual é a seed, qual é o
seu recorde no período, nem que regras valem. E as "regras do dia" não existem — Diário e Semanal
jogam exatamente como o Endless (clima sorteado, todos os power-ups disponíveis), o que torna os
desafios indistinguíveis da partida normal.

## Objetivo

1. **Modificadores determinísticos por seed**: cada desafio tem regras próprias, derivadas por
   função pura da seed — idênticas para todos os jogadores do planeta, recomputáveis pelo
   verificador anti-cheat.
2. **Tela de briefing** antes de jogar: seed do período, recorde (local + central quando online) e
   as regras vigentes. Botões Jogar / Voltar.

## Decisões travadas

| Questão | Decisão | Por quê |
|---|---|---|
| Quais modificadores | **Exatamente dois eixos, sempre ativos**: `forcedWeather` (1 dos 5 climas, fixo toda a partida) e `bannedPowerup` (1 dos 5 power-ups, nunca spawna) | Dois eixos dão variedade real com zero ramo condicional (sem "às vezes tem modificador"); o briefing sempre mostra 2 regras concretas. YAGNI: nada de gravidade/velocidade custom. |
| Onde vive a derivação | `src/core/challenge/` — `challengeModifiersForSeed(seed)`, puro, RNG forkado da seed (`createRng(seed).fork('challenge')`) | Fork é o idioma do projeto para stream independente; não interfere nos streams `obstacles`/`collectibles`/`powerups`/`weather`. |
| Como o mundo aplica | `WorldConfig.challenge?: boolean` (default `false`). `createWorld` deriva os mods **internamente** a partir da própria seed | O cliente não pode "escolher" modificadores: só existe o par (seed, flag). Verificador reconstrói o mesmo par. |
| Clima forçado | `weather = forcedWeather` e **`weatherGenerator = null`** | Regra do dia = clima constante; sem gerador não há drift nem saques de RNG de clima. |
| Power-up banido | `powerupSpawner` recebe catálogo **filtrado** (4 tipos) | O gerador continua com a mesma contagem de saques por spawn (`pick` = 1 saque `int`); a lógica de spawn não muda. |
| Novos campos em `WorldState` | **Nenhum** | `hashState` intocado ⇒ teste de completude e goldens de Endless não mexem. O efeito dos mods já aparece em campos hasheados (`weather`, entidades de power-up emitidas). |
| Config de desafio duplicada | Builder único `challengeWorldConfig(seed)` em `@core/challenge` | Hoje `{seed, trait:'none'}` está copiado em `matchFactory`, `verifyReplay` e `verifyChallengeSubmission`. Divergência entre eles = replay válido rejeitado. Um builder + teste de acordo mata a classe de bug. |
| Briefing como rota | Sem rota nova: `App` passa a montar `ChallengeScreen` para `daily`/`weekly`, que alterna briefing ⇄ `PlayScreen` por estado local | Mantém a pilha do router intacta; "Voltar" do jogo cai no briefing (não na Home). |

## Arquitetura

### Núcleo — `src/core/challenge/` (novo, puro)

```
types.ts      ChallengeModifiers { forcedWeather: WeatherKind; bannedPowerup: PowerupKind }
modifiers.ts  challengeModifiersForSeed(seed: string): ChallengeModifiers
config.ts     challengeWorldConfig(seed: string): WorldConfig  // { seed, trait:'none', challenge:true }
index.ts      barrel
```

`challengeModifiersForSeed` consome, **nesta ordem fixa**, dois saques do RNG forkado:
`pick(WEATHER_KINDS)` e depois `pick(POWERUP_KINDS)`. Ordem = parte do contrato: mudá-la muda as
regras de todas as seeds. Sem `Date`, sem `Math.random` (guarda de API proibida já cobre o
diretório).

`POWERUP_KINDS` (ordem estável dos 5 kinds) passa a ser exportada por `@core/powerup` — hoje a
ordem só existe implícita no `POWERUP_CATALOG`.

### Aplicação — `src/core/sim/world.ts`

```ts
const challenge = config.challenge === true && config.seed !== undefined;
const mods = challenge ? challengeModifiersForSeed(config.seed!) : null;
// clima: mods !== null ⇒ weather = mods.forcedWeather, weatherGenerator = null
// power-ups: mods !== null ⇒ buildPowerupSpawner(..., powerupCatalogExcluding(mods.bannedPowerup))
```

`powerupCatalogExcluding(kind)` mora em `@core/powerup`, **memoizado e congelado por kind** (uma
array por kind, criada na 1ª chamada) ⇒ zero alocação por `createWorld` e referência estável para
as comparações estruturais dos testes de determinismo.

Caminho não-desafio (`challenge` ausente/false): **byte-idêntico** ao atual. `config.weather ===
false` continua vencendo (mundo sem clima), inclusive em desafio.

### Verificação e wiring

- `createMatchFactory` (daily/weekly) → `deps.createWorld(challengeWorldConfig(seedLabel))`.
- `verifyReplay` (`src/services/replay/verify.ts`) → `simulate(challengeWorldConfig(seed), tl)`.
- `verifyChallengeSubmission` (`src/services/online/verifyChallenge.ts`) → idem; regenerar
  `_verify.bundle.js` com `npm run build:edge`.
- **Bump de storage**: `jurassicrun.replays.v2` → `.v3`. Replays de desafio gravados antes de 9.9
  têm `finalHash` do mundo sem modificadores e passariam a ser reportados como inválidos; o bump
  os aposenta em vez de mostrar erro falso. (Mesmo precedente do bump v1→v2 em 9.8.)
- Entradas centrais antigas de `challenge_entries` deixam de recomputar. Aceitável: `verified` é
  **sinal, não gate** (ADR da Fase 6) e a Fase 9 é pré-lançamento.

### Briefing — `src/app`

**Parte pura** (`src/app/challenge/brief.ts`), testável sem DOM:

```ts
interface ChallengeBriefView {
  seed: string;                 // seed canônica ('daily:2026-07-29')
  periodLabel: string;          // parte após ':' — o rótulo exibível do período
  yourBest: number | null;      // melhor score local NESTA seed
  worldBest: number | null;     // melhor score central NESTA seed (null se offline)
  rules: readonly ChallengeRule[]; // chaves i18n + args, nunca texto pronto
}
type ChallengeRule =
  | { kind: 'weather'; valueKey: string }        // 'weather.storm'
  | { kind: 'bannedPowerup'; valueKey: string }  // 'powerup.shield.name'
  | { kind: 'trait' };                           // traço sempre 'none' nos desafios
```

`buildChallengeBrief({ seed, localEntries, centralEntries })` é pura: recebe as listas já lidas
dos serviços e devolve o view-model. Regras derivam de `challengeModifiersForSeed(seed)` ⇒ a tela
mostra exatamente o que a simulação vai aplicar (uma fonte da verdade).

**Casca**: `ChallengeScreen.tsx` (novo) — `started=false` renderiza `ChallengeBrief`, `true`
renderiza `<PlayScreen mode=… onExit={() => setStarted(false)} />`. `PlayScreen` ganha prop
opcional `onExit` (default `back()`), usada pelo botão Voltar e pelo "Sair" do Game Over.
`App.tsx` roteia `daily`/`weekly` para `ChallengeScreen`.

i18n: novas chaves `challenge.brief.*` nos 10 locales (skill `add-locale`). Nomes de clima,
power-up e traço reusam `weather.*`, `powerup.*.name`, `trait.none.name`.

## Testes

**Core (TDD rigoroso)**
- `challengeModifiersForSeed`: mesma seed ⇒ mesmo objeto; seeds diferentes cobrem >1 clima e >1
  power-up ao longo de N datas; resultado sempre dentro dos catálogos; pino de valor para 3 seeds
  fixas (contrato de ordem dos saques).
- `powerupCatalogExcluding`: exclui exatamente 1, mesma ref em chamadas repetidas.
- `createWorld` com `challenge:true`: `weather === forcedWeather`, `weatherGenerator === null`,
  banido nunca aparece em `powerups` numa sim longa, e o power-up permitido ainda aparece.
- `challenge:false`/ausente: `cloneWorld`/`toEqual` idêntico ao mundo atual (não-regressão).

**Determinismo**
- Novo cenário golden de modo-desafio (seed `daily:2026-01-01`) em
  `tests/determinism/replay.determinism.test.ts` + asserção "desafio ≠ endless na mesma seed".
- Goldens de Endless **não** re-pinam (prova de que o caminho comum não mudou).
- `npm run test:determinism` verde; `determinism-guardian` no fechamento.

**Serviços/app**
- `verifyReplay`: replay gravado com config de desafio verifica `valid`; hash de sim sem
  modificadores é rejeitado.
- Acordo `createMatchFactory` × `challengeWorldConfig` × `verifyReplay` (mesma config).
- `buildChallengeBrief`: seleciona o recorde da seed certa, `null` sem tentativa/offline, regras
  batendo com os modificadores.
- Paridade i18n dos 10 locales (guarda existente) e scanner de strings hardcoded.

## Fora de escopo

Modificadores extras (gravidade/velocidade/densidade), briefing no Endless, countdown para o
próximo período, compartilhar o briefing, arte nova. `verified` continua sinal, não gate.

## Aceite

Tela de briefing mostra seed, recorde local/central e as 2 regras + traço; modificadores idênticos
por seed em qualquer dispositivo; `npm test` verde; `npm run check` limpo;
`npm run test:determinism` verde; replay de desafio verifica com os modificadores aplicados;
`_verify.bundle.js` regenerado.
