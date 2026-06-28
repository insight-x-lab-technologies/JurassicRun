# CLAUDE.md — JurassicRun

> Briefing sempre carregado. Leia isto antes de qualquer trabalho.
> É a memória persistente do projeto para sessões autônomas. Mantenha-o curto e verdadeiro.

## O que é

PWA mobile-first, side-scroller estilo Flappy Bird com temática de dinossauros.
O jogador é um **pterodáctilo**. Hobby project, sem frameworks pagos, sem custo no lançamento.

Design completo: `docs/superpowers/specs/2026-06-27-jurassicrun-design.md`
Arquitetura: `docs/architecture/ARCHITECTURE.md`
Roadmap: `docs/roadmap/ROADMAP.md`
Como trabalhar aqui: `docs/WORKFLOW.md`

## Regras inegociáveis (NÃO VIOLE)

1. **Determinismo.** Toda lógica de jogo vive em `src/core/` (TS puro, sem Phaser, sem DOM).
   - `Math.random()`, `Date.now()`, `performance.now()` são **PROIBIDOS** dentro de `src/core/`.
     Aleatoriedade só via o serviço de RNG com seed. Tempo só via o relógio da simulação.
   - Simulação roda em **passo fixo**. Render nunca altera estado de simulação.
   - Mesma seed + mesma sequência de inputs ⇒ estado idêntico. Há testes que provam isso.
   - Detalhes e checklist: `docs/architecture/DETERMINISM.md`.
2. **Arte desacoplada.** Colisão usa hitbox lógica, nunca pixels. Trocar geométrico↔PNG é
   editar o manifesto de assets, não a lógica. Expansões só mudam cosméticos.
   Detalhes: `docs/architecture/RENDERING-AND-ASSETS.md`.
3. **Performance.** Alvo 60fps+. Não introduza alocação por frame no hot path nem trabalho
   síncrono pesado no loop. Use atlases, não imagens soltas.
4. **i18n.** Nenhuma string visível ao usuário hardcoded. Tudo via chaves i18next.
5. **Toda imagem trocável** precisa de um asset-spec em `docs/assets/specs/` (ver skill
   `create-asset-spec`).

## Como rodar (preenchido na Fase 1/2)

- Dev: `npm run dev`
- Testes: `npm test` (Vitest)
- Verificar determinismo: `npm run test:determinism` (ou skill `verify-determinism`)
- Build: `npm run build`
- Lint/typecheck: `npm run check`

> Enquanto esses scripts não existem (pré-Fase 1), eles serão criados como parte do setup.

## Convenções

Ver `docs/conventions/CONVENTIONS.md`. Resumo:
- TypeScript estrito. Sem `any` sem justificativa.
- `src/core/` não importa de `phaser`, `preact`, nem nada de DOM/IO.
- Toda feature segue o fluxo SDD (`docs/WORKFLOW.md`): spec → plano → TDD → review.
- Commits pequenos e descritivos. Não fazer commit/push sem o usuário pedir.

## Estado atual

Fase 0 (Fundações) — documentação e infra SDD criadas. Código do jogo ainda não iniciado.
Próximo: Fase 1 (núcleo determinístico headless). Ver `docs/roadmap/ROADMAP.md`.
