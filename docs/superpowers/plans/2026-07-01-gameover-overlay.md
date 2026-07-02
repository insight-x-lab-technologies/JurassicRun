# Game Over Overlay (2.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao morrer (`dead`), mostrar um overlay de Game Over com estatísticas (distância, comida, near-misses) e botões Reiniciar (ativo) / Sair (stub desabilitado).

**Architecture:** Padrão puro×casca das telas anteriores. Lógica testável em módulos puros (`gameover.ts` formata stats; `MatchController` separa `notifyFlap`/`restart`); a renderização Phaser fica na casca `GameScene` (verificada por Playwright). Core intocado (REGRA 1).

**Tech Stack:** TypeScript estrito, Vitest, Phaser (só na casca), i18next (10 locales).

## Global Constraints

- **Determinismo:** `src/core/` NÃO é tocado. `Math.random`/`Date.now`/`performance.now` proibidos em core (não aplicável aqui — não mexemos em core).
- **i18n (REGRA 4):** nenhuma string visível hardcoded; toda chave nova existe nos **10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`), paridade validada por `tests/i18n/locales.test.ts`.
- **Performance (REGRA 3):** zero alocação por frame no hot path — o overlay refaz strings só na transição para `dead`, não por frame.
- **TS estrito:** sem `any` sem justificativa. `src/render/` não importa phaser em módulos puros (só em `GameScene`/`game`).
- **Commits:** um por task, na branch `feature/2.6-gameover-overlay`.

---

### Task 1: `gameover.ts` puro — `formatGameOverStats`

**Files:**
- Create: `src/render/gameover.ts`
- Test: `tests/render/gameover.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface GameOverRaw { distance: number; food: number; nearMisses: number }`
  - `interface GameOverView { distance: string; food: string; nearMisses: string }`
  - `function formatGameOverStats(raw: GameOverRaw): GameOverView`

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/gameover.test.ts
import { describe, it, expect } from 'vitest';
import { formatGameOverStats } from '@render/gameover';

describe('formatGameOverStats', () => {
  it('faz floor de distância/comida/near-misses em strings', () => {
    expect(formatGameOverStats({ distance: 128.9, food: 7, nearMisses: 3 })).toEqual({
      distance: '128',
      food: '7',
      nearMisses: '3',
    });
  });

  it('formata zeros e trunca frações', () => {
    expect(formatGameOverStats({ distance: 0.9, food: 0, nearMisses: 2.7 })).toEqual({
      distance: '0',
      food: '0',
      nearMisses: '2',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/gameover.test.ts`
Expected: FAIL — cannot resolve `@render/gameover`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/render/gameover.ts
// Módulo PURO (sem phaser): formatação canônica das estatísticas do Game Over.
// Espelha formatHudValues (hud.ts). Rótulos/unidades vivem nas chaves i18n `gameover.*`.

/** Valores crus lidos do WorldState ao morrer. */
export interface GameOverRaw {
  distance: number;
  food: number;
  nearMisses: number;
}

/** Valores formatados (strings). Rótulos/unidades vêm das chaves i18n. */
export interface GameOverView {
  distance: string;
  food: string;
  nearMisses: string;
}

/** Floor de contagens inteiras. Sem estado, sem alocação por frame (chamado 1× ao morrer). */
export function formatGameOverStats(raw: GameOverRaw): GameOverView {
  return {
    distance: String(Math.floor(raw.distance)),
    food: String(Math.floor(raw.food)),
    nearMisses: String(Math.floor(raw.nearMisses)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/gameover.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/render/gameover.ts tests/render/gameover.test.ts
git commit -m "feat(2.6): gameover.ts puro (formatGameOverStats)"
```

---

### Task 2: `MatchController` — separar `notifyFlap` de `restart`

**Files:**
- Modify: `src/render/match.ts`
- Modify (tests existentes): `tests/render/match.test.ts`

**Interfaces:**
- Consumes: `MatchController(input, factory, hooks)`, getters `phase/world/loop/seedLabel` (já existem).
- Produces:
  - `MatchController.notifyFlap(): void` — agora **só** `ready → playing`. No-op em `playing`/`dead`.
  - `MatchController.restart(): void` — **novo**. Só em `dead`: monta nova partida (nova seed/world via `factory`) + dispara `hooks.onNewMatch?.()`. No-op fora de `dead`.

- [ ] **Step 1: Atualizar os testes existentes de restart (falham antes da mudança)**

Em `tests/render/match.test.ts`, substituir o teste "notifyFlap em dead reinicia…" e ajustar o de "loop aponta para o world corrente" para usar `restart()`, e adicionar cobertura de `notifyFlap` no-op em `dead`:

```ts
  it('notifyFlap em dead é no-op (restart é explícito)', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    const seedBefore = m.seedLabel;
    m.notifyFlap();
    expect(m.phase).toBe('dead');
    expect(m.seedLabel).toBe(seedBefore);
  });

  it('restart em dead reinicia: nova seed, world novo, ready, onNewMatch chamado', () => {
    let resets = 0;
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onNewMatch: () => { resets++; },
    });
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.phase).toBe('dead');

    m.restart();
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST1');
    expect(m.world.tick).toBe(0);
    expect(m.world.alive).toBe(true);
    expect(resets).toBe(1);
  });

  it('restart fora de dead é no-op', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.restart(); // em ready
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST0');
    m.notifyFlap(); // playing
    m.restart(); // em playing
    expect(m.phase).toBe('playing');
    expect(m.seedLabel).toBe('endless:TEST0');
  });

  it('o loop aponta para o world corrente após restart', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    m.restart(); // → ready, world novo
    expect(m.loop.world).toBe(m.world);
  });
```

Remover o teste antigo "notifyFlap em dead reinicia…" e o "loop aponta…" antigo (substituídos acima).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/render/match.test.ts`
Expected: FAIL — `m.restart is not a function` e/ou `notifyFlap em dead` ainda reiniciando.

- [ ] **Step 3: Implementar a separação em `MatchController`**

Em `src/render/match.ts`, substituir o método `notifyFlap` por dois métodos:

```ts
  /** Borda de pressão de flap vinda da casca. Só inicia a partida em `ready`. */
  notifyFlap(): void {
    if (this._phase === 'ready') {
      this._phase = 'playing';
    }
    // em `playing`: o flap é tratado pelo core via InputSource. Em `dead`: no-op (restart é explícito).
  }

  /** Reinicia após a morte: nova partida (nova seed/world) + hook. No-op fora de `dead`. */
  restart(): void {
    if (this._phase !== 'dead') return;
    this.startMatch();
    this.hooks.onNewMatch?.();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render/match.test.ts`
Expected: PASS (todos, incluindo os novos).

- [ ] **Step 5: Commit**

```bash
git add src/render/match.ts tests/render/match.test.ts
git commit -m "feat(2.6): MatchController separa notifyFlap (ready→playing) de restart (dead→nova partida)"
```

---

### Task 3: Chaves i18n `gameover.*` nos 10 locales

**Files:**
- Modify: `src/i18n/locales/en.json`, `es.json`, `pt-BR.json`, `fr.json`, `it.json`, `de.json`, `ja.json`, `zh.json`, `ko.json`, `hi.json`
- Test (já existe, deve continuar verde): `tests/i18n/locales.test.ts`

**Interfaces:**
- Produces: bloco `gameover` com chaves `title`, `distance`, `food`, `nearMisses`, `restart`, `quit` em cada locale.

- [ ] **Step 1: Adicionar o bloco `gameover` em cada locale**

Inserir, no objeto raiz de cada JSON (após o bloco `match`), o bloco `gameover`. Traduções por idioma:

`en.json`:
```json
  "gameover": {
    "title": "Game Over",
    "distance": "Distance: {{value}}m",
    "food": "Food: {{value}}",
    "nearMisses": "Near misses: {{value}}",
    "restart": "Restart",
    "quit": "Quit"
  }
```

`es.json`:
```json
  "gameover": {
    "title": "Fin del juego",
    "distance": "Distancia: {{value}} m",
    "food": "Comida: {{value}}",
    "nearMisses": "Casi choques: {{value}}",
    "restart": "Reiniciar",
    "quit": "Salir"
  }
```

`pt-BR.json`:
```json
  "gameover": {
    "title": "Fim de jogo",
    "distance": "Distância: {{value}} m",
    "food": "Comida: {{value}}",
    "nearMisses": "Quase colisões: {{value}}",
    "restart": "Reiniciar",
    "quit": "Sair"
  }
```

`fr.json`:
```json
  "gameover": {
    "title": "Partie terminée",
    "distance": "Distance : {{value}} m",
    "food": "Nourriture : {{value}}",
    "nearMisses": "Quasi-collisions : {{value}}",
    "restart": "Recommencer",
    "quit": "Quitter"
  }
```

`it.json`:
```json
  "gameover": {
    "title": "Game Over",
    "distance": "Distanza: {{value}} m",
    "food": "Cibo: {{value}}",
    "nearMisses": "Quasi collisioni: {{value}}",
    "restart": "Ricomincia",
    "quit": "Esci"
  }
```

`de.json`:
```json
  "gameover": {
    "title": "Spiel vorbei",
    "distance": "Distanz: {{value}} m",
    "food": "Futter: {{value}}",
    "nearMisses": "Beinahe-Kollisionen: {{value}}",
    "restart": "Neu starten",
    "quit": "Beenden"
  }
```

`ja.json`:
```json
  "gameover": {
    "title": "ゲームオーバー",
    "distance": "距離: {{value}}m",
    "food": "エサ: {{value}}",
    "nearMisses": "ニアミス: {{value}}",
    "restart": "リスタート",
    "quit": "やめる"
  }
```

`zh.json`:
```json
  "gameover": {
    "title": "游戏结束",
    "distance": "距离：{{value}} 米",
    "food": "食物：{{value}}",
    "nearMisses": "险些相撞：{{value}}",
    "restart": "重新开始",
    "quit": "退出"
  }
```

`ko.json`:
```json
  "gameover": {
    "title": "게임 오버",
    "distance": "거리: {{value}}m",
    "food": "먹이: {{value}}",
    "nearMisses": "아슬아슬: {{value}}",
    "restart": "다시 시작",
    "quit": "나가기"
  }
```

`hi.json`:
```json
  "gameover": {
    "title": "गेम ओवर",
    "distance": "दूरी: {{value}} मी",
    "food": "भोजन: {{value}}",
    "nearMisses": "करीबी टक्कर: {{value}}",
    "restart": "फिर से शुरू करें",
    "quit": "बाहर निकलें"
  }
```

Cuidar da vírgula que separa o bloco `match` do novo `gameover` em cada arquivo.

- [ ] **Step 2: Run i18n parity test**

Run: `npx vitest run tests/i18n/locales.test.ts`
Expected: PASS — todos os locales com paridade de chaves com `en` (agora incluindo `gameover.*`).

- [ ] **Step 3: Typecheck (JSON importado)**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(2.6): chaves i18n gameover.* nos 10 locales"
```

---

### Task 4: Constantes de layout/estilo do Game Over

**Files:**
- Modify: `src/render/constants.ts`

**Interfaces:**
- Produces (exports novos):
  - `GAMEOVER_OVERLAY_ALPHA: number`
  - `GAMEOVER_OVERLAY_DEPTH: number` (fundo), `GAMEOVER_CONTENT_DEPTH: number` (conteúdo)
  - `GAMEOVER_TITLE_FONT_SIZE`, `GAMEOVER_STAT_FONT_SIZE`, `GAMEOVER_BUTTON_FONT_SIZE: string`
  - `GAMEOVER_TEXT_COLOR`, `GAMEOVER_BUTTON_COLOR`, `GAMEOVER_BUTTON_DISABLED_COLOR: string`
  - `CONFIRM_KEYS: readonly string[]`

- [ ] **Step 1: Adicionar as constantes**

Acrescentar ao fim de `src/render/constants.ts`:

```ts
/** Game Over (2.6): overlay no estado `dead`. Entre o HUD (900) e a pausa (1000). */
export const GAMEOVER_OVERLAY_ALPHA = 0.6;
export const GAMEOVER_OVERLAY_DEPTH = 960; // fundo escuro
export const GAMEOVER_CONTENT_DEPTH = 970; // título/stats/botões (acima do fundo)
export const GAMEOVER_TITLE_FONT_SIZE = '16px';
export const GAMEOVER_STAT_FONT_SIZE = '9px';
export const GAMEOVER_BUTTON_FONT_SIZE = '11px';
export const GAMEOVER_TEXT_COLOR = '#ffffff';
export const GAMEOVER_BUTTON_COLOR = '#ffe08a'; // Reiniciar (ativo)
export const GAMEOVER_BUTTON_DISABLED_COLOR = '#777777'; // Sair (stub desabilitado)

/** Teclas de confirmação que reiniciam quando em `dead` (conveniência desktop). */
export const CONFIRM_KEYS: readonly string[] = ['Space', 'ArrowUp', 'Enter'];
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: sem erros (constantes ainda não usadas — ok; serão consumidas na Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/render/constants.ts
git commit -m "feat(2.6): constantes de layout/estilo do Game Over overlay"
```

---

### Task 5: Overlay de Game Over na `GameScene` (casca)

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: `formatGameOverStats` (Task 1); `MatchController.restart()`/`phase`/`world` (Task 2); chaves `gameover.*` (Task 3); constantes `GAMEOVER_*`/`CONFIRM_KEYS` (Task 4); `i18n`.
- Produces: comportamento visual (sem export novo). Sem teste de unidade (Phaser) — verificação visual na Task 6.

- [ ] **Step 1: Importar peças novas**

No topo de `src/render/GameScene.ts`, adicionar aos imports existentes:

```ts
import { HudTicker, formatHudValues } from './hud';
import { formatGameOverStats } from './gameover';
```

E acrescentar às constantes já importadas de `./constants`:

```ts
  GAMEOVER_OVERLAY_ALPHA,
  GAMEOVER_OVERLAY_DEPTH,
  GAMEOVER_CONTENT_DEPTH,
  GAMEOVER_TITLE_FONT_SIZE,
  GAMEOVER_STAT_FONT_SIZE,
  GAMEOVER_BUTTON_FONT_SIZE,
  GAMEOVER_TEXT_COLOR,
  GAMEOVER_BUTTON_COLOR,
  GAMEOVER_BUTTON_DISABLED_COLOR,
  CONFIRM_KEYS,
```

- [ ] **Step 2: Campos de instância do overlay**

Adicionar aos campos privados da classe (junto de `readyPrompt`):

```ts
  private gameOverBg!: Phaser.GameObjects.Graphics;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverStats!: Phaser.GameObjects.Text;
  private gameOverRestart!: Phaser.GameObjects.Text;
  private gameOverQuit!: Phaser.GameObjects.Text;
  private wasDead = false;
```

- [ ] **Step 3: Construir o overlay em `create()`**

No fim de `create()`, após o `readyPrompt`, adicionar:

```ts
    // Game Over (2.6): overlay no estado `dead`. Criado 1×, escondido por default.
    this.gameOverBg = this.add.graphics().setScrollFactor(0).setDepth(GAMEOVER_OVERLAY_DEPTH);
    this.gameOverBg.fillStyle(PAUSE_OVERLAY_COLOR, GAMEOVER_OVERLAY_ALPHA);
    this.gameOverBg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.gameOverBg.setVisible(false);

    this.gameOverTitle = this.add
      .text(VIEW_WIDTH / 2, 36, i18n.t('gameover.title'), {
        fontSize: GAMEOVER_TITLE_FONT_SIZE,
        color: GAMEOVER_TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false);

    this.gameOverStats = this.add
      .text(VIEW_WIDTH / 2, 78, '', {
        fontSize: GAMEOVER_STAT_FONT_SIZE,
        color: GAMEOVER_TEXT_COLOR,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false);

    this.gameOverRestart = this.add
      .text(VIEW_WIDTH / 2 - 44, 130, i18n.t('gameover.restart'), {
        fontSize: GAMEOVER_BUTTON_FONT_SIZE,
        color: GAMEOVER_BUTTON_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.gameOverRestart.on('pointerdown', () => this.match.restart());

    this.gameOverQuit = this.add
      .text(VIEW_WIDTH / 2 + 44, 130, i18n.t('gameover.quit'), {
        fontSize: GAMEOVER_BUTTON_FONT_SIZE,
        color: GAMEOVER_BUTTON_DISABLED_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false); // stub desabilitado: não interativo (ativa na Fase 4)

    // Teclado (desktop): confirmar reinicia só em `dead`.
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.match.phase === 'dead' && CONFIRM_KEYS.includes(e.code)) this.match.restart();
    });
```

- [ ] **Step 4: Alternar visibilidade + refresh 1× na transição, no `update()`**

Adicionar um helper privado e chamá-lo no `update()`. Inserir o método:

```ts
  /** Mostra/esconde o overlay de Game Over; refaz as estatísticas 1× ao ENTRAR em `dead`. */
  private syncGameOver(): void {
    const dead = this.match.phase === 'dead';
    this.gameOverBg.setVisible(dead);
    this.gameOverTitle.setVisible(dead);
    this.gameOverStats.setVisible(dead);
    this.gameOverRestart.setVisible(dead);
    this.gameOverQuit.setVisible(dead);
    if (dead && !this.wasDead) this.refreshGameOverStats(); // transição ⇒ 1× (REGRA 3)
    this.wasDead = dead;
  }

  private refreshGameOverStats(): void {
    const w = this.match.world;
    const v = formatGameOverStats({ distance: w.distance, food: w.food, nearMisses: w.nearMisses });
    this.gameOverStats.setText([
      i18n.t('gameover.distance', { value: v.distance }),
      i18n.t('gameover.food', { value: v.food }),
      i18n.t('gameover.nearMisses', { value: v.nearMisses }),
    ]);
  }
```

No `update()`, alterar o topo para sincronizar o overlay antes e depois do gate de pausa (a fase não muda sob pausa; após `advance` reflete a morte no frame):

```ts
  override update(_time: number, deltaMs: number): void {
    const paused = this.pause.paused;
    this.pauseOverlay.setVisible(paused);
    this.syncGameOver();
    if (paused) return; // congela a sim; o último frame desenhado permanece sob o overlay

    const match = this.match;
    match.advance(deltaMs / 1000); // no-op fora de `playing`
    this.readyPrompt.setVisible(match.phase === 'ready');
    this.syncGameOver(); // reflete morte ocorrida neste frame
    // ... (restante inalterado: câmera, parallax, desenho, hud)
```

(O restante de `update()` permanece exatamente como está.)

- [ ] **Step 5: Typecheck + suíte completa**

Run: `npm run check && npm test`
Expected: check limpo; todos os testes verdes (nenhum teste de unidade cobre a casca, mas nada deve quebrar).

- [ ] **Step 6: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(2.6): overlay de Game Over na GameScene (stats + Reiniciar/Sair, restart por botão/tecla)"
```

---

### Task 6: Verificação visual (Playwright) + fechamento

**Files:**
- Modify: `docs/roadmap/PHASE-02-endless-vertical-slice.md` (marcar 2.6)
- Modify: `CLAUDE.md` (Estado atual)

**Interfaces:** nenhuma (verificação + docs).

- [ ] **Step 1: Subir o dev server**

Run: `bash scripts/run.sh` (background) — confirmar a porta em uso (ex.: `http://localhost:5173`).

- [ ] **Step 2: Verificar o fluxo no browser (Playwright)**

Navegar até o app, iniciar (tap/Space), deixar o dino morrer e confirmar:
- overlay de Game Over aparece com título e **3 linhas** de estatística (distância/comida/near-misses) coerentes com o HUD do momento da morte;
- clicar **Reiniciar** → volta ao `ready` (prompt "Tap to start"), nova seed no HUD;
- clicar **Sair** → nada acontece (stub);
- tocar em espaço vazio do overlay → não reinicia;
- pressionar `Space`/`Enter` no `dead` → reinicia.

Registrar evidência (screenshot). Parar o server: `bash scripts/stop.sh`.

- [ ] **Step 3: Marcar o item na fase**

Em `docs/roadmap/PHASE-02-endless-vertical-slice.md`, trocar o item 2.6 para:

```markdown
### 2.6 Game Over overlay (básico)
- [x] Estatísticas: distância, comida, near-misses. Botões reiniciar/sair.
```

- [ ] **Step 4: Atualizar "Estado atual" no CLAUDE.md**

Acrescentar o parágrafo `2.6 (...)` ao bloco de itens da Fase 2 e ajustar a linha "Próximo:" para **2.7 (performance)**. Também trocar, na linha de sumário da Fase 2, "faltam 2.6 e 2.7" por "falta 2.7".

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap/PHASE-02-endless-vertical-slice.md CLAUDE.md
git commit -m "docs(2.6): marca 2.6 concluído; próximo 2.7 (performance)"
```

---

## Self-Review

- **Cobertura da spec:** `gameover.ts` puro (Task 1) ✓; separação `notifyFlap`/`restart` (Task 2) ✓; i18n 10 locales (Task 3) ✓; constantes/depths (Task 4) ✓; overlay+botões+teclado na casca (Task 5) ✓; verificação visual + fechamento de docs (Task 6) ✓. Não-objetivos (menu/Sair real, score/persistência, pooling) explicitamente fora.
- **Placeholders:** nenhum — todo código está escrito.
- **Consistência de tipos:** `formatGameOverStats(GameOverRaw): GameOverView` usado igual na Task 5; `restart()` definido na Task 2 e chamado na Task 5; `CONFIRM_KEYS`/`GAMEOVER_*` definidos na Task 4 e consumidos na Task 5; `PAUSE_OVERLAY_COLOR`/`VIEW_WIDTH`/`VIEW_HEIGHT` já importados na `GameScene`.
- **Determinismo:** nenhuma task toca `src/core/`.
