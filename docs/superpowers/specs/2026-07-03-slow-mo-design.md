# Slow-mo (câmera lenta) sem quebrar determinismo — Fase 3, item 3.2

**Data:** 2026-07-03
**Roadmap:** `docs/roadmap/PHASE-03-powerups-and-weather.md` item 3.2
**Depende de:** 3.1 (framework de efeitos temporários — `src/core/powerup/`)

## Objetivo

Adicionar o power-up **câmera lenta (slow-mo)**: ao coletá-lo, o jogo passa a ser
percebido em câmera lenta por uma duração determinística, dando ao jogador mais tempo
**real** de reação — sem violar o passo fixo da simulação nem o contrato de determinismo.

O framework de 3.1 já deixou o gancho pronto: `PowerupKind` é uma união extensível,
`tickEffects` decrementa 1×/step, e `pickupPowerup` já roteia efeitos temporários por
`activateEffect`. O 3.2 é o slow-mo em si — adiado do 3.1 justamente porque seu **modelo de
percepção de tempo** é o objeto deste item.

## Modelo escolhido: escala de tempo na camada de render

O slow-mo é um **efeito temporário determinístico** (`kind: 'slowMo'`) que vive em
`WorldState.effects` — ativado no pickup dentro de `step()` (core, determinístico), ticado
1×/step por `tickEffects`, incluído no golden hash. Mas a **lentidão em si é aplicada FORA
do core**, na única garganta que traduz tempo real → steps fixos: `FixedStepLoop.advance`.

Durante o slow-mo, `advance(dt)` escala o `dt` real por `SLOW_MO_TIME_SCALE` (< 1) **antes**
de somá-lo ao acumulador de passo fixo. Efeito: o acumulador enche mais devagar ⇒ menos
steps de simulação por segundo real ⇒ o mundo (obstáculos, dino, parallax, interpolação)
avança em câmera lenta na parede do relógio, enquanto **cada step continua idêntico**.

### Por que isto respeita o determinismo (o ponto central)

O contrato é: *mesma seed + mesma sequência de inputs ⇒ mesmo estado*. Ele nunca prometeu
nada sobre **quantos** steps rodam por segundo real — o loop de render já é livre nisso (é
por isso que os testes de golden dirigem o `simulate()` por uma timeline fixa, não pelo loop
de render, e a bateria já prova **independência de fps**: mesma timeline com batching de
steps diferente ⇒ estado idêntico).

O slow-mo é apenas mais uma variação de *ritmo* (wall-clock → steps), exatamente como a
variação de frame-rate que a suíte já cobre. A simulação é **byte-idêntica** esteja ela
clocada devagar ou não. Logo o slow-mo é seguro sob as garantias de determinismo já
existentes, e o `src/core/` é tocado só no que é genuinamente determinístico (o registro do
efeito), não na lentidão.

Consequência de balanceamento (desejável): como o mundo **avança a mesma distância por
step**, distância/dificuldade/score (todos keyed por distância) e a sequência de spawns
ficam idênticos com ou sem slow-mo — o jogador só experimenta o mesmo conteúdo mais devagar
no relógio, ganhando tempo de reação. (O modelo alternativo — escalar o movimento dentro de
`step()` — foi rejeitado por ser invasivo no core e por comprimir progressão/score durante o
slow-mo.)

### Duração e ritmo

A duração é medida em **steps de mundo** (unidade determinística), decrementada por
`tickEffects`. O tempo **real** sentido = `SLOW_MO_DURATION_STEPS × FIXED_DT ÷
SLOW_MO_TIME_SCALE` (steps mais lentos ⇒ mais segundos de relógio). Ambos são placeholders
de tuning (como os demais power-ups do 3.1).

- `SLOW_MO_DURATION_STEPS` (core, placeholder): 180 steps (= 3 s de conteúdo de mundo).
- `SLOW_MO_TIME_SCALE` (render, placeholder): 0.4 ⇒ tempo real sentido ≈ 3 / 0.4 = 7,5 s.

## Componentes e mudanças

### Core (`src/core/`) — só o registro determinístico do efeito

1. **`powerup/types.ts`** — estender a união: `PowerupKind = … | 'slowMo'`.
2. **`powerup/catalog.ts`** — 5ª entrada em `POWERUP_CATALOG`
   (`{ id: 'powerup.slowMo', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) }`)
   + `'powerup.slowMo': 'slowMo'` em `KIND_BY_TAG`.
3. **`powerup/constants.ts`** — `export const SLOW_MO_DURATION_STEPS = 180;`.
4. **`powerup/apply.ts`** — `durationFor` passa a incluir `'slowMo'` (retorna
   `SLOW_MO_DURATION_STEPS`); `pickupPowerup` já roteia qualquer kind temporário pelo ramo
   `else` (`activateEffect`), então nada mais muda ali.
5. **`replay/hashState`** — se a codificação de `ActiveEffect.kind` usa um switch com
   `default: never` (guarda de exaustividade), tratar `'slowMo'` (o `tsc` avisa). Se codifica
   por caracteres da string, nada a fazer além de re-pinar goldens.
6. **Golden master** (`tests/determinism/replay.determinism.test.ts`) — os 3 cenários **com
   seed** (`GOLD1`, `GOLD1 difficulty:false`, `GOLD2`) rodam o `powerupSpawner`; a 5ª entrada
   no catálogo muda a distribuição do `pick` ⇒ **re-pinar** esses 3 hashes. O cenário sem
   seed não tem spawner ⇒ inalterado.

> **Nota:** o efeito `slowMo` não altera nenhum campo de `WorldState` (só entra no array
> `effects` já existente), então a guarda de completude de chaves do `hashState` (24 chaves)
> permanece válida sem mudança.

### Render (`src/render/`) — a percepção (lentidão)

7. **`constants.ts`** — `export const SLOW_MO_TIME_SCALE = 0.4;`.
8. **`loop.ts`** (`FixedStepLoop.advance`) — ler o efeito e escalar o `dt`:
   `const scale = isEffectActive(this.world.effects, 'slowMo') ? SLOW_MO_TIME_SCALE : 1;`
   e então `this.accumulator += dt * scale;` (o clamp `MAX_FRAME_TIME` continua sobre o `dt`
   real, antes da escala). `isEffectActive` é puro (`@core/powerup`, sem phaser) ⇒ importável
   no loop. Alocação-zero (só escalares, REGRA 3). Lido 1×/`advance` (a imprecisão de fronteira
   ao expirar é ≤ 1 frame de ritmo e **não** afeta estado do sim).
9. **`manifest.ts`** — `'powerup.slowMo': { kind: 'primitive', color: 0x66ffcc }` (mint, distinto
   dos 4 tons já usados: shield-ciano, extraLife-rosa, magnet-roxo, doubleCoin-amarelo).
   A guarda de completude do manifesto (todo id de `POWERUP_CATALOG` tem `Renderable`) exige
   esta entrada. `GameScene.drawVisible(world.powerups)` já desenha genericamente.

### Assets & i18n

10. **Asset-spec** `docs/assets/specs/powerup.slowMo.md` + registro (REGRA 5), via skill
    `create-asset-spec`.
11. **i18n:** nenhuma string nova. Indicador visual dedicado de "efeito ativo" fica **adiado**
    (consistente com o 3.1) — o mundo desacelerando já é o feedback perceptível.

## Testes

- **Core — pickup/catálogo (determinístico):** coletar `powerup.slowMo` ativa o efeito
  `slowMo` com `remaining = SLOW_MO_DURATION_STEPS`; `powerupKindForTag('powerup.slowMo') ===
  'slowMo'`; o efeito expira após exatamente `SLOW_MO_DURATION_STEPS` steps de `tickEffects`.
- **Core — determinismo:** cenário que exercita pickup de slow-mo é reprodutível
  (mesma seed+timeline ⇒ mesmo `hashState`) e fps-independente (batching 1/2/5 steps por
  frame ⇒ idêntico), espelhando os testes de power-up de 3.1.
- **Render — o crux (`loop.ts`, puro, env node):** com `slowMo` ativo em `world.effects`,
  `advance(dt)` roda **menos** steps que com ele inativo para o mesmo `dt` (ex.: `scale=0.4`,
  um frame de `FIXED_DT` ⇒ 0 steps; ~2,5 frames ⇒ 1 step), e o efeito volta ao ritmo normal
  quando expira. Prova a lentidão sem tocar o core.
- **Golden:** re-pinar os 3 hashes seeded e confirmar a suíte verde.

## Definição de pronto

- Slow-mo coletável funciona em jogo (mundo desacelera ao coletar, volta ao normal ao
  expirar), com `npm test` + `npm run check` verdes e a bateria de determinismo intacta
  (`verify-determinism` + `determinism-guardian` "contrato intacto").
- Item 3.2 marcado `[x]`; "Estado atual" do `CLAUDE.md` atualizado.

## Adiados (tuning/fases posteriores)

- Tuning de `SLOW_MO_DURATION_STEPS` / `SLOW_MO_TIME_SCALE` (placeholders).
- Indicador visual dedicado de efeito ativo + HUD de power-up + rótulos i18n (Fase 4/8).
- Efeitos cosméticos de slow-mo (vinheta/tint/motion-blur), Fase 8.
- Raridade/frequência de spawn afinada dos power-ups (placeholder herdado do 3.1).
