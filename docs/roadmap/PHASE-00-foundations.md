# Fase 0 — Fundações

**Objetivo:** ter toda a infraestrutura SDD e o esqueleto técnico prontos para que sessões
autônomas implementem o jogo com segurança.

## Itens

### 0.1 Documentação-memória (este pacote)
- [x] `CLAUDE.md` (briefing sempre carregado).
- [x] Design spec master (`docs/superpowers/specs/2026-06-27-jurassicrun-design.md`).
- [x] Arquitetura: `ARCHITECTURE.md`, `DETERMINISM.md`, `RENDERING-AND-ASSETS.md`.
- [x] `CONVENTIONS.md`, `glossary.md`, `WORKFLOW.md`.
- [x] Roadmap + arquivos por fase.
- [x] ADRs iniciais (`docs/decisions/`).
- [x] Sistema de asset-spec (template + registro).

### 0.2 Agentes e skills
- [x] Agentes adaptados ao projeto (architect, coder, tester, reviewer, devops).
- [x] Novo agente `determinism-guardian`.
- [x] Skills de projeto: `add-gameplay-entity`, `add-locale`, `verify-determinism`,
      `create-asset-spec`.

### 0.3 Esqueleto técnico (concluído)
- [x] `npm init`, instalar: typescript, vite, vite-plugin-pwa, phaser, preact,
      @preact/signals, i18next, vitest.
- [x] `tsconfig.json` estrito; aliases de import (`@core`, `@app`, etc.).
- [x] Estrutura de pastas `src/` conforme `ARCHITECTURE.md`.
- [x] `index.html` + bootstrap mínimo (Vite roda, tela em branco/canvas vazio).
- [x] Scripts npm: `dev`, `build`, `test`, `test:determinism`, `check` (typecheck+lint).
- [x] ESLint/regra que falha se `src/core/` importar runtime gráfico ou usar
      `Math.random/Date.now/performance.now`. (Dupla camada: ESLint + teste Vitest.)
- [x] Atualizar `scripts/run.sh` e `scripts/stop.sh` para o dev server.

### 0.4 i18n scaffold (concluído)
- [x] Setup i18next; locales para os 10 idiomas (en default + es, pt-BR, fr, it, de, ja,
      zh, ko, hi) via `I18nService` (`src/services/i18n.ts`), com namespace `app.*` de
      bootstrap e teste de paridade de chaves.
- [x] Função `t()` disponível no app shell (`main.ts` inicializa i18n e usa `t('app.title')`).

### 0.5 CI skeleton (GitHub Actions) (concluído)
- [x] Workflow `.github/workflows/ci.yml`: em `pull_request` e `push` no `main`, instala
      deps com `npm ci` (Node 22) e roda `check` + `test` + `test:determinism`. Menor
      privilégio (`contents: read`) e `concurrency` com cancel-in-progress.
- [x] (Deploy GitHub Pages fica na Fase 7.)

## Definição de pronto
- `npm run dev` sobe a página. `npm test` roda (mesmo que com 1 teste trivial).
- `npm run check` passa. CI verde em PR. Regra anti-não-determinismo ativa.
