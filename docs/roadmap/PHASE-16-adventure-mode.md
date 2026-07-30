# Fase 16 — Modo aventura

**Objetivo:** profundidade single-player evergreen — o item mais ambicioso do roadmap de
monetização, por isso o último. Desenho deliberadamente barato: **missão = dados, não level
design artesanal**. Cada missão é `{seed, modificadores (eixos 9.9), objetivo-predicado puro,
critérios de estrela, recompensa}` rodando o MESMO motor Endless/desafio de sempre.

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.

## Premissas (NÃO violar)

- **Meta: zero toque em `src/core/`.** Objetivos são predicados avaliados FORA do core sobre
  `MatchSummary`/timeline pós-partida (sobreviva Ns, colete N moedas, N near-misses, termine sem
  usar power-up X — tudo derivável do que o summary já expõe; se faltar um escalar no summary,
  preferir derivá-lo da timeline no serviço a mexer no core). Se algum modificador novo derivar
  para o core, ritual completo (re-pin + `verify-determinism` + `build:edge`) e item marcado D.
- Campo 320×180 e física intocados; missão nunca altera a simulação além dos eixos 9.9
  (`forcedWeather`, `bannedPowerup`) + duração/objetivo externos.
- Recompensas alimentam a economia existente (moedas/ovos/skin exclusiva) — sem moeda nova.
- i18n 10 idiomas; arte de mapa/capítulos via asset-spec + pipeline contra placeholder.

## Itens

### 16.1 Formato de missão + runtime
- [ ] `MissionDef {id, capítulo, seed, modifiers, objetivo, estrelas: [1★ objetivo, 2★ secundário,
      3★ par de score/tempo], recompensa}` em JSON versionado; validador de schema em teste.
- [ ] Runtime: partida de missão = partida de desafio com config da missão (builder canônico 9.9
      reusado); avaliação de objetivo/estrelas pós-partida, pura e testada.
- [ ] HUD mostra o objetivo ativo (chip curto) sem poluir.

**Toca:** serviço novo, fluxo de partida (modo novo), HUD, i18n. **Aceite:** mesma missão ⇒ mesma
partida em qualquer aparelho (determinismo herdado); avaliação de estrelas provada por teste com
summaries sintéticos.

### 16.2 Gerador procedural + curadoria (~30 missões, 3 capítulos)
- [ ] Script gerador (fora do app): varre seeds candidatas, simula headless (core puro) e mede
      dificuldade real (score alcançável, densidade de obstáculos) ⇒ propõe missões com curva
      crescente. Saída = JSON curável na mão.
- [ ] 3 capítulos × 10 missões (capítulo = tema visual: classic → volcano → ice, reusando
      expansões). Curadoria: ajustar objetivos/pares no JSON gerado.
- [ ] Estrelas destravam: N★ acumuladas abrem o próximo capítulo.

**Toca:** `scripts/`, JSON de missões, i18n (título/descrição por missão — usar templates
parametrizados para não explodir em 300+ strings soltas). **Aceite:** 30 missões jogáveis com
curva validada pelo simulador headless; capítulos destravam por estrelas.

### 16.3 Mapa de aventura (UI)
- [ ] Tela de mapa por capítulo: nós de missão com estrelas obtidas, cadeado nos bloqueados,
      entrada pelo Home. Paisagem + retrato (10.9).
- [ ] Arte do mapa: placeholder procedural primeiro; arte IA depois via asset-spec
      (`docs/assets/specs/ui.adventure-map.md`).

**Toca:** tela nova, router, i18n, asset-spec. **Aceite:** navegação completa
Home→mapa→missão→resultado→mapa; progresso persiste; responsivo nas duas orientações.

### 16.4 Recompensas & integração de economia
- [ ] Recompensa por missão (moedas), bônus por capítulo completo (ovo 11.4) e skin exclusiva por
      zerar com 3★ em tudo (asset-spec).
- [ ] Troféus novos de aventura (molde 10.7); missões contam para quests diárias tipo "jogue N
      partidas".

**Toca:** carteira, troféus, quests, i18n. **Aceite:** recompensa 1× por conquista (re-jogar não
duplica); troféus destravam; storage migrado sem perder progresso.

## Ordem de execução

16.1 → 16.2 → 16.3 → 16.4. Um item por PR.

## Definição de pronto (fase)

- `check` + suíte inteira verdes; determinismo intacto (meta: sem re-pin — core intocado).
- 3 capítulos jogáveis de ponta a ponta com estrelas, destravas e recompensas; mapa responsivo;
  gerador versionado permitindo capítulos futuros só com dados+arte.
