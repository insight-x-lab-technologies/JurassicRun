# music.menu

**Tipo:** música de fundo (loop) — telas de menu (Home, Perfil, Ninho, Loja, etc.).
**Mood:** calmo, acolhedor, levemente pré-histórico/aventura leve; não intrusivo.
**Loop:** fecha por compasso (8 compassos) — sem costura audível na volta ao início.
**Mix:** teto baixo (não abafar SFX/voz); ver `MUSIC_CEILING`.

## Modelo procedural (item 9.6, sempre presente)

Cada tema (`classic`/`volcano`/`glacier`) tem uma `MusicScore` própria em
`src/services/audio/music.ts` (`MUSIC_SCORES.<tema>.menu`), gerada por WebAudio na hora, sem
arquivo. 4 camadas por compasso: `bass` (drone longo), `drums` (hat/kick esparso), `pad` (drone
longo, textura), `melody` (frase curta que varia por compasso via LCG determinístico — sem
`Math.random`). BPM/tônica/modo por tema:

| tema      | BPM | tônica | modo    |
|-----------|-----|--------|---------|
| classic   | 78  | A2     | maior   |
| volcano   | 70  | F2     | menor   |
| glacier   | 68  | C3     | lídio   |

## Faixa de arquivo (opcional, seam 9.6)

Se existir `public/audio/<tema>/menu.mp3`, ele entra em crossfade de 0,4s sobre a camada
procedural e passa a tocar em loop (a procedural para). Sem arquivo, o procedural toca para
sempre — nada quebra. Ver `docs/audio/specs/SUNO-BRIEF.md` para o briefing de geração (Suno,
~78 BPM, ambiente cinemático pré-histórico) e `public/audio/README.md` para onde salvar.
**Formato-alvo:** `.mp3`, < ~3 MB, duração 1:30–2:00.
