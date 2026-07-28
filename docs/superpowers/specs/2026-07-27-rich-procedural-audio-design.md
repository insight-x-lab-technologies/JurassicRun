# 9.6 — Áudio procedural rico (+ seam de faixa de arquivo)

**Item:** Fase 9, Frente C, 9.6 (`docs/roadmap/PHASE-09-structural-improvements.md`).
**Data:** 2026-07-27. **Core intocado** (determinismo 67 inalterado).

## Problema

O áudio é o placeholder do 4.10: uma sequência de ~7 notas de oscilador único por contexto
(`MUSIC_TRACKS.menu/gameplay`) e **um** SFX (`click`). Não há percussão, harmonia, variação nem
diferença por tema; nenhum evento de gameplay (flap, moeda, colisão, power-up, near-miss, level-up,
game over) faz som.

## Objetivo

1. Música **multi-camada** (baixo + percussão + melodia + pad), com tempo/tom/timbre distintos por
   **contexto** (menu vs. gameplay) e por **tema** (classic / volcano / glacier).
2. **SFX por evento** de gameplay, distintos e agradáveis, procedurais.
3. **Seam de arquivo**: se existir `public/audio/<tema>/<track>.mp3`, ele toca no lugar da camada
   procedural (as trilhas do Suno — `docs/audio/specs/SUNO-BRIEF.md`). Sem arquivo, procedural.
4. Zero arquivo obrigatório, zero custo, offline, sem regressão de 60fps.

## Não-objetivos

- Toggle de SFX de clique em Configurações — é o item **9.7**.
- Ducking/mixagem dinâmica avançada, reverb/convolução, música reativa à dificuldade.
- Qualquer mudança em `src/core/`.

## Arquitetura

Mantém o padrão **puro × casca** do projeto: dados/composição puros e testáveis; WebAudio só na
casca. O seam `AudioEngine` (4.10) continua sendo a fronteira — `AudioService`, `policy` e os
consumidores (`bindButtonSfx`) não mudam de forma.

```
src/services/audio/
  music.ts        NOVO  PURO — modelo de composição + geração de vozes por compasso
  sfx.ts          NOVO  PURO — catálogo de SFX multi-camada (partials/envelopes)
  musicSource.ts  NOVO  PURO — resolução da URL da faixa de arquivo (seam Suno)
  tracks.ts       MUDA  passa a ser só os tipos/ids compartilhados + beatsToSeconds
  policy.ts       MUDA  ganha o tema (expansão ativa) no input/target
  engine.ts       MUDA  casca WebAudio: buses por camada, scheduler de compasso,
                        renderer de SFX, playback de arquivo com fallback procedural
  index.ts        MUDA  passa o tema ao engine; expõe playSfx já existente
src/render/
  audioEvents.ts  NOVO  PURO — detector de eventos por diff de WorldState
  GameScene.ts    MUDA  chama o detector 1×/frame e encaminha ao audioService
```

### 1. `music.ts` — composição pura

Modelo generativo (não 6 partituras escritas à mão):

```ts
export type MusicTheme = 'classic' | 'volcano' | 'glacier';
export type LayerId = 'bass' | 'drums' | 'melody' | 'pad';
export type Timbre = OscillatorType | 'kick' | 'snare' | 'hat';

export interface LayerSpec {
  readonly timbre: Timbre;
  readonly gain: number;        // 0..1, relativo dentro da faixa
  readonly octave: number;      // deslocamento em oitavas do root
  readonly pattern: readonly number[]; // offsets em BEATS dentro do compasso
  readonly durBeats: number;
}

export interface MusicScore {
  readonly id: string;          // ex.: 'classic.gameplay' — semente da variação
  readonly bpm: number;
  readonly beatsPerBar: number; // 4
  readonly bars: number;        // tamanho do loop (8)
  readonly rootMidi: number;
  readonly scale: readonly number[];      // semitons do modo
  readonly progression: readonly number[]; // grau da escala por compasso
  readonly layers: Readonly<Record<LayerId, LayerSpec>>;
}

export interface Voice {
  readonly layer: LayerId;
  readonly timbre: Timbre;
  readonly freq: number;   // Hz (0 p/ timbres percussivos, que ignoram a nota)
  readonly startBeat: number; // absoluto dentro do compasso
  readonly durBeats: number;
  readonly gain: number;
}

export function voicesForBar(score: MusicScore, barIndex: number, out: Voice[]): Voice[];
export const MUSIC_SCORES: Record<MusicTheme, Record<MusicTrack, MusicScore>>;
```

- **Variação sem aleatoriedade viva:** a melodia escolhe graus da escala via um LCG puro semeado
  por `hash(score.id) ^ barIndex` ⇒ mesma barra sempre soa igual, o loop de 8 compassos não é
  repetitivo, e o teste consegue afirmar o resultado. (Fora de `src/core/`, mas o mesmo espírito:
  nada de `Math.random`.)
- `midiToFreq(m) = 440 · 2^((m−69)/12)`.
- **Contraste de contexto:** menu = bpm baixo, pad longo, percussão esparsa, melodia rala;
  gameplay = bpm alto, ostinato de baixo em colcheias, kick/hat constantes, melodia densa.
- **Contraste de tema:** classic = modo maior/mixolídio, `triangle`+`sine`; volcano = menor
  natural/frígio, `sawtooth` grave, percussão mais pesada; glacier = lídio/maior, `sine` agudo
  com pad, hats cristalinos.

### 2. `sfx.ts` — SFX multi-camada puro

```ts
export type SfxId =
  | 'click' | 'flap' | 'coin' | 'powerup' | 'hit'
  | 'gameOver' | 'nearMiss' | 'levelUp' | 'block';

export interface SfxLayer {
  readonly timbre: Timbre;   // oscilador ou 'noise'
  readonly freq: number;
  readonly freqEnd?: number; // glide exponencial (sweep)
  readonly delaySec: number; // offset dentro do SFX (arpejo/duplo hit)
  readonly attackSec: number;
  readonly decaySec: number;
  readonly gain: number;     // relativo, 0..1
  readonly filterHz?: number; // lowpass p/ ruído
}
export interface SfxSpec { readonly layers: readonly SfxLayer[]; }
export const SFX_CATALOG: Record<SfxId, SfxSpec>;
/** Detune determinístico por repetição (o flap não fica metralhadora). */
export function sfxDetune(id: SfxId, playCount: number): number;
export function sfxDurationSec(spec: SfxSpec): number;
```

Desenhos: `flap` = whoosh curto de ruído filtrado + tom descendente; `coin` = duas senoides em
arpejo ascendente (quinta); `powerup` = arpejo de 3 notas com sweep; `hit` = ruído grave + queda
de sawtooth; `gameOver` = motivo descendente de 3 notas; `nearMiss` = whoosh de ruído
passa-banda curto e baixo; `levelUp` = arpejo ascendente de 4 notas; `block` (escudo/vida extra
absorvendo) = ping metálico curto; `click` = o atual, um pouco mais suave.

### 3. `engine.ts` — casca WebAudio

- **Buses:** `master → music` e `master → sfx`; dentro de `music`, um `GainNode` por camada
  (mixagem relativa fixa vinda de `LayerSpec.gain`). `setMusicGain` continua ajustando só o bus de
  música.
- **Scheduler de compasso:** mantém o padrão atual (lookahead 25 ms / janela 0,12 s), mas o
  cursor anda por **compasso**: quando o próximo compasso entra na janela, chama `voicesForBar` e
  agenda todas as vozes daquele compasso. `voicesForBar` escreve num array-scratch reusado ⇒ sem
  alocação por frame (o scheduler roda em `setInterval`, fora do rAF, mas o cuidado vale).
- **Buffer de ruído** criado uma vez e cacheado (kick/snare/hat/whooshes reusam
  `AudioBufferSourceNode` sobre o mesmo buffer).
- `playSfx(id, gain)` renderiza cada `SfxLayer` com o envelope; nada é pré-alocado por evento além
  dos nós WebAudio (que o browser recolhe ao `stop`).

### 4. `musicSource.ts` + seam de arquivo

```ts
export function musicFileUrl(theme: MusicTheme, track: MusicTrack, base: string): string;
// `${base}audio/${theme}/${track}.mp3`, com base = import.meta.env.BASE_URL (GitHub Pages)
```

No engine, `playMusic(track, gain, theme)`:
1. Se já existe `AudioBuffer` decodificado em cache para `(theme, track)` ⇒ toca em loop.
2. Se a URL já foi marcada como **ausente** ⇒ vai direto para o procedural.
3. Senão: começa **imediatamente** o procedural (sem gap de silêncio) e dispara
   `fetch` + `decodeAudioData` em background; ao resolver, faz crossfade curto (0,4 s) para o
   arquivo. Falha/404 ⇒ marca ausente e segue procedural.

`public/audio/**` fica **fora do precache** do PWA (`globIgnores`, precedente `**/art/**` do 8.1):
faixas de música são grandes e opcionais; são buscadas sob demanda e o runtime-cache do SW as
guarda depois da primeira reprodução.

### 5. `audioEvents.ts` — detector puro de eventos (render)

Diff de campos escalares de `WorldState` entre frames; sem alocação por frame (estado em campos
privados; saída num array-scratch).

| Evento | Regra de detecção | SFX |
|--------|-------------------|-----|
| flap | `!prev.lastFlap && world.lastFlap` | `flap` |
| moeda | `world.food > prev.food` | `coin` |
| power-up | novo kind em `world.effects` **ou** `extraLives` subiu | `powerup` |
| near-miss | `world.nearMisses > prev.nearMisses` | `nearMiss` |
| level-up | `world.level > prev.level` | `levelUp` |
| bloqueio | `extraLives` caiu e `alive` continua true | `block` |
| morte | `prev.alive && !world.alive` | `hit` + `gameOver` (atrasado) |

`reset(world)` na troca de partida (evita disparo espúrio no restart). O `GameScene` chama
`detector.poll(world, out)` 1×/frame **só em `playing`/`dying`** e encaminha para
`audioService.playSfx`.

### 6. Tema no `policy.ts`

`AudioInput` ganha `expansionId: string`; `AudioTarget` ganha `theme: MusicTheme`
(`musicThemeFor(expansionId)` com fallback `classic`). `AudioService` lê
`entitlementsService.activeExpansion` dentro do `effect` já existente ⇒ trocar de pack troca a
música **ao vivo**, como já faz com o tema CSS (8.3).

## Testes

Puros (Vitest), sem browser:
- `music.test.ts`: escala/frequências corretas; `voicesForBar` determinístico (mesma barra ⇒
  mesmas vozes); vozes dentro do compasso (`startBeat + durBeats ≤ beatsPerBar` para camadas
  não-sustentadas); todos os 6 scores com bpm/camadas válidos e distintos por tema; escrita no
  scratch sem alocar array novo.
- `sfx.test.ts`: os 9 ids existem; ganhos ∈ (0,1]; durações plausíveis (< 1,5 s); `sfxDetune`
  determinístico e limitado; sweeps com `freq`/`freqEnd` > 0.
- `musicSource.test.ts`: URL com/sem base de subdiretório.
- `policy.test.ts` (existente, estendido): tema derivado da expansão; fallback.
- `audioEvents.test.ts`: cada regra da tabela dispara exatamente 1×; `reset` limpa; sem eventos
  quando nada muda; multi-evento no mesmo frame.
- `index.test.ts` (existente): o `effect` continua idempotente e agora repassa o tema.

Casca (`engine.ts` WebAudio) não é unit-testada — validação por **Playwright** no build de
produção: contar nós/eventos via `AudioContext` instrumentado não é confiável, então a validação
mede: (a) `audioService` inicia a música ao desbloquear, (b) trocar de rota troca a faixa,
(c) trocar de expansão troca o tema, (d) eventos de gameplay chamam `playSfx` com os ids
esperados (engine de gravação injetado via exposição TEMP no `window`, revertida depois),
(e) 0 erros de console e fps sem regressão.

## Riscos

- **Custo de CPU do scheduler**: agendar um compasso inteiro de uma vez cria dezenas de nós por
  ~2 s. Mitigação: teto de vozes por compasso (≤ 32) e agendamento só do próximo compasso.
- **Fadiga auditiva** do loop de 8 compassos: mitigada pela variação por barra do LCG.
- **Faixa de arquivo grande** estourando o cache: fora do precache; teto documentado (~3 MB).

## Definição de pronto

`npm test` verde, `npm run check` limpo, determinismo **67** inalterado (core intocado),
validação Playwright registrada, item 9.6 marcado no arquivo da fase.
