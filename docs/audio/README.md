# Audio specs — JurassicRun

Especificações das fontes sonoras trocáveis (análogo aos asset-specs de imagem em
`docs/assets/specs/`). Na Fase 4 o áudio é **placeholder procedural** (WebAudio, ver
`src/services/audio/`); na Fase 8 estas specs guiam a composição/gravação das faixas e SFX
reais (formato-alvo `.ogg`, decodificados por `decodeAudioData` e injetados no `AudioEngine`
sem tocar os consumidores).

| id | Arquivo |
|----|---------|
| music.menu | specs/music.menu.md |
| music.gameplay | specs/music.gameplay.md |
| sfx.click | specs/sfx.click.md |
