# music.gameplay

**Tipo:** música de fundo (loop) — partida (tela Play).
**Mood:** energético, propulsor, sensação de corrida/voo; sobe a tensão sem cansar.
**Loop:** fecha por compasso (8 compassos) — sem costura audível na volta ao início.
**Mix:** teto baixo; não competir com os SFX de gameplay (`sfx.gameplay.md`).

## Modelo procedural (item 9.6, sempre presente)

Cada tema (`classic`/`volcano`/`glacier`) tem uma `MusicScore` própria em
`src/services/audio/music.ts` (`MUSIC_SCORES.<tema>.gameplay`), gerada por WebAudio na hora, sem
arquivo. 4 camadas por compasso: `bass` (ostinato em colcheias), `drums` (kick/hat denso),
`pad` (drone de sustentação), `melody` (frase rítmica que varia por compasso via LCG
determinístico — sem `Math.random`). Sempre mais rápido que a faixa de menu do mesmo tema.
BPM/tônica/modo por tema:

| tema      | BPM | tônica | modo    |
|-----------|-----|--------|---------|
| classic   | 132 | A2     | maior   |
| volcano   | 142 | F2     | menor   |
| glacier   | 128 | C3     | lídio   |

## Faixa de arquivo (opcional, seam 9.6)

Se existir `public/audio/<tema>/gameplay.mp3`, ele entra em crossfade de 0,4s sobre a camada
procedural e passa a tocar em loop (a procedural para). Sem arquivo, o procedural toca para
sempre — nada quebra. Ver `docs/audio/specs/SUNO-BRIEF.md` para o briefing de geração (Suno,
~132–142 BPM, chase cinemático) e `public/audio/README.md` para onde salvar.
**Formato-alvo:** `.mp3`, < ~3 MB, duração 2:00–2:30.
