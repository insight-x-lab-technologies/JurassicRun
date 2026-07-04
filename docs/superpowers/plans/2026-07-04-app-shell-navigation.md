# App Shell e Navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a casca Preact do JurassicRun — telas navegáveis (router + design tokens responsivos) com o jogo Phaser existente vivendo como a tela "Play".

**Architecture:** Padrão puro×casca (como `src/render/`). Router = módulo puro testável (pilha de histórico) + sinal reativo `@preact/signals`. `App` observa o sinal e faz switch para a tela. `PlayScreen` monta/destrói o Phaser via `startGame()` com **dynamic import** (Phaser fica fora do grafo estático do shell). Telas não-implementadas são stubs genéricos. `src/core/` NÃO é tocado.

**Tech Stack:** Preact 10 + `@preact/signals` (JSX via esbuild, `jsxImportSource: preact`), i18next (10 locales), CSS custom properties, Vitest + happy-dom para 1 smoke test.

## Global Constraints

- **REGRA 4 (i18n):** nenhuma string visível hardcoded — tudo via chaves i18next nos **10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`). `en` é a fonte; paridade forçada por `tests/i18n/locales.test.ts`.
- **`src/core/` NÃO é tocado** ⇒ determinismo intacto (64 testes de determinismo devem continuar verdes).
- **REGRA 3 (performance):** montar/desmontar o Phaser sem leak (destruir o `Game` e remover listeners).
- **TypeScript estrito:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (use `import { x, type T }`), `noFallthroughCasesInSwitch`. Sem `any` sem justificativa.
- Padrão **puro × casca**: lógica de estado testável separada da casca Preact/DOM (a casca Phaser e os componentes de tela não têm teste unitário; verificação é visual via Playwright).
- Verificação final: `npm run check` (tsc + eslint) limpo e `npm test` verde.

---

### Task 1: Router (estado puro + sinal reativo)

**Files:**
- Create: `src/app/router/routes.ts`
- Create: `src/app/router/router.ts`
- Create: `src/app/router/index.ts`
- Test: `tests/app/router.test.ts`

**Interfaces:**
- Produces:
  - `type Screen = 'home' | 'play' | 'profile' | 'nest' | 'shop' | 'settings' | 'leaderboard' | 'expansions'`
  - `HOME_SCREEN: Screen`
  - `route: ReadonlySignal<Screen>` (topo da pilha; o que o `App` observa)
  - `navigate(screen: Screen): void` — empilha; navegar para a rota corrente é no-op
  - `back(): void` — desempilha; na raiz é no-op
  - `canGoBack(): boolean`
  - `resetToHome(): void` — zera a pilha para `[HOME_SCREEN]`

- [ ] **Step 1: Escrever o teste que falha** — `tests/app/router.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { route, navigate, back, canGoBack, resetToHome } from '@app/router';

describe('router', () => {
  beforeEach(() => resetToHome());

  it('começa na Home sem histórico para trás', () => {
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });

  it('navigate empilha e torna a tela corrente', () => {
    navigate('settings');
    expect(route.value).toBe('settings');
    expect(canGoBack()).toBe(true);
  });

  it('navegar para a rota corrente é no-op (não empilha)', () => {
    navigate('shop');
    navigate('shop');
    back();
    expect(route.value).toBe('home');
  });

  it('back desempilha para a tela anterior', () => {
    navigate('nest');
    navigate('shop');
    back();
    expect(route.value).toBe('nest');
    back();
    expect(route.value).toBe('home');
  });

  it('back na raiz (Home) é no-op', () => {
    back();
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });

  it('resetToHome limpa a pilha', () => {
    navigate('profile');
    navigate('leaderboard');
    resetToHome();
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/router.test.ts`
Expected: FAIL (módulo `@app/router` não existe).

- [ ] **Step 3: Implementar `routes.ts`**

```ts
export type Screen =
  | 'home'
  | 'play'
  | 'profile'
  | 'nest'
  | 'shop'
  | 'settings'
  | 'leaderboard'
  | 'expansions';

export const HOME_SCREEN: Screen = 'home';
```

- [ ] **Step 4: Implementar `router.ts`**

```ts
import { signal, type ReadonlySignal } from '@preact/signals';
import { HOME_SCREEN, type Screen } from './routes';

// Pilha de histórico de navegação; o topo é a rota corrente.
const stack: Screen[] = [HOME_SCREEN];
const _route = signal<Screen>(HOME_SCREEN);

/** Sinal somente-leitura com a rota corrente (topo da pilha). */
export const route: ReadonlySignal<Screen> = _route;

/** Empilha uma tela e a torna corrente. Navegar para a rota corrente é no-op. */
export function navigate(screen: Screen): void {
  if (stack[stack.length - 1] === screen) return;
  stack.push(screen);
  _route.value = screen;
}

/** Volta uma tela. Na raiz (Home) é no-op. */
export function back(): void {
  if (stack.length <= 1) return;
  stack.pop();
  _route.value = stack[stack.length - 1]!;
}

/** true sse há para onde voltar (pilha com mais de um item). */
export function canGoBack(): boolean {
  return stack.length > 1;
}

/** Reinicia a navegação para a raiz (Home). Usado por "sair para Home" e por testes. */
export function resetToHome(): void {
  stack.length = 0;
  stack.push(HOME_SCREEN);
  _route.value = HOME_SCREEN;
}
```

- [ ] **Step 5: Implementar `index.ts` (barrel)**

```ts
export * from './routes';
export * from './router';
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/app/router.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 7: Typecheck/lint**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/router tests/app/router.test.ts
git commit -m "feat(4.1): router puro+sinal (navigate/back/canGoBack) com testes"
```

---

### Task 2: Chaves i18n do shell (10 locales)

**Files:**
- Modify: `src/i18n/locales/en.json` (+ `es, pt-BR, fr, it, de, ja, zh, ko, hi`.json)
- Test: `tests/i18n/locales.test.ts` (existente — paridade)

**Interfaces:**
- Produces: chaves `nav.{play,back,profile,nest,shop,settings,leaderboard,expansions}` e `screen.{comingSoon,profile,nest,shop,settings,leaderboard,expansions}` em todos os locales.

- [ ] **Step 1: Adicionar os dois blocos ao `en.json`** (dentro do objeto raiz, ao lado de `app`/`hud`/etc.)

```json
  "nav": {
    "play": "Play",
    "back": "Back",
    "profile": "Profile",
    "nest": "Nest",
    "shop": "Shop",
    "settings": "Settings",
    "leaderboard": "Leaderboard",
    "expansions": "Expansions"
  },
  "screen": {
    "comingSoon": "Coming soon",
    "profile": "Profile",
    "nest": "Nest",
    "shop": "Shop",
    "settings": "Settings",
    "leaderboard": "Leaderboard",
    "expansions": "Expansions"
  }
```

- [ ] **Step 2: Rodar o teste de locales e ver falhar** (os 9 outros ainda não têm as chaves)

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: FAIL (paridade: os demais locales divergem de `en`).

- [ ] **Step 3: Adicionar os blocos `nav`/`screen` aos 9 locales restantes**

`es.json`:
```json
  "nav": { "play": "Jugar", "back": "Atrás", "profile": "Perfil", "nest": "Nido", "shop": "Tienda", "settings": "Ajustes", "leaderboard": "Clasificación", "expansions": "Expansiones" },
  "screen": { "comingSoon": "Próximamente", "profile": "Perfil", "nest": "Nido", "shop": "Tienda", "settings": "Ajustes", "leaderboard": "Clasificación", "expansions": "Expansiones" }
```
`pt-BR.json`:
```json
  "nav": { "play": "Jogar", "back": "Voltar", "profile": "Perfil", "nest": "Ninho", "shop": "Loja", "settings": "Configurações", "leaderboard": "Placar", "expansions": "Expansões" },
  "screen": { "comingSoon": "Em breve", "profile": "Perfil", "nest": "Ninho", "shop": "Loja", "settings": "Configurações", "leaderboard": "Placar", "expansions": "Expansões" }
```
`fr.json`:
```json
  "nav": { "play": "Jouer", "back": "Retour", "profile": "Profil", "nest": "Nid", "shop": "Boutique", "settings": "Paramètres", "leaderboard": "Classement", "expansions": "Extensions" },
  "screen": { "comingSoon": "Bientôt disponible", "profile": "Profil", "nest": "Nid", "shop": "Boutique", "settings": "Paramètres", "leaderboard": "Classement", "expansions": "Extensions" }
```
`it.json`:
```json
  "nav": { "play": "Gioca", "back": "Indietro", "profile": "Profilo", "nest": "Nido", "shop": "Negozio", "settings": "Impostazioni", "leaderboard": "Classifica", "expansions": "Espansioni" },
  "screen": { "comingSoon": "Prossimamente", "profile": "Profilo", "nest": "Nido", "shop": "Negozio", "settings": "Impostazioni", "leaderboard": "Classifica", "expansions": "Espansioni" }
```
`de.json`:
```json
  "nav": { "play": "Spielen", "back": "Zurück", "profile": "Profil", "nest": "Nest", "shop": "Shop", "settings": "Einstellungen", "leaderboard": "Bestenliste", "expansions": "Erweiterungen" },
  "screen": { "comingSoon": "Demnächst", "profile": "Profil", "nest": "Nest", "shop": "Shop", "settings": "Einstellungen", "leaderboard": "Bestenliste", "expansions": "Erweiterungen" }
```
`ja.json`:
```json
  "nav": { "play": "プレイ", "back": "戻る", "profile": "プロフィール", "nest": "巣", "shop": "ショップ", "settings": "設定", "leaderboard": "ランキング", "expansions": "拡張" },
  "screen": { "comingSoon": "近日公開", "profile": "プロフィール", "nest": "巣", "shop": "ショップ", "settings": "設定", "leaderboard": "ランキング", "expansions": "拡張" }
```
`zh.json`:
```json
  "nav": { "play": "开始", "back": "返回", "profile": "个人资料", "nest": "巢穴", "shop": "商店", "settings": "设置", "leaderboard": "排行榜", "expansions": "扩展" },
  "screen": { "comingSoon": "敬请期待", "profile": "个人资料", "nest": "巢穴", "shop": "商店", "settings": "设置", "leaderboard": "排行榜", "expansions": "扩展" }
```
`ko.json`:
```json
  "nav": { "play": "플레이", "back": "뒤로", "profile": "프로필", "nest": "둥지", "shop": "상점", "settings": "설정", "leaderboard": "리더보드", "expansions": "확장" },
  "screen": { "comingSoon": "곧 출시", "profile": "프로필", "nest": "둥지", "shop": "상점", "settings": "설정", "leaderboard": "리더보드", "expansions": "확장" }
```
`hi.json`:
```json
  "nav": { "play": "खेलें", "back": "वापस", "profile": "प्रोफ़ाइल", "nest": "घोंसला", "shop": "दुकान", "settings": "सेटिंग्स", "leaderboard": "लीडरबोर्ड", "expansions": "विस्तार" },
  "screen": { "comingSoon": "जल्द आ रहा है", "profile": "प्रोफ़ाइल", "nest": "घोंसला", "shop": "दुकान", "settings": "सेटिंग्स", "leaderboard": "लीडरबोर्ड", "expansions": "विस्तार" }
```

(Formate cada arquivo como o `en.json`: JSON válido, blocos como propriedades do objeto raiz. Ajuste vírgulas.)

- [ ] **Step 4: Rodar o teste de locales e ver passar**

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: PASS (paridade de chaves em todos os 10 locales).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(4.1): chaves i18n do shell (nav.*/screen.*) nos 10 locales"
```

---

### Task 3: Design tokens + CSS global

**Files:**
- Create: `src/app/styles/tokens.css`
- Create: `src/app/styles/global.css`

**Interfaces:**
- Produces: custom properties `--color-*`, `--space-1..6`, `--font-*`, `--radius-*`, `--shadow-1`; classes utilitárias `.screen`, `.screen__title`, `.btn`, `.btn--ghost`, `.play-screen`, `.play-screen__canvas`, `.play-screen__back` (consumidas pelas telas na Task 4).

- [ ] **Step 1: Criar `src/app/styles/tokens.css`**

```css
:root {
  /* Cores (neutras; packs cosméticos da Fase 8 sobrescrevem via override) */
  --color-bg: #0e1116;
  --color-surface: #1a1f2b;
  --color-surface-2: #232a38;
  --color-primary: #4ea1ff;
  --color-on-primary: #06121f;
  --color-text: #eef2f7;
  --color-text-muted: #9aa6b6;
  --color-accent: #ffcf5c;
  --color-danger: #ff6b6b;

  /* Espaçamento */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  /* Tipografia fluida (escala com a viewport) */
  --font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-size-sm: clamp(0.8rem, 0.75rem + 0.3vw, 0.95rem);
  --font-size-md: clamp(1rem, 0.9rem + 0.5vw, 1.2rem);
  --font-size-lg: clamp(1.4rem, 1.1rem + 1.2vw, 2rem);
  --font-size-xl: clamp(2rem, 1.4rem + 2.5vw, 3.2rem);

  /* Superfícies */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --shadow-1: 0 2px 8px rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 2: Criar `src/app/styles/global.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  /* Safe-area (viewport-fit=cover já no index.html) */
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
}

.screen__title {
  font-size: var(--font-size-xl);
  margin: 0;
}

.btn {
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  min-width: 12rem;
  min-height: 44px; /* alvo de toque confortável */
  cursor: pointer;
  box-shadow: var(--shadow-1);
}

.btn--ghost {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.btn:active {
  transform: translateY(1px);
}

.play-screen {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.play-screen__canvas {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-screen__back {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  z-index: 10;
  min-width: auto;
}
```

- [ ] **Step 3: Verificar que o check continua limpo** (CSS não quebra tsc/eslint)

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/styles
git commit -m "feat(4.1): design tokens + CSS global responsivo (safe-area, tipografia fluida)"
```

---

### Task 4: App shell, telas e integração do jogo

**Files:**
- Create: `src/app/game/startGame.ts`
- Create: `src/app/screens/PlayScreen.tsx`
- Create: `src/app/screens/HomeScreen.tsx`
- Create: `src/app/screens/PlaceholderScreen.tsx`
- Create: `src/app/App.tsx`
- Rename+Modify: `src/app/main.ts` → `src/app/main.tsx`
- Modify: `index.html` (script src → `main.tsx`)
- Modify: `vite.config.ts` (esbuild JSX preact)
- Modify: `vitest.config.ts` (incluir `.tsx`)
- Modify: `package.json` (devDep `happy-dom`)
- Test: `tests/app/App.test.tsx`

**Interfaces:**
- Consumes: `route`, `navigate`, `back`, `type Screen` (Task 1); chaves i18n (Task 2); classes CSS (Task 3); `createWorld` (`@core/sim`), `createGame` (`@render/game`), `FlapInputSource`/`PauseController` (`@render/input`), `MatchController` (`@render/match`), `randomEndlessSeed` (`@render/seedSource`), `bindGameControls` (`@render/controls`).
- Produces: `startGame(container: HTMLElement): () => void`; componentes `App`, `HomeScreen`, `PlayScreen`, `PlaceholderScreen`.

- [ ] **Step 1: Instalar happy-dom (devDep)**

Run: `npm install -D happy-dom`
Expected: adiciona `happy-dom` em `devDependencies`.

- [ ] **Step 2: Ampliar o include do Vitest para `.tsx`** — `vitest.config.ts`

Trocar a linha `include:` por:
```ts
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
```

- [ ] **Step 3: Garantir JSX Preact no esbuild do Vite** — `vite.config.ts`

Adicionar ao objeto de `defineConfig` (ao lado de `plugins`):
```ts
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
```
(O Vitest herda `jsxImportSource: 'preact'` do `tsconfig.json`.)

- [ ] **Step 4: Criar `src/app/game/startGame.ts`** (casca imperativa; migra a fiação do antigo main.ts)

```ts
import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController } from '@render/match';
import { randomEndlessSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';

/**
 * Monta o jogo Phaser no `container` e devolve um `stop()` que o destrói e remove os
 * listeners. Reproduz a fiação antes feita no main.ts (agora dirigida pela PlayScreen).
 */
export function startGame(container: HTMLElement): () => void {
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset();

  const match = new MatchController(
    flap,
    () => {
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed }), seedLabel: seed };
    },
    { onNewMatch: () => flap.reset() },
  );

  const game = createGame(container, match, { pause });
  const cleanupControls = bindGameControls(window, {
    flap,
    pause,
    onFlap: () => match.notifyFlap(),
    onRestart: () => match.restart(),
    isDead: () => match.phase === 'dead',
  });

  return () => {
    cleanupControls();
    game.destroy(true);
  };
}
```

- [ ] **Step 5: Criar `src/app/screens/PlayScreen.tsx`** (Phaser via **dynamic import** ⇒ fora do grafo estático do shell)

```tsx
import { useLayoutEffect, useRef } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';

export function PlayScreen() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      stop = startGame(el);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
    </div>
  );
}
```

- [ ] **Step 6: Criar `src/app/screens/HomeScreen.tsx`** (menu temporário; o real é 4.3)

```tsx
import { navigate, type Screen } from '../router';
import { i18n } from '@services/i18n';

const DESTINATIONS: readonly Screen[] = [
  'profile',
  'nest',
  'shop',
  'settings',
  'leaderboard',
  'expansions',
];

export function HomeScreen() {
  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('app.title')}</h1>
      <button class="btn" onClick={() => navigate('play')}>
        {i18n.t('nav.play')}
      </button>
      {DESTINATIONS.map((screen) => (
        <button key={screen} class="btn btn--ghost" onClick={() => navigate(screen)}>
          {i18n.t(`nav.${screen}`)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Criar `src/app/screens/PlaceholderScreen.tsx`**

```tsx
import { back } from '../router';
import { i18n } from '@services/i18n';

export function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t(titleKey)}</h1>
      <p>{i18n.t('screen.comingSoon')}</p>
      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Criar `src/app/App.tsx`** (switch exaustivo com `default: never`)

```tsx
import { route, type Screen } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import type { VNode } from 'preact';

function screenFor(screen: Screen): VNode {
  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'play':
      return <PlayScreen />;
    case 'profile':
      return <PlaceholderScreen titleKey="screen.profile" />;
    case 'nest':
      return <PlaceholderScreen titleKey="screen.nest" />;
    case 'shop':
      return <PlaceholderScreen titleKey="screen.shop" />;
    case 'settings':
      return <PlaceholderScreen titleKey="screen.settings" />;
    case 'leaderboard':
      return <PlaceholderScreen titleKey="screen.leaderboard" />;
    case 'expansions':
      return <PlaceholderScreen titleKey="screen.expansions" />;
    default: {
      const _never: never = screen;
      return _never;
    }
  }
}

export function App(): VNode {
  return screenFor(route.value);
}
```

- [ ] **Step 9: Renomear `main.ts` → `main.tsx` e reescrevê-lo**

Run: `git mv src/app/main.ts src/app/main.tsx`

Conteúdo novo de `src/app/main.tsx`:
```tsx
import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { i18n } from '@services/i18n';
import { App } from './App';

async function bootstrap(): Promise<void> {
  await i18n.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const root = document.getElementById('app');
  if (root === null) throw new Error('#app não encontrado');
  render(<App />, root);
}

void bootstrap();
```

- [ ] **Step 10: Apontar o `index.html` para `main.tsx`**

Trocar `src="/src/app/main.ts"` por `src="/src/app/main.tsx"`.

- [ ] **Step 11: Escrever o smoke test** — `tests/app/App.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { resetToHome, navigate } from '@app/router';
import { i18n } from '@services/i18n';

describe('App shell', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container); // desmonta
    container.remove();
  });

  it('renderiza a Home com título e botão Jogar', () => {
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('app.title'));
    expect(container.textContent).toContain(i18n.t('nav.play'));
  });

  it('após navegar a um stub, mostra seu título e "em breve"', () => {
    render(<App />, container);
    navigate('settings');
    render(<App />, container); // re-render lê route.value corrente (flush determinístico)
    expect(container.textContent).toContain(i18n.t('screen.settings'));
    expect(container.textContent).toContain(i18n.t('screen.comingSoon'));
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });
});
```

Nota: o teste nunca renderiza `PlayScreen` (Phaser precisa de canvas/WebGL, ausente no happy-dom); o Phaser está atrás do `import()` dinâmico da Task 4/Step 5, logo não entra no grafo estático deste teste.

- [ ] **Step 12: Rodar a suíte inteira e ver passar**

Run: `npm test`
Expected: PASS — router (6) + App shell (2) + i18n + todo o resto; determinismo (64) intacto.

- [ ] **Step 13: Typecheck/lint**

Run: `npm run check`
Expected: sem erros (JSX transforma; switch exaustivo; sem imports não usados).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(4.1): app shell Preact (router, telas, jogo como PlayScreen com Phaser lazy)"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run check` limpo e `npm test` verde (evidência real).
- [ ] `npm run test:determinism` verde (64 testes) — confirma `src/core/` intocado.
- [ ] Verificação visual (Playwright, dev server): Home renderiza com botões; "Jogar" → canvas do jogo visível e dino jogável; "Voltar" → destrói o jogo e volta à Home; abrir um stub (ex.: Configurações) mostra título + "em breve" e Voltar retorna à Home. Layout ok em retrato e paisagem (redimensionar).
- [ ] Marcar 4.1 `[x]` em `docs/roadmap/PHASE-04-meta-offline.md`.
- [ ] Atualizar "Estado atual" do `CLAUDE.md`.

## Self-review (cobertura da spec)

- Router puro + sinal → Task 1. ✓
- App shell + switch de telas → Task 4 (App.tsx). ✓
- Integração do jogo (mount/destroy, sem leak) → Task 4 (startGame + PlayScreen, dynamic import). ✓
- Telas placeholder (Home + genérico) → Task 4. ✓
- Design tokens + global CSS (safe-area, tipografia fluida, mobile-first) → Task 3. ✓
- i18n 10 locales (nav.*/screen.*) → Task 2. ✓
- Testes (router a fundo + smoke de App) → Tasks 1 e 4. ✓
- `src/core/` intocado → nenhuma task toca `src/core/`. ✓
