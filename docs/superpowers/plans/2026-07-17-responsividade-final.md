# Responsividade final (7.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogo fica legível e jogável em desktop/tablet/celular, retrato e paisagem, com canvas letterbox correto, safe-areas respeitadas, zero scroll horizontal, e uma dica de girar (não-bloqueante) em celular retrato.

**Architecture:** Campo lógico do jogo permanece fixo em 320×180 (Phaser `Scale.FIT`+`CENTER_BOTH`) — só a moldura/UI ao redor se adapta. Nova detecção de orientação em módulo puro (`src/render/orientation.ts`) consumida por uma casca na PlayScreen que mostra um overlay `pointer-events:none`. Correções de CSS para menus roláveis em paisagem curta e safe-areas do botão Voltar.

**Tech Stack:** Preact + signals, Phaser (só render), CSS design tokens, Vitest, i18next (10 locales), Playwright (evidência).

## Global Constraints

- **`src/core/` NÃO é tocado** — determinismo 67 intacto, sem re-pin de goldens.
- **Campo lógico fixo 320×180** — nunca redimensionar o mundo por dispositivo (determinismo + justiça de leaderboard).
- **REGRA 4 (i18n):** nenhuma string visível hardcoded; toda string nova entra nos **10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`) com paridade; o scanner AST de strings hardcoded deve seguir verde.
- **REGRA 3 (perf):** nada de trabalho por frame novo; a dica de girar reage a eventos de `matchMedia`, não a polling.
- **TypeScript estrito**, sem `any` sem justificativa. `src/render/` puro (o módulo `orientation.ts`) não importa `phaser`/DOM.
- Alvos de toque ≥44px; verificação de "pronto": `npm run check` limpo + `npm test` verde.
- Um commit por task na branch `feat/7.2-responsividade`.

---

### Task 1: Módulo puro de orientação (`orientation.ts`)

**Files:**
- Create: `src/render/orientation.ts`
- Test: `src/render/orientation.test.ts`

**Interfaces:**
- Produces: `shouldSuggestRotate(input: { portrait: boolean; coarsePointer: boolean }): boolean` — retorna `true` sse `portrait && coarsePointer`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { shouldSuggestRotate } from './orientation';

describe('shouldSuggestRotate', () => {
  it('sugere girar só em retrato com ponteiro grosso (toque)', () => {
    expect(shouldSuggestRotate({ portrait: true, coarsePointer: true })).toBe(true);
  });

  it('não sugere em paisagem', () => {
    expect(shouldSuggestRotate({ portrait: false, coarsePointer: true })).toBe(false);
  });

  it('não sugere em retrato com ponteiro fino (desktop/janela estreita)', () => {
    expect(shouldSuggestRotate({ portrait: true, coarsePointer: false })).toBe(false);
  });

  it('não sugere em paisagem com ponteiro fino', () => {
    expect(shouldSuggestRotate({ portrait: false, coarsePointer: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/orientation.test.ts`
Expected: FAIL — `shouldSuggestRotate` não existe / módulo não encontrado.

- [ ] **Step 3: Write minimal implementation**

```ts
/** Fatos de ambiente lidos pela casca (sem DOM aqui) para decidir a dica de girar. */
export interface OrientationFacts {
  /** Viewport em retrato (altura ≥ largura). */
  readonly portrait: boolean;
  /** Ponteiro primário grosso (toque) — evita sugerir girar num desktop de janela estreita. */
  readonly coarsePointer: boolean;
}

/**
 * A dica "gire para paisagem" só faz sentido em dispositivos de toque em retrato:
 * o campo de jogo é 16:9 fixo (paisagem) e vira uma faixa fina em retrato.
 */
export function shouldSuggestRotate(facts: OrientationFacts): boolean {
  return facts.portrait && facts.coarsePointer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/orientation.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/render/orientation.ts src/render/orientation.test.ts
git commit -m "feat(7.2): módulo puro shouldSuggestRotate (detecção de dica de girar)"
```

---

### Task 2: Chave i18n `rotateHint.message` nos 10 locales

**Files:**
- Modify: `src/i18n/locales/en.json`, `es.json`, `pt-BR.json`, `fr.json`, `it.json`, `de.json`, `ja.json`, `zh.json`, `ko.json`, `hi.json`
- Test (já existente): `tests/i18n/locales.test.ts` (paridade) — deve continuar verde.

**Interfaces:**
- Produces: chave i18n `rotateHint.message` disponível em todos os locales.

- [ ] **Step 1: Adicionar o bloco `rotateHint` ao `en.json`**

Adicionar como novo objeto top-level (irmão de `online`), tomando cuidado com a vírgula do objeto anterior:

```json
  "rotateHint": {
    "message": "Rotate your device to landscape for the best experience."
  }
```

- [ ] **Step 2: Adicionar `rotateHint.message` traduzido nos outros 9 locales**

Valores nativos (sem hardcode em código; só JSON):

- `es.json`: `"Gira tu dispositivo a horizontal para una mejor experiencia."`
- `pt-BR.json`: `"Gire o dispositivo para a horizontal para uma experiência melhor."`
- `fr.json`: `"Tournez votre appareil en mode paysage pour une meilleure expérience."`
- `it.json`: `"Ruota il dispositivo in orizzontale per un'esperienza migliore."`
- `de.json`: `"Drehe dein Gerät ins Querformat für das beste Erlebnis."`
- `ja.json`: `"最適な操作のために端末を横向きにしてください。"`
- `zh.json`: `"请将设备旋转为横屏以获得最佳体验。"`
- `ko.json`: `"최적의 환경을 위해 기기를 가로로 돌려 주세요."`
- `hi.json`: `"बेहतर अनुभव के लिए अपने डिवाइस को लैंडस्केप में घुमाएँ।"`

Cada um como bloco `rotateHint` top-level, mesmo formato do `en`.

- [ ] **Step 3: Rodar a suíte i18n para provar paridade**

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: PASS — paridade das chaves nos 10 locales, sem chave órfã, sem placeholder faltando.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/*.json
git commit -m "i18n(7.2): chave rotateHint.message nos 10 locales"
```

---

### Task 3: Overlay de dica de girar na PlayScreen + safe-area/letterbox

**Files:**
- Create: `src/app/hooks/useRotateHint.ts`
- Modify: `src/app/screens/PlayScreen.tsx`
- Modify: `src/app/styles/global.css` (regras `.play-screen*` — overlay + safe-area do Voltar)

**Interfaces:**
- Consumes: `shouldSuggestRotate` (Task 1), `i18n.t('rotateHint.message')` (Task 2).
- Produces: hook `useRotateHint(): boolean` (reativo à orientação/ponteiro).

- [ ] **Step 1: Escrever o hook `useRotateHint`**

`src/app/hooks/useRotateHint.ts` — casca que lê `matchMedia` e recomputa via o módulo puro:

```ts
import { useEffect, useState } from 'preact/hooks';
import { shouldSuggestRotate } from '@render/orientation';

/**
 * Retorna true quando convém sugerir girar para paisagem (celular em retrato).
 * Assina `matchMedia` (sem polling): reage a girar o aparelho / mudar de janela.
 */
export function useRotateHint(): boolean {
  const [suggest, setSuggest] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const portraitMq = window.matchMedia('(orientation: portrait)');
    const coarseMq = window.matchMedia('(pointer: coarse)');
    const update = (): void => {
      setSuggest(
        shouldSuggestRotate({ portrait: portraitMq.matches, coarsePointer: coarseMq.matches }),
      );
    };
    update();
    portraitMq.addEventListener('change', update);
    coarseMq.addEventListener('change', update);
    return () => {
      portraitMq.removeEventListener('change', update);
      coarseMq.removeEventListener('change', update);
    };
  }, []);

  return suggest;
}
```

- [ ] **Step 2: Renderizar o overlay na PlayScreen**

Modificar `src/app/screens/PlayScreen.tsx` para consumir o hook e renderizar o overlay condicional (mantendo o `useLayoutEffect` do jogo intacto):

```tsx
import { useLayoutEffect, useRef } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { useRotateHint } from '../hooks/useRotateHint';
import type { MatchMode } from '@render/matchFactory';

export function PlayScreen({ mode = 'endless' }: { mode?: MatchMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestRotate = useRotateHint();

  useLayoutEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      stop = startGame(el, mode);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode]);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
      {suggestRotate && (
        <div class="rotate-hint" aria-live="polite">
          <span class="rotate-hint__icon" aria-hidden="true">
            📱↻
          </span>
          <p class="rotate-hint__text">{i18n.t('rotateHint.message')}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: CSS do overlay + safe-area do Voltar + fundo do letterbox**

Adicionar/ajustar em `src/app/styles/global.css`. O overlay é **não-bloqueante** (`pointer-events: none`), centralizado, sobre o canvas. O botão Voltar respeita a safe-area. A `.play-screen` mantém o fundo do tema para as barras de letterbox:

```css
.play-screen {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  background: var(--color-bg); /* barras de letterbox na cor do tema */
}

.play-screen__back {
  position: absolute;
  top: max(var(--space-3), env(safe-area-inset-top));
  left: max(var(--space-3), env(safe-area-inset-left));
  z-index: 10;
  min-width: auto;
}

/* Dica de girar (7.2): não bloqueia o toque/flap; some em paisagem via o hook. */
.rotate-hint {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-5);
  text-align: center;
  pointer-events: none; /* CRÍTICO: deixa o flap/tap passarem para o canvas */
  background: color-mix(in srgb, var(--color-bg) 55%, transparent);
}

.rotate-hint__icon {
  font-size: var(--font-size-xl);
  line-height: 1;
}

.rotate-hint__text {
  margin: 0;
  max-width: 20rem;
  color: var(--color-text);
  font-size: var(--font-size-md);
}
```

- [ ] **Step 4: Verificar typecheck e testes de componente/smoke**

Run: `npm run check && npx vitest run`
Expected: typecheck limpo; suíte verde (smoke de App do 4.1/4.2 continua passando).

- [ ] **Step 5: Commit**

```bash
git add src/app/hooks/useRotateHint.ts src/app/screens/PlayScreen.tsx src/app/styles/global.css
git commit -m "feat(7.2): overlay de dica de girar (não-bloqueante) + safe-area do Voltar + letterbox no tema"
```

---

### Task 4: Menus roláveis em paisagem curta + garantia de zero scroll horizontal

**Files:**
- Modify: `src/app/styles/global.css` (regras `.screen`, `#app`, contêineres de menu)

**Interfaces:**
- Consumes: tokens de espaçamento existentes.
- Produces: menus que rolam verticalmente quando o conteúdo não cabe (paisagem baixa), sem nunca gerar scroll horizontal.

- [ ] **Step 1: Permitir rolagem vertical dos menus e travar overflow horizontal**

Ajustar `src/app/styles/global.css`. A `.screen` (e as telas que a usam) deve rolar quando o conteúdo excede a altura, sem clipar; o `#app` nunca deve rolar na horizontal:

```css
html,
body {
  margin: 0;
  height: 100%;
  overflow-x: hidden; /* trava scroll horizontal em qualquer largura */
}

#app {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-5);
  text-align: center;
  overflow-y: auto; /* paisagem curta: conteúdo alto rola em vez de clipar */
}
```

Aplicar o mesmo `overflow-y: auto` + `min-height: 0` aos contêineres de tela que definem o próprio scroll e não usam `.screen` diretamente: `.home` e `.play-screen` já têm `min-height: 0`; garantir que `.home` role quando necessário:

```css
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-4);
  min-height: 0;
  overflow-y: auto;
}
```

- [ ] **Step 2: Verificar que nada quebra o layout no build de dev**

Run: `npm run check && npx vitest run`
Expected: typecheck limpo; suíte verde (mudança é só CSS, sem impacto em testes de lógica).

- [ ] **Step 3: Commit**

```bash
git add src/app/styles/global.css
git commit -m "feat(7.2): menus roláveis em paisagem curta + trava de scroll horizontal"
```

---

### Task 5: Validação Playwright (matriz de tamanhos/orientações) — evidência de fechamento

**Files:** nenhum (verificação; não commita código). Registrar evidência no relatório final e no CLAUDE.md.

**Interfaces:**
- Consumes: bundle real (`npm run dev` ou `bash scripts/run.sh`).

- [ ] **Step 1: Subir o dev server**

Run: `bash scripts/run.sh` (background) — anotar a URL/porta.

- [ ] **Step 2: Percorrer a matriz no Playwright**

Para cada linha, redimensionar (`browser_resize`), navegar, e capturar screenshot + checagem de scroll-x:

| Alvo | Tamanho | Prova |
|------|---------|-------|
| Celular retrato | 390×844 | Home responsiva; entrar em Play mostra a `.rotate-hint`; `scrollWidth <= clientWidth` |
| Celular paisagem | 844×390 | Play sem `.rotate-hint`; canvas centrado com barras no tema; menu (Configurações) rola sem clipar |
| Tablet retrato | 768×1024 | grids reflowam; sem scroll-x |
| Tablet paisagem | 1024×768 | canvas grande centrado |
| Desktop | 1440×900 | canvas centrado, barras na cor do tema; menus centrados |

Checagem de scroll horizontal (via `browser_evaluate`):

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Checagem da dica (retrato toque vs. paisagem): presença/ausência do seletor `.rotate-hint` e que um toque no canvas ainda flapa (o overlay é `pointer-events:none`).

- [ ] **Step 3: Parar o dev server**

Run: `bash scripts/stop.sh`

- [ ] **Step 4: Registrar evidência**

Sem commit de código; anotar os resultados (screenshots + checagens) para o relatório de conclusão e a entrada do CLAUDE.md.

---

## Fechamento (fora das tasks, feito pelo controlador)
- `verify-determinism` / bateria 67 (não-regressão; nada em `src/core/`).
- Marcar `7.2` como `[x]` em `docs/roadmap/PHASE-07-pwa-and-deploy.md`.
- Atualizar "Estado atual" do `CLAUDE.md`.
- Merge para `main` (`--no-ff`) e aposentar a branch (pré-autorizado).
