# Suno AI — briefing de geração de trilhas (JurassicRun)

> Trilhas **opcionais**. O jogo continua tocando música **procedural** (item 9.6) quando não há
> arquivo. Se um arquivo existir em `public/audio/`, ele tem precedência sobre a camada procedural.
> Regra 2 (arte desacoplada) aplicada a áudio: trocar procedural↔arquivo é dropar o arquivo, não
> mexer em lógica.

## Regras gerais (valem para TODOS os prompts)

- **Instrumental.** Marcar `Instrumental` no Suno. Sem vocais, sem letra, sem spoken word.
- **Loopável.** Pedir intro curta e final que volte ao clima da abertura. Cortar o silêncio das
  pontas na exportação; o player faz loop contínuo.
- **Sem mudança brusca de seção** (Suno gosta de "drop"/bridge; peça estrutura estável).
- **Headroom:** exportar sem clipping; o jogo aplica ganho ~0,35 de teto sobre a música.
- **Duração alvo:** menu 1:30–2:00 · gameplay 2:00–2:30.
- **Formato:** exportar MP3 (ou WAV → converter). O jogo carrega sob demanda, fora do precache do
  PWA — não estoure ~3 MB por faixa.

### Onde salvar

```
public/audio/<tema>/menu.mp3
public/audio/<tema>/gameplay.mp3
```
`<tema>` ∈ `classic` · `volcano` · `glacier` (os mesmos 3 packs de look&feel).

Se você só gerar um par, salve como `classic/` — ele é o default e vale para todos os temas
enquanto os outros não existirem.

---

## 1. Menu — `classic` (selva/cânion, golden hour)

**Style of Music:**
```
cinematic prehistoric adventure ambient, slow 78 BPM, tribal frame drums played soft with mallets,
low bamboo flute melody, warm ethnic strings drone, distant jungle atmosphere, wide reverb,
hopeful and majestic but calm, orchestral hybrid, loopable, instrumental
```
**Exclude styles:** `vocals, choir, lyrics, drop, EDM, distorted guitar, dubstep, sudden silence`

**Descrição/Lyrics box:** `[Instrumental]`

---

## 2. Gameplay — `classic`

**Style of Music:**
```
driving tribal adventure chase music, 132 BPM, steady tom-tom and djembe groove, ostinato marimba
riff, pulsing low brass, energetic jungle percussion, adventurous and forward-moving, consistent
intensity with no breakdown, cinematic game loop, instrumental
```
**Exclude styles:** `vocals, choir, lyrics, breakdown, ambient section, fade out, silence, dubstep`

---

## 3. Menu — `volcano` (basalto, brasa, cinzas)

**Style of Music:**
```
dark cinematic ambient, 70 BPM, deep sub drone, slow taiko heartbeat, smoldering metallic
percussion, ominous low strings, distant rumbling, embers and ash atmosphere, tense but restrained,
hybrid orchestral, loopable, instrumental
```
**Exclude styles:** `vocals, choir, lyrics, drop, EDM, screaming, sudden silence`

---

## 4. Gameplay — `volcano`

**Style of Music:**
```
intense volcanic chase music, 142 BPM, aggressive taiko and metal-hit percussion, low brass stabs,
relentless driving rhythm, dark minor mode, industrial tribal fusion, danger and urgency, constant
energy with no breakdown, cinematic game loop, instrumental
```
**Exclude styles:** `vocals, lyrics, breakdown, ambient section, fade out, silence`

---

## 5. Menu — `glacier` (tundra, gelo, aurora)

**Style of Music:**
```
cold cinematic ambient, 68 BPM, glassy bell tones, airy pad drone, soft ice-crystal textures,
sparse low piano notes, distant wind, aurora shimmer, serene and vast, hybrid orchestral,
loopable, instrumental
```
**Exclude styles:** `vocals, choir, lyrics, drop, EDM, heavy drums, sudden silence`

---

## 6. Gameplay — `glacier`

**Style of Music:**
```
icy adventure chase music, 128 BPM, crisp snare and frame drum groove, glassy pizzicato ostinato,
bright bell melody over cold pad, brisk and agile, wintery cinematic game loop, consistent
intensity with no breakdown, instrumental
```
**Exclude styles:** `vocals, lyrics, breakdown, ambient section, fade out, silence`

---

## Pós-processamento (você, antes de commitar)

1. Cortar silêncio do início e do fim (loop sem "buraco").
2. Normalizar a ~−14 LUFS (ou pico −3 dBFS).
3. Exportar MP3 128–160 kbps mono ou estéreo (< ~3 MB).
4. Salvar no caminho da tabela acima e recarregar o jogo — sem passo de build.

## SFX

**NÃO** gerar SFX no Suno. Os efeitos (flap, moeda, colisão, power-up, game over, clique) são
**procedurais** (item 9.6): latência zero, variação por evento, custo zero e funcionam offline.
