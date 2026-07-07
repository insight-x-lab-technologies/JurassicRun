# Spec 5.1 — Modo Desafio (Diário / Semanal)

> Fase 5, item 5.1. Modos Desafio Diário e Semanal jogáveis, com seeds determinísticas
> baseadas no relógio UTC, e a seed do desafio visível no HUD.

## Objetivo

Permitir jogar **Desafio Diário** (seed do dia UTC) e **Desafio Semanal** (seed da semana
ISO-8601), além do Endless já existente. A mesma data/semana produz a **mesma seed para todos
os jogadores** (reprodutível). A seed do desafio aparece no HUD. As corridas de desafio são
reproduzíveis **só a partir de `seed + InputTimeline`** — preparando os leaderboards locais
(5.2) e a verificação online (5.4 / Fase 6).

Este item **não** toca `src/core/` (todas as peças determinísticas já existem desde a Fase 1:
`dailySeed`, `weeklySeed`, `isoWeekOf`, `createWorld({seed, trait})`). Logo o contrato de
determinismo fica intacto (67) — sem re-pin de goldens.

## Fora de escopo (adiado)

- **Armazenamento e tela de leaderboard** (Endless/Diário/Semanal) → 5.2.
- **Troféu de top-3 do diário** → 5.3.
- **Guardar `seed + InputTimeline` da melhor tentativa** → 5.4.
- Tela de "abertura" do desafio (mostrando "seu melhor de hoje") → 5.2, quando houver recorde.
- Rótulo textual do modo no HUD além do prefixo da seed (`daily:`/`weekly:` já sinaliza).

## Decisões (autônomas)

1. **Trait fixado em `'none'` nos desafios.** Endless mantém o dino ativo do Ninho; Diário e
   Semanal rodam sempre com o pterodáctilo padrão (`trait: 'none'`). Razão: 5.4 guarda só
   `seed + InputTimeline`; para a corrida ser reproduzível e verificável **apenas** a partir
   disso, o estado inicial não pode variar por escolha do jogador. Clima (`fork('weather')`),
   tempo do dia (cosmético) e dificuldade (por distância) já derivam da seed — o trait é a
   **única** entrada de estado inicial fora da seed, então fixá-lo torna o desafio justo e
   reproduzível. (Cosmético do dino ativo na cena é Fase 8, ortogonal.)

2. **Seed do desafio capturada 1× ao entrar no modo.** O restart após a morte **replaya a
   mesma seed** do dia/semana (você retenta o mesmo desafio). Endless continua sorteando nova
   seed aleatória a cada restart. A resolução do "hoje/esta semana" acontece quando a tela do
   desafio monta (não muda no meio da sessão se cruzar a meia-noite UTC).

3. **HUD mostra a seed do desafio sem código novo.** O HUD já renderiza `seedLabel` (item 2.4).
   Em desafio, `seedLabel = "daily:AAAA-MM-DD"` ou `"weekly:AAAA-Www"`, cujo prefixo já
   identifica o modo. Nenhuma string i18n nova.

4. **`onGameOver` inalterado para todos os modos.** Comida→moedas e `trophyService.recordMatch`
   continuam disparando em Endless e nos desafios (jogar desafio também rende meta-progressão).
   O registro do recorde *por período do desafio* (leaderboard) é 5.2.

5. **Regra rankeável (definida aqui, implementada em 5.2):** tentativas **ilimitadas** por
   período; a **melhor pontuação** do período é a que rankeia. 5.1 não impõe limite nem grava
   recorde de desafio.

## Arquitetura

Padrão puro × casca já usado no projeto. Duas peças novas na camada de render/app + fiação.

### 1. Derivação relógio→seed fora do core (`src/render/seedSource.ts`, estende o existente)

O `seedSource.ts` já hospeda "a aleatoriedade do Endless fora do core". Adiciono aqui a
conversão **relógio→`CalendarDate` UTC** que a Fase 1 deixou explicitamente para a Fase 5.

Puras (testáveis com `ms` fixo):
- `utcCalendarDateFromMs(ms: number): CalendarDate` — usa os getters `getUTC*` de `Date`
  (permitido fora do core; determinístico dado `ms`, sem ler o relógio).
- `dailyChallengeSeedForMs(ms: number): string` = `dailySeed(utcCalendarDateFromMs(ms))`.
- `weeklyChallengeSeedForMs(ms: number): string` = `weeklySeed(utcCalendarDateFromMs(ms))`.

Casca (lê o relógio; não testada por unidade, como `randomEndlessSeed`):
- `dailyChallengeSeed(): string` = `dailyChallengeSeedForMs(Date.now())`.
- `weeklyChallengeSeed(): string` = `weeklyChallengeSeedForMs(Date.now())`.

### 2. Fábrica de partida por modo (`src/render/matchFactory.ts`, novo — PURO)

Extrai a construção da fábrica de `MatchInit` (hoje embutida em `startGame`) para uma função
pura e testável, com dependências injetadas:

```ts
export type MatchMode = 'endless' | 'daily' | 'weekly';

export interface MatchFactoryDeps {
  randomEndlessSeed: () => string;      // casca (crypto) — novo seed por chamada
  dailyChallengeSeed: () => string;     // casca (clock)
  weeklyChallengeSeed: () => string;    // casca (clock)
  activeTrait: () => DinoTrait;         // nestService.activeTrait()
  createWorld: (config: WorldConfig) => WorldState;
}

// Resolve a seed do desafio 1× aqui (captura); Endless sorteia dentro do closure.
export function createMatchFactory(mode: MatchMode, deps: MatchFactoryDeps): () => MatchInit;
```

Mapeamento:
- `endless` → seed = `deps.randomEndlessSeed()` **por (re)start**; `trait = deps.activeTrait()`.
- `daily`   → seed = `deps.dailyChallengeSeed()` **capturada 1×**; `trait = 'none'`.
- `weekly`  → seed = `deps.weeklyChallengeSeed()` **capturada 1×**; `trait = 'none'`.

Retorna sempre `{ world: createWorld({ seed, trait }), seedLabel: seed }`.

### 3. Fiação

- `startGame(container: HTMLElement, mode: MatchMode = 'endless'): () => void`
  monta `deps` com os serviços/nucleo reais (`randomEndlessSeed`, `dailyChallengeSeed`,
  `weeklyChallengeSeed`, `nestService.activeTrait`, `createWorld`) e passa `mode` a
  `createMatchFactory`. `MatchController`, `createGame`, `bindGameControls` inalterados.
  Default `'endless'` preserva o call-site atual.
- `PlayScreen({ mode = 'endless' }: { mode?: MatchMode })` passa `mode` a `startGame`; o
  `useLayoutEffect` passa a depender de `[mode]` (remonta o jogo se o modo mudar).
- `App.screenFor`: `play`→`<PlayScreen mode="endless"/>`, `daily`→`<PlayScreen mode="daily"/>`,
  `weekly`→`<PlayScreen mode="weekly"/>` (as rotas `daily`/`weekly` deixam de ser placeholder).
- Home: os botões "Diário"/"Semanal" já navegam para `daily`/`weekly` (agora lançam o jogo).

## Fluxo de dados

Home → clique "Diário" → `navigate('daily')` → `App` renderiza `<PlayScreen mode="daily"/>` →
`startGame(el, 'daily')` → `createMatchFactory('daily', deps)` captura `daily:AAAA-MM-DD` →
`MatchController` monta o mundo com essa seed + `trait:'none'` → HUD exibe `Seed: daily:AAAA-MM-DD`
→ tap inicia; morte → restart replaya a **mesma** seed do dia.

## Tratamento de erros / bordas

- `utcCalendarDateFromMs` correto em bordas de virada de ano e de semana ISO (delegado à
  matemática de calendário já validada 1990–2060; os testes fixam `ms` em datas de borda).
- Navegação `daily`→`weekly` direta não ocorre pelo fluxo (passa pela Home); ainda assim o
  `deps: [mode]` do `useLayoutEffect` garante remontagem correta se acontecer.

## Testes

Puros (Vitest, sem Phaser):
- `tests/render/seedSource.test.ts` (estende): `utcCalendarDateFromMs` para `ms` fixos
  (ex.: 2026-07-07, virada de ano, borda de semana ISO 53); `daily/weeklyChallengeSeedForMs`
  compõem as seeds canônicas esperadas.
- `tests/render/matchFactory.test.ts` (novo): com `deps` fakes —
  - `endless`: duas chamadas ao factory ⇒ seeds **diferentes** (fake conta chamadas); trait = ativo.
  - `daily`/`weekly`: duas chamadas ⇒ **mesma** seed (capturada 1×); `trait === 'none'`;
    `seedLabel` bate com a seed; a seed de desafio é lida **uma vez** na criação da fábrica.
  - `createWorld` fake recebe `{ seed, trait }` esperado.

Determinismo: bateria intacta (nenhuma mudança em `src/core/`); rodo `verify-determinism`
como salvaguarda.

## Definição de pronto

- Dá para jogar Diário e Semanal a partir da Home; o jogo roda com a seed determinística do
  dia/semana e a seed aparece no HUD; restart replaya a mesma seed do desafio.
- `npm run check` limpo, `npm test` verde, bateria de determinismo verde.
