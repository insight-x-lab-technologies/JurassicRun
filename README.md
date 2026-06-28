# JurassicRun

PWA mobile-first, side-scroller estilo Flappy Bird com temática de dinossauros — o jogador é
um **pterodáctilo**. Jogo determinístico (desafios diário/semanal justos entre dispositivos),
arte trocável (geométrico → PNG AAA), 10 idiomas, leaderboards e packs cosméticos.

Hobby project. Construído por sessões autônomas de IA com **Spec-Driven Development (SDD)**.

## Documentação

- **[CLAUDE.md](CLAUDE.md)** — briefing do projeto (regras inegociáveis). Comece aqui.
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — como desenvolver (o loop SDD).
- **[docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md)** — fases e rastreabilidade de requisitos.
- **[docs/architecture/](docs/architecture/)** — arquitetura, contrato de determinismo, assets.
- **[docs/decisions/](docs/decisions/)** — ADRs (decisões de arquitetura).
- **[docs/assets/](docs/assets/)** — registro e specs de imagens (para geração por IA).
- **[docs/superpowers/specs/](docs/superpowers/specs/)** — specs de design por feature.

## Stack

Phaser 3 · Preact + Signals · Vite + vite-plugin-pwa · TypeScript · Vitest · i18next · Supabase (tardio).

## Status

Fase 0 (Fundações) concluída: docs, arquitetura, roadmap, agents e skills. Próximo:
Fase 1 — núcleo determinístico headless. Ver `docs/roadmap/ROADMAP.md`.
