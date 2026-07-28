# 9.7 — Toggle de SFX de clique · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar um toggle em Configurações que silencia o SFX de clique dos botões, sem
afetar a música nem os SFX de gameplay.

**Architecture:** molde de `menuMusic`/`gameplayMusic` ponta a ponta — estado puro em
`src/services/settings/store.ts`, sinal reativo no `SettingsService`, decisão pura em
`resolveAudioTarget` (novo campo `uiSfxGain`), e uma classificação pura `sfxChannelFor(id)` que
separa o SFX de UI (`click`) dos 8 SFX de gameplay. A casca (`AudioService.playSfx`) só escolhe
qual ganho usar. Nenhum arquivo novo além do teste do canal; nenhum effect novo.

**Tech Stack:** TypeScript estrito, `@preact/signals`, Preact, Vitest (+ happy-dom via pragma),
i18next com 10 locales JSON.

Spec: `docs/superpowers/specs/2026-07-27-sfx-toggle-design.md`.

## Global Constraints

- **`src/core/` NÃO é tocado.** Determinismo permanece em 67 testes; nada de re-pin de goldens.
- Nenhuma string visível ao usuário hardcoded — tudo por chave i18next nos **10** locales
  (`de, en, es, fr, hi, it, ja, ko, pt-BR, zh`). Guardas de paridade em `tests/i18n/` provam.
- TypeScript estrito, sem `any`. `src/services/settings/store.ts` e `src/services/audio/{policy,
  sfx}.ts` são módulos **puros** (sem DOM, sem WebAudio, sem `Date`/`Math.random`).
- Um commit por task. Comandos: `npm test`, `npm run check`.
- O default do novo campo é `true` (ligado) — comportamento atual preservado para quem já jogava.
- **Não** existe bump de versão de storage: o saneamento é por campo, estado antigo carrega com o
  default.

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `src/services/settings/store.ts` | campo `buttonSfx` + `setButtonSfx` (puro) | 1 |
| `src/services/settings/storage.ts` | `parseState` sane `buttonSfx` por campo | 1 |
| `src/services/settings/index.ts` | sinal `buttonSfx` + método no serviço | 1 |
| `src/services/audio/sfx.ts` | `SfxChannel` + `sfxChannelFor` (puro) | 2 |
| `src/services/audio/policy.ts` | `AudioInput.buttonSfx` → `AudioTarget.uiSfxGain` (puro) | 2 |
| `src/services/audio/index.ts` | `_uiSfxGain` + roteamento em `playSfx` (casca) | 2 |
| `src/app/screens/SettingsScreen.tsx` | linha de toggle | 3 |
| `src/i18n/locales/*.json` (10) | chave `settings.buttonSfx` | 3 |

---

### Task 1: Estado do toggle (settings)

**Files:**
- Modify: `src/services/settings/store.ts` (interface `SettingsState`, `initialSettingsState`,
  novo `setButtonSfx`)
- Modify: `src/services/settings/storage.ts:26-42` (`parseState`)
- Modify: `src/services/settings/index.ts` (sinal + método, molde de `setMenuMusic`)
- Test: `tests/services/settings/store.test.ts`, `tests/services/settings/storage.test.ts`,
  `tests/services/settings/service.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `SettingsState.buttonSfx: boolean` (default `true`)
  - `setButtonSfx(s: SettingsState, on: boolean): SettingsState`
  - `settingsService.buttonSfx: ReadonlySignal<boolean>`
  - `settingsService.setButtonSfx(on: boolean): void`

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/services/settings/store.test.ts` (adicionar ao `describe` existente):

```ts
it('buttonSfx começa ligado e alterna sem mutar', () => {
  const s = initialSettingsState();
  expect(s.buttonSfx).toBe(true);
  const off = setButtonSfx(s, false);
  expect(off.buttonSfx).toBe(false);
  expect(s.buttonSfx).toBe(true); // original intacto
  expect(setButtonSfx(off, true).buttonSfx).toBe(true);
});
```

Ajustar o import do arquivo para incluir `setButtonSfx`.

Em `tests/services/settings/storage.test.ts`:

```ts
it('JSON legado sem buttonSfx carrega com o default ligado', () => {
  const raw = JSON.stringify({ version: 1, volume: 50, menuMusic: false, language: 'en' });
  expect(parseState(raw).buttonSfx).toBe(true);
});

it('buttonSfx com tipo errado cai no default', () => {
  expect(parseState(JSON.stringify({ buttonSfx: 'nope' })).buttonSfx).toBe(true);
});

it('round-trip preserva buttonSfx desligado', () => {
  const storage = memorySettingsStorage();
  storage.save({ ...initialSettingsState(), buttonSfx: false });
  expect(parseState(JSON.stringify({ version: 1, ...storage.load() })).buttonSfx).toBe(false);
});
```

Em `tests/services/settings/service.test.ts`:

```ts
it('setButtonSfx comita no sinal e persiste', async () => {
  const storage = memorySettingsStorage();
  await settingsService.init(storage);
  expect(settingsService.buttonSfx.value).toBe(true);
  settingsService.setButtonSfx(false);
  expect(settingsService.buttonSfx.value).toBe(false);
  expect(storage.load().buttonSfx).toBe(false);
});
```

(Se algum desses arquivos de teste não importar `initialSettingsState`/`parseState`/
`memorySettingsStorage`, acrescente ao import existente — não crie arquivo novo.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/settings`
Expected: FAIL — `setButtonSfx is not a function` / `buttonSfx` é `undefined`.

- [ ] **Step 3: Implementar**

Em `src/services/settings/store.ts`: acrescentar `readonly buttonSfx: boolean;` à interface
`SettingsState` (depois de `gameplayMusic`), `buttonSfx: true,` em `initialSettingsState()`, e:

```ts
export function setButtonSfx(s: SettingsState, on: boolean): SettingsState {
  return { ...s, buttonSfx: on };
}
```

Em `src/services/settings/storage.ts`, dentro de `parseState`, junto dos outros campos:

```ts
const buttonSfx = typeof d.buttonSfx === 'boolean' ? d.buttonSfx : base.buttonSfx;
```

e incluir `buttonSfx` no objeto retornado: `return { volume, menuMusic, gameplayMusic, buttonSfx,
language, font };`

Em `src/services/settings/index.ts`: importar `setButtonSfx` do `./store`, adicionar

```ts
readonly buttonSfx: ReadonlySignal<boolean> = computed(() => this._state.value.buttonSfx);
```

junto dos outros `computed`, e o método logo após `setGameplayMusic`:

```ts
setButtonSfx(on: boolean): void {
  this.commit(setButtonSfx(this._state.value, on));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/settings && npm run check`
Expected: PASS, typecheck limpo. Se `npm run check` reclamar de `SettingsState` incompleto em
algum outro ponto (ex.: um literal de estado em teste), complete o literal com `buttonSfx`.

- [ ] **Step 5: Commit**

```bash
git add src/services/settings tests/services/settings
git commit -m "feat(9.7): estado buttonSfx em settings (store/storage/serviço)"
```

---

### Task 2: Canal de SFX e política de áudio

**Files:**
- Modify: `src/services/audio/sfx.ts` (novo tipo + função pura, no topo perto de `SfxId`)
- Modify: `src/services/audio/policy.ts:16-58` (`AudioInput`, `AudioTarget`, `resolveAudioTarget`)
- Modify: `src/services/audio/index.ts:9-53` (`_uiSfxGain`, effect, `playSfx`)
- Test: `tests/services/audio/sfx.test.ts`, `tests/services/audio/policy.test.ts`,
  `tests/services/audio/service.test.ts`

**Interfaces:**
- Consumes (Task 1): `settingsService.buttonSfx.value: boolean`.
- Produces:
  - `export type SfxChannel = 'ui' | 'game'`
  - `export function sfxChannelFor(id: SfxId): SfxChannel`
  - `AudioInput.buttonSfx: boolean` (campo obrigatório)
  - `AudioTarget.uiSfxGain: number`

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/services/audio/sfx.test.ts` (adicionar; importar `sfxChannelFor` e, se ainda não
importado, `SFX_CATALOG`/`SfxId` conforme o arquivo já faz):

```ts
it('só o click é do canal de UI; todo o resto é gameplay', () => {
  expect(sfxChannelFor('click')).toBe('ui');
  for (const id of ['flap', 'coin', 'powerup', 'hit', 'gameOver', 'nearMiss', 'levelUp', 'block'] as const) {
    expect(sfxChannelFor(id)).toBe('game');
  }
});
```

Em `tests/services/audio/policy.test.ts` — os testes existentes constroem um `AudioInput`;
acrescente `buttonSfx: true` ao helper/objeto base que eles usam, e adicione:

```ts
it('buttonSfx off zera só o SFX de UI', () => {
  const t = resolveAudioTarget({ ...base, volume: 100, buttonSfx: false });
  expect(t.uiSfxGain).toBe(0);
  expect(t.sfxGain).toBeGreaterThan(0); // gameplay segue soando
});

it('buttonSfx on iguala o ganho de UI ao de gameplay', () => {
  const t = resolveAudioTarget({ ...base, volume: 100, buttonSfx: true });
  expect(t.uiSfxGain).toBe(t.sfxGain);
});

it('volume 0 zera os dois ganhos', () => {
  const t = resolveAudioTarget({ ...base, volume: 0, buttonSfx: true });
  expect(t.sfxGain).toBe(0);
  expect(t.uiSfxGain).toBe(0);
});
```

(`base` = o objeto `AudioInput` que o arquivo já monta; se ele monta inline em cada teste, monte
um `base` local no topo do `describe` reaproveitando os mesmos valores.)

Em `tests/services/audio/service.test.ts`:

```ts
it('toggle de SFX off silencia o clique mas não o gameplay', () => {
  audioService.unlock();
  settingsService.setButtonSfx(false);
  audioService.playSfx('click');
  expect(engine.sfxPlayed).toEqual([]);
  audioService.playSfx('flap');
  expect(engine.sfxPlayed).toEqual(['flap']);
  settingsService.setButtonSfx(true);
  audioService.playSfx('click');
  expect(engine.sfxPlayed).toEqual(['flap', 'click']);
});

it('com o toggle off, o clique em botão ainda desbloqueia o áudio', () => {
  settingsService.setButtonSfx(false);
  const cleanup = bindButtonSfx(document.body, audioService);
  const btn = document.createElement('button');
  document.body.append(btn);
  btn.click();
  expect(engine.sfxPlayed).toEqual([]);
  expect(engine.resumed).toBe(true); // unlock aconteceu ⇒ a música pode começar
  cleanup();
  btn.remove();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/audio`
Expected: FAIL — `sfxChannelFor is not a function`, `uiSfxGain` `undefined`, e o clique ainda soa.

- [ ] **Step 3: Implementar**

Em `src/services/audio/sfx.ts`, logo abaixo do `export type SfxId`:

```ts
/** Canal de mixagem lógico: `ui` = feedback de interface, `game` = eventos de partida. */
export type SfxChannel = 'ui' | 'game';

/** Classificação total (não heurística de nome): só o clique de botão é de UI. */
export function sfxChannelFor(id: SfxId): SfxChannel {
  return id === 'click' ? 'ui' : 'game';
}
```

Em `src/services/audio/policy.ts`: acrescentar `readonly buttonSfx: boolean;` a `AudioInput`
(depois de `gameplayMusic`) e `readonly uiSfxGain: number; // 0..1` a `AudioTarget` (depois de
`sfxGain`). Em `resolveAudioTarget`:

```ts
const sfxGain = base * SFX_CEILING;
const uiSfxGain = input.buttonSfx ? sfxGain : 0;
const theme = musicThemeFor(input.expansionId);

if (base === 0) return { track: null, musicGain: 0, sfxGain: 0, uiSfxGain: 0, theme };
```

e o `return` final vira `{ track, musicGain, sfxGain, uiSfxGain, theme }`.

Em `src/services/audio/index.ts`: importar `sfxChannelFor` de `./sfx`, adicionar o campo
`private _uiSfxGain = 0;` ao lado de `_sfxGain`; dentro do `effect`, passar
`buttonSfx: settingsService.buttonSfx.value,` no objeto de `resolveAudioTarget` e guardar
`this._uiSfxGain = target.uiSfxGain;` logo depois de `this._sfxGain = target.sfxGain;`
(**antes** do `if (target.track === null) return;`, senão o ganho fica preso quando não há
música). Trocar `playSfx`:

```ts
playSfx(id: SfxId): void {
  const gain = sfxChannelFor(id) === 'ui' ? this._uiSfxGain : this._sfxGain;
  if (!this._unlocked.value || gain <= 0) return;
  this.engine.playSfx(id, gain);
}
```

`bindButtonSfx` não muda: o `unlock()` continua fora do gate.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/audio && npm run check`
Expected: PASS. Se algum outro teste montava `AudioInput` sem `buttonSfx`, o typecheck aponta —
adicione o campo lá.

- [ ] **Step 5: Commit**

```bash
git add src/services/audio tests/services/audio
git commit -m "feat(9.7): canal de SFX ui/game e ganho de UI gateado pelo toggle"
```

---

### Task 3: Toggle na tela de Configurações + i18n (10 locales)

**Files:**
- Modify: `src/app/screens/SettingsScreen.tsx:49-62` (inserir a linha depois de "Música do jogo")
- Modify: `src/i18n/locales/{de,en,es,fr,hi,it,ja,ko,pt-BR,zh}.json` (chave `settings.buttonSfx`)
- Test: `tests/app/settings-screen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `settingsService.buttonSfx.value`, `settingsService.setButtonSfx(on)`.
- Produces: `data-testid="settings-button-sfx"`, chave i18n `settings.buttonSfx`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/app/settings-screen.test.tsx`:

```ts
it('renderiza o toggle de SFX de botão', () => {
  expect(container.querySelector('[data-testid="settings-button-sfx"]')).not.toBeNull();
});

it('desmarcar o toggle de SFX atualiza o serviço', () => {
  const box = container.querySelector('[data-testid="settings-button-sfx"]') as HTMLInputElement;
  expect(box.checked).toBe(true);
  box.checked = false;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  expect(settingsService.buttonSfx.value).toBe(false);
});
```

Atualizar também o teste `'renderiza os 4 controles'`: ele passa a cobrir 6 controles — renomeie
para `'renderiza os controles'` e acrescente as asserções de `settings-button-sfx` e
`settings-font` (que já existe na tela e não estava coberto).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/settings-screen.test.tsx`
Expected: FAIL — elemento `settings-button-sfx` é `null`.

- [ ] **Step 3: Implementar a linha na tela**

Em `SettingsScreen.tsx`, ler o sinal junto dos outros (`const buttonSfx =
settingsService.buttonSfx.value;`) e inserir esta linha **depois** do bloco
`settings-gameplay-music` e **antes** do de idioma:

```tsx
<label class="settings__row" for="settings-button-sfx">
  <span class="settings__label">{i18n.t('settings.buttonSfx')}</span>
  <input
    id="settings-button-sfx"
    data-testid="settings-button-sfx"
    type="checkbox"
    class="settings__toggle"
    checked={buttonSfx}
    onChange={(e) => settingsService.setButtonSfx((e.currentTarget as HTMLInputElement).checked)}
  />
  <span class="settings__state" aria-hidden="true">
    {i18n.t(buttonSfx ? 'settings.on' : 'settings.off')}
  </span>
</label>
```

- [ ] **Step 4: Adicionar a chave nos 10 locales**

Em cada `src/i18n/locales/<lng>.json`, dentro do objeto `settings`, logo após `gameplayMusic`:

| arquivo | valor |
|---|---|
| `pt-BR.json` | `"buttonSfx": "Som dos botões"` |
| `en.json` | `"buttonSfx": "Button sounds"` |
| `es.json` | `"buttonSfx": "Sonido de los botones"` |
| `fr.json` | `"buttonSfx": "Sons des boutons"` |
| `de.json` | `"buttonSfx": "Tastentöne"` |
| `it.json` | `"buttonSfx": "Suoni dei pulsanti"` |
| `ja.json` | `"buttonSfx": "ボタン音"` |
| `ko.json` | `"buttonSfx": "버튼 효과음"` |
| `zh.json` | `"buttonSfx": "按钮音效"` |
| `hi.json` | `"buttonSfx": "बटन ध्वनि"` |

Mantenha a ordem das chaves igual à dos outros locales e preserve a indentação/estilo do arquivo
(inclusive newline final).

- [ ] **Step 5: Rodar tudo e ver passar**

Run: `npm test && npm run check`
Expected: PASS — incluindo as guardas de paridade i18n (`tests/i18n/`) e o scanner de strings
hardcoded. Se a guarda de paridade acusar chave faltando, é um locale esquecido no Step 4.

- [ ] **Step 6: Commit**

```bash
git add src/app/screens/SettingsScreen.tsx src/i18n/locales tests/app/settings-screen.test.tsx
git commit -m "feat(9.7): toggle de SFX de botão em Configurações + i18n nos 10 locales"
```

---

## Fechamento (controlador, após o review final)

- Marcar os 3 checkboxes do item 9.7 em `docs/roadmap/PHASE-09-structural-improvements.md` e o
  título como `— CONCLUÍDA`.
- Atualizar o "Estado atual" do `CLAUDE.md`: contagem de testes, 9.7 ✅, "Frente C concluída",
  próximo = 9.8.
- `npm test` + `npm run check` finais (evidência antes de afirmar pronto).
- Merge em `main` (PR + merge automático via `gh`; sem remote ⇒ merge local `--no-ff`).
