---
description: Pega o próximo item não concluído do ROADMAP e executa o loop SDD completo de forma autônoma (ou o item passado como argumento).
---

Você vai trabalhar um item do roadmap do JurassicRun seguindo o processo SDD, em **modo
autônomo**: tome as decisões de processo sozinho e siga até o fim sem pedir aprovação
humana nos checkpoints. Relate o que decidiu para o usuário poder corrigir o rumo, mas
**não bloqueie** esperando confirmação.

## Contexto a carregar (obrigatório, antes de tudo)
1. Leia `CLAUDE.md` (regras inegociáveis + "Modo de operação").
2. Leia `docs/roadmap/ROADMAP.md` e `docs/WORKFLOW.md`.
3. Identifique a fase atual pelo campo "Estado atual" do `CLAUDE.md` e abra o arquivo
   `docs/roadmap/PHASE-XX-*.md` correspondente.

## Seleção do item
- Se houver um argumento (`$ARGUMENTS`), trabalhe esse item específico (ex.: `1.3`).
- Caso contrário, escolha o **primeiro item não marcado `[ ]`** da fase atual.
- **Anuncie** qual item escolheu e siga — não espere confirmação.

## Loop SDD (autônomo — sem gate humano nos checkpoints)
1. `superpowers:brainstorming` → escreva a spec da feature em `docs/superpowers/specs/`.
   Decida as escolhas técnicas/de arquitetura você mesmo, seguindo os docs e sua melhor
   recomendação. Pergunte ao usuário **apenas** quando travar numa decisão de
   produto/escopo que muda o resultado e não tem default razoável. **Não** peça revisão da
   spec — siga direto para o plano.
2. `superpowers:writing-plans` → plano em passos testáveis. **Não** peça aprovação — siga
   direto para a execução.
3. **Execução = `superpowers:subagent-driven-development` por default**: um sub-agente
   implementador fresco por task (TDD), review por task (spec + qualidade) e review final
   da branch. Trabalhe numa **branch de feature** e faça **um commit por task** (autorizado
   por default). Direita-dimensione as tasks do plano em unidades revisáveis quando fizer
   sentido.
4. Se tocou `src/core/` ou determinismo/economia: skill `verify-determinism` e, se útil,
   o subagent `determinism-guardian`.
5. `superpowers:verification-before-completion` → rode `npm test` e `npm run check` de
   verdade. Evidência antes de afirmar "pronto".

## Ao terminar
- Marque o item como `[x]` no arquivo da fase.
- Atualize o campo "Estado atual" do `CLAUDE.md` se algo mudou.
- Commits por task na branch de feature são automáticos. **Integre no `main`** sem pedir
  (pré-autorizado, um desenvolvimento por vez): com remote GitHub + `gh`, abra PR e use merge
  automático; sem remote, faça merge local no `main` (`--no-ff`) e aposente a branch de
  feature. Só ações externas/irreversíveis fora isso (deploy, publicar) exigem o usuário pedir.
</content>
