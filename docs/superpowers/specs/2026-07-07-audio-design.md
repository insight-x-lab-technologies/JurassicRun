# Spec — 4.10 Áudio (música de menu, música de gameplay, SFX de botões)

**Data:** 2026-07-07
**Fase/Item:** 4 (Meta offline) / 4.10 — último item da fase.
**Autor:** sessão autônoma SDD.

## Objetivo

Dar voz ao jogo: música de fundo no menu, música durante a partida e efeito sonoro (SFX)
ao acionar botões. **Respeitando as configurações** persistidas pelo 4.8 (`volume`,
`menuMusic`, `gameplayMusic`), sem tocar `src/core/` e sem custo de assets no lançamento.

## Restrições inegociáveis (do CLAUDE.md)

- **Determinismo (REGRA 1).** Áudio é 100% camada de apresentação. **Nenhum arquivo de
  `src/core/` é tocado.** `Math.random`/`Date.now`/`performance.now` continuam proibidos no
  core; o áudio (que usa `AudioContext.currentTime` etc.) vive **fora** do core, como
  `seedSource`/render. Determinismo 67 permanece inalterado.
- **Performance (REGRA 3).** Nenhum trabalho de áudio no hot path do render. Música e SFX
  são agendados em **transições** (mudança de rota ou de configuração, clique de botão),
  nunca por frame. O `GameScene.update` não toca em áudio.
- **i18n (REGRA 4).** Nenhuma string de UI nova é necessária — os rótulos de volume/música
  já existem na `SettingsScreen`/locales (4.8). Nada de string hardcoded.
- **REGRA 5 (assets trocáveis).** É sobre imagens; áudio não se enquadra. Ainda assim, para
  a Fase 8 (arte/áudio real) criamos **audio-specs** análogos em `docs/audio/specs/`
  descrevendo cada faixa/SFX pretendido, para geração/composição futura.

## Escopo

**Nesta entrega:**
- Serviço de áudio reativo que liga configurações + rota → reprodução.
- Música de menu (tocando em qualquer tela que não seja a partida, inclusive onboarding).
- Música de gameplay (tocando na tela `play`).
- SFX de clique em **todos** os botões da UI Preact, por delegação global.
- Placeholders **procedurais** (WebAudio) para as 3 fontes sonoras — zero arquivo, zero custo.
- Unlock de autoplay no primeiro gesto do usuário.
- Respeito total às configurações, **ao vivo** (mudar volume/toggle reflete imediatamente).

**Fora de escopo (adiado, com seam pronto):**
- Faixas musicais compostas reais e SFX gravados (arquivos `.ogg`/`.mp3`) → **Fase 8**,
  guiados pelos audio-specs. O `AudioEngine` é a costura: trocar o placeholder procedural por
  `decodeAudioData` de buffers não muda os consumidores.
- SFX além de "clique de botão" (flap, coleta, colisão, power-up, game over) → Fase 8 (usam
  o mesmo `playSfx(id)` já pronto; hoje só `'click'` está no catálogo).
- Toggle dedicado de SFX (settings só tem volume + 2 toggles de música; SFX segue o volume
  mestre). Se quiserem no futuro, é mais um seam de settings.
- Áudio por-perfil (settings são globais até a Fase 6).

## Decisões de produto/arquitetura (tomadas na sessão autônoma)

1. **Placeholder procedural, não arquivos royalty-free agora.** Espelha o padrão do projeto
   (geométrico agora, PNG na Fase 8; seams inertes religados depois). Mantém o repo sem
   binários e o lançamento sem custo, e prova a fiação ponta-a-ponta (música toca e respeita
   settings) sem depender de terceiros. Faixas reais entram na Fase 8.
2. **SFX de botão por delegação global**, não `onClick` em cada botão. Um único listener de
   `click` capturado no shell dispara `audioService.playSfx('click')` quando o alvo está
   dentro de um `<button>`. Cobre "SFX de botões" (todos) com zero edição por tela e sem
   acoplar componentes ao serviço de áudio.
3. **Contexto de música = função da rota.** `route === 'play'` ⇒ gameplay; qualquer outra
   (inclusive onboarding, onde `route` ainda é o default `home`) ⇒ menu. Simples e suficiente;
   pausa do jogo não silencia a música (decisão: música de gameplay continua na pausa — menos
   surpresa; pode virar tuning na Fase 8).

## Arquitetura

Padrão **puro × casca**, molde de `settings`/`wallet`/`trophy`. Novo módulo
`src/services/audio/`:

```
src/services/audio/
  policy.ts     (PURO, testado)  — decide O QUE deve tocar e com que ganho
  tracks.ts     (PURO, testado)  — dados: sequências de notas por faixa + defs de SFX
  engine.ts     (CASCA)          — AudioEngine (interface) + WebAudioEngine + nullAudioEngine
  index.ts      (CASCA)          — AudioService reativo (singleton) + bindButtonSfx
```

### `policy.ts` (puro)

```ts
export type MusicTrack = 'menu' | 'gameplay';

export interface AudioInput {
  readonly route: Screen;         // do router
  readonly volume: number;        // 0..100 (settings)
  readonly menuMusic: boolean;    // settings
  readonly gameplayMusic: boolean;// settings
  readonly unlocked: boolean;     // autoplay liberado por gesto?
}

export interface AudioTarget {
  readonly track: MusicTrack | null; // null ⇒ silêncio de música
  readonly musicGain: number;        // 0..1 (linear p/ GainNode)
  readonly sfxGain: number;          // 0..1
}

export function volumeToGain(volume0to100: number): number; // curva; 0⇒0
export function resolveAudioTarget(input: AudioInput): AudioTarget;
```

Regras de `resolveAudioTarget`:
- `!unlocked` ⇒ `track:null` (nada toca antes do gesto), mas `sfxGain` já calculado (o próprio
  gesto que desbloqueia pode ser um clique de botão; o SFX toca após `resume`).
- `volume === 0` ⇒ ganhos 0 e `track:null` (não faz sentido segurar osciladores mudos).
- rota `play` + `gameplayMusic` ⇒ `track:'gameplay'`; senão nessa rota, `null`.
- outras rotas + `menuMusic` ⇒ `track:'menu'`; senão `null`.
- `musicGain`/`sfxGain` = `volumeToGain(volume)` (música pode ter um teto menor que SFX p/
  não abafar — constante de mixagem placeholder).

`volumeToGain`: mapeamento perceptual simples (ex.: `(v/100)^2`) para o slider soar linear ao
ouvido; `0 ⇒ 0`, `100 ⇒ 1`. Testável por igualdade em pontos-chave.

### `tracks.ts` (puro)

- `MUSIC_TRACKS: Record<MusicTrack, TrackSpec>` — cada `TrackSpec` = tempo (BPM) + array de
  passos `{ freq: number; durBeats: number }` (freq 0 = pausa). Menu = sequência calma e
  curta em loop; gameplay = mais rápida/energética. Dados puros, tuning placeholder (Fase 8).
- `SFX_CATALOG: Record<SfxId, SfxSpec>` — `SfxId = 'click'`. `SfxSpec` = tipo de onda +
  freq + duração + envelope (attack/decay curtos). Um blip curto.
- Helpers puros triviais se úteis (ex.: `beatsToSeconds(beats, bpm)`), testáveis.

### `engine.ts` (casca — WebAudio; sem unit test, verificado no browser)

Interface estável (a costura da Fase 8):

```ts
export interface AudioEngine {
  resume(): Promise<void>;              // desbloqueio de autoplay
  playSfx(id: SfxId, gain: number): void;
  playMusic(track: MusicTrack, gain: number): void; // troca/seta a faixa em loop
  stopMusic(): void;
  setMusicGain(gain: number): void;     // ajuste ao vivo sem reiniciar a faixa
  readonly running: MusicTrack | null;  // faixa atual (idempotência do serviço)
}
```

- `WebAudioEngine`: cria `AudioContext` sob demanda; um `GainNode` mestre de música e SFX
  one-shot. Música = **scheduler look-ahead** padrão do WebAudio (setInterval de ~25ms
  agendando notas ~100ms à frente via `osc.start(when)`/`stop(when)`), em loop; trocar de
  faixa cancela o agendamento e recomeça. SFX = oscilador one-shot com envelope. `stopMusic`
  limpa o intervalo e silencia. Sem alocação por frame do jogo (o scheduler é próprio, ~40Hz,
  independente do rAF do Phaser, e só roda enquanto há música).
- `nullAudioEngine()`: implementação no-op que **registra** as chamadas (`running` refletido)
  — usada em testes do `AudioService` e como fallback fora do browser (SSR/headless).

### `index.ts` (casca — AudioService reativo + bindButtonSfx)

- `AudioService` singleton (molde dos outros serviços). `init(engine?)` injeta o engine
  (default `WebAudioEngine`, testes passam `nullAudioEngine`). Um `effect()` combina
  `settingsService.{volume,menuMusic,gameplayMusic}` + `route` + `_unlocked` (sinal interno)
  → `resolveAudioTarget` → aplica no engine **idempotentemente** (só troca faixa quando
  `target.track !== engine.running`; ajusta ganho ao vivo via `setMusicGain`; `stopMusic`
  quando `track:null`).
- `playSfx(id)`: lê o alvo corrente; se `unlocked` e `sfxGain>0`, chama `engine.playSfx`.
- `unlock()`: idempotente; `await engine.resume()`, seta `_unlocked=true` (o `effect`
  reavalia e inicia a música apropriada).
- `bindButtonSfx(root, service)`: adiciona listener de `click` (bubbling) no `root`; se
  `event.target.closest('button')` existir, chama `service.unlock()` (garante desbloqueio no
  1º clique) e `service.playSfx('click')`. Retorna cleanup. **Também** liga um listener único
  de `pointerdown`/`keydown` em `window` para desbloquear no 1º gesto que não seja botão
  (ex.: tap no canvas do jogo), removido após o primeiro disparo.

### Fiação no bootstrap (`main.tsx`)

Após `settingsService.init()` (áudio depende do volume/idioma já carregados) e o `render`:
`audioService.init()` e `bindButtonSfx(document.body, audioService)`. O `effect` do serviço
começa a reagir a rota/settings; a música só soa após o 1º gesto (unlock).

## Fluxo de dados

```
settings signals ─┐
route signal ─────┼─▶ effect ─▶ resolveAudioTarget ─▶ engine (playMusic/stopMusic/setMusicGain)
_unlocked signal ─┘
click em <button> ─▶ bindButtonSfx ─▶ service.unlock()+playSfx('click') ─▶ engine.playSfx
1º gesto (pointer/key) ─▶ service.unlock() ─▶ _unlocked=true ─▶ effect reavalia ─▶ música inicia
```

## Testes

**Puros (Vitest, sem WebAudio):**
- `tests/services/audio/policy.test.ts` — `volumeToGain` (0/50/100 e monotonicidade);
  `resolveAudioTarget` cobrindo: não-unlocked ⇒ sem música; volume 0 ⇒ silêncio; play +
  gameplayMusic on/off; menu + menuMusic on/off; onboarding-como-menu (route home).
- `tests/services/audio/tracks.test.ts` — catálogos bem-formados: as 2 faixas existem, passos
  não-vazios, freqs/durações não-negativas; SFX `'click'` existe; `beatsToSeconds` correto.
- `tests/services/audio/service.test.ts` — `AudioService` com `nullAudioEngine` (spy):
  init não toca nada antes do unlock; após `unlock()` toca a faixa da rota corrente; trocar
  `route` para `play` troca para gameplay (1× `playMusic`, idempotente em re-render); desligar
  `menuMusic` para `stopMusic`; mudar `volume` chama `setMusicGain` sem reiniciar; `playSfx`
  respeita unlock/volume; `bindButtonSfx` dispara em clique de `<button>` e ignora clique fora.

**Casca (não unit-testada):** `WebAudioEngine` — verificada no browser (Playwright): música
audível trocando entre menu e gameplay, SFX no clique, respeito a volume/toggles ao vivo.

**Guardas existentes:** `no-hardcoded-strings` e `locales` continuam verdes (sem string nova);
determinismo 67 inalterado (core intocado) — rodar `test:determinism`.

## Audio-specs (Fase 8)

`docs/audio/specs/{music.menu,music.gameplay,sfx.click}.md` — descrição do caráter pretendido
(mood, instrumentação, andamento, duração de loop, formato-alvo `.ogg`), para composição/
geração futura. Análogo aos asset-specs de imagem. Registro simples em `docs/audio/README.md`.

## Riscos e mitigação

- **Autoplay bloqueado:** resolvido pelo unlock no 1º gesto (padrão da web). Antes disso, tudo
  fica em `track:null`.
- **happy-dom sem WebAudio:** por isso o engine é injetável e os testes usam `nullAudioEngine`.
  O `WebAudioEngine` referencia `window.AudioContext` só quando instanciado (lazy).
- **Música procedural desagradável:** volume-teto de música conservador + sequências curtas e
  simples; é placeholder explícito, substituído na Fase 8.
- **Scheduler vazando timers:** `stopMusic`/cleanup limpam o `setInterval`; `AudioService` não
  cria timers próprios (só o engine, encapsulado).

## Definição de pronto

- `npm run check` limpo; `npm test` verde (novos testes puros + suíte); `test:determinism` 67.
- Verificação no browser (Playwright): SFX no clique; música de menu após 1º gesto; entrar em
  `play` troca para gameplay; voltar troca de volta; volume/toggles refletem ao vivo.
- Item 4.10 marcado `[x]`; `CLAUDE.md` "Estado atual" atualizado (Fase 4 concluída).
```
