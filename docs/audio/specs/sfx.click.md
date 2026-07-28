# sfx.click

**Tipo:** SFX one-shot — acionamento de qualquer botão da UI.
**Caráter:** clique curto, nítido, agradável; sem cauda longa; **não varia de afinação** entre
repetições (feedback de UI precisa ser estável e previsível — ao contrário dos SFX de gameplay).
**Duração:** ~100ms.
**Mix:** segue o volume mestre (`SFX_CEILING`).

## Desenho sonoro (procedural, item 9.6, sempre presente)

2 camadas em `SFX_CATALOG.click` (`src/services/audio/sfx.ts`), sintetizadas por WebAudio na
hora — sem arquivo:

1. `triangle` 880 Hz, ataque 4ms, decaimento 60ms, ganho 0,5 — corpo do clique.
2. `sine` 1320 Hz, atraso 10ms, ataque 4ms, decaimento 40ms, ganho 0,2 — brilho/topo.

Não há seam de arquivo para SFX (só música tem faixa de arquivo opcional, ver
`docs/audio/specs/SUNO-BRIEF.md`): SFX precisa de latência zero e variação por evento, então
fica procedural mesmo depois que a música ganhar faixas reais.
