# Esqueleto Técnico (Fase 0, Item 0.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar o tooling, tipos, estrutura de pastas, bootstrap mínimo e a guarda anti-não-determinismo (dupla camada) do JurassicRun, deixando `npm run dev/test/check/build` funcionando.

**Architecture:** Projeto Vite + TypeScript estrito com aliases de path como fonte única (`tsconfig` → Vite/Vitest via `vite-tsconfig-paths`). Bootstrap monta um shell Preact vazio. A regra inegociável de determinismo é enforçada por ESLint (override em `src/core/**`) **e** por um teste Vitest que varre os fontes de `src/core/`.

**Tech Stack:** npm, TypeScript, Vite, vite-plugin-pwa, vite-tsconfig-paths, Vitest, Preact, @preact/signals, Phaser (instalado, não fiado), i18next (instalado, não fiado), ESLint + typescript-eslint.

## Global Constraints

- **Sem commit/push sem o usuário pedir.** Onde o fluxo TDD pediria "commit", este plano usa um **checkpoint de verificação**. O commit acontece só quando o usuário solicitar, ao final.
- **Determinismo:** `src/core/` nunca pode usar `Math.random`, `Date.now`, `Date`/`new Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `window`, `document`, `localStorage`, `fetch`, nem importar `phaser`/`preact`/`@preact/*`. (`docs/architecture/DETERMINISM.md`, `docs/conventions/CONVENTIONS.md`.)
- **TypeScript estrito:** `strict: true` + `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`. Sem `any` sem justificativa.
- **i18n e CI fora de escopo** deste item (são 0.4 e 0.5). Phaser instalado mas não conectado ao bootstrap.
- **Aliases:** `@core @render @app @services @backend @assets @i18n` → `src/*`, declarados só no `tsconfig.json`.
- `package.json` com `"type": "module"`.

---

### Task 1: Inicializar package.json e instalar dependências

**Files:**
- Create: `package.json` (via `npm init` + edição)

**Interfaces:**
- Produces: `node_modules/` com as deps; campo `"type": "module"`; scripts npm placeholders que serão validados nas tasks seguintes.

- [ ] **Step 1: Inicializar o package.json**

Run:
```bash
cd /mnt/userdata/Projetos/Pessoal/JurassicRun
npm init -y
```

- [ ] **Step 2: Instalar dependencies de runtime**

Run:
```bash
npm install phaser preact @preact/signals i18next
```
Expected: instala sem erro; aparecem em `dependencies`.

- [ ] **Step 3: Instalar devDependencies**

Run:
```bash
npm install -D typescript vite vite-plugin-pwa vite-tsconfig-paths vitest eslint typescript-eslint @types/node
```
Expected: instala sem erro; aparecem em `devDependencies`.

- [ ] **Step 4: Editar package.json (type module + scripts)**

Garantir estes campos no `package.json` (mesclar com o gerado):
```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:determinism": "vitest run tests/determinism",
    "check": "tsc --noEmit && eslint ."
  }
}
```

- [ ] **Step 5: Verificação**

Run:
```bash
node -e "const p=require('./package.json'); console.log(p.type, Object.keys(p.scripts).join(','))"
```
Expected: `module dev,build,test,test:determinism,check`

---

### Task 2: tsconfig estrito com aliases

**Files:**
- Create: `tsconfig.json`

**Interfaces:**
- Produces: paths `@core/* @render/* @app/* @services/* @backend/* @assets/* @i18n/*` → `src/*`; `tsc --noEmit` válido. Os arquivos de config (`vite.config.ts`, `vitest.config.ts`) entram no `include` do mesmo tsconfig.

- [ ] **Step 1: Criar tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["vite/client", "vitest/globals", "node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@render/*": ["src/render/*"],
      "@app/*": ["src/app/*"],
      "@services/*": ["src/services/*"],
      "@backend/*": ["src/backend/*"],
      "@assets/*": ["src/assets/*"],
      "@i18n/*": ["src/i18n/*"]
    }
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 2: Verificação (tsc roda sem erro)**

Run:
```bash
npx tsc --noEmit
```
Expected: sem saída de erro (ainda não há `.ts`, então passa). Se reclamar de "No inputs were found", criar a estrutura de pastas (Task 3) primeiro e repetir — ou ignorar até Task 3, onde isto é re-verificado.

---

### Task 3: Estrutura de pastas + .gitkeep

**Files:**
- Create: `src/core/{rng,sim,spawn,collision,economy,difficulty,weather,seed}/.gitkeep`
- Create: `src/{render,app,services,backend,assets,i18n}/.gitkeep`
- Create: `tests/determinism/.gitkeep`

**Interfaces:**
- Produces: a árvore `src/` e `tests/` conforme `ARCHITECTURE.md`.

- [ ] **Step 1: Criar as pastas com .gitkeep**

Run:
```bash
cd /mnt/userdata/Projetos/Pessoal/JurassicRun
for d in src/core/rng src/core/sim src/core/spawn src/core/collision \
         src/core/economy src/core/difficulty src/core/weather src/core/seed \
         src/render src/app src/services src/backend src/assets src/i18n \
         tests/determinism; do
  mkdir -p "$d" && touch "$d/.gitkeep"
done
```

- [ ] **Step 2: Verificação**

Run:
```bash
find src tests -type d | sort
```
Expected: lista todas as pastas acima.

---

### Task 4: Config Vite + Vitest (aliases via plugin)

**Files:**
- Create: `vite.config.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: `paths` do `tsconfig.json` (Task 2).
- Produces: resolução de aliases no dev/build e nos testes; ambiente de teste `node`.

- [ ] **Step 1: Criar vite.config.ts**

```ts
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // PWA real fica na Fase 7; aqui só registra sem exigir ícones.
    VitePWA({ disable: true }),
  ],
});
```

- [ ] **Step 2: Criar vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Verificação (configs carregam)**

Run:
```bash
npx vitest run --passWithNoTests
```
Expected: Vitest inicia, "No test files found" tolerado por `--passWithNoTests`, exit 0.

---

### Task 5: Smoke test (prova que o Vitest roda)

**Files:**
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: garante DoD "npm test roda mesmo com 1 teste trivial".

- [ ] **Step 1: Escrever o teste (deve passar imediatamente — é o smoke)**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('o toolchain de teste está vivo', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver passar**

Run:
```bash
npx vitest run tests/smoke.test.ts
```
Expected: 1 passed.

- [ ] **Step 3: Checkpoint de verificação** (sem commit — ver Global Constraints)

Run:
```bash
npm test
```
Expected: 1 passed.

---

### Task 6: Guarda anti-não-determinismo — camada B (teste Vitest)

**Files:**
- Create: `tests/determinism/no-forbidden-apis.determinism.test.ts`

**Interfaces:**
- Produces: `findForbiddenApis(source: string): string[]` (local ao teste) e dois casos: (a) detecta violações numa fixture string; (b) `src/core/` real está limpo.

- [ ] **Step 1: Escrever o teste primeiro (TDD)**

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_DIR = fileURLToPath(new URL('../../src/core', import.meta.url));

const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /\bMath\s*\.\s*random\b/, label: 'Math.random' },
  { pattern: /\bDate\s*\.\s*now\b/, label: 'Date.now' },
  { pattern: /\bperformance\s*\.\s*now\b/, label: 'performance.now' },
  { pattern: /\bnew\s+Date\b/, label: 'new Date' },
  { pattern: /\bsetTimeout\s*\(/, label: 'setTimeout' },
  { pattern: /\bsetInterval\s*\(/, label: 'setInterval' },
  { pattern: /\brequestAnimationFrame\s*\(/, label: 'requestAnimationFrame' },
  { pattern: /from\s+['"]phaser['"]/, label: "import 'phaser'" },
  { pattern: /from\s+['"]preact/, label: "import 'preact'" },
  { pattern: /from\s+['"]@preact\//, label: "import '@preact/*'" },
];

function findForbiddenApis(source: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map((f) => f.label);
}

function collectTsFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(collectTsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('guarda de determinismo do core (camada B)', () => {
  it('o detector pega APIs proibidas numa fixture', () => {
    const bad = `const r = Math.random(); const t = Date.now();`;
    expect(findForbiddenApis(bad).sort()).toEqual(['Date.now', 'Math.random']);
  });

  it('o detector não acusa código limpo', () => {
    const good = `export function step(dt: number) { return dt * 2; }`;
    expect(findForbiddenApis(good)).toEqual([]);
  });

  it('src/core/ não contém nenhuma API proibida', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(CORE_DIR)) {
      const hits = findForbiddenApis(readFileSync(file, 'utf8'));
      if (hits.length) offenders.push(`${file}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar (passa: core vazio + fixtures válidas)**

Run:
```bash
npx vitest run tests/determinism/no-forbidden-apis.determinism.test.ts
```
Expected: 3 passed.

- [ ] **Step 3: Provar que a guarda morde (caso negativo temporário)**

Run:
```bash
printf 'export const x = Math.random();\n' > src/core/_tmp_violation.ts
npx vitest run tests/determinism/no-forbidden-apis.determinism.test.ts
```
Expected: o teste "src/core/ não contém nenhuma API proibida" FALHA apontando `_tmp_violation.ts: Math.random`.

- [ ] **Step 4: Remover o arquivo de violação e reconfirmar verde**

Run:
```bash
rm src/core/_tmp_violation.ts
npx vitest run tests/determinism
```
Expected: tudo passa.

---

### Task 7: Guarda anti-não-determinismo — camada A (ESLint flat config)

**Files:**
- Create: `eslint.config.js`

**Interfaces:**
- Consumes: nada.
- Produces: `eslint .` falha se `src/core/**` usar API proibida; `npm run check` integra isso.

- [ ] **Step 1: Criar eslint.config.js**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'dev-dist/'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use o serviço de RNG com seed (determinismo).' },
        { object: 'Date', property: 'now', message: 'Use o relógio da simulação (determinismo).' },
        { object: 'performance', property: 'now', message: 'Use o relógio da simulação (determinismo).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'setTimeout', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'setInterval', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'requestAnimationFrame', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'window', message: 'src/core/ é headless.' },
        { name: 'document', message: 'src/core/ é headless.' },
        { name: 'localStorage', message: 'src/core/ é headless.' },
        { name: 'fetch', message: 'src/core/ é headless.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'preact', 'preact/*', '@preact/*'] },
      ],
    },
  },
);
```

- [ ] **Step 2: Verificar que o lint passa no core limpo**

Run:
```bash
npx eslint .
```
Expected: sem erros (core vazio).

- [ ] **Step 3: Provar que o ESLint morde (caso negativo temporário)**

Run:
```bash
printf 'export const x = Math.random();\n' > src/core/_tmp_violation.ts
npx eslint src/core/_tmp_violation.ts
```
Expected: erro `no-restricted-properties` com a mensagem do RNG.

- [ ] **Step 4: Remover violação e reconfirmar**

Run:
```bash
rm src/core/_tmp_violation.ts
npx eslint .
```
Expected: sem erros.

---

### Task 8: index.html + bootstrap Preact vazio

**Files:**
- Create: `index.html`
- Create: `src/app/main.ts`

**Interfaces:**
- Consumes: Preact (runtime).
- Produces: app montado em `#app`, tela em branco; valida Vite+TS+Preact ponta a ponta.

- [ ] **Step 1: Criar index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>JurassicRun</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/app/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Criar src/app/main.ts (shell vazio, sem strings hardcoded)**

```ts
import { render, h } from 'preact';

const root = document.getElementById('app');
if (root) {
  // Shell vazio: a árvore de telas entra na Fase 4. Sem texto hardcoded (i18n na Fase 0.4).
  render(h('div', { id: 'app-shell' }), root);
}
```

- [ ] **Step 3: Verificar typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 4: Verificar build**

Run:
```bash
npm run build
```
Expected: gera `dist/` sem erro.

---

### Task 9: scripts/run.sh e stop.sh para o dev server

**Files:**
- Modify: `scripts/run.sh`
- Modify: `scripts/stop.sh`
- Modify: `.gitignore` (adicionar `.devserver.pid` e `dev-dist/`)

**Interfaces:**
- Produces: `run.sh` sobe o Vite em background gravando PID; `stop.sh` encerra pelo PID.

- [ ] **Step 1: Reescrever scripts/run.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dev server já rodando (PID $(cat "$PID_FILE"))."
  exit 0
fi
npm run dev >/tmp/jurassicrun-dev.log 2>&1 &
echo $! > "$PID_FILE"
echo "Dev server iniciado (PID $(cat "$PID_FILE")). Log: /tmp/jurassicrun-dev.log"
```

- [ ] **Step 2: Reescrever scripts/stop.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "Nenhum dev server registrado."
  exit 0
fi
PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Dev server (PID $PID) encerrado."
else
  echo "Dev server (PID $PID) já estava parado."
fi
rm -f "$PID_FILE"
```

- [ ] **Step 3: Adicionar entradas ao .gitignore**

Acrescentar ao `.gitignore`:
```
.devserver.pid
dev-dist/
```

- [ ] **Step 4: Verificar que sobe e para**

Run:
```bash
bash scripts/run.sh && sleep 2 && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173/ ; bash scripts/stop.sh
```
Expected: imprime `200` (página servida) e depois "Dev server ... encerrado."

---

### Task 10: Verificação final do DoD (sem commit)

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Suite completa**

Run:
```bash
npm run check && npm test && npm run test:determinism && npm run build
```
Expected: tudo verde — typecheck, lint, testes, guarda de determinismo, build.

- [ ] **Step 2: Dev server sobe**

Run:
```bash
bash scripts/run.sh && sleep 2 && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173/ ; bash scripts/stop.sh
```
Expected: `200`.

- [ ] **Step 3: Atualizar docs de estado**

- Marcar todos os checkboxes do item 0.3 em `docs/roadmap/PHASE-00-foundations.md` como `[x]`.
- Atualizar o campo "Estado atual" em `CLAUDE.md` (0.3 concluído; preencher "Como rodar" com os scripts agora reais).

- [ ] **Step 4: Checkpoint** — apresentar evidência ao usuário; commit **só** se o usuário pedir.

---

## Notas de execução

- Onde um fluxo TDD normal commitaria, aqui paramos num checkpoint de verificação (regra do projeto: sem commit sem pedido).
- As Tasks 6 e 7 incluem um **caso negativo temporário** que prova que cada camada da guarda realmente falha — o arquivo de violação é sempre removido no passo seguinte.
- `localhost:5173` é a porta default do Vite; se ocupada, o Vite escolhe outra — ajustar a verificação conforme o log.
</content>
