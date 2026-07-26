# Indicador de power-up ativo + traço do dino (9.5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar ao jogador quais power-ups estão ativos (chip com barra de duração + aura no dino) e qual traço de dino a partida está usando.

**Architecture:** Módulo PURO `src/render/effects.ts` (catálogo + `effectViews` + `auraPulse`) alimenta duas cascas: um componente DOM `EffectBadges` (via payload `HudLive` já existente, agora entregue por `GameHandle.hud()` em vez do snapshot por frame) e anéis desenhados no `Graphics` já existente da `GameScene`. Nada em `src/core/` é tocado.

**Tech Stack:** TypeScript estrito, Preact + `@preact/signals`, Phaser 3, Vitest (+ happy-dom para componentes), i18next.

## Global Constraints

- **REGRA 1 (determinismo):** nenhum arquivo sob `src/core/` pode ser modificado neste item. Nenhum teste de determinismo muda (fica em **67**).
- **REGRA 3 (performance):** zero alocação por frame no hot path. O desenho da aura em `GameScene.update` só pode usar números e chamadas de desenho — nada de `new`, literal de objeto/array, `map`, `filter`, closure ou template string dentro do `update`.
- **REGRA 4 (i18n):** nenhuma string visível hardcoded. Todo texto via chave i18next, presente nos **10** locales (`src/i18n/locales/*.json`: en, pt-BR, es, fr, de, it, ja, ko, zh, hi). Emoji sem alfanumérico são permitidos como glifo (precedente `📱↻` em `PlayScreen`).
- **TypeScript estrito:** sem `any`. Índices de array vêm com `!` quando o acesso é provado (padrão do repo).
- Comentários e nomes de teste em **português** (padrão do repo).
- Rodar sempre com `npx vitest run <arquivo>` (a suíte inteira é `npm test`; typecheck+lint é `npm run check`).

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/render/effects.ts` (novo) | PURO: ordem canônica, durações nominais, cores da aura, `effectViews()`, `auraPulse()` |
| `tests/render/effects.test.ts` (novo) | testes do módulo puro |
| `src/app/game/startGame.ts` (modificar) | `HudLive` ganha `effects`/`extraLives`/`trait`; `MatchSnapshot` perde `hud`; `GameHandle` ganha `hud()` |
| `src/app/screens/PlayScreen.tsx` (modificar) | chama `handle.hud()` só no gate de 200 ms; renderiza `<EffectBadges>` |
| `src/app/game/EffectBadges.tsx` (novo) | chips DOM (efeito + barra, vidas extras, traço) |
| `src/app/styles/global.css` (modificar) | classes `.effect-badges`, `.effect-badge*` |
| `src/i18n/locales/*.json` (10 arquivos) | chaves `powerup.*.name`, `trait.*.name`, `hud.extraLives` |
| `src/render/GameScene.ts` (modificar) | anéis de aura no `this.gfx` |
| `tests/app/hud.test.tsx` (modificar) | payload `HudLive` novo + testes do `EffectBadges` |

---

### Task 1: Módulo puro `effects.ts`

**Files:**
- Create: `src/render/effects.ts`
- Test: `tests/render/effects.test.ts`

**Interfaces:**
- Consumes: `PowerupKind`, `ActiveEffect` de `@core/powerup`; `SHIELD_DURATION_STEPS`, `MAGNET_DURATION_STEPS`, `DOUBLE_COIN_DURATION_STEPS`, `SLOW_MO_DURATION_STEPS` de `@core/powerup`; `FIXED_DT` de `@core/sim`.
- Produces:
  - `EFFECT_ORDER: readonly PowerupKind[]`
  - `EFFECT_DURATION_STEPS: Readonly<Record<PowerupKind, number>>`
  - `EFFECT_COLORS: Readonly<Record<PowerupKind, number>>`
  - `interface EffectView { readonly kind: PowerupKind; readonly seconds: number; readonly fraction: number }`
  - `effectViews(effects: readonly ActiveEffect[]): EffectView[]`
  - `auraPulse(t: number): number`
  - `AURA_MIN_ALPHA = 0.35`, `AURA_MAX_ALPHA = 0.7`, `AURA_PULSE_HZ = 1.4`

> Antes de escrever: confirme os nomes exportados por `@core/powerup` lendo `src/core/powerup/index.ts` e `src/core/powerup/constants.ts`. Se algum nome de constante diferir, use o real — **não** duplique valores numéricos à mão.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/render/effects.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  EFFECT_ORDER,
  EFFECT_DURATION_STEPS,
  EFFECT_COLORS,
  effectViews,
  auraPulse,
  AURA_MIN_ALPHA,
  AURA_MAX_ALPHA,
  AURA_PULSE_HZ,
} from '../../src/render/effects';
import { SHIELD_DURATION_STEPS } from '@core/powerup';
import { HEAD_START_SHIELD_STEPS } from '@core/dino';

describe('effectViews', () => {
  it('mapeia kind, segundos (ceil) e fração da duração nominal', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: SHIELD_DURATION_STEPS }]);
    expect(v!.kind).toBe('shield');
    expect(v!.seconds).toBe(Math.ceil(SHIELD_DURATION_STEPS / 60));
    expect(v!.fraction).toBeCloseTo(1, 9);
  });

  it('usa a ORDEM CANÔNICA, não a ordem de pickup', () => {
    const views = effectViews([
      { kind: 'doubleCoin', remaining: 10 },
      { kind: 'shield', remaining: 10 },
    ]);
    expect(views.map((v) => v.kind)).toEqual(['shield', 'doubleCoin']);
  });

  it('nunca reporta 0 segundo enquanto o efeito ainda vale 1 step', () => {
    const [v] = effectViews([{ kind: 'magnet', remaining: 1 }]);
    expect(v!.seconds).toBe(1);
  });

  it('clampa a fração em [0,1] mesmo com remaining acima do nominal', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: SHIELD_DURATION_STEPS * 3 }]);
    expect(v!.fraction).toBe(1);
  });

  it('escudo curto do traço headStart nasce com fração parcial (não é bug)', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: HEAD_START_SHIELD_STEPS }]);
    expect(v!.fraction).toBeCloseTo(HEAD_START_SHIELD_STEPS / SHIELD_DURATION_STEPS, 9);
    expect(v!.fraction).toBeLessThan(1);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(effectViews([])).toEqual([]);
  });

  it('ignora kinds fora da ordem canônica (extraLife é carga, não efeito)', () => {
    expect(effectViews([{ kind: 'extraLife', remaining: 60 }])).toEqual([]);
  });
});

describe('catálogo', () => {
  it('toda entrada da ordem canônica tem duração positiva e cor', () => {
    for (const kind of EFFECT_ORDER) {
      expect(EFFECT_DURATION_STEPS[kind]).toBeGreaterThan(0);
      expect(EFFECT_COLORS[kind]).toBeGreaterThanOrEqual(0);
    }
  });

  it('extraLife não é um efeito temporário exibível', () => {
    expect(EFFECT_ORDER).not.toContain('extraLife');
  });
});

describe('auraPulse', () => {
  it('fica dentro da faixa de alpha em toda a amostragem', () => {
    for (let i = 0; i <= 200; i++) {
      const a = auraPulse(i / 100);
      expect(a).toBeGreaterThanOrEqual(AURA_MIN_ALPHA - 1e-9);
      expect(a).toBeLessThanOrEqual(AURA_MAX_ALPHA + 1e-9);
    }
  });

  it('é periódica em 1/AURA_PULSE_HZ', () => {
    const period = 1 / AURA_PULSE_HZ;
    expect(auraPulse(0.31 + period)).toBeCloseTo(auraPulse(0.31), 9);
  });

  it('é pura (mesma entrada ⇒ mesma saída)', () => {
    expect(auraPulse(2.5)).toBe(auraPulse(2.5));
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run tests/render/effects.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/render/effects"`.

- [ ] **Step 3: Implementar `src/render/effects.ts`**

```ts
// Módulo PURO (sem phaser/DOM): dados de exibição dos efeitos ativos + curva da aura (9.5).
// Consome só constantes do core; não muda nada de simulação.
import type { ActiveEffect, PowerupKind } from '@core/powerup';
import {
  SHIELD_DURATION_STEPS,
  MAGNET_DURATION_STEPS,
  DOUBLE_COIN_DURATION_STEPS,
  SLOW_MO_DURATION_STEPS,
} from '@core/powerup';
import { FIXED_DT } from '@core/sim';

/** Ordem CANÔNICA de exibição — fixa, para o chip não pular de posição quando um efeito expira.
 *  `extraLife` fica de fora de propósito: no core é carga (`WorldState.extraLives`), não efeito. */
export const EFFECT_ORDER: readonly PowerupKind[] = Object.freeze([
  'shield', 'slowMo', 'magnet', 'doubleCoin',
]);

/** Duração NOMINAL por kind (steps) — denominador da barra. */
export const EFFECT_DURATION_STEPS: Readonly<Record<PowerupKind, number>> = Object.freeze({
  shield: SHIELD_DURATION_STEPS,
  slowMo: SLOW_MO_DURATION_STEPS,
  magnet: MAGNET_DURATION_STEPS,
  doubleCoin: DOUBLE_COIN_DURATION_STEPS,
  extraLife: 1, // não exibido; presente só para o Record ser total
});

/** Cor do anel de aura por kind (0xRRGGBB). */
export const EFFECT_COLORS: Readonly<Record<PowerupKind, number>> = Object.freeze({
  shield: 0x6fd3ff,
  slowMo: 0xb08cff,
  magnet: 0xff8a3d,
  doubleCoin: 0xffd75e,
  extraLife: 0xff6b7a,
});

export const AURA_MIN_ALPHA = 0.35;
export const AURA_MAX_ALPHA = 0.7;
export const AURA_PULSE_HZ = 1.4;

/** Dados de um chip do HUD. `seconds` é `ceil` (nunca 0 enquanto ativo); `fraction` ∈ [0,1]. */
export interface EffectView {
  readonly kind: PowerupKind;
  readonly seconds: number;
  readonly fraction: number;
}

/** Efeitos ativos → chips na ordem canônica. Chamado no throttle do HUD (~5 Hz), NÃO por frame. */
export function effectViews(effects: readonly ActiveEffect[]): EffectView[] {
  const out: EffectView[] = [];
  for (const kind of EFFECT_ORDER) {
    for (const e of effects) {
      if (e.kind !== kind) continue;
      const nominal = EFFECT_DURATION_STEPS[kind];
      const fraction = Math.min(1, Math.max(0, e.remaining / nominal));
      out.push({ kind, seconds: Math.ceil(e.remaining * FIXED_DT), fraction });
      break;
    }
  }
  return out;
}

/** Alpha pulsante da aura em função do tempo (s). Puro, sem estado. */
export function auraPulse(t: number): number {
  const mid = (AURA_MIN_ALPHA + AURA_MAX_ALPHA) / 2;
  const amp = (AURA_MAX_ALPHA - AURA_MIN_ALPHA) / 2;
  return mid + amp * Math.sin(2 * Math.PI * AURA_PULSE_HZ * t);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/render/effects.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/render/effects.ts tests/render/effects.test.ts
git commit -m "feat(9.5): módulo puro de efeitos ativos (views do HUD + curva da aura)"
```

---

### Task 2: Ponte — payload do HUD sai do snapshot por frame

**Files:**
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/screens/PlayScreen.tsx`
- Modify: `tests/app/App.challenge.test.tsx` (mock do `GameHandle`)
- Modify: `tests/app/App.test.tsx` (se tiver mock equivalente — conferir antes)
- Test: `tests/app/start-game-bridge.test.ts` (novo)

**Interfaces:**
- Consumes: `EffectView`, `effectViews` da Task 1.
- Produces:
  - `HudLive` agora inclui `readonly effects: readonly EffectView[]`, `readonly extraLives: number`, `readonly trait: DinoTrait`.
  - `MatchSnapshot` **não tem mais** o campo `hud`.
  - `GameHandle` ganha `readonly hud: () => HudLive | null` (null fora de `playing`).

**Contexto para quem implementa:** `PlayScreen` chama `handle.snapshot()` 1×/frame no rAF só para
detectar mudanças de fase/pausa/gameover/dying, mas hoje o `snapshot()` monta o objeto `HudLive`
em toda chamada — lixo por frame para um dado consumido a 5 Hz. Mover o HUD para uma chamada
própria mata essa alocação e é pré-requisito para o payload maior desta feature.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/app/start-game-bridge.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import type { HudLive, MatchSnapshot, GameHandle } from '../../src/app/game/startGame';

// Contrato de tipos da ponte (W4 + 9.5). Compila ⇒ o contrato vale.
describe('contrato da ponte startGame', () => {
  it('HudLive carrega efeitos, vidas extras e traço', () => {
    const hud: HudLive = {
      distance: 10, food: 2, level: 1, speed: 120, weather: 'clear', seed: 's',
      effects: [{ kind: 'shield', seconds: 5, fraction: 1 }],
      extraLives: 1,
      trait: 'magnet',
    };
    expect(hud.effects[0]!.kind).toBe('shield');
    expect(hud.trait).toBe('magnet');
  });

  it('MatchSnapshot não expõe mais o HUD (ele vem por GameHandle.hud())', () => {
    const snap: MatchSnapshot = { phase: 'ready', paused: false, gameOver: null, dying: false };
    expect(Object.keys(snap)).not.toContain('hud');
    const handle: Pick<GameHandle, 'hud'> = { hud: () => null };
    expect(handle.hud()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/start-game-bridge.test.ts`
Expected: FAIL — objeto `HudLive` não aceita `effects`/`extraLives`/`trait`.

- [ ] **Step 3: Implementar em `src/app/game/startGame.ts`**

Trocar a interface `HudLive`, o `MatchSnapshot`, o `GameHandle` e as funções correspondentes:

```ts
import type { DinoTrait } from '@core/dino';
import { effectViews, type EffectView } from '@render/effects';

/** Stats vivos do mundo para o HUD DOM (W4 + 9.5). Lidos do WorldState corrente. */
export interface HudLive {
  readonly distance: number;
  readonly food: number;
  readonly level: number;
  readonly speed: number;
  readonly weather: string;
  readonly seed: string;
  /** Efeitos temporários ativos, na ordem canônica (9.5). */
  readonly effects: readonly EffectView[];
  /** Cargas de vida extra (não é efeito temporário). */
  readonly extraLives: number;
  /** Traço da PARTIDA (`world.trait`) — nos desafios é sempre 'none'. */
  readonly trait: DinoTrait;
}

export interface MatchSnapshot {
  readonly phase: MatchPhase;
  readonly paused: boolean;
  readonly gameOver: GameOverStats | null;
  /** 9.3: true durante a animação cosmética de morte — o overlay de Game Over espera ela acabar. */
  readonly dying: boolean;
}

export interface GameHandle {
  readonly stop: () => void;
  readonly snapshot: () => MatchSnapshot;
  /** Payload do HUD (9.5): chamado só no throttle de ~5 Hz, não por frame. */
  readonly hud: () => HudLive | null;
  readonly restart: () => void;
}
```

E no fim de `startGame`:

```ts
  const hudLive = (): HudLive | null => {
    if (match.phase !== 'playing') return null;
    const w = match.world;
    return {
      distance: w.distance, food: w.food, level: w.level,
      speed: w.scrollSpeed, weather: w.weather, seed: match.seedLabel,
      effects: effectViews(w.effects), extraLives: w.extraLives, trait: w.trait,
    };
  };
  return {
    stop,
    snapshot: () => ({
      phase: match.phase,
      paused: pause.paused,
      gameOver: lastGameOver,
      dying: match.dying,
    }),
    hud: hudLive,
    restart: () => match.restart(),
  };
```

- [ ] **Step 4: Ajustar `src/app/screens/PlayScreen.tsx`**

`INITIAL` perde o campo `hud`. Dentro do `tick`, o bloco do gate de 200 ms passa a chamar
`handle.hud()` (e o `s.hud` some):

```ts
const INITIAL: MatchSnapshot = { phase: 'ready', paused: false, gameOver: null, dying: false };
```

```ts
        if (t - lastHud >= HUD_INTERVAL_MS) {
          const fps = accumMs > 0 ? Math.round((frames * 1000) / accumMs) : 0;
          const live = handle.hud();
          setHud(live !== null ? { hud: live, fps } : null);
          lastHud = t;
          frames = 0;
          accumMs = 0;
        }
```

- [ ] **Step 5: Ajustar os mocks de `GameHandle` nos testes existentes**

Rodar `grep -rn "snapshot: () =>" tests/` e, em cada mock de `startGame`, acrescentar
`hud: () => null` ao objeto devolvido (ex.: `tests/app/App.challenge.test.tsx:13`).

- [ ] **Step 6: Rodar os testes tocados**

Run: `npx vitest run tests/app`
Expected: PASS, exceto `tests/app/hud.test.tsx` (o payload `HudLive` do teste ainda não tem os
campos novos) — **esse é corrigido na Task 3**. Se preferir manter a suíte verde neste commit,
acrescente já `effects: [], extraLives: 0, trait: 'none'` ao objeto do teste do `Hud`.

- [ ] **Step 7: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/game/startGame.ts src/app/screens/PlayScreen.tsx tests/app
git commit -m "refactor(9.5): HUD sai do snapshot por frame e vira GameHandle.hud() com efeitos/traço"
```

---

### Task 3: Chips DOM + i18n + CSS

**Files:**
- Create: `src/app/game/EffectBadges.tsx`
- Modify: `src/app/screens/PlayScreen.tsx` (renderizar os chips)
- Modify: `src/app/styles/global.css`
- Modify: `src/i18n/locales/{en,pt-BR,es,fr,de,it,ja,ko,zh,hi}.json`
- Modify: `tests/app/hud.test.tsx`

**Interfaces:**
- Consumes: `HudLive` (Task 2), `EffectView` (Task 1).
- Produces: `EffectBadges({ hud }: { hud: HudLive }): VNode`.

**Chaves i18n novas** (traduzir de verdade em cada locale; nada de copiar o inglês — a guarda
`tests/i18n/locales.test.ts` reprova valores idênticos ao `en` fora da allowlist):

```
powerup.shield.name       "Shield"
powerup.slowMo.name       "Slow-mo"
powerup.magnet.name       "Magnet"
powerup.doubleCoin.name   "Double food"
powerup.extraLife.name    "Extra life"
trait.none.name           "No trait"
trait.magnet.name         "Magnet"
trait.doubleFood.name     "Double food"
trait.tripleFood.name     "Triple food"
trait.startLife.name      "Extra life"
trait.headStart.name      "Head start"
hud.extraLives            "×{{value}}"
```

`powerup.*` são chaves NOVAS (hoje só existem `trait.*.desc`). `trait.*.name` entram ao lado dos
`.desc` já existentes. `hud.extraLives` é só o multiplicador — o nome vem de
`powerup.extraLife.name`. Como `×{{value}}` não tem palavra, ele vai para a
`IDENTICAL_TO_EN_ALLOWLIST` de `tests/i18n/locales.test.ts` (uma entrada por locale ≠ en, com
comentário justificando: símbolo de multiplicação, não tem tradução).

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/app/hud.test.tsx` (e corrigir o payload do teste `Hud` já existente com
`effects: [], extraLives: 0, trait: 'none'`):

```tsx
import { EffectBadges } from '../../src/app/game/EffectBadges';
import type { HudLive } from '../../src/app/game/startGame';

const BASE: HudLive = {
  distance: 0, food: 0, level: 1, speed: 120, weather: 'clear', seed: 's',
  effects: [], extraLives: 0, trait: 'none',
};

describe('EffectBadges', () => {
  it('não renderiza nada sem efeito, sem vida extra e sem traço', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={BASE} />, host);
    expect(host.querySelectorAll('.effect-badge').length).toBe(0);
  });

  it('renderiza um chip por efeito ativo com a barra proporcional', () => {
    const host = document.createElement('div');
    render(
      <EffectBadges
        hud={{
          ...BASE,
          effects: [
            { kind: 'shield', seconds: 5, fraction: 1 },
            { kind: 'magnet', seconds: 3, fraction: 0.5 },
          ],
        }}
      />,
      host,
    );
    const chips = host.querySelectorAll('.effect-badge');
    expect(chips.length).toBe(2);
    const bar = chips[1]!.querySelector('.effect-badge__bar-fill') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('mostra as vidas extras só quando há carga', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={{ ...BASE, extraLives: 2 }} />, host);
    expect(host.querySelector('.effect-badge--lives')).not.toBeNull();
    render(<EffectBadges hud={{ ...BASE, extraLives: 0 }} />, host);
    expect(host.querySelector('.effect-badge--lives')).toBeNull();
  });

  it('mostra o traço da partida e some quando é none', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={{ ...BASE, trait: 'doubleFood' }} />, host);
    expect(host.querySelector('.effect-badge--trait')).not.toBeNull();
    render(<EffectBadges hud={{ ...BASE, trait: 'none' }} />, host);
    expect(host.querySelector('.effect-badge--trait')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/hud.test.tsx`
Expected: FAIL — `Failed to resolve import ".../EffectBadges"`.

- [ ] **Step 3: Implementar `src/app/game/EffectBadges.tsx`**

```tsx
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import type { PowerupKind } from '@core/powerup';
import type { DinoTrait } from '@core/dino';
import type { HudLive } from './startGame';

/** Glifos (emoji = glifo de fonte, não asset ⇒ sem asset-spec; precedente do rotate-hint). */
const GLYPH: Readonly<Record<PowerupKind, string>> = {
  shield: '🛡', slowMo: '⏳', magnet: '🧲', doubleCoin: '✨', extraLife: '❤',
};
const TRAIT_GLYPH = '🥚';

/** Chips de feedback in-game (9.5): efeitos temporários (com barra), vidas extras e traço.
 *  Cosmético e duplicado no canvas ⇒ aria-hidden, como o HUD do W4. */
export function EffectBadges({ hud }: { hud: HudLive }): VNode {
  return (
    <div class="effect-badges" aria-hidden="true">
      {hud.effects.map((e) => (
        <div class="effect-badge" key={e.kind}>
          <span class="effect-badge__glyph">{GLYPH[e.kind]}</span>
          <span class="effect-badge__label">{i18n.t('powerup.' + e.kind + '.name')}</span>
          <span class="effect-badge__time">{i18n.t('hud.seconds', { value: e.seconds })}</span>
          <span class="effect-badge__bar">
            <span class="effect-badge__bar-fill" style={{ width: e.fraction * 100 + '%' }} />
          </span>
        </div>
      ))}
      {hud.extraLives > 0 && (
        <div class="effect-badge effect-badge--lives">
          <span class="effect-badge__glyph">{GLYPH.extraLife}</span>
          <span class="effect-badge__label">{i18n.t('powerup.extraLife.name')}</span>
          <span class="effect-badge__time">{i18n.t('hud.extraLives', { value: hud.extraLives })}</span>
        </div>
      )}
      {hud.trait !== 'none' && (
        <div class="effect-badge effect-badge--trait">
          <span class="effect-badge__glyph">{TRAIT_GLYPH}</span>
          <span class="effect-badge__label">{i18n.t('trait.' + (hud.trait as DinoTrait) + '.name')}</span>
        </div>
      )}
    </div>
  );
}
```

> `hud.seconds` (`"{{value}}s"`) é chave nova junto com as demais — acrescente-a à lista do
> cabeçalho desta task nos 10 locales (em `en`: `"{{value}}s"`; no allowlist de idênticos, mesma
> justificativa de `hud.extraLives`).

- [ ] **Step 4: Adicionar as chaves nos 10 locales**

Editar `src/i18n/locales/*.json` inserindo as chaves nos blocos existentes (`powerup` novo,
`trait.*` ao lado dos `.desc`, `hud.*` no bloco `hud`). Traduzir de verdade; usar a skill
`add-locale` como referência de idioma/tom.

- [ ] **Step 5: Renderizar no `PlayScreen`**

Em `src/app/screens/PlayScreen.tsx`, junto do `<Hud>`:

```tsx
      {snap.phase === 'playing' && !snap.paused && hud !== null && (
        <>
          <Hud hud={hud.hud} fps={hud.fps} />
          <EffectBadges hud={hud.hud} />
        </>
      )}
```

(importar `EffectBadges` de `../game/EffectBadges`.)

- [ ] **Step 6: CSS em `src/app/styles/global.css`** (ao lado do bloco `.hud`)

```css
/* 9.5: chips de power-up ativo / vidas extras / traço — canto inferior esquerdo. */
.effect-badges {
  position: absolute;
  left: max(var(--space-2), env(safe-area-inset-left));
  bottom: max(var(--space-2), env(safe-area-inset-bottom));
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  pointer-events: none;
}
.effect-badge {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.effect-badge__time {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
.effect-badge__bar {
  grid-column: 1 / -1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}
.effect-badge__bar-fill {
  display: block;
  height: 100%;
  background: var(--color-accent);
}
```

> Conferir os nomes de token (`--space-1`, `--radius-sm`, `--color-accent`, `--font-size-sm`) em
> `src/app/styles/tokens.css` antes de usar; se algum não existir, use o equivalente real.

- [ ] **Step 7: Rodar testes de app + i18n**

Run: `npx vitest run tests/app tests/i18n`
Expected: PASS. Se `locales.test.ts` reprovar algum valor idêntico ao `en`, ou traduza, ou —
para os puramente simbólicos (`hud.extraLives`, `hud.seconds`) — acrescente a entrada com
comentário na `IDENTICAL_TO_EN_ALLOWLIST`.

- [ ] **Step 8: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/app src/i18n tests/app tests/i18n
git commit -m "feat(9.5): chips de power-up ativo, vidas extras e traço no HUD DOM"
```

---

### Task 4: Aura no canvas

**Files:**
- Modify: `src/render/GameScene.ts`
- Test: `tests/render/effects.test.ts` (acrescentar o teste do raio)

**Interfaces:**
- Consumes: `EFFECT_ORDER`, `EFFECT_COLORS`, `auraPulse` (Task 1); `isEffectActive` de `@core/powerup`.
- Produces: `auraRadius(baseRadius: number, index: number): number` em `src/render/effects.ts`.

**Contexto para quem implementa:** `GameScene.update` é hot path. Já existem os precedentes de
9.3 (partículas de morte no `this.gfx`) e 9.4 (relógio `this.idleElapsed`, que congela na pausa).
O `this.gfx` é criado ANTES do `this.dinoSprite`, então o que for desenhado nele fica atrás do
dino — que é onde a aura deve ficar.

- [ ] **Step 1: Teste do raio (falha)**

Acrescentar em `tests/render/effects.test.ts`:

```ts
import { auraRadius, AURA_RING_GAP } from '../../src/render/effects';

describe('auraRadius', () => {
  it('o primeiro anel abraça o dino e cada anel seguinte afasta um passo fixo', () => {
    expect(auraRadius(10, 0)).toBe(10);
    expect(auraRadius(10, 1)).toBe(10 + AURA_RING_GAP);
    expect(auraRadius(10, 2)).toBe(10 + 2 * AURA_RING_GAP);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/render/effects.test.ts`
Expected: FAIL — `auraRadius` não exportado.

- [ ] **Step 3: Implementar em `src/render/effects.ts`**

```ts
/** Distância (unidades de mundo) entre anéis concêntricos da aura. */
export const AURA_RING_GAP = 2;

/** Raio do i-ésimo anel visível. */
export function auraRadius(baseRadius: number, index: number): number {
  return baseRadius + index * AURA_RING_GAP;
}
```

- [ ] **Step 4: Desenhar no `GameScene.update`**

Imports novos no topo do arquivo:

```ts
import { EFFECT_ORDER, EFFECT_COLORS, auraPulse, auraRadius } from './effects';
import { isEffectActive } from '@core/powerup';
```

No `update`, **depois** do bloco que posiciona o dino e **antes** do bloco `if (dying)`:

```ts
    // Aura dos efeitos ativos (9.5): um anel por efeito, atrás do dino (this.gfx foi criado
    // antes do dinoSprite). Some durante a morte — a cena ali é o impacto.
    if (!dying) {
      const alpha = auraPulse(this.idleElapsed);
      const base = Math.max(dinoSize.w, dinoSize.h) / 2 + AURA_BASE_MARGIN;
      let ring = 0;
      for (let i = 0; i < EFFECT_ORDER.length; i++) {
        const kind = EFFECT_ORDER[i]!;
        if (!isEffectActive(world.effects, kind)) continue;
        g.lineStyle(AURA_LINE_WIDTH, EFFECT_COLORS[kind], alpha);
        g.strokeCircle(loop.renderX, loop.renderY, auraRadius(base, ring));
        ring++;
      }
    }
```

Constantes junto das demais do arquivo (ou em `src/render/constants.ts`, seguindo o que já
existir lá): `const AURA_BASE_MARGIN = 2;` e `const AURA_LINE_WIDTH = 1;`.

**Proibido** dentro desse bloco: `new`, literais de objeto/array, `map`/`filter`, closures,
template strings — REGRA 3. Só números e chamadas de desenho.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/render tests/render
git commit -m "feat(9.5): aura pulsante por efeito ativo ao redor do dino"
```

---

### Task 5: Fechamento (docs + verificação)

**Files:**
- Modify: `docs/roadmap/PHASE-09-structural-improvements.md`
- Modify: `CLAUDE.md`
- Modify: `docs/assets/asset-registry.md` (só se alguma arte tiver sido adicionada — não deve ter)

- [ ] **Step 1: Rodar a verificação completa**

```bash
npm test
npm run check
npm run test:determinism
```

Expected: suíte verde, check limpo, determinismo **67** testes (inalterado — nenhum arquivo de
`src/core/` foi tocado; confirmar com `git diff --name-only main... | grep '^src/core/'` vazio).

- [ ] **Step 2: Marcar o item no arquivo da fase**

Em `docs/roadmap/PHASE-09-structural-improvements.md` §9.5: trocar os `- [ ]` por `- [x]`,
acrescentar o título `— CONCLUÍDA` e um bloco `>` de nota no molde dos itens 9.1–9.4 (decisões,
gotchas, números da suíte).

- [ ] **Step 3: Atualizar o "Estado atual" do `CLAUDE.md`**

Métricas (nº de testes) e a linha da Fase 9 (Frente B em andamento / 9.5 concluído, próximo 9.6).

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs(9.5): marca o item concluído e atualiza o estado atual"
```

---

## Notas de verificação final (controlador, fora das tasks)

- **Review por task** (agente `reviewer`) + **review final da branch** antes do merge.
- **Playwright** (build de produção, `npm run build && npm run preview`): pegar um power-up e
  conferir chip + barra esvaziando + anel pulsando; conferir que o chip do traço aparece no
  Endless com um dino de traço e **não** aparece no Diário. Gotcha conhecido: o service worker
  cacheia o `dist` antigo ⇒ `unregister()` + `caches.delete()` + `?nocache=<t>`.
- **Sem `verify-determinism` obrigatório** (core intocado), mas rodar mesmo assim como prova.
