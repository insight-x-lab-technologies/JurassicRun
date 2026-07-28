# 9.7 — Toggle de SFX de clique em Configurações

> Item `9.7` da Fase 9 (Frente C — Áudio/UX). Ver `docs/roadmap/PHASE-09-structural-improvements.md`.
> **Core intocado** (`src/core/` não é lido nem escrito) ⇒ determinismo segue em 67 testes.

## Problema

Configurações tem toggles de **música** (menu e gameplay) e um slider de volume, mas nenhum
controle para os efeitos sonoros. Quem quer navegar em silêncio sem perder a música precisa zerar
o volume — que mata tudo.

## Escopo (decidido)

O toggle silencia **apenas o SFX de UI** (`click`, disparado por `bindButtonSfx` em qualquer
`<button>`). Os 8 SFX de gameplay introduzidos no 9.6 (`flap`, `coin`, `powerup`, `hit`,
`gameOver`, `nearMiss`, `levelUp`, `block`) **não são afetados**.

Motivo: o item do roadmap é "toggle de SFX **de clique**" e o critério de aceite diz "demais
áudios inalterados". Um toggle separado para SFX de gameplay é conteúdo de outro item; esta spec
deixa a costura pronta (ver "Canal de SFX") para que ele custe ~10 linhas.

Fora de escopo: mudar mixagem, `SFX_CEILING`, engine, ou o áudio de gameplay.

## Arquitetura

Segue o **molde de `menuMusic`/`gameplayMusic`** ponta a ponta — nenhum conceito novo além do
canal de SFX. Puro × casca preservado: toda decisão é função pura; a casca só roteia ganho.

### 1. Estado — `src/services/settings/` (puro)

- `SettingsState.buttonSfx: boolean`, default `true` em `initialSettingsState()`.
- `setButtonSfx(s, on): SettingsState` — espelha `setMenuMusic`.
- `parseState`: saneado **por campo** (`typeof d.buttonSfx === 'boolean' ? … : base.buttonSfx`)
  ⇒ estado v1 salvo antes do 9.7 carrega com o default `true`, sem migração nem bump de versão.
- `SettingsService`: sinal `buttonSfx` + método `setButtonSfx(on)` via `commit` (persiste).

### 2. Canal de SFX — `src/services/audio/sfx.ts` (puro)

```ts
export type SfxChannel = 'ui' | 'game';
export function sfxChannelFor(id: SfxId): SfxChannel; // 'click' ⇒ 'ui'; resto ⇒ 'game'
```

Classificação explícita e total (exaustiva sobre `SfxId`), não uma heurística de nome. É a peça
que torna o toggle possível sem tocar em cada call-site de `playSfx`.

### 3. Política — `src/services/audio/policy.ts` (puro)

- `AudioInput.buttonSfx: boolean`.
- `AudioTarget.uiSfxGain: number` — novo campo ao lado de `sfxGain` (que continua sendo o ganho
  dos SFX de gameplay). `uiSfxGain = buttonSfx ? sfxGain : 0`.
- Volume 0 já zera os dois (caminho `base === 0` retorna ambos em 0).

Decisão: **campo novo, não sobrescrever `sfxGain`**. Sobrescrever silenciaria o gameplay junto —
exatamente o que o aceite proíbe.

### 4. Casca — `src/services/audio/index.ts`

`AudioService` guarda `_uiSfxGain` ao lado de `_sfxGain` (ambos atualizados pelo mesmo `effect`
que já existe — sem novo effect, sem nova assinatura). `playSfx(id)` escolhe o ganho pelo canal:

```ts
const gain = sfxChannelFor(id) === 'ui' ? this._uiSfxGain : this._sfxGain;
if (!this._unlocked.value || gain <= 0) return;
this.engine.playSfx(id, gain);
```

`bindButtonSfx` **não muda**: continua chamando `unlock()` + `playSfx('click')`. O `unlock` no
primeiro gesto tem de acontecer mesmo com o SFX desligado, senão a música nunca começa — por isso
o gate fica em `playSfx`, não no listener.

### 5. UI — `SettingsScreen.tsx` + i18n

Nova linha `settings__row` idêntica às de música (checkbox + `settings.on/off`), `for` /
`id="settings-button-sfx"`, `data-testid="settings-button-sfx"`, posicionada **depois** de
"Música do jogo" (agrupa áudio antes de idioma/fonte).

Chave `settings.buttonSfx` nos **10 locales** (skill `add-locale`): pt-BR "Som dos botões",
en "Button sounds", e equivalentes em es/fr/de/it/ja/ko/zh/hi. As guardas de paridade i18n
(4.9) provam a cobertura.

## Fluxo de dados

```
SettingsScreen (checkbox)
  └─ settingsService.setButtonSfx(on) ──▶ store puro ──▶ signal + localStorage
                                                            │
        effect existente em AudioService ◀──────────────────┘
                       │
        resolveAudioTarget({…, buttonSfx}) ──▶ uiSfxGain
                       │
        playSfx('click') ──▶ sfxChannelFor('click')='ui' ──▶ gain 0 ⇒ return (silêncio)
        playSfx('flap')  ──▶ 'game' ──▶ _sfxGain ⇒ toca normalmente
```

## Erros / bordas

| Borda | Comportamento |
|---|---|
| `localStorage` sem o campo (estado v1 antigo) | default `true` |
| `buttonSfx` não-booleano no JSON | default `true` (saneado por campo) |
| Volume 0 | `sfxGain` **e** `uiSfxGain` = 0 (já coberto) |
| Toggle off + primeiro gesto | `unlock()` ainda roda ⇒ música inicia |
| `localStorage` indisponível | `save` já é best-effort (try/catch existente) |

## Testes

- `tests/services/settings/store.test.ts` — default `true`; `setButtonSfx` alterna e não muta.
- `tests/services/settings/storage.test.ts` — round-trip; JSON legado sem o campo ⇒ `true`;
  campo com tipo errado ⇒ `true`.
- `tests/services/audio/policy.test.ts` — `buttonSfx:false` ⇒ `uiSfxGain === 0` **e**
  `sfxGain > 0`; `true` ⇒ `uiSfxGain === sfxGain`; volume 0 ⇒ ambos 0.
- `tests/services/audio/sfx.test.ts` — `sfxChannelFor` cobre todo `SfxId` ('click'='ui', resto='game').
- `tests/services/audio/service.test.ts` — com toggle off, `bindButtonSfx` + clique **não** chama
  `engine.playSfx`, mas `playSfx('flap')` chama; `unlock` ocorre mesmo assim.
- `tests/app/screens/settings.test.tsx` — o checkbox reflete e escreve o estado.
- Guardas i18n existentes (paridade das 10 línguas + scanner de string hardcoded).

## Aceite

Desligar o SFX de botão silencia os cliques, persiste no reload, e música + SFX de gameplay
seguem inalterados. `npm test` verde, `npm run check` limpo, determinismo inalterado (67).
