# Parallax Multicamadas (2.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ≥3 camadas de fundo com `scrollFactor` distintos (profundidade) ao render,
puramente visuais, rolando infinitamente e sem alocação por frame, sem tocar `src/core/`.

**Architecture:** Módulo PURO `src/render/parallax.ts` (catálogo de camadas + matemática de
deslocamento, testável, sem `phaser`) × casca Phaser em `GameScene` (gera texturas de tile uma
vez, cria `TileSprite` por camada, ajusta `tilePositionX` por frame). Espelha o padrão puro×casca
de 2.1/2.2 e a filosofia de manifesto/arte-desacoplada (REGRA 2).

**Tech Stack:** TypeScript estrito, Vitest (env node p/ testes puros), Phaser 3 (só na casca).

## Global Constraints

- `src/core/` **NÃO é tocado** (REGRA 1 — determinismo intacto por construção).
- `src/render/` puro não importa `phaser`; `index.ts` só reexporta módulos puros.
- Zero alocação no hot path do `update` (REGRA 3): texturas na inicialização; por frame só
  atribuição de número.
- Nenhuma string visível ao usuário (REGRA 4 não se aplica aqui).
- Toda camada de fundo trocável tem asset-spec + entrada no registry (REGRA 5).
- ids das camadas = os já reservados no `asset-registry.md`: `bg.layer.far`, `bg.layer.mid`,
  `bg.layer.near`.
- `scrollFactor` de cada camada em `[0,1)`, estritamente crescente do índice 0 (mais distante)
  ao último (mais próximo).

---

### Task 1: Módulo puro de parallax + testes

**Files:**
- Create: `src/render/parallax.ts`
- Test: `tests/render/parallax.test.ts`
- Modify: `src/render/index.ts` (adicionar `export * from './parallax';`)

**Interfaces:**
- Consumes: nada (módulo folha).
- Produces:
  - `type ParallaxVisual = { kind: 'primitive'; color: number; tileWidth: number; peakHeight: number; baseFromBottom: number } | { kind: 'sprite'; texture: string }`
  - `interface ParallaxLayer { readonly id: string; readonly scrollFactor: number; readonly visual: ParallaxVisual }`
  - `const PARALLAX_LAYERS: readonly ParallaxLayer[]` (ordem trás→frente, índice 0 mais distante)
  - `function parallaxTileOffset(cameraScrollX: number, scrollFactor: number): number`

- [ ] **Step 1: Escrever os testes que falham**

`tests/render/parallax.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS, parallaxTileOffset } from '@render/parallax';

describe('PARALLAX_LAYERS', () => {
  it('tem ao menos 3 camadas', () => {
    expect(PARALLAX_LAYERS.length).toBeGreaterThanOrEqual(3);
  });

  it('usa os ids reservados no registry, únicos', () => {
    const ids = PARALLAX_LAYERS.map((l) => l.id);
    expect(ids).toEqual(['bg.layer.far', 'bg.layer.mid', 'bg.layer.near']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scrollFactor de cada camada em [0,1)', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.scrollFactor).toBeGreaterThanOrEqual(0);
      expect(l.scrollFactor).toBeLessThan(1);
    }
  });

  it('scrollFactor estritamente crescente (distante→próximo)', () => {
    for (let i = 1; i < PARALLAX_LAYERS.length; i++) {
      expect(PARALLAX_LAYERS[i]!.scrollFactor).toBeGreaterThan(PARALLAX_LAYERS[i - 1]!.scrollFactor);
    }
  });

  it('toda camada tem um visual primitivo completo', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.visual.kind).toBe('primitive');
      if (l.visual.kind === 'primitive') {
        expect(typeof l.visual.color).toBe('number');
        expect(l.visual.tileWidth).toBeGreaterThan(0);
        expect(l.visual.peakHeight).toBeGreaterThan(0);
        expect(l.visual.baseFromBottom).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('parallaxTileOffset', () => {
  it('fator 0 ⇒ deslocamento 0 (fundo imóvel)', () => {
    expect(parallaxTileOffset(1234, 0)).toBe(0);
  });

  it('é proporcional a cameraScrollX', () => {
    expect(parallaxTileOffset(100, 0.4)).toBeCloseTo(40);
    expect(parallaxTileOffset(200, 0.4)).toBeCloseTo(80);
  });

  it('camada distante desloca menos que a próxima para o mesmo scrollX', () => {
    const far = PARALLAX_LAYERS[0]!;
    const near = PARALLAX_LAYERS[PARALLAX_LAYERS.length - 1]!;
    const sx = 500;
    expect(parallaxTileOffset(sx, far.scrollFactor)).toBeLessThan(
      parallaxTileOffset(sx, near.scrollFactor),
    );
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

Run: `npm test -- parallax`
Expected: FAIL (`Cannot find module '@render/parallax'`).

- [ ] **Step 3: Implementar o módulo puro**

`src/render/parallax.ts`:

```ts
/**
 * Camadas de parallax (REGRA 2): tipos lógicos trocáveis, geométricos agora (`primitive`),
 * sprite depois (Fase 8). Puramente visuais ⇒ não tocam `src/core/` (determinismo intacto).
 * Ordem do array = profundidade: índice 0 é a mais distante (menor scrollFactor).
 */
export type ParallaxVisual =
  | {
      readonly kind: 'primitive';
      readonly color: number;
      readonly tileWidth: number;
      readonly peakHeight: number;
      readonly baseFromBottom: number;
    }
  | { readonly kind: 'sprite'; readonly texture: string };

export interface ParallaxLayer {
  readonly id: string;
  /** Fração do scroll da câmera que a camada acompanha; em [0,1). Menor = mais distante. */
  readonly scrollFactor: number;
  readonly visual: ParallaxVisual;
}

/** Trás→frente. ids batem com os reservados em docs/assets/asset-registry.md. */
export const PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    id: 'bg.layer.far',
    scrollFactor: 0.2,
    visual: { kind: 'primitive', color: 0x6b7a8f, tileWidth: 160, peakHeight: 55, baseFromBottom: 40 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.4,
    visual: { kind: 'primitive', color: 0x4f7a5a, tileWidth: 120, peakHeight: 35, baseFromBottom: 18 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.7,
    visual: { kind: 'primitive', color: 0x2f5233, tileWidth: 64, peakHeight: 50, baseFromBottom: 6 },
  },
];

/**
 * Deslocamento horizontal do padrão de tile de uma camada, dado o scroll da câmera.
 * `tilePositionX = cameraScrollX * scrollFactor` ⇒ camadas com fator menor rolam mais devagar
 * (profundidade). Fator 0 ⇒ imóvel; fator 1 ⇒ acompanha o mundo (nenhuma camada usa 1).
 */
export function parallaxTileOffset(cameraScrollX: number, scrollFactor: number): number {
  return cameraScrollX * scrollFactor;
}
```

- [ ] **Step 4: Reexportar no index e rodar os testes**

Adicionar a `src/render/index.ts`:

```ts
export * from './parallax';
```

Run: `npm test -- parallax`
Expected: PASS (todos verdes).

- [ ] **Step 5: Typecheck e commit**

Run: `npm run check`
Expected: sem erros.

```bash
git add src/render/parallax.ts tests/render/parallax.test.ts src/render/index.ts
git commit -m "feat(2.3): módulo puro de parallax (catálogo + offset) com testes"
```

---

### Task 2: Casca Phaser — texturas de tile + TileSprites com scrollFactor

**Files:**
- Modify: `src/render/GameScene.ts`
- Modify: `src/render/constants.ts` (limpar comentário "parallax real é 2.3")

**Interfaces:**
- Consumes de Task 1: `PARALLAX_LAYERS`, `parallaxTileOffset`, `ParallaxLayer`.
- Produces: comportamento visual (sem teste de unidade — casca Phaser, padrão de 2.1/2.2).

Sem teste de unidade nesta task (a casca Phaser não é testada em node, como em 2.1/2.2). A
verificação é `npm run check` + verificação visual na Task 4. TDD não se aplica à casca gráfica.

- [ ] **Step 1: Importar o módulo de parallax em `GameScene.ts`**

Adicionar aos imports do topo:

```ts
import { PARALLAX_LAYERS, parallaxTileOffset } from './parallax';
import type { ParallaxLayer } from './parallax';
```

- [ ] **Step 2: Guardar os TileSprites como campo da cena**

Adicionar aos campos privados da classe (perto de `gfx`/`pauseOverlay`):

```ts
  private parallaxTiles: Phaser.GameObjects.TileSprite[] = [];
```

- [ ] **Step 3: Criar texturas + TileSprites no `create()`**

Em `create()`, ANTES de criar `this.gfx` (para que o mundo fique na frente), inserir a
construção das camadas. Cada camada gera uma textura de tile transparente com uma linha de
triângulos (silhueta) e um `TileSprite` de tela cheia preso à câmera, atrás do mundo:

```ts
    // Parallax (2.3): camadas de silhueta atrás do mundo. Texturas geradas 1×; por frame só
    // ajusta tilePositionX (zero alocação — REGRA 3). scrollFactor(0) prende à câmera.
    this.parallaxTiles = PARALLAX_LAYERS.map((layer, index) => {
      const key = this.ensureLayerTexture(layer);
      const tile = this.add
        .tileSprite(0, 0, VIEW_WIDTH, VIEW_HEIGHT, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-(PARALLAX_LAYERS.length - index)); // far mais negativo, atrás de tudo
      return tile;
    });
```

- [ ] **Step 4: Implementar o gerador de textura de silhueta**

Adicionar um método privado que desenha uma linha de triângulos repetidos e retorna a chave da
textura (idempotente — só gera uma vez por id):

```ts
  /** Gera (1×) a textura de tile de uma camada: linha de triângulos como silhueta. Chave = id. */
  private ensureLayerTexture(layer: ParallaxLayer): string {
    const key = `parallax:${layer.id}`;
    if (this.textures.exists(key)) return key;
    if (layer.visual.kind !== 'primitive') return key; // sprite: arte real (fase posterior)
    const { color, tileWidth, peakHeight, baseFromBottom } = layer.visual;
    const baseY = VIEW_HEIGHT - baseFromBottom; // base da silhueta (px do topo)
    const topY = baseY - peakHeight; // ápice dos triângulos
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    // Dois triângulos por tile garantem casamento nas bordas ao tilear.
    const half = tileWidth / 2;
    for (let x = 0; x < tileWidth; x += half) {
      g.fillTriangle(x, baseY, x + half / 2, topY, x + half, baseY);
    }
    g.generateTexture(key, tileWidth, VIEW_HEIGHT);
    g.destroy();
    return key;
  }
```

- [ ] **Step 5: Atualizar `tilePositionX` por frame no ramo não-pausado do `update`**

Em `update()`, logo APÓS `this.cameras.main.scrollX = this.loop.renderX - DINO_SCREEN_X;`,
inserir a sincronização das camadas (usa o scrollX recém-definido):

```ts
    const scrollX = this.cameras.main.scrollX;
    for (let i = 0; i < this.parallaxTiles.length; i++) {
      this.parallaxTiles[i]!.tilePositionX = parallaxTileOffset(scrollX, PARALLAX_LAYERS[i]!.scrollFactor);
    }
```

- [ ] **Step 6: Garantir profundidade da faixa de chão/teto acima das camadas**

A faixa `bg` (teto/chão) hoje não tem depth explícito (default 0). As camadas de parallax têm
depth negativo, então já ficam atrás. Confirmar que a linha `const bg = this.add.graphics().setScrollFactor(0);`
permanece; nenhuma mudança necessária além de deixar as camadas com depth negativo (Step 3).
Nenhuma edição extra aqui — passo de verificação.

- [ ] **Step 7: Limpar comentário obsoleto em `constants.ts`**

Editar a linha 11 de `src/render/constants.ts`:

De:
```ts
// Cores de cenário (placeholder; parallax real é 2.3).
```
Para:
```ts
// Cores de cenário fixo (céu de fundo, faixas de teto/chão). Parallax multicamadas: parallax.ts.
```

- [ ] **Step 8: Typecheck e commit**

Run: `npm run check`
Expected: sem erros de tipo/lint.

```bash
git add src/render/GameScene.ts src/render/constants.ts
git commit -m "feat(2.3): casca Phaser do parallax (texturas de silhueta + tilePositionX)"
```

---

### Task 3: Asset-specs das 3 camadas + registry (REGRA 5)

**Files:**
- Create: `docs/assets/specs/bg.layer.far.md`
- Create: `docs/assets/specs/bg.layer.mid.md`
- Create: `docs/assets/specs/bg.layer.near.md`
- Modify: `docs/assets/asset-registry.md` (status das 3 camadas → `spec`)

**Interfaces:** documentação; sem código. Segue `docs/assets/asset-spec-template.md`.

- [ ] **Step 1: Criar `docs/assets/specs/bg.layer.far.md`**

```markdown
# Asset Spec — bg.layer.far

## Identidade
- **id:** `bg.layer.far`
- **Categoria:** fundo (parallax, camada distante)
- **Substitui o placeholder geométrico:** linha de triângulos (cordilheira) azul-acinzentada
  `0x6b7a8f`, tile 160×180, pico 55px, base a 40px do fundo, `scrollFactor 0.2`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~640×360 (@2x de 320×180) ou faixa
  de silhueta com alfa; deve tilear sem costura visível.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), tile ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha (fundo transparente ⇒ camadas atrás aparecem).
- **Margens/padding seguros:** bordas esquerda/direita devem casar para tilear.

## Direção de arte
- **Estilo:** silhueta chapada, sem detalhe interno; sensação de distância (baixo contraste).
- **Paleta:** azul-acinzentado enevoado `0x6b7a8f`.
- **Iluminação/ângulo:** vista lateral 2D; atmosfera enevoada (mais claro = mais longe).
- **Coerência:** camada mais distante; deve ficar atrás de `bg.layer.mid`/`near`.

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game background layer of a distant mountain
> ridge silhouette, flat hazy blue-grey color (#6b7a8f), low contrast to convey distance,
> transparent background above the ridge, no text, no foreground detail, prehistoric jungle
> setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
```

- [ ] **Step 2: Criar `docs/assets/specs/bg.layer.mid.md`**

```markdown
# Asset Spec — bg.layer.mid

## Identidade
- **id:** `bg.layer.mid`
- **Categoria:** fundo (parallax, camada média)
- **Substitui o placeholder geométrico:** linha de triângulos (colinas) verde poeirento
  `0x4f7a5a`, tile 120×180, pico 35px, base a 18px do fundo, `scrollFactor 0.4`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~480×360 (@2x); tilear sem costura.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** bordas laterais casadas para tilear.

## Direção de arte
- **Estilo:** silhueta chapada, contraste médio (mais perto que `far`).
- **Paleta:** verde poeirento `0x4f7a5a`.
- **Iluminação/ângulo:** vista lateral 2D.
- **Coerência:** entre `bg.layer.far` (atrás) e `bg.layer.near` (à frente).

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game background layer of rolling hills
> silhouette, flat dusty green color (#4f7a5a), medium contrast, transparent background above
> the hills, no text, prehistoric jungle setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
```

- [ ] **Step 3: Criar `docs/assets/specs/bg.layer.near.md`**

```markdown
# Asset Spec — bg.layer.near

## Identidade
- **id:** `bg.layer.near`
- **Categoria:** fundo (parallax, camada próxima)
- **Substitui o placeholder geométrico:** linha de triângulos estreitos (samambaias/vegetação)
  verde escuro `0x2f5233`, tile 64×180, pico 50px, base a 6px do fundo, `scrollFactor 0.7`.

## Especificação técnica
- **Dimensões alvo (px):** tile horizontalmente repetível, ~256×360 (@2x); tilear sem costura.
- **Pivô / âncora:** canto superior-esquerdo (origin 0,0), ancorado à viewport.
- **Hitbox lógica associada:** nenhuma — camada puramente visual, não colide.
- **Animação:** nenhuma (estático; rola via tilePositionX).
- **Atlas de destino:** `backgrounds`.
- **Formato de exportação:** PNG com alpha.
- **Margens/padding seguros:** bordas laterais casadas; enraíza atrás da linha do solo.

## Direção de arte
- **Estilo:** silhueta chapada, maior contraste (camada mais próxima).
- **Paleta:** verde escuro `0x2f5233`.
- **Iluminação/ângulo:** vista lateral 2D.
- **Coerência:** camada mais à frente das três; fica atrás da faixa de chão.

## Prompt para geração por IA
> "Seamless horizontally-tileable side-view 2D game foreground foliage layer, silhouettes of
> tall ferns and jungle plants, flat dark green color (#2f5233), higher contrast, transparent
> background above the foliage, no text, prehistoric jungle setting."

## Checklist de aceite
- [ ] Tilea horizontalmente sem costura.
- [ ] Fundo transparente acima da silhueta.
- [ ] Empacotado no atlas `backgrounds`; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
```

- [ ] **Step 4: Atualizar o registry**

Em `docs/assets/asset-registry.md`, na seção "## Fundos / parallax", substituir as três linhas:

De:
```markdown
| `bg.layer.far` | camada distante | placeholder | — |
| `bg.layer.mid` | camada média | placeholder | — |
| `bg.layer.near` | camada próxima | placeholder | — |
```
Para:
```markdown
| `bg.layer.far` | montanhas distantes (parallax) | spec | `specs/bg.layer.far.md` |
| `bg.layer.mid` | colinas médias (parallax) | spec | `specs/bg.layer.mid.md` |
| `bg.layer.near` | samambaias próximas (parallax) | spec | `specs/bg.layer.near.md` |
```

- [ ] **Step 5: Commit**

```bash
git add docs/assets/specs/bg.layer.far.md docs/assets/specs/bg.layer.mid.md docs/assets/specs/bg.layer.near.md docs/assets/asset-registry.md
git commit -m "docs(2.3): asset-specs das 3 camadas de parallax + registry"
```

---

### Task 4: Verificação final (testes, typecheck, determinismo, visual) + fechamento

**Files:**
- Modify: `docs/roadmap/PHASE-02-endless-vertical-slice.md` (marcar 2.3 `[x]`)
- Modify: `CLAUDE.md` (atualizar "Estado atual")

- [ ] **Step 1: Suíte completa verde**

Run: `npm run check && npm test`
Expected: typecheck/lint limpos; todos os testes passam (incluindo os novos de parallax).

- [ ] **Step 2: Determinismo como sanidade (core intacto)**

Run: `npm run test:determinism`
Expected: verde (nenhuma mudança em `src/core/` ⇒ contrato intacto).

- [ ] **Step 3: Verificação visual (Playwright)**

Subir o dev server (`bash scripts/run.sh` ou `npm run dev`), abrir no navegador e confirmar:
as três camadas aparecem atrás do mundo; ao o dino avançar, camadas distantes rolam mais devagar
que as próximas (profundidade); sob pausa o fundo congela. Registrar screenshot como evidência.

- [ ] **Step 4: Marcar o item na fase**

Em `docs/roadmap/PHASE-02-endless-vertical-slice.md`, seção 2.3:
```markdown
### 2.3 Parallax multicamadas
- [x] ≥3 camadas de fundo com scrollFactors distintos (profundidade).
```

- [ ] **Step 5: Atualizar "Estado atual" em `CLAUDE.md`**

Atualizar a linha da Fase 2 e o bloco de resumo para registrar 2.3 concluído e apontar o próximo
item (2.4 HUD). (Texto exato definido no fechamento da sessão.)

- [ ] **Step 6: Commit de fechamento**

```bash
git add docs/roadmap/PHASE-02-endless-vertical-slice.md CLAUDE.md
git commit -m "docs(2.3): marca 2.3 concluído (fase/estado)"
```

## Self-Review

- **Spec coverage:** módulo puro + catálogo (Task 1) ✓; render infinito com scrollFactor +
  depth + zero-alocação (Task 2) ✓; asset-specs + registry REGRA 5 (Task 3) ✓; verificação/
  determinismo/visual + fechamento (Task 4) ✓. Requisito "≥3 camadas com scrollFactors
  distintos" coberto (3 camadas + céu). i18n N/A (sem strings).
- **Placeholder scan:** sem TBD/TODO; todo passo de código traz o código.
- **Type consistency:** `PARALLAX_LAYERS`, `parallaxTileOffset`, `ParallaxLayer`, `ParallaxVisual`
  usados de forma idêntica entre Task 1 (definição) e Task 2 (consumo).
