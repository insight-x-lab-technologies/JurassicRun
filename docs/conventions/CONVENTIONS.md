# Convenções — JurassicRun

## Linguagem e tipos

- TypeScript em modo estrito (`strict: true`). Evite `any`; se inevitável, comente o porquê.
- Prefira tipos/`interface` explícitos nas fronteiras entre subsistemas (core/render/app/services).
- Funções puras quando possível, especialmente em `src/core/`.

## Regras de dependência (verificadas)

- `src/core/` **não importa** de `phaser`, `preact`, `@preact/*`, nem usa DOM/`window`/
  `document`/`localStorage`/`fetch`.
- `src/core/` **não usa** `Math.random`, `Date.now`, `Date`, `performance.now`,
  `setTimeout`, `requestAnimationFrame`. Ver `docs/architecture/DETERMINISM.md`.
- Sentido das dependências: `app → services → core` e `render → core` (+ `render → services`
  para áudio/assets). Nunca o contrário.

## Estrutura e tamanho

- Um módulo, uma responsabilidade. Se um arquivo cresce demais (> ~300 linhas), provavelmente
  faz coisas demais — divida.
- Nomes de pastas em kebab-case; tipos/classes em PascalCase; funções/variáveis em camelCase;
  constantes em UPPER_SNAKE.

## i18n

- Nenhuma string visível ao usuário no código. Use chaves i18next (`t("home.play")`).
- Idioma default: inglês. Idiomas (10): en, es, pt-BR, fr, it, de, ja, zh, ko, hi.
- Ao adicionar uma chave, adicione em **todos** os locales (use a skill `add-locale`).

## Testes

- Vitest. Testes ao lado do código (`*.test.ts`) ou em `tests/`.
- `src/core/` deve ter cobertura alta — é a parte crítica e determinística.
- Determinismo: todo gerador/sim novo precisa de um teste de reprodutibilidade.
- Economia (moedas, custos, multiplicadores) precisa de testes — é dinheiro do jogo.
- TDD é o padrão: escreva o teste que falha antes da implementação (ver `docs/WORKFLOW.md`).

## Performance

- Sem alocação por frame no hot path do render (só escalares; desenho alocação-zero). Na fase
  geométrica (um único `Graphics` em modo imediato) não há sprite por entidade para reciclar, então
  o object pooling clássico só passa a valer com os PNGs/atlases da Fase 8.
- Sem trabalho síncrono pesado no game loop.
- Culling de fora-de-tela. Atlases (não imagens soltas) quando entrar a arte PNG (Fase 8).

## Git

- Commits pequenos, mensagem no imperativo, escopo claro.
- Não commitar/pushar sem o usuário pedir.
- Branch por feature quando fizer sentido; `main` é a base de PRs.

## Acessibilidade e responsividade

- UI deve funcionar em desktop, tablet e celular, retrato e paisagem.
- Áreas de toque adequadas; respeitar safe-areas em telas com notch.
