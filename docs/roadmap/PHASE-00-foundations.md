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

### 0.3 Esqueleto técnico (a executar)
- [ ] `npm init`, instalar: typescript, vite, vite-plugin-pwa, phaser, preact,
      @preact/signals, i18next, vitest.
- [ ] `tsconfig.json` estrito; aliases de import (`@core`, `@app`, etc.).
- [ ] Estrutura de pastas `src/` conforme `ARCHITECTURE.md`.
- [ ] `index.html` + bootstrap mínimo (Vite roda, tela em branco/canvas vazio).
- [ ] Scripts npm: `dev`, `build`, `test`, `test:determinism`, `check` (typecheck+lint).
- [ ] ESLint/regra que falha se `src/core/` importar runtime gráfico ou usar
      `Math.random/Date.now/performance.now`.
- [ ] Atualizar `scripts/run.sh` e `scripts/stop.sh` para o dev server.

### 0.4 i18n scaffold
- [ ] Setup i18next; arquivos de locale vazios para os 10 idiomas (en default).
- [ ] Função `t()` disponível no app shell.

### 0.5 CI skeleton (GitHub Actions)
- [ ] Workflow: instala deps, roda `check` + `test` + `test:determinism` em PRs.
- [ ] (Deploy GitHub Pages fica na Fase 7.)

## Definição de pronto
- `npm run dev` sobe a página. `npm test` roda (mesmo que com 1 teste trivial).
- `npm run check` passa. CI verde em PR. Regra anti-não-determinismo ativa.
