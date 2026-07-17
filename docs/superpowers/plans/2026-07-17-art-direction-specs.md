# Direção de Arte AAA — Specs & Migração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir a documentação de direção de arte (Style Bible), o catálogo de asset-specs prontas-para-IA dos assets novos que os concepts introduzem, o realinhamento dos 24 specs existentes, o registro atualizado, e uma guarda de paridade registro↔spec — sem tocar código de produção.

**Architecture:** Entrega 100% de documentação + 1 teste-guarda. Um Style Bible (`docs/assets/ART-DIRECTION.md`) é a fonte única do look; cada asset-spec (formato existente da skill `create-asset-spec`) referencia o bible e traz um prompt de IA copiável com dimensão exata. Uma guarda Vitest garante que todo id no `asset-registry.md` tem arquivo de spec e que todo spec novo tem o bloco de prompt de IA.

**Tech Stack:** Markdown (docs), Vitest + Node `fs` (guarda de paridade), TypeScript (o teste). As imagens conceituais de referência ficam em `ref/`.

## Global Constraints

- **Nome do jogo:** `JurassicRun` (NÃO "Ptero Ascent"). Logo é ornamentado mas o wordmark diz "JurassicRun".
- **Nenhum arquivo em `src/` ou `src/core/` é modificado.** Determinismo 67 intacto por construção.
- **Dois tiers de arte:** Tier 1 (UI/menus + fundos de tela) = AAA pintado full-res no DOM; Tier 2 (entidades in-game) = sprite legível a 320×180 no canvas. Fixado pela REGRA de campo lógico 320×180.
- **REGRA 2 (arte desacoplada):** a arte NUNCA define hitbox; dimensões de spec são cosméticas. Hitbox lógica vive no core.
- **Formato de asset-spec:** seguir o existente (Identidade / Especificação técnica / Direção de arte / **Prompt para geração por IA** / Checklist de aceite). Ver `docs/assets/specs/powerup.shield.md` e `dino.starter.md` como moldes.
- **Paleta mestra (do Style Bible):** slate `#0e1116`→`#1a1f2b`; ouro `#c9a227`/`#f2d878`/`#8a6d1b`; azul-glow CTA `#2f6fe0`→`#5aa0ff` glow `#bcd8ff`; texto `#eef2f7`/`#9aa6b6`; âmbar `#ffcf5c`.
- **Spec de referência:** `docs/superpowers/specs/2026-07-17-art-direction-migration-design.md`.

---

### Task 1: Style Bible + commit dos concepts de referência

**Files:**
- Create: `docs/assets/ART-DIRECTION.md`
- Add: `ref/*.png` (6 imagens conceituais — fonte canônica do look)

**Interfaces:**
- Consumes: nada.
- Produces: `docs/assets/ART-DIRECTION.md` — a fonte única de estilo que todos os specs posteriores referenciam por caminho relativo. Seções nomeadas: `## Paleta mestra`, `## Materiais`, `## Tipografia`, `## Iconografia`, `## Dois tiers de arte`, `## Desacople (REGRA 2)`, `## Referências (ref/)`.

- [ ] **Step 1: Escrever o Style Bible**

Criar `docs/assets/ART-DIRECTION.md` com:
- `## Paleta mestra` — a tabela de cores das Global Constraints, com uso de cada cor (fundo, moldura, CTA, texto, recorde).
- `## Materiais` — vidro escuro semi-translúcido (painel), metal dourado ornamentado (moldura/divisor), vidro azul energizado (botão CTA), pedra/folhagem pintada (fundo).
- `## Tipografia` — display serif ornamentada (headers/logo, ex.: Cinzel/Trajan) + sans limpa (corpo, fica no CSS). Nota: só logo/headers estilizados viram PNG; fontes de UI são CSS.
- `## Iconografia` — ícones de linha/preenchimento dourado, estilo emblema heráldico, sobre vazado transparente.
- `## Dois tiers de arte` — Tier 1 (UI/fundos, full-res DOM, AAA pintado) vs Tier 2 (entidades in-game, legível a 320×180). Listar o que cai em cada tier.
- `## Desacople (REGRA 2)` — a arte não define hitbox; dimensões são cosméticas.
- `## Referências (ref/)` — listar as 6 imagens (`ref/ref_Home.png`, `ref_GamePlay.png`, `ref_Ninho.png`, `ref_LeaderBoard.png`, `ref_Expansões.png`, `ref_GameOver.png`) e o que cada uma exemplifica. **Nota explícita:** `ref_GamePlay.png` mostra mecânicas NÃO implementadas (habilidades/minimapa/objetivos) — usar só para o *look*, não para mecânica (ver spec de migração).

- [ ] **Step 2: Verificar o bible**

Run: `test -f docs/assets/ART-DIRECTION.md && grep -c '^## ' docs/assets/ART-DIRECTION.md`
Expected: arquivo existe; ≥7 (as 7 seções `##`).

- [ ] **Step 3: Commit**

```bash
git add docs/assets/ART-DIRECTION.md ref/
git commit -m "docs(8.1): Style Bible da direção de arte + concepts de referência"
```

---

### Task 2: Specs de UI chrome — logo, painel, botões, header, statchip

**Files:**
- Create: `docs/assets/specs/logo.app.md`
- Create: `docs/assets/specs/ui.panel.frame.md`
- Create: `docs/assets/specs/ui.button.md` (variantes primary/secondary + estados)
- Create: `docs/assets/specs/ui.header.emblem.md`
- Create: `docs/assets/specs/ui.statchip.frame.md`

**Interfaces:**
- Consumes: `docs/assets/ART-DIRECTION.md` (Task 1) — referenciar por caminho relativo em cada seção "Direção de arte".
- Produces: 5 arquivos de spec no formato padrão. Cada um contém a heading exata `## Prompt para geração por IA` e o campo `- **id:**`.

- [ ] **Step 1: Escrever `logo.app.md`**

Formato padrão. id `logo.app`, categoria "UI / marca". Dimensão alvo: ~1024×384 @1x (+@2x), PNG transparente, atlas `ui`. Direção de arte: wordmark "JurassicRun" em display serif ornamentada dourada + emblema pterodáctilo heráldico acima/entre as palavras (estilo `ref_Home.png`/`ref_LeaderBoard.png`), referenciando o Style Bible. Prompt IA copiável: `"Ornate golden game logo wordmark reading 'JurassicRun', heraldic pterodactyl crest emblem above the text, engraved metallic gold with dark outline, fantasy AAA game title style, transparent background, no photographic background, centered."` Checklist: fundo transparente, texto legível "JurassicRun", coerente com Style Bible.

- [ ] **Step 2: Escrever `ui.panel.frame.md`**

id `ui.panel.frame`, categoria "UI / chrome". Dimensão base ~512×512 @1x (+@2x), PNG transparente. **9-slice:** documentar insets de canto (ex.: 48px em cada borda são a ornamentação fixa; o centro estica). Atlas `ui`. Direção: painel de vidro escuro semi-translúcido com moldura dourada ornamentada nos cantos (estilo dos painéis dos concepts). Prompt IA: `"Dark translucent glass UI panel with ornate golden filigree border and decorated corners, fantasy AAA game menu frame, 9-slice friendly (plain stretchable center, detailed corners), transparent background, no text."` Checklist inclui: 9-slice válido (cantos não esticam), transparência.

- [ ] **Step 3: Escrever `ui.button.md`**

id base `ui.button` cobrindo `ui.button.primary` e `ui.button.secondary` numa tabela de variantes + estados (normal/pressed/disabled descritos). Dimensão ~256×72 @1x (+@2x), 9-slice horizontal (insets laterais fixos). PNG transparente, atlas `ui`. Direção: primary = vidro azul-glow gradiente (`#2f6fe0`→`#5aa0ff`, brilho `#bcd8ff`); secondary = vidro escuro com borda dourada. Prompt IA (um por variante, copiável). Checklist: 9-slice horizontal, estados descritos.

- [ ] **Step 4: Escrever `ui.header.emblem.md`**

id `ui.header.emblem`. Divisor/crista de pterodáctilo dourado acima dos títulos de tela (o ornamento simétrico visto em todos os headers dos concepts). ~640×160 @1x (+@2x), PNG transparente, atlas `ui`. Prompt IA copiável. Checklist.

- [ ] **Step 5: Escrever `ui.statchip.frame.md`**

id `ui.statchip.frame`. Moldura pequena dos stat-chips (moedas/troféus/nível) do topo. ~192×64 @1x (+@2x), 9-slice horizontal, PNG transparente, atlas `ui`. Prompt IA copiável. Checklist.

- [ ] **Step 6: Verificar as 5 specs**

Run: `for f in logo.app ui.panel.frame ui.button ui.header.emblem ui.statchip.frame; do grep -q '## Prompt para geração por IA' docs/assets/specs/$f.md && grep -q '**id:**' docs/assets/specs/$f.md && echo "$f ok" || echo "$f FALTA"; done`
Expected: 5 linhas "ok".

- [ ] **Step 7: Commit**

```bash
git add docs/assets/specs/logo.app.md docs/assets/specs/ui.panel.frame.md docs/assets/specs/ui.button.md docs/assets/specs/ui.header.emblem.md docs/assets/specs/ui.statchip.frame.md
git commit -m "docs(8.1): asset-specs de UI chrome (logo, painel, botões, header, statchip)"
```

---

### Task 3: Specs de medalhas, barra de nav e conjunto de ícones

**Files:**
- Create: `docs/assets/specs/ui.medals.md` (gold/silver/bronze)
- Create: `docs/assets/specs/ui.nav.bar.md`
- Create: `docs/assets/specs/ui.icons.md` (conjunto de 10 ícones de nav)

**Interfaces:**
- Consumes: `docs/assets/ART-DIRECTION.md` (Task 1).
- Produces: 3 arquivos de spec. Cada um com heading `## Prompt para geração por IA` e campo `- **id:**`. `ui.icons.md` enumera os ids concretos: `icon.daily`, `icon.weekly`, `icon.nest`, `icon.shop`, `icon.expansions`, `icon.leaderboard`, `icon.settings`, `icon.share`, `icon.donate`, `icon.back`.

- [ ] **Step 1: Escrever `ui.medals.md`**

id `ui.medals` cobrindo `ui.medal.gold`/`silver`/`bronze` (tabela de variantes). Medalha rankeada = láurea + número (1/2/3), diferindo pela cor do metal (ouro `#c9a227`, prata `#c8d0d8`, bronze `#b06a2c`). ~96×96 @1x (+@2x), PNG transparente, atlas `ui`. Prompt IA por variante, copiável. Checklist.

- [ ] **Step 2: Escrever `ui.nav.bar.md`**

id `ui.nav.bar`. Fundo da barra de navegação inferior (vidro escuro + borda dourada superior). Faixa horizontal ~1280×96 @1x (+@2x), 9-slice horizontal, PNG transparente (ou opaco com alpha nas bordas). Atlas `ui`. Prompt IA copiável. Checklist.

- [ ] **Step 3: Escrever `ui.icons.md`**

id base `ui.icons`. Conjunto de 10 ícones de nav num único spec com **tabela** (id → glyph descrito): `icon.daily` (sol), `icon.weekly` (calendário), `icon.nest` (láurea/ninho), `icon.shop` (cesta), `icon.expansions` (folha/mundo), `icon.leaderboard` (pódio), `icon.settings` (engrenagem), `icon.share` (compartilhar), `icon.donate` (coração/mão), `icon.back` (seta). Todos: 64×64 @1x (+@2x), PNG transparente, estilo linha/preenchimento dourado heráldico (Style Bible), atlas `ui-icons`. Prompt IA: um template compartilhado + a coluna glyph por ícone (copiável trocando o glyph). Checklist: grade uniforme, transparência, coerência de estilo entre os 10.

- [ ] **Step 4: Verificar as 3 specs**

Run: `for f in ui.medals ui.nav.bar ui.icons; do grep -q '## Prompt para geração por IA' docs/assets/specs/$f.md && grep -q '**id:**' docs/assets/specs/$f.md && echo "$f ok" || echo "$f FALTA"; done`
Expected: 3 linhas "ok".

- [ ] **Step 5: Commit**

```bash
git add docs/assets/specs/ui.medals.md docs/assets/specs/ui.nav.bar.md docs/assets/specs/ui.icons.md
git commit -m "docs(8.1): asset-specs de medalhas, barra de nav e conjunto de ícones"
```

---

### Task 4: Specs de fundos de tela e capas de expansão

**Files:**
- Create: `docs/assets/specs/bg.screen.md` (classic/volcano/glacier)
- Create: `docs/assets/specs/expansion.covers.md` (classic/volcano/glacier)

**Interfaces:**
- Consumes: `docs/assets/ART-DIRECTION.md` (Task 1); relação com o seam `activeExpansion` de 4.6 (`src/services/entitlements`) documentada.
- Produces: 2 arquivos de spec. `bg.screen.md` enumera ids `bg.screen.classic`/`volcano`/`glacier`; `expansion.covers.md` enumera `expansion.classic`/`volcano`/`glacier`. Cada um com heading `## Prompt para geração por IA` e `- **id:**`.

- [ ] **Step 1: Escrever `bg.screen.md`**

id base `bg.screen` cobrindo 3 variantes (tabela). Fundo pintado full-screen dos menus, trocado pela **expansão ativa** (seam `activeExpansion`, 4.6): `classic` (jungle canyon + vulcão distante, estilo `ref_Home.png`), `volcano` (terras ardentes, `ref_Expansões.png` card Vulcão), `glacier` (gelo + aurora, card Geleira). Dimensão ~1920×1080 @1x (paisagem; UI escala por cima), PNG opaco. Atlas: nenhum (carregado como imagem de fundo cheia, não atlas). Direção: pintado AAA, **contraste baixo o suficiente para painéis legíveis por cima** (nota crítica). Prompt IA por variante, copiável. Checklist: legibilidade de overlay, coerência entre as 3.

- [ ] **Step 2: Escrever `expansion.covers.md`**

id base `expansion.covers` cobrindo `expansion.classic`/`volcano`/`glacier` (tabela). Arte de card retangular da tela de Expansões (~512×640 @1x retrato, opaco). Podem ser crops verticais dos `bg.screen.*`; spec própria por clareza. Prompt IA por variante. Checklist.

- [ ] **Step 3: Verificar as 2 specs**

Run: `for f in bg.screen expansion.covers; do grep -q '## Prompt para geração por IA' docs/assets/specs/$f.md && grep -q '**id:**' docs/assets/specs/$f.md && echo "$f ok" || echo "$f FALTA"; done`
Expected: 2 linhas "ok".

- [ ] **Step 4: Commit**

```bash
git add docs/assets/specs/bg.screen.md docs/assets/specs/expansion.covers.md
git commit -m "docs(8.1): asset-specs de fundos de tela e capas de expansão"
```

---

### Task 5: Realinhar os 24 specs existentes ao Style Bible

**Files:**
- Modify: `docs/assets/specs/dino.default.md`, `dino.starter.md`, `dino.lodestone.md`, `dino.goldbeak.md`, `dino.midas.md`, `dino.nine-lives.md`, `dino.aegis.md`, `dino.prospector.md`, `dino.harvester.md`, `dino.phoenix.md`, `dino.guardian.md`, `obstacle.tree.md`, `obstacle.vine.md`, `obstacle.boulder.md`, `obstacle.stalactite.md`, `bird.coin.md`, `powerup.shield.md`, `powerup.extraLife.md`, `powerup.magnet.md`, `powerup.doubleCoin.md`, `powerup.slowMo.md`, `bg.layer.far.md`, `bg.layer.mid.md`, `bg.layer.near.md`, `pwa-icon.md`

**Interfaces:**
- Consumes: `docs/assets/ART-DIRECTION.md` (Task 1).
- Produces: cada spec ganha, na seção `## Direção de arte`, uma linha de referência ao Style Bible. Sem mudar dimensões, hitbox ou prompts técnicos.

- [ ] **Step 1: Adicionar referência ao Style Bible em cada spec existente**

Em cada um dos 25 arquivos acima (24 do registro + `dino.default` exemplo; ajuste a lista ao que existir de fato em `docs/assets/specs/`), inserir na seção `## Direção de arte` uma linha:
`> **Coerência de mundo:** seguir \`docs/assets/ART-DIRECTION.md\` (Style Bible). Este é um asset **Tier 2** (in-game): manter legibilidade a 320×180, silhueta forte, alinhar a paleta ao mundo pintado sem detalhe fino que suma a tamanho pequeno.`
(Para `bg.layer.*` a linha nota Tier 1.5 — fundo de jogo, silhueta que aceita tint de daynight; para `pwa-icon` nota que é ícone de OS, não in-game.)

- [ ] **Step 2: Verificar cobertura**

Run: `grep -L 'ART-DIRECTION.md' docs/assets/specs/dino.*.md docs/assets/specs/obstacle.*.md docs/assets/specs/bird.coin.md docs/assets/specs/powerup.*.md docs/assets/specs/bg.layer.*.md docs/assets/specs/pwa-icon.md`
Expected: nenhuma saída (todos referenciam o bible).

- [ ] **Step 3: Commit**

```bash
git add docs/assets/specs/
git commit -m "docs(8.1): realinha os 24 asset-specs existentes ao Style Bible"
```

---

### Task 6: Atualizar o registro de assets

**Files:**
- Modify: `docs/assets/asset-registry.md`

**Interfaces:**
- Consumes: todos os ids criados nas Tasks 2–4.
- Produces: `asset-registry.md` com seções novas "UI / chrome", "Fundos de tela" e entradas para cada id novo, status `spec`, apontando o arquivo de spec (o grupo aponta o arquivo compartilhado).

- [ ] **Step 1: Adicionar as entradas novas ao registro**

Adicionar/atualizar tabelas em `docs/assets/asset-registry.md`:
- Nova seção "## UI / chrome": `logo.app`→`specs/logo.app.md`; `ui.panel.frame`→`specs/ui.panel.frame.md`; `ui.button.primary`/`ui.button.secondary`→`specs/ui.button.md`; `ui.header.emblem`→`specs/ui.header.emblem.md`; `ui.statchip.frame`→`specs/ui.statchip.frame.md`; `ui.medal.gold`/`silver`/`bronze`→`specs/ui.medals.md`; `ui.nav.bar`→`specs/ui.nav.bar.md`; os 10 `icon.*`→`specs/ui.icons.md`. Todos status `spec`.
- Nova seção "## Fundos de tela": `bg.screen.classic`/`volcano`/`glacier`→`specs/bg.screen.md`; `expansion.classic`/`volcano`/`glacier`→`specs/expansion.covers.md`. Status `spec`.
- Na seção "UI / ícones" existente, atualizar `logo.app` de `placeholder`→`spec` (evitar duplicata: se já listado, só mudar status/spec).

- [ ] **Step 2: Verificar que cada spec path do registro existe**

Run: `grep -oE 'specs/[a-zA-Z0-9._-]+\.md' docs/assets/asset-registry.md | sort -u | while read p; do test -f "docs/assets/$p" && echo "ok $p" || echo "FALTA $p"; done`
Expected: só linhas "ok".

- [ ] **Step 3: Commit**

```bash
git add docs/assets/asset-registry.md
git commit -m "docs(8.1): registra ids de UI chrome e fundos de tela"
```

---

### Task 7: Guarda de paridade registro↔spec (teste)

**Files:**
- Create: `tests/assets/registry-specs.test.ts`

**Interfaces:**
- Consumes: `docs/assets/asset-registry.md` e `docs/assets/specs/*.md`.
- Produces: um teste Vitest que falha se (a) um caminho `specs/*.md` citado no registro não existe, ou (b) um spec novo de UI/fundo não contém o bloco `## Prompt para geração por IA`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/assets/registry-specs.test.ts`:

```ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const REGISTRY = join(ROOT, 'docs/assets/asset-registry.md');
const SPECS_DIR = join(ROOT, 'docs/assets');

function specPathsInRegistry(): string[] {
  const md = readFileSync(REGISTRY, 'utf8');
  const matches = md.match(/specs\/[A-Za-z0-9._-]+\.md/g) ?? [];
  return [...new Set(matches)];
}

describe('asset registry ↔ specs parity', () => {
  it('every spec path referenced in the registry exists', () => {
    const missing = specPathsInRegistry().filter(
      (p) => !existsSync(join(SPECS_DIR, p)),
    );
    expect(missing).toEqual([]);
  });

  it('the registry references at least one spec path', () => {
    expect(specPathsInRegistry().length).toBeGreaterThan(0);
  });

  it('every new UI/background spec has an AI generation prompt block', () => {
    const NEW_SPECS = [
      'logo.app', 'ui.panel.frame', 'ui.button', 'ui.header.emblem',
      'ui.statchip.frame', 'ui.medals', 'ui.nav.bar', 'ui.icons',
      'bg.screen', 'expansion.covers',
    ];
    const missing = NEW_SPECS.filter((name) => {
      const file = join(SPECS_DIR, 'specs', `${name}.md`);
      if (!existsSync(file)) return true;
      return !readFileSync(file, 'utf8').includes('## Prompt para geração por IA');
    });
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver passar**

Run: `npm test -- tests/assets/registry-specs.test.ts`
Expected: PASS (Tasks 2–6 já criaram os specs e o registro). Se falhar, corrigir o spec/registro faltante — o teste é a prova de completude.

> Nota TDD: este teste só é escrito na Task 7 porque depende dos artefatos das Tasks 1–6. Para provar que ele TEM dente, renomeie temporariamente um spec, rode, confirme FAIL, e reverta (o "testar o teste" do projeto).

- [ ] **Step 3: Commit**

```bash
git add tests/assets/registry-specs.test.ts
git commit -m "test(8.1): guarda de paridade registro↔spec + presença de prompt IA"
```

---

### Task 8: Verificação final + fechamento

**Files:**
- Modify: `docs/roadmap/PHASE-08-art-and-packs.md` (marcar parte de 8.1 documentada)
- Modify: `CLAUDE.md` ("Estado atual")

**Interfaces:**
- Consumes: tudo acima.
- Produces: roadmap e CLAUDE.md atualizados; suíte verde comprovada.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm run check && npm test`
Expected: typecheck limpo; todos os testes verdes (contagem anterior + os 3 novos da guarda). Nenhum teste de determinismo mudou (nada de `src/core/` tocado).

- [ ] **Step 2: Atualizar o roadmap**

Em `docs/roadmap/PHASE-08-art-and-packs.md`, no item 8.1, adicionar nota `_Specs de arte + Style Bible + migração documentados (docs-only); geração das imagens e atlas ficam para sessão futura._` sem marcar `[x]` o item inteiro (só a parte de specs está pronta) — OU marcar o primeiro sub-bullet conforme o estado. Deixar claro o que resta (gerar imagens, atlas).

- [ ] **Step 3: Atualizar `CLAUDE.md` "Estado atual"**

Adicionar entrada da Fase 8 registrando: 8.1-parte-docs concluída (Style Bible, catálogo de specs-IA, realinhamento, registro, guarda de paridade); nome mantido JurassicRun; HUD-fantasia do concept rejeitado; próximo = geração de imagens (usuário) + atlas/sprite (8.1 restante/8.2).

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap/PHASE-08-art-and-packs.md CLAUDE.md
git commit -m "docs(8.1): fecha a parte de specs de arte (roadmap + Estado atual)"
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura da spec:**
- Style Bible (Artefato A) → Task 1. ✓
- Doc de migração (Artefato B) → já é a spec commitada; roadmap/CLAUDE.md referenciam. ✓
- Catálogo de specs-IA novas (C.1): logo/UI chrome → Task 2; medalhas/nav/ícones → Task 3; fundos/capas → Task 4. ✓
- Realinhamento dos 24 existentes (C.2) → Task 5. ✓
- Registro (C.3) → Task 6. ✓
- Guarda de consistência (critério de aceite) → Task 7. ✓
- `src/` intocado + suíte verde → Task 8. ✓
- Rejeição do HUD-fantasia → documentada na spec + reforçada no Style Bible (Task 1 Step 1) e CLAUDE.md (Task 8). ✓

**Placeholders:** nenhum "TBD"; cada task tem conteúdo concreto e comandos de verificação exatos.

**Consistência de tipos/nomes:** ids usados na Task 6 (registro) e Task 7 (teste `NEW_SPECS`) batem com os nomes de arquivo criados nas Tasks 2–4 (`logo.app`, `ui.panel.frame`, `ui.button`, `ui.header.emblem`, `ui.statchip.frame`, `ui.medals`, `ui.nav.bar`, `ui.icons`, `bg.screen`, `expansion.covers`). ✓
