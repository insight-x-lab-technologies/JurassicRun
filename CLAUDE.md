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

## Como rodar

- Dev: `npm run dev` (ou `bash scripts/run.sh` em background; `bash scripts/stop.sh` para parar)
- Testes: `npm test` (Vitest)
- Verificar determinismo: `npm run test:determinism` (ou skill `verify-determinism`)
- Build: `npm run build`
- Lint/typecheck: `npm run check`

## Convenções

Ver `docs/conventions/CONVENTIONS.md`. Resumo:
- TypeScript estrito. Sem `any` sem justificativa.
- `src/core/` não importa de `phaser`, `preact`, nem nada de DOM/IO.
- Toda feature segue o fluxo SDD (`docs/WORKFLOW.md`): spec → plano → TDD → review.
- Commits pequenos e descritivos. Não fazer commit/push sem o usuário pedir.

## Modo de operação (autônomo)

Default para sessões de desenvolvimento (ex.: `/next-item`), salvo pedido em contrário:
- **Execução por sub-agentes** (`subagent-driven-development`): um implementador por task +
  review por task + review final. Não pergunte qual método usar.
- **Branch de feature + um commit por task**, automático. Não pergunte.
- **Sem gate humano de aprovação** de spec nem de plano: decida pelas suas recomendações
  (o usuário não é especialista em game dev e confia na recomendação) e siga. Relate as
  decisões para permitir correção de rumo, mas não bloqueie.
- Pergunte só quando travar numa decisão de **produto/escopo** sem default razoável.
- **`main` é o branch principal (tronco).** Um desenvolvimento em execução por vez.
- **Commit, PR e merge para `main` são pré-autorizados** (merge automático): ao terminar um
  item, integre no `main` sem pedir. Quando houver remote GitHub + `gh`, abra PR e use merge
  automático; sem remote, faça merge local no `main`. Demais ações externas/irreversíveis
  (deploy, publicar em loja, etc.) ainda exigem o usuário pedir.

## Estado atual

**Fase 0 (Fundações) — CONCLUÍDA.** Itens 0.3 (esqueleto técnico), 0.4 (scaffold i18n) e
0.5 (CI) prontos: Vite+TS estrito, aliases, estrutura `src/`, bootstrap Preact que
inicializa i18n, guarda anti-não-determinismo em dupla camada (ESLint + teste Vitest),
scripts npm e dev server; i18next via `I18nService` (`src/services/i18n.ts`) com 10 locales
JSON (`en` default + es, pt-BR, fr, it, de, ja, zh, ko, hi) e `t()` no app shell; CI em
GitHub Actions (`.github/workflows/ci.yml`) rodando `check` + `test` + `test:determinism`
em PRs e pushes no `main`.

**Fase 1 (núcleo determinístico headless) — EM ANDAMENTO.** Itens 1.1 (RNG), 1.2
(derivação de seeds) e 1.3 (modelo de mundo + loop de passo fixo) concluídos.

1.1 (RNG): `src/core/rng/` com PRNG portável `mulberry32` + hash de seed `xmur3` (só
`Math.imul`/`>>>0`, zero fontes proibidas), classe `Rng` (`createRng`/`rngFromState`/
`hashSeed`) com `next`/`range`/`int`/`pick`/`fork`/`clone`/`nextUint32` e `seed`/`state`;
`fork(streamId)` deriva streams independentes.

1.2 (seeds): `src/core/seed/` puro (sem `Date`). `calendar.ts` faz a matemática de
calendário/semana ISO-8601 sobre `CalendarDate {year,month,day}` (Sakamoto p/ dia da semana,
`isoWeekOf` com bordas de virada de ano validadas 1990–2060 vs `Date` UTC). `seed.ts` monta a
**string canônica** por modo — `dailySeed`→`"daily:YYYY-MM-DD"`, `weeklySeed`→`"weekly:YYYY-Www"`,
`endlessSeed(token)`→`"endless:<token>"` — sem hashear (hashing fica em `createRng`, caminho
único); `randomEndlessToken(uint32)` formata um token exibível Crockford base32 (7 chars).
A aleatoriedade do Endless e a conversão relógio→`CalendarDate` UTC vêm de FORA do core
(esta última é da Fase 5, com o modo Diário/Semanal).

1.3 (modelo de mundo): `src/core/sim/` com `WorldState`, `Entity`, `Hitbox` (aabb/circle/polygon),
`createWorld`/`cloneWorld` e `step(world, input)` — gravidade, flap (borda de subida), scroll
horizontal, clamp de teto, morte no chão, estado congelado após morte. `FIXED_DT = 1/60`. Suíte
verde (`check` limpo, 81 testes, bateria de determinismo 27 — inclui reprodutibilidade e
independência de fps 1/2/5 steps por frame).

Próximo: **item 1.4 (geração de obstáculos)**. Ver
`docs/roadmap/PHASE-01-deterministic-core.md`.
