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

> **Histórico por-item vive fora deste arquivo** (mantê-lo curto — REGRA do topo). O detalhe de
> cada item concluído (decisões, gotchas, merges) está nos arquivos de memória
> (`.claude/.../memory/deferred-*.md`, indexados em `MEMORY.md`) e nos docs de fase
> (`docs/roadmap/PHASE-0X-*.md`). Consulte-os quando precisar de contexto de um item específico.

**Métricas correntes:** determinismo **67** testes · suíte **843** testes · `check` limpo.
Branch `main`. Fases 0–8 **CONCLUÍDAS**; Fase 9 **EM ANDAMENTO** (9.1–9.4 feitos ⇒ Frente A fechada).

### Fases (todas testadas/`check` limpo; det = nº de testes de determinismo ao fechar)

| Fase | Tema | Status | det |
|------|------|--------|-----|
| 0 | Fundações (Vite+TS estrito, i18n 10 locales, guarda anti-não-det dupla camada, CI) | ✅ | — |
| 1 | Núcleo determinístico headless (RNG, seeds, sim passo-fixo, spawn, colisão, dificuldade, economia, replay/golden) | ✅ | 54 |
| 2 | Vertical slice Endless (render Phaser, input, parallax, HUD, fluxo de partida, Game Over, perf 60fps) | ✅ | 54 |
| 3 | Power-ups & clima (escudo/vida/ímã/2x/slow-mo; tempo-do-dia cosmético; clima afeta física vertical) | ✅ | 64 |
| 4 | Meta offline (shell Preact+router, perfis, Home hub, Ninho/traços, carteira+Loja, entitlements/expansões, troféus, settings, i18n completo, áudio) | ✅ | 67 |
| 5 | Desafios & leaderboards locais (Diário/Semanal, leaderboards 3 abas, troféu pódio local, replays verificáveis seed+timeline+hash) | ✅ | 67 |
| 6 | Online Supabase (schema/RLS, ID global anônimo, leaderboard central, anti-cheat Edge Function, troféus sincronizados) | ✅ | 67 |
| 7 | PWA & deploy (instalável/offline, responsividade final, GitHub Pages, itch.io; 7.5 wrappers de loja ADIADO) | ✅ | 67 |
| 8 | Arte AAA & packs (manifesto→sprite atlas, arte real entidades+dino animado, Tier-1 UI/fundos/parallax, packs=expansão ativa, gateway Ko-Fi/código, redesign UI W1→W9) | ✅ | 67 |
| 9 | Melhorias estruturais | 🚧 | 67 |

### Invariantes que se repetem (padrões do projeto)

- **det 67 "inalterado":** itens que **não tocam `src/core/`** (render/app/serviços/infra) não mudam
  os testes de determinismo. Só 9.8/9.9 tocam core ⇒ re-pin de goldens + regenerar
  `_verify.bundle.js` (`npm run build:edge`) + `verify-determinism` verde.
- **Padrão puro×casca:** lógica pura testável (sem phaser/DOM) separada da casca de IO/render.
  Serviços reativos singleton via `@preact/signals` (molde wallet/trophy/settings).
- **Pipeline contra PLACEHOLDER:** arte/áudio novos entram contra placeholder procedural; a arte AAA
  real dropa depois só trocando os PNG/JSON-fonte (REGRA 2). Precedente: atlas 8.2, áudio 4.10,
  parallax 9.1, obstáculos 9.2.
- **Offline-first:** sem `.env`/Supabase ⇒ tudo online vira no-op best-effort, jogo idêntico.
- **Campo lógico fixo 320×180** (determinismo + justiça de leaderboard). Telas variadas = escalar+
  letterbox, nunca redimensionar o mundo. Resolução de render (W5) dá px 1:1 ao display.
- **Seams documentados** (sem abstração morta): `getHomeStats`, `activeExpansion`, `AudioEngine`,
  provider de entitlements/gateway, `LookPack.atlas` por tema.

### Gotchas recorrentes (verificados no projeto)

- **Subagente cai por limite de sessão** ⇒ controlador finaliza a task **INLINE** (TDD, self-review).
  Precedente 3.4/4.3/4.7/4.8/6.2/6.5/9.2.
- **`coder` agente NÃO commita** (regra do agente) ⇒ o controlador commita os arquivos staged.
- **SW cacheia `dist` antigo** na validação Playwright ⇒ unregister SW + clear caches + `?nocache`.
- **Verificar por NÚMERO, não screenshot:** medir `getComputedStyle`/runtime, não confiar em CSS/print
  em cache. Encoder pode passar nos testes mas estourar timeout (custo ≠ asserção).
- **`git commit -am` de subagente varre trabalho pré-existente** do usuário ⇒ commitar só os arquivos
  do item (precedente 8.4).

### Fase 9 — Melhorias estruturais (EM ANDAMENTO) — `docs/roadmap/PHASE-09-*.md`

Ordem travada **A → B → C → D**. Um item por PR (SDD por subagentes). Só D toca core.

- **A (arte/render):** 9.1 parallax alpha ✅ · 9.2 obstáculos segmentados (cobrem hitbox) ✅ ·
  9.3 animação de morte do dino ✅ (fase cosmética `dying` 0,75 s: giro/queda/partículas/shake, tudo
  procedural — frames `dino.hit` ficaram como asset-spec futuro) ·
  9.4 idle cosmético de obstáculo ✅ (também PROCEDURAL: sway da árvore/cipó com **sangria =
  amplitude** ⇒ o balanço nunca descobre a hitbox; gota da estalactite; campo `idle` no manifesto).
  **Frente A concluída.**
- **B (feedback):** **9.5 indicador de power-up ativo + traço do dino ← PRÓXIMO** (badges HUD +
  aura no canvas).
- **C (áudio/UX):** 9.6 áudio procedural rico (multi-camada + SFX por evento) · 9.7 toggle de SFX.
- **D (core/desafios):** 9.8 novos obstáculos (`add-gameplay-entity`) · 9.9 briefing + modificadores
  de desafio por seed (`src/core/challenge/`, função pura da seed; verificador recomputa).

Prompts de geração de asset prontos no Apêndice do `PHASE-09`.
