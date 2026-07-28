# Trilhas de música (opcionais)

Solte aqui as faixas geradas no Suno (ver `docs/audio/specs/SUNO-BRIEF.md`):

    public/audio/classic/menu.mp3
    public/audio/classic/gameplay.mp3
    public/audio/volcano/{menu,gameplay}.mp3
    public/audio/glacier/{menu,gameplay}.mp3

Sem arquivo, o jogo toca a música **procedural** (item 9.6) — nada quebra.
Com arquivo, ele entra em crossfade sobre a camada procedural na primeira reprodução.

Estes MP3 **não** entram no precache do Service Worker (`globPatterns` só cobre
`js,css,html,png,svg,ico,woff2`): são grandes e opcionais. Mantenha cada faixa abaixo de ~3 MB.
