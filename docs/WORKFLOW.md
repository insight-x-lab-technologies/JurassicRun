# WORKFLOW — Como desenvolver JurassicRun com Claude Code (SDD)

> Este projeto é construído por sessões autônomas de IA usando **Spec-Driven Development**.
> Este documento é o passo-a-passo de cada sessão. Otimizado para as *superpowers skills*.

## Visão geral do loop

```
Escolher item do roadmap
        │
        ▼
[brainstorming]  → cria a SPEC em docs/superpowers/specs/AAAA-MM-DD-<topico>-design.md
        │
        ▼
[writing-plans]  → cria o PLANO de implementação (passos verificáveis)
        │
        ▼
[test-driven-development] / [subagent-driven-development]
        │   escreve teste que falha → implementa → passa → refatora
        ▼
[requesting-code-review]  → revisão (agente reviewer / skill)
        │
        ▼
[verification-before-completion]  → roda testes/typecheck/determinismo de verdade
        │
        ▼
Commit  (somente quando o usuário pedir)
```

## Passo a passo de uma sessão

1. **Abrir contexto.** Leia `CLAUDE.md`, o `docs/roadmap/ROADMAP.md` e o arquivo da fase atual
   (`docs/roadmap/PHASE-XX-*.md`). Escolha **um** item pequeno e bem definido.
2. **Brainstorm da feature.** Invoque a skill `superpowers:brainstorming`. Resultado: uma spec
   curta da feature em `docs/superpowers/specs/`.
3. **Plano.** Invoque `superpowers:writing-plans`. Resultado: plano com passos testáveis.
4. **Implementar com TDD.** Invoque `superpowers:test-driven-development`. Para itens com várias
   partes independentes, use `superpowers:subagent-driven-development` ou
   `superpowers:dispatching-parallel-agents`.
   - Itens em `src/core/` ou que toquem determinismo/economia: TDD **rigoroso**.
   - Telas/UI cosméticas: testes onde fizer sentido (lógica de estado), menos cerimônia.
5. **Determinismo.** Se tocou `src/core/`, rode a skill `verify-determinism` antes de fechar.
6. **Review.** Invoque `superpowers:requesting-code-review` (ou o agente `reviewer`).
7. **Verificar de verdade.** Invoque `superpowers:verification-before-completion`: rode
   `npm test`, `npm run check`, e o teste de determinismo. Evidência antes de afirmar "pronto".
8. **Fechar.** Atualize o arquivo da fase (marque o item), atualize `CLAUDE.md` "Estado atual"
   se mudou. Commit só quando o usuário pedir.

## Agentes especializados (`.claude/agents/`)

- `architect` — produz/atualiza docs de arquitetura de uma feature.
- `coder` — implementa a partir do plano.
- `tester` — planeja/escreve/roda testes, grava TEST_REPORT.md.
- `reviewer` — revisa diff antes de commit (bugs, segurança, convenções, cobertura).
- `determinism-guardian` — auditoria focada: garante que `src/core/` não violou o contrato.
- `devops` — build, CI, deploy (GitHub Pages, depois itch.io).

Use agentes quando o usuário pedir ou quando a tarefa se beneficiar de isolamento de contexto.

## Skills de projeto (`.claude/skills/`)

- `add-gameplay-entity` — adicionar obstáculo/coletável/power-up (lógica + hitbox + manifesto +
  asset-spec + testes), respeitando o contrato de determinismo.
- `add-locale` — adicionar/editar chaves i18n em todos os 10 idiomas.
- `verify-determinism` — rodar a bateria de testes de determinismo.
- `create-asset-spec` — criar a especificação de uma imagem trocável para geração por IA.

## Regras de ouro

- **Sempre** comece pelas skills de processo (brainstorming/debugging) antes de implementar.
- **Nunca** viole o contrato de determinismo (`docs/architecture/DETERMINISM.md`).
- **Sempre** atualize a documentação-memória quando uma decisão muda (CLAUDE.md, ADRs).
- **Evidência antes de afirmar.** Não diga "passa" sem ter rodado.
