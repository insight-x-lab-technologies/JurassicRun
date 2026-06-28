---
description: Pega o próximo item não concluído do ROADMAP e executa o loop SDD completo (ou o item passado como argumento).
---

Você vai trabalhar um item do roadmap do JurassicRun seguindo o processo SDD.

## Contexto a carregar (obrigatório, antes de tudo)
1. Leia `CLAUDE.md` (regras inegociáveis).
2. Leia `docs/roadmap/ROADMAP.md` e `docs/WORKFLOW.md`.
3. Identifique a fase atual pelo campo "Estado atual" do `CLAUDE.md` e abra o arquivo
   `docs/roadmap/PHASE-XX-*.md` correspondente.

## Seleção do item
- Se houver um argumento (`$ARGUMENTS`), trabalhe esse item específico (ex.: `1.3`).
- Caso contrário, escolha o **primeiro item não marcado `[ ]`** da fase atual.
- **Confirme comigo qual item** você vai fazer antes de começar a implementar.

## Loop SDD (pare em cada checkpoint de aprovação)
1. `superpowers:brainstorming` → escreva a spec da feature em `docs/superpowers/specs/`. Peça aprovação.
2. `superpowers:writing-plans` → plano em passos testáveis. Peça aprovação.
3. `superpowers:test-driven-development` → teste falha primeiro, depois implementação.
4. Se tocou `src/core/` ou determinismo/economia: skill `verify-determinism` e, se útil,
   o subagent `determinism-guardian`.
5. `superpowers:requesting-code-review` (ou subagent `reviewer`).
6. `superpowers:verification-before-completion` → rode `npm test` e `npm run check` de verdade.

## Ao terminar
- Marque o item como `[x]` no arquivo da fase.
- Atualize o campo "Estado atual" do `CLAUDE.md` se algo mudou.
- NÃO faça commit nem push sem eu pedir.
