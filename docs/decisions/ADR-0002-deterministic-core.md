# ADR-0002 — Núcleo determinístico e separação core/render
- Status: Aceita
- Data: 2026-06-27

## Contexto
Desafios Diário/Semanal precisam ser justos entre dispositivos: o mesmo desafio deve produzir
o mesmo mundo e permitir comparar scores. Requisito inegociável.

## Decisão
Toda a lógica de jogo vive em `src/core/`, TypeScript puro, sem Phaser/DOM/IO. Simulação em
passo fixo (`FIXED_DT = 1/60`) desacoplada do render, com PRNG semeado. `Math.random`,
`Date.now`, `performance.now` proibidos no core. Ver `docs/architecture/DETERMINISM.md`.

## Consequências
- Determinismo é testável (replay + golden master) e verificado no CI.
- Render pode rodar em qualquer fps sem afetar resultado.
- Abre caminho para verificação anti-cheat por re-simulação no servidor.
- Exige disciplina: regra de lint impede importações/Apis proibidas no core.

## Alternativas consideradas
- Lógica acoplada ao update loop do Phaser: simples no início, mas determinismo frágil e não
  testável isoladamente. Rejeitada.
