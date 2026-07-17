# 7.4 — Deploy itch.io (design/spec)

## Objetivo

Empacotar o build estático da PWA para publicação no itch.io como jogo HTML5, com
automação opcional de push e documentação do passo manual. Fecha o item 7.4 da Fase 7.

**Limite de escopo:** publicar de fato no itch.io é uma ação externa que exige a conta e as
credenciais do usuário (página do jogo criada + API key do butler). Este item entrega a
tooling, a automação (inerte sem o secret) e as instruções; o publish final é passo manual
do usuário, não automatizável pelo agente.

## Regras inegociáveis afetadas

- **Determinismo:** `src/core/` **NÃO é tocado** ⇒ determinismo 67 inalterado. Item só de
  build/infra.
- **i18n:** sem strings visíveis ao usuário novas (metadados de infra/CI não passam pelo
  scanner AST).
- **Performance / arte:** não afeta o hot path nem o manifesto de assets.

## Contexto reaproveitado

- `src/pwa/base.ts` (`resolveBasePath`) já suporta base relativa: `BASE_PATH=./` é retornado
  como veio (passthrough), o caminho legítimo do Vite para hospedagem em path arbitrário como
  o itch.io. Já testado em `src/pwa/base.test.ts` (item 7.3). **Nada novo em `base.ts`.**
- `vite.config.ts` já usa `base: resolveBasePath(process.env)`.
- Precedente de script de build node puro: `scripts/build-edge.mjs`, `scripts/gen-icons.mjs`.
- `zip` do sistema disponível (`/usr/bin/zip`).

## Componentes

### 1. Empacotamento local — `scripts/package-itch.mjs`

Script node (molde `build-edge.mjs`) que:

1. Roda `vite build` (via `tsc --noEmit && vite build`, i.e. `npm run build`) com o env
   `BASE_PATH=./` herdado no processo filho ⇒ assets referenciados relativamente.
2. Zipa o **conteúdo** de `dist/` (não a pasta `dist/` em si) em `jurassicrun-itch.zip` na
   raiz do repo, de forma que `index.html` fique na **raiz do zip** — requisito do itch.io
   HTML5 (o player procura `index.html` no topo do arquivo enviado).
3. Usa o `zip` do sistema via `child_process` (`cd dist && zip -r -X ../jurassicrun-itch.zip
   .`). `-X` remove metadados extra; determinístico o suficiente para o propósito.

npm script novo: `"package:itch": "node scripts/package-itch.mjs"`.

O artefato `jurassicrun-itch.zip` é **ignorado no git** (`.gitignore`) — é saída de build,
não fonte.

### 2. CI opcional gated — `.github/workflows/itch.yml`

Workflow separado do `deploy.yml` (Pages) e do `ci.yml`:

- Disparo: push de tag `v*` **e** `workflow_dispatch` (publicação deliberada, não a cada
  push em `main` — evita queimar cota do itch e publicar builds intermediários).
- Steps: checkout, setup-node 22, `npm ci`, `npm run build` com `BASE_PATH=./`, instalar
  butler, `butler push dist "$ITCH_TARGET:html5"`.
- **Gate offline-first:** o job só executa se `secrets.BUTLER_API_KEY` estiver presente
  (`if: ${{ secrets.BUTLER_API_KEY != '' }}` no job) ⇒ sem o secret o workflow é inerte,
  como os serviços online do projeto sem `.env`. `ITCH_TARGET` (ex.: `usuario/jurassicrun`)
  via repository variable `vars.ITCH_TARGET`.
- butler faz push da pasta `dist` diretamente (não precisa de zip) e cuida de
  versionamento/canal (`:html5`).

### 3. Docs — `docs/deploy/README.md`

Estende com uma seção **itch.io** cobrindo:

- Criar a página do jogo no itch.io: Kind = HTML, marcar "This file will be played in the
  browser", definir dimensões da viewport (recomendado: fullscreen ou 640×360 mantendo 16:9
  do campo lógico 320×180).
- **Caminho manual:** `npm run package:itch` → subir `jurassicrun-itch.zip` no dashboard.
- **Caminho automatizado (butler):** gerar API key no itch, adicionar `BUTLER_API_KEY`
  (secret) e `ITCH_TARGET` (variable) no repo, publicar via tag `v*` ou `workflow_dispatch`.
- **Limitação PWA conhecida:** o itch.io embute o jogo em iframe sandbox de subdomínio
  aleatório (`html-classic.itch.zone`); o service worker pode não registrar. O jogo funciona
  normalmente — o precache offline é um bônus da instalação PWA (GitHub Pages), não requisito
  para rodar no itch. Base relativa (`./`) garante que os assets resolvem sob qualquer path.

## Fora de escopo (YAGNI / adiado)

- Publicação real no itch.io (ação do usuário; credenciais que o agente não tem).
- Empacotar como app de loja / TWA / Capacitor (item 7.5, futuro).
- Comprimir/otimizar o zip além do padrão do `zip`.
- Testar SW dentro do iframe do itch (ambiente externo; documentado como limitação).

## Verificação (evidência antes de "pronto")

Como 7.3 (verificação por build real, não por unit test de um script de empacotamento):

1. `npm run package:itch` produz `jurassicrun-itch.zip`.
2. `unzip -l jurassicrun-itch.zip` mostra `index.html` na **raiz** (sem prefixo `dist/`).
3. `dist/index.html` referencia assets por caminho **relativo** (`./assets/…` ou `assets/…`,
   não `/JurassicRun/…` nem `/assets/…`).
4. `npm test` e `npm run check` verdes; determinismo 67 inalterado (core intocado).

## Decisões de produto registradas

- **Publish manual + CI gated, ambos documentados** (não só um): o manual funciona já; o
  butler é bônus quando o usuário adicionar o secret — mesmo padrão offline-first dos serviços
  online. Não bloqueia esperando credenciais.
- **Disparo por tag/dispatch, não por push em main:** publicar no itch é deliberado; Pages
  (7.3) continua contínuo por push. Separação evita publicar builds intermediários.
- **Zip do conteúdo de dist, não da pasta:** exigência do player HTML5 do itch (`index.html`
  no topo).
