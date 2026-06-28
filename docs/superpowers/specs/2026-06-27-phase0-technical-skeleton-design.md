# Spec — Fase 0, Item 0.3: Esqueleto Técnico

> Data: 2026-06-27
> Item do roadmap: `docs/roadmap/PHASE-00-foundations.md` § 0.3
> Status: aprovado para planejamento

## Objetivo

Montar toda a infraestrutura técnica (tooling, tipos, estrutura de pastas, bootstrap
mínimo e guarda anti-não-determinismo) para que sessões autônomas implementem o jogo a
partir da Fase 1 com segurança. Ao fim deste item, `npm run dev` sobe uma página em
branco, `npm test` e `npm run check` passam, e a regra inegociável de determinismo é
enforçada por duas camadas independentes.

## Fora de escopo (itens separados da Fase 0)

- **i18n scaffold** (item 0.4): i18next é instalado como dependência, mas **não** é fiado
  no app shell aqui. Nenhuma chave/locale é criada neste item.
- **CI GitHub Actions** (item 0.5): nenhum workflow é criado aqui.
- **Render Phaser / cena de jogo** (Fase 2): Phaser é instalado, mas o bootstrap não cria
  `Phaser.Game` nem canvas.
- Qualquer lógica de jogo (`src/core/` contém apenas pastas vazias com `.gitkeep`).

## Decisões (do brainstorming)

1. **Guarda anti-não-determinismo: dupla camada** — ESLint (override em `src/core/**`)
   **e** um teste Vitest que varre os fontes de `src/core/`. Defesa em profundidade para
   uma regra inegociável; falha tanto em `npm run check` quanto em `npm test`.
2. **Aliases: fonte única via `vite-tsconfig-paths`** — `paths` declarados só no
   `tsconfig.json`; Vite e Vitest leem de lá pelo plugin. Sem duplicação.
3. **Bootstrap: só shell Preact vazio** — sem Phaser conectado nesta fase.

## Componentes

### 1. Toolchain e dependências

Gerenciador: **npm**. `package.json` com `"type": "module"`.

- **dependencies:** `phaser`, `preact`, `@preact/signals`, `i18next`.
  (`phaser` e `i18next` instalados agora porque a Fase 0 pede; ainda não usados pelo
  bootstrap.)
- **devDependencies:** `typescript`, `vite`, `vite-plugin-pwa`, `vite-tsconfig-paths`,
  `vitest`, `eslint`, `typescript-eslint`, `@types/node`.

### 2. tsconfig estrito + aliases

`tsconfig.json` com:

- `strict: true` mais `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`.
- `module`/`moduleResolution` modernos (`bundler`), `target` `ES2022`, `lib` incluindo
  `DOM` (necessário para render/app; o core é restringido por lint, não por `lib`).
- `paths` (fonte única dos aliases):
  - `@core/*` → `src/core/*`
  - `@render/*` → `src/render/*`
  - `@app/*` → `src/app/*`
  - `@services/*` → `src/services/*`
  - `@backend/*` → `src/backend/*`
  - `@assets/*` → `src/assets/*`
  - `@i18n/*` → `src/i18n/*`
- `noEmit: true` para o typecheck; o build usa Vite.

### 3. Estrutura de pastas

Conforme `docs/architecture/ARCHITECTURE.md` § "Estrutura de pastas alvo":

```
src/
  core/
    rng/  sim/  spawn/  collision/  economy/  difficulty/  weather/  seed/
  render/
  app/
  services/
  backend/
  assets/
  i18n/
tests/
  determinism/
```

Pastas sem código recebem `.gitkeep` (Git não versiona pasta vazia).

### 4. Bootstrap mínimo

- `index.html` na raiz: `<div id="app"></div>` + `<script type="module"
  src="/src/app/main.ts">`.
- `src/app/main.ts`: monta um shell Preact vazio em `#app`. Sem strings hardcoded visíveis
  ao usuário. Tela em branco. Valida que o toolchain Vite+TS+Preact carrega ponta a ponta.

### 5. Guarda anti-não-determinismo (dupla camada)

Padrões proibidos em `src/core/` (de `docs/conventions/CONVENTIONS.md` e
`docs/architecture/DETERMINISM.md`):

- Propriedades: `Math.random`, `Date.now`, `performance.now`.
- Globais: `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `window`,
  `document`, `localStorage`, `fetch`.
- Imports: `phaser`, `preact`, `@preact/*`.

**Camada A — ESLint flat config** (`eslint.config.js`):
- Base: `typescript-eslint` recomendado.
- Override `files: ['src/core/**/*.ts']` com:
  - `no-restricted-properties` para `Math.random`, `Date.now`, `performance.now`.
  - `no-restricted-globals` para `Date`, `setTimeout`, `setInterval`,
    `requestAnimationFrame`, `window`, `document`, `localStorage`, `fetch`.
  - `no-restricted-imports` (patterns) para `phaser`, `preact`, `@preact/*`.
- Roda em `npm run check`.

**Camada B — teste de guarda** (`tests/determinism/no-forbidden-apis.determinism.test.ts`):
- Lê recursivamente os `*.ts` de `src/core/` e falha se encontrar qualquer padrão
  proibido (via regex sobre o fonte, ignorando comentários de licença simples).
- Vazio no início (core só tem pastas) ⇒ passa trivialmente; protege contra futuras
  violações sem depender do ESLint.
- Roda em `npm test` e em `npm run test:determinism`.

### 6. Scripts npm

| Script | Comando |
|--------|---------|
| `dev` | `vite` |
| `build` | `tsc --noEmit && vite build` |
| `test` | `vitest run` |
| `test:determinism` | `vitest run tests/determinism` |
| `check` | `tsc --noEmit && eslint .` |

### 7. scripts/run.sh & stop.sh

Substituem os placeholders atuais:

- `run.sh`: sobe `npm run dev` em background, grava o PID em arquivo no diretório do
  projeto (ex.: `.devserver.pid`, já coberto por `.gitignore` ou adicionado a ele).
- `stop.sh`: lê o PID e encerra o processo; tolerante a "já parado".

### Config de teste

`vitest.config.ts` (ou seção em `vite.config.ts`): ambiente `node` por padrão (o core e os
guards são headless); plugin `vite-tsconfig-paths` para resolver aliases nos testes.

`vite.config.ts`: plugins `vite-tsconfig-paths` e `vite-plugin-pwa` (config PWA mínima/
placeholder; a PWA real é Fase 7 — aqui só não quebrar o build).

## Fluxo de dados

Nenhum fluxo de runtime de jogo nesta fase. O único "fluxo" é o de verificação:

```
npm run check  → tsc (tipos) + eslint (inclui guarda core, camada A)
npm test       → vitest (smoke + guarda core, camada B)
npm run dev    → vite serve → página em branco
npm run build  → tsc typecheck + vite build → dist/
```

## Tratamento de erros / casos de borda

- **Pasta `src/core/` vazia:** guarda B passa (nada a varrer). Esperado.
- **`test:determinism` sem testes além do guard:** o diretório `tests/determinism/` já
  contém o guard, então há ≥1 arquivo; não precisa de `--passWithNoTests`.
- **`vite-plugin-pwa` exigindo manifest:** usar config mínima que não falhe o build sem
  ícones reais (PWA completa fica na Fase 7).
- **`lib: DOM` no tsconfig vs. proibição no core:** o core continua livre para usar tipos
  DOM pelo `lib`, mas o ESLint (camada A) e o guard (camada B) impedem o **uso real** de
  globais de browser. Tipos compilam; runtime proibido.

## Testes

- **Smoke test** (`tests/smoke.test.ts`): um teste trivial que prova que o Vitest roda
  (satisfaz o DoD "npm test roda mesmo com 1 teste trivial").
- **Guarda anti-não-determinismo** (`tests/determinism/no-forbidden-apis.determinism.test.ts`):
  - passa com `src/core/` vazio;
  - falha quando um fonte de `src/core/` contém um padrão proibido (validado com um caso
    de fixture em string dentro do próprio teste, sem criar arquivo real proibido).
- Nenhum teste de reprodutibilidade de simulação ainda (isso é Fase 1).

## Definição de pronto

- [ ] `npm run dev` sobe a página (em branco) sem erro.
- [ ] `npm test` roda e passa (smoke + guarda).
- [ ] `npm run check` passa (tipos + lint).
- [ ] `npm run build` gera `dist/` sem erro.
- [ ] `npm run test:determinism` roda o guard e passa.
- [ ] Regra anti-não-determinismo ativa nas duas camadas (verificada com um caso negativo
      temporário durante o desenvolvimento, removido antes de fechar).
- [ ] `scripts/run.sh` e `scripts/stop.sh` funcionam para o dev server.
- [ ] Item 0.3 marcado `[x]` no arquivo da fase; `CLAUDE.md` "Estado atual" atualizado.
</content>
</invoke>
