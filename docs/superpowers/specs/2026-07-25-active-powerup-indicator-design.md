# 9.5 — Indicador de power-up ativo + traço do dino

**Item:** Fase 9, Frente B (`docs/roadmap/PHASE-09-structural-improvements.md` §9.5).
**Resolve também o #2** do relatório do usuário (dino do Ninho "não aparece" no gameplay):
o feedback vem do indicador, não de skin nova.
**Core intocado** ⇒ determinismo permanece **67**.

## Problema

`world.effects[]` (escudo, ímã, moeda-dobrada, slow-mo) e `world.extraLives` existem e afetam a
partida, mas **nada os exibe**. O jogador pega um power-up e não sabe (a) qual pegou, (b) quanto
tempo ainda tem, (c) se ainda está ativo. O traço do dino escolhido no Ninho é aplicado em
`createWorld` e também é invisível — a escolha do Ninho parece não ter efeito.

## Escopo

1. **Badges DOM no HUD** — um chip por efeito temporário ativo, com **barra de duração**
   esvaziando, + chip de **vidas extras** (carga, não temporal) + chip **fixo do traço** do dino
   da partida.
2. **Aura no canvas** ao redor do dino — um anel colorido por efeito temporário ativo.
3. **i18n** dos nomes de power-up e traço nos 10 locales.

Fora de escopo: arte nova (badges usam glifos de emoji, precedente `📱↻` do 7.2); skin de dino;
qualquer mudança em `src/core/`.

## Arquitetura

### Puro × casca (padrão do projeto)

| Peça | Arquivo | Papel |
|------|---------|-------|
| Puro | `src/render/effects.ts` (novo) | catálogo de duração/ordem/cor + `effectViews()` (dados p/ o HUD) + `auraPulse()` (curva da aura) |
| Casca DOM | `src/app/game/EffectBadges.tsx` (novo) | renderiza os chips a partir do payload |
| Casca canvas | `src/render/GameScene.ts` | desenha os anéis no `Graphics` já existente |
| Ponte | `src/app/game/startGame.ts` | expõe o payload no `GameHandle` |

### `src/render/effects.ts` (PURO, sem phaser/DOM)

```ts
export const EFFECT_ORDER: readonly PowerupKind[] = ['shield', 'slowMo', 'magnet', 'doubleCoin'];
export const EFFECT_DURATION_STEPS: Readonly<Record<PowerupKind, number>>; // do catálogo do core
export const EFFECT_COLORS: Readonly<Record<PowerupKind, number>>;         // 0xRRGGBB p/ a aura

export interface EffectView {
  readonly kind: PowerupKind;
  readonly seconds: number;   // ceil(remaining × FIXED_DT) — nunca mostra "0s" enquanto ativo
  readonly fraction: number;  // remaining ÷ duração nominal, clampado em [0,1]
}

export function effectViews(effects: readonly ActiveEffect[]): EffectView[];
export function auraPulse(t: number): number;   // alpha 0,35..0,70 a ~1,4 Hz, puro
```

- `extraLife` **não** entra em `EFFECT_ORDER`: no core ele é carga em `world.extraLives`, não
  efeito temporário. Vira chip próprio com contagem.
- `fraction` usa a duração **nominal** do catálogo. O traço `headStart` concede
  `HEAD_START_SHIELD_STEPS` (180) < `SHIELD_DURATION_STEPS` (300) ⇒ a barra já nasce ~60% cheia,
  que é a leitura correta ("escudo curto"), não um bug. O clamp em 1 protege de um futuro
  power-up que estenda além do nominal.
- Ordem de exibição fixa (`EFFECT_ORDER`), **não** ordem de pickup: chip não pula de posição
  quando um efeito expira e outro entra.

### Payload / ponte

`HudLive` (em `startGame.ts`) ganha:

```ts
readonly effects: readonly EffectView[];
readonly extraLives: number;
readonly trait: DinoTrait;   // world.trait — reflete a partida, inclusive 'none' nos desafios
```

O traço vem de **`world.trait`** (não de `nestService`): nos modos Diário/Semanal a fábrica força
`trait: 'none'` (decisão do 5.1) e o HUD tem que dizer a verdade da partida.

**Correção de alocação junto (targeted improvement):** hoje `PlayScreen` chama
`handle.snapshot()` **1×/frame** e `snapshot()` monta o objeto `HudLive` toda vez, embora o HUD
só seja consumido a ~5 Hz. Somar um array de `EffectView` a isso multiplicaria lixo por frame.
Então o HUD sai do snapshot e vira chamada própria:

- `MatchSnapshot` perde o campo `hud`;
- `GameHandle` ganha `hud: () => HudLive | null` (null fora de `playing`);
- `PlayScreen` chama `handle.hud()` **só** dentro do gate de 200 ms que já existe.

Resultado: menos alocação por frame que hoje, mesmo com o payload maior.

### HUD DOM — `EffectBadges.tsx`

Renderizado ao lado do `<Hud>` (mesma condição: `phase === 'playing' && !paused`),
`aria-hidden="true"` como o HUD atual (informação cosmética duplicada do canvas).

Cada chip: glifo + nome traduzido + tempo (`{n}s`) + `<div class="effect-badge__bar">` com
`style="width: {fraction × 100}%"`. Chip de vidas extras: `❤ ×N` (sem barra, some com N = 0).
Chip de traço: glifo + `trait.<t>.name`, sem barra, sem tempo; some quando `trait === 'none'`.

Glifos (sem asset novo): `shield 🛡` · `slowMo ⏳` · `magnet 🧲` · `doubleCoin ✨` ·
`extraLives ❤` · traço `🥚`.

### Aura no canvas

No `GameScene.update`, depois de posicionar o dino e **só quando não está `dying`**
(durante a morte a cena é do impacto; a aura sumir é o feedback correto de "acabou"):

```
para cada kind em EFFECT_ORDER com isEffectActive(world.effects, kind), índice visível i:
  g.lineStyle(1, EFFECT_COLORS[kind], auraPulse(this.idleElapsed));
  g.strokeCircle(renderX, renderY, baseRadius + i × 2);
```

- Reusa o `Graphics` `this.gfx` (mesmo objeto das partículas de 9.3) e o relógio `idleElapsed`
  (9.4, congela na pausa). **Zero alocação por frame** — só números e chamadas de desenho
  (REGRA 3). `isEffectActive` já é busca linear sem alocação.
- `this.gfx` é criado **antes** do `dinoSprite` ⇒ os anéis ficam **atrás** do dino, sem tapar a
  arte (mesma ordem das partículas de morte).
- `baseRadius` derivado de `dinoSize` (já calculado no frame): `max(w, h) / 2 + 2`.
- Traço permanente **não** desenha aura (ficaria acesa a partida inteira = ruído); o traço é
  feedback de chip fixo.

### i18n (skill `add-locale`, 10 locales)

Novas chaves: `powerup.shield.name`, `powerup.slowMo.name`, `powerup.magnet.name`,
`powerup.doubleCoin.name`, `powerup.extraLife.name`, `hud.seconds` (`{{value}}s`),
`hud.extraLives` (`×{{value}}`) e
`trait.<t>.name` para os 6 traços (segue o padrão já existente `trait.<t>.desc` e
`dino.<id>.name`). Nada hardcoded; os glifos são emoji (sem alfanumérico ⇒ passam pelo scanner
AST do 4.9, precedente `📱↻`).

## Testes

| Alvo | Testes |
|------|--------|
| `effects.ts` | `effectViews` mapeia kind/segundos/fração; ordem canônica ≠ ordem de pickup; `ceil` nunca devolve 0 com `remaining ≥ 1`; fração clampada em [0,1]; escudo de `headStart` (180 steps) dá fração 0,6; array vazio ⇒ vazio; `auraPulse` dentro de [0,35; 0,70] e periódico |
| `EffectBadges.tsx` | chip por efeito ativo com nome traduzido e largura da barra; vidas extras somem em 0; traço `none` não renderiza chip; sem strings hardcoded |
| `startGame`/ponte | `hud()` devolve null fora de `playing`; `MatchSnapshot` já não expõe `hud` (ajuste dos testes W4) |
| i18n | guardas existentes (paridade 10 locales + scanner AST) cobrem as chaves novas |
| Determinismo | inalterado (**67**) — nenhum arquivo de `src/core/` é tocado |

Validação final em Playwright (build de produção): pegar um power-up ⇒ chip aparece, barra
esvazia, anel pulsando ao redor do dino, tudo some ao expirar; sem erro de console; 60fps.

## Riscos

- **Poluição visual do HUD.** Mitigado: chips numa faixa própria (canto oposto ao HUD de stats),
  no máximo 4 temporários + 2 fixos, e o HUD já é `aria-hidden` e não bloqueia toque
  (`pointer-events: none`).
- **Regressão do W4/W3.** Tirar `hud` do `MatchSnapshot` toca `PlayScreen` e seus testes; o gate
  de re-render de overlays (fase/pausa/gameover/dying) **não** muda.

## Aceite (do roadmap)

Ao pegar/ter um power-up aparece badge + duração decrescente + aura; o traço do dino ativo é
visível; sem strings hardcoded; `npm test` e `npm run check` verdes; determinismo **67**.
