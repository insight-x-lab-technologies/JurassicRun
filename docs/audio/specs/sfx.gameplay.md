# sfx.gameplay

**Tipo:** 8 SFX one-shot de evento de jogo (fora do `sfx.click`, que é feedback de UI —
ver `sfx.click.md`). Todos procedurais (item 9.6), sintetizados por WebAudio na hora, sem
arquivo — precisam de latência zero e não têm seam de arquivo (só a música tem, ver
`docs/audio/specs/SUNO-BRIEF.md`).

Detectados por diff puro de `WorldState` a cada frame (`src/render/audioEvents.ts`,
`AudioEventDetector`), exceto `gameOver` que é disparado direto pelo `GameScene` na transição
para a fase cosmética `dying` (9.3). Cada spec está em `SFX_CATALOG.<id>`
(`src/services/audio/sfx.ts`). Duração = `sfxDurationSec(spec)` (fim da camada mais longa).

| id         | gatilho                                                          | duração  |
|------------|-------------------------------------------------------------------|----------|
| `flap`     | borda de subida de `world.lastFlap` (um bater de asa)              | ~0,14s   |
| `coin`     | `world.food` aumenta (comida coletada)                             | ~0,22s   |
| `nearMiss` | `world.nearMisses` aumenta (desvio raspando um obstáculo)           | ~0,16s   |
| `levelUp`  | `world.level` aumenta (subida de dificuldade)                       | ~0,50s   |
| `powerup`  | novo efeito temporário ativo OU `world.extraLives` aumenta           | ~0,47s   |
| `block`    | `world.extraLives` diminui enquanto `world.alive` (vida extra absorveu o golpe) | ~0,22s |
| `hit`      | `world.alive` vira `false` (colisão fatal)                          | ~0,36s   |
| `gameOver` | transição para a fase cosmética `dying` (disparo único, cauda longa) | ~1,06s   |

(Durações = `sfxDurationSec(SFX_CATALOG[id])` medido; a fase cosmética `dying` dura 0,75s — o
`gameOver` estende um pouco além dela, o que é intencional: a última nota não fica cortada.)

## Desenho sonoro (por id, camadas de `SFX_CATALOG`)

- **`flap`** — whoosh de ruído filtrado (1400 Hz) + corpo grave `sine` 260→150 Hz. Curto o
  bastante para taps rápidos (< 0,35s garantido por teste).
- **`coin`** — arpejo ascendente de quinta: `square` 988 Hz seguido de `square` 1319 Hz
  (atraso 60ms), brilhante.
- **`nearMiss`** — sopro curto e discreto de ruído filtrado (2600 Hz), ganho baixo (0,18):
  é frequente, precisa ser barato de ouvir sem cansar.
- **`levelUp`** — arpejo ascendente de 4 notas `square` (523→659→784→1047 Hz).
- **`powerup`** — tríade ascendente `triangle` (523→659→784 Hz) com sweep final até 1568 Hz:
  "algo bom aconteceu".
- **`block`** — ping metálico: `sine` 1200→700 Hz + transiente de ruído filtrado (3500 Hz).
- **`hit`** — impacto: ruído grave filtrado (500 Hz) + queda `sawtooth` 180→55 Hz.
- **`gameOver`** — motivo descendente de 3 notas `triangle` (392→311→233 Hz), a única cauda
  longa do catálogo (~1,06s) — tocada uma única vez por morte.

## Variação (sem `Math.random`)

`flap`, `coin` e `nearMiss` variam de afinação a cada repetição (`sfxDetune`, tabela cíclica de
cents fixa `[0, 35, -25, 60, -50, 15]` indexada pelo contador de reproduções do id) — evita o
efeito "metralhadora" quando o evento repete rápido. Os demais ids (incluindo `click`) não
variam: são raros o bastante, ou pedem feedback estável.

## Headroom

Todos os SFX somam ganho por camada ≤ 2 (guarda de teste) e a duração máxima é 1,5s
(guarda de teste) — nenhum atropela o próximo evento nem estoura o teto de mixagem
(`SFX_CEILING`, `src/services/audio/policy.ts`).
