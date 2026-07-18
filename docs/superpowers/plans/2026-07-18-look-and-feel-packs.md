# Packs look&feel (8.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin cosmético do jogo inteiro por "pack" trocável (tema CSS + paletas do mundo + tint de entidades), keyed pela expansão ativa, sem tocar `src/core/`.

**Architecture:** Módulo puro `render/packs.ts` define os packs (classic = look atual, volcano/glacier recolor). O tema CSS é aplicado por um effect reativo que assina `entitlementsService.activeExpansion`. A `GameScene` lê o pack ativo para paletas dia/noite, cores de parallax e tint de sprites. Tudo cosmético ⇒ determinismo 67 intacto.

**Tech Stack:** TypeScript estrito, Preact `@preact/signals`, Phaser (casca), Vitest + happy-dom.

## Global Constraints

- `src/core/` **PROIBIDO** de tocar (REGRA 1). Packs são só render/app.
- Sem `Math.random`/`Date`/`performance.now` em módulos puros novos (não são core, mas não precisam).
- Zero alocação por frame no hot path da `GameScene` (REGRA 3): tint é `setTint` escalar.
- Nenhuma string visível hardcoded (REGRA 4) — aqui não há string nova (nomes de expansão já existem).
- `classic` DEVE reproduzir o look atual byte-a-byte (zero regressão).
- Testes: `npm run check` limpo + `npm test` verde ao fim de cada task.

---

### Task 1: Módulo puro `src/render/packs.ts` + packs (classic/volcano/glacier)

**Files:**
- Create: `src/render/packs.ts`
- Create: `src/render/packs.test.ts`

**Interfaces:**
- Consumes: `DAY_NIGHT_PALETTES`, `type TimeOfDay`, `type DayNightPalette` de `./daynight`; `PARALLAX_LAYERS` de `./parallax`; `EXPANSION_CATALOG` de `@services/entitlements` (só no teste de completude).
- Produces:
  - `interface ParallaxPaint { readonly color: number }`
  - `interface LookPack { readonly id: string; readonly theme: Readonly<Record<string,string>>; readonly dayNight: Readonly<Record<TimeOfDay, DayNightPalette>>; readonly parallax: readonly ParallaxPaint[]; readonly entityTint: number }`
  - `const PACK_CLASSIC: LookPack`
  - `const LOOK_PACKS: readonly LookPack[]`
  - `function packForId(id: string): LookPack` (fallback `PACK_CLASSIC`)

- [ ] **Step 1: Write the failing test** — `src/render/packs.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { PACK_CLASSIC, LOOK_PACKS, packForId } from './packs';
import { DAY_NIGHT_PALETTES } from './daynight';
import { PARALLAX_LAYERS } from './parallax';
import { EXPANSION_CATALOG } from '@services/entitlements';

describe('packs', () => {
  it('classic reproduz o look atual (zero regressão)', () => {
    expect(PACK_CLASSIC.id).toBe('classic');
    expect(PACK_CLASSIC.dayNight).toEqual(DAY_NIGHT_PALETTES);
    expect(PACK_CLASSIC.entityTint).toBe(0xffffff);
    // cores de parallax na mesma ordem das camadas
    PARALLAX_LAYERS.forEach((layer, i) => {
      if (layer.visual.kind === 'primitive') {
        expect(PACK_CLASSIC.parallax[i]!.color).toBe(layer.visual.color);
      }
    });
  });

  it('packForId faz fallback para classic em id desconhecido', () => {
    expect(packForId('nope')).toBe(PACK_CLASSIC);
    expect(packForId('classic')).toBe(PACK_CLASSIC);
  });

  it('todo id de expansão tem um pack (guarda de completude)', () => {
    for (const exp of EXPANSION_CATALOG) {
      expect(LOOK_PACKS.find((p) => p.id === exp.id)).toBeDefined();
    }
  });

  it('packs alternativos diferem do classic', () => {
    for (const id of ['volcano', 'glacier']) {
      const p = packForId(id);
      expect(p.id).toBe(id);
      expect(p).not.toBe(PACK_CLASSIC);
      expect(p.dayNight).not.toEqual(DAY_NIGHT_PALETTES);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/packs.test.ts`
Expected: FAIL — `Cannot find module './packs'`.

- [ ] **Step 3: Write minimal implementation** — `src/render/packs.ts`

```ts
/**
 * Packs look&feel (8.3): bundle cosmético trocável (tema CSS + paletas do mundo + tint de
 * entidades). 100% render/app ⇒ NÃO toca `src/core/` (determinismo intacto). Trocar look = editar
 * estes dados, nunca a lógica (REGRA 2). Keyed pelos ids de expansão (seam `activeExpansion`, 4.6).
 * `classic` reexporta os valores atuais ⇒ zero regressão.
 */
import { DAY_NIGHT_PALETTES, type TimeOfDay, type DayNightPalette } from './daynight';
import { PARALLAX_LAYERS } from './parallax';

export interface ParallaxPaint {
  readonly color: number;
}

export interface LookPack {
  readonly id: string;
  /** Custom properties CSS aplicadas em :root (reskin dos menus DOM). */
  readonly theme: Readonly<Record<string, string>>;
  /** As 4 paletas do mundo; a seleção continua derivada da seed (dia/noite 3.3). */
  readonly dayNight: Readonly<Record<TimeOfDay, DayNightPalette>>;
  /** Cor de cada camada de parallax, na ordem de PARALLAX_LAYERS. */
  readonly parallax: readonly ParallaxPaint[];
  /** Tint multiplicativo dos sprites de entidade; 0xffffff = sem alteração. */
  readonly entityTint: number;
}

/** Cores de parallax atuais, extraídas das camadas primitivas (classic). */
const CLASSIC_PARALLAX: readonly ParallaxPaint[] = PARALLAX_LAYERS.map((l) => ({
  color: l.visual.kind === 'primitive' ? l.visual.color : 0xffffff,
}));

/** Tema padrão = valores de tokens.css. Fonte única do `classic`. */
const CLASSIC_THEME: Readonly<Record<string, string>> = {
  '--color-bg': '#0e1116',
  '--color-surface': '#1a1f2b',
  '--color-surface-2': '#232a38',
  '--color-primary': '#4ea1ff',
  '--color-accent': '#ffcf5c',
  '--color-gold': '#c9a227',
};

export const PACK_CLASSIC: LookPack = {
  id: 'classic',
  theme: CLASSIC_THEME,
  dayNight: DAY_NIGHT_PALETTES,
  parallax: CLASSIC_PARALLAX,
  entityTint: 0xffffff,
};

/** Vulcão — quente/basalto. Placeholders coerentes com o Style Bible (8.1); tuning na arte. */
const PACK_VOLCANO: LookPack = {
  id: 'volcano',
  theme: {
    '--color-bg': '#160d0d',
    '--color-surface': '#241315',
    '--color-surface-2': '#331b1c',
    '--color-primary': '#ff7a3c',
    '--color-accent': '#ffcf5c',
    '--color-gold': '#d98a2b',
  },
  dayNight: {
    morning: { sky: 0xffb070, ground: 0x5a2f22, ceiling: 0x3a1f24, parallaxTint: 0xffd0a0 },
    afternoon: { sky: 0xe8815a, ground: 0x5a2a20, ceiling: 0x3a1e22, parallaxTint: 0xffc0a0 },
    dusk: { sky: 0xd8542f, ground: 0x4a241a, ceiling: 0x42202a, parallaxTint: 0xff9060 },
    night: { sky: 0x2a1218, ground: 0x2a150f, ceiling: 0x22101a, parallaxTint: 0xaa5544 },
  },
  parallax: [{ color: 0x7a4a4a }, { color: 0x8a3f2a }, { color: 0x532f24 }],
  entityTint: 0xffd9c8,
};

/** Geleira — frio/gelo. Placeholders coerentes com o Style Bible (8.1); tuning na arte. */
const PACK_GLACIER: LookPack = {
  id: 'glacier',
  theme: {
    '--color-bg': '#0b1016',
    '--color-surface': '#131d28',
    '--color-surface-2': '#1c2a38',
    '--color-primary': '#5ac8ff',
    '--color-accent': '#bfe6ff',
    '--color-gold': '#9fb8cc',
  },
  dayNight: {
    morning: { sky: 0xd6f0ff, ground: 0x8fb0c0, ceiling: 0x4a5a6a, parallaxTint: 0xe0f4ff },
    afternoon: { sky: 0xbfe6ff, ground: 0x8aa8ba, ceiling: 0x3a4a5a, parallaxTint: 0xffffff },
    dusk: { sky: 0x9ab8d8, ground: 0x6f8a9a, ceiling: 0x42506a, parallaxTint: 0xc0d8f0 },
    night: { sky: 0x18243a, ground: 0x24333f, ceiling: 0x1e2838, parallaxTint: 0x6688cc },
  },
  parallax: [{ color: 0x9fb8cc }, { color: 0x7fa8c0 }, { color: 0x5f88a0 }],
  entityTint: 0xd8ecff,
};

export const LOOK_PACKS: readonly LookPack[] = [PACK_CLASSIC, PACK_VOLCANO, PACK_GLACIER];

/** Pack por id (= id de expansão); fallback `classic` para id desconhecido. */
export function packForId(id: string): LookPack {
  return LOOK_PACKS.find((p) => p.id === id) ?? PACK_CLASSIC;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/packs.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Verify typecheck + full suite**

Run: `npm run check && npx vitest run`
Expected: sem erros de tipo; suíte verde.

- [ ] **Step 6: Commit**

```bash
git add src/render/packs.ts src/render/packs.test.ts
git commit -m "feat(8.3): pack model + classic/volcano/glacier (recolor procedural)"
```

---

### Task 2: Tema CSS reativo — `src/app/theme.ts` + fiação no bootstrap

**Files:**
- Create: `src/app/theme.ts`
- Create: `src/app/theme.test.ts`
- Modify: `src/app/main.tsx` (importar e chamar `bindPackTheme()` após `entitlementsService.init()`)

**Interfaces:**
- Consumes: `packForId`, `type LookPack` de `@render/packs`; `entitlementsService` de `@services/entitlements`; `effect` de `@preact/signals`.
- Produces:
  - `function applyPackTheme(pack: LookPack, root?: HTMLElement): void`
  - `function bindPackTheme(): () => void` (retorna cleanup do effect)

- [ ] **Step 1: Write the failing test** — `src/app/theme.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPackTheme, bindPackTheme } from './theme';
import { packForId } from '@render/packs';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('applyPackTheme seta as custom properties do pack em :root', () => {
    applyPackTheme(packForId('volcano'));
    const primary = document.documentElement.style.getPropertyValue('--color-primary');
    expect(primary).toBe('#ff7a3c');
  });

  it('bindPackTheme reage à troca de expansão ativa', () => {
    entitlementsService.init(memoryEntitlementsStorage());
    const cleanup = bindPackTheme();
    // classic por padrão
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#4ea1ff');
    // desbloquear + selecionar volcano ⇒ tema muda ao vivo
    entitlementsService.unlock('volcano');
    entitlementsService.select('volcano');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff7a3c');
    cleanup();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'`.

- [ ] **Step 3: Write minimal implementation** — `src/app/theme.ts`

```ts
/**
 * Aplicação do tema CSS do pack look&feel ativo (8.3). Um effect assina a expansão ativa
 * (seam 4.6) e reescreve as custom properties de :root ⇒ reskin AO VIVO dos menus DOM.
 * tokens.css mantém os defaults (= classic) como fallback pré-JS. Cosmético ⇒ não toca core.
 */
import { effect } from '@preact/signals';
import { packForId, type LookPack } from '@render/packs';
import { entitlementsService } from '@services/entitlements';

/** Escreve as custom properties do pack no elemento raiz (default <html>). */
export function applyPackTheme(pack: LookPack, root: HTMLElement = document.documentElement): void {
  for (const [prop, value] of Object.entries(pack.theme)) {
    root.style.setProperty(prop, value);
  }
}

/** Liga a reatividade tema↔expansão ativa. Retorna cleanup do effect. */
export function bindPackTheme(): () => void {
  return effect(() => {
    applyPackTheme(packForId(entitlementsService.activeExpansion.value.id));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/theme.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Wire bootstrap** — em `src/app/main.tsx`, adicionar o import e chamar após `entitlementsService.init()`:

```ts
import { bindPackTheme } from './theme';
```

Logo após a linha `entitlementsService.init();` no `bootstrap()`:

```ts
  entitlementsService.init();
  bindPackTheme(); // tema CSS do pack ativo, reativo (8.3)
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `npm run check && npx vitest run`
Expected: sem erros; suíte verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/theme.ts src/app/theme.test.ts src/app/main.tsx
git commit -m "feat(8.3): tema CSS reativo do pack ativo (bindPackTheme)"
```

---

### Task 3: `GameScene` lê o pack ativo (paletas dia/noite, parallax, tint de entidade)

**Files:**
- Modify: `src/render/GameScene.ts`

**Interfaces:**
- Consumes: `packForId` de `./packs`; `entitlementsService` de `@services/entitlements`.
- Produces: nada novo exportado (casca Phaser, sem teste de unidade — validação por Playwright no fim).

Notas de implementação (casca; sem teste unitário, molde das demais mudanças de `GameScene`):

1. Import no topo:

```ts
import { packForId } from './packs';
import { entitlementsService } from '@services/entitlements';
```

2. Campo novo para reagir à troca de pack sem a seed mudar (junto de `appliedDayNightSeed`):

```ts
  private appliedPackId: string | null = null;
```

3. Em `update()`, a guarda de reaplicação passa a considerar também o pack ativo. Trocar o bloco:

```ts
    if (this.match.seedLabel !== this.appliedDayNightSeed) {
      this.applyDayNight(this.match.seedLabel);
    }
```

por:

```ts
    const packId = entitlementsService.activeExpansion.value.id;
    if (this.match.seedLabel !== this.appliedDayNightSeed || packId !== this.appliedPackId) {
      this.applyDayNight(this.match.seedLabel);
    }
```

4. `applyDayNight(seed)` usa o pack ativo para paleta e cores de parallax; grava `appliedPackId`:

```ts
  private applyDayNight(seed: string): void {
    const pack = packForId(entitlementsService.activeExpansion.value.id);
    const p = pack.dayNight[timeOfDayForSeed(seed)];
    this.cameras.main.setBackgroundColor(p.sky);
    const g = this.bandsGfx;
    g.clear();
    g.fillStyle(p.ceiling, 1);
    g.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    g.fillStyle(p.ground, 1);
    g.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);
    // Regenera as texturas de silhueta do pack (chave inclui packId) e re-tinta.
    for (let i = 0; i < this.parallaxTiles.length; i++) {
      const key = this.ensureLayerTexture(PARALLAX_LAYERS[i]!, pack.parallax[i]!.color, pack.id);
      this.parallaxTiles[i]!.setTexture(key);
      this.parallaxTiles[i]!.setTint(p.parallaxTint);
    }
    this.appliedDayNightSeed = seed;
    this.appliedPackId = pack.id;
  }
```

5. `ensureLayerTexture` recebe cor + packId (para não colidir cache entre packs). Assinatura e corpo:

```ts
  private ensureLayerTexture(layer: ParallaxLayer, color: number, packId: string): string {
    const key = `parallax:${packId}:${layer.id}`;
    if (this.textures.exists(key)) return key;
    if (layer.visual.kind !== 'primitive') return key;
    const { tileWidth, peakHeight, baseFromBottom } = layer.visual;
    const baseY = VIEW_HEIGHT - baseFromBottom;
    const topY = baseY - peakHeight;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    const half = tileWidth / 2;
    for (let x = 0; x < tileWidth; x += half) {
      g.fillTriangle(x, baseY, x + half / 2, topY, x + half, baseY);
    }
    g.generateTexture(key, tileWidth, VIEW_HEIGHT);
    g.destroy();
    return key;
  }
```

6. O `create()` chama `ensureLayerTexture` na criação dos tiles — atualizar a chamada para passar a cor do pack ativo e o id. Trocar o bloco de criação dos `parallaxTiles`:

```ts
    const createPack = packForId(entitlementsService.activeExpansion.value.id);
    this.parallaxTiles = PARALLAX_LAYERS.map((layer, index) => {
      const key = this.ensureLayerTexture(layer, createPack.parallax[index]!.color, createPack.id);
      const tile = this.add
        .tileSprite(0, 0, VIEW_WIDTH, VIEW_HEIGHT, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-(PARALLAX_LAYERS.length - index));
      return tile;
    });
```

7. Tint de entidade nos sprites do pool e no dino. No `update()`, capturar o tint uma vez e aplicá-lo. Após obter `scrollX` e antes de desenhar, adicionar:

```ts
    const entityTint = packForId(entitlementsService.activeExpansion.value.id).entityTint;
```

No `drawSpriteEntity`, após `img.setTexture(...)` aplicar `img.setTint(entityTint)` — passar `entityTint` como parâmetro. Ajustar assinaturas:

```ts
  private drawSpriteEntity(e: Entity, scrollX: number, entityTint: number): void {
    // ...igual até acquireSprite...
    const img = this.acquireSprite();
    img.setTexture(ATLAS_KEY, frame);
    img.setTint(entityTint);
    const s = this.sizeFor(typeId, e.hitbox);
    img.setDisplaySize(s.w, s.h);
    img.setPosition(x, e.transform.position.y);
  }

  private drawVisibleSprites(entities: readonly Entity[], scrollX: number, entityTint: number): void {
    for (const e of entities) this.drawSpriteEntity(e, scrollX, entityTint);
  }
```

E as 3 chamadas em `update()` passam `entityTint`; o dino recebe `this.dinoSprite.setTint(entityTint)` junto do `setPosition`.

- [ ] **Step 1: Aplicar as mudanças 1–7 acima em `src/render/GameScene.ts`.**

- [ ] **Step 2: Verify typecheck + full suite**

Run: `npm run check && npx vitest run`
Expected: sem erros; suíte verde (nenhum teste unitário novo — GameScene é casca).

- [ ] **Step 3: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(8.3): GameScene reskina mundo/parallax/entidades pelo pack ativo"
```

---

### Task 4: Docs (formato de pack + registro) + roadmap/CLAUDE.md + verificação final

**Files:**
- Modify: `docs/assets/asset-registry.md` (seção "Packs look&feel" — formato + seam de extensão)
- Modify: `docs/roadmap/PHASE-08-art-and-packs.md` (marcar 8.3 `[x]` com nota)
- Modify: `CLAUDE.md` (atualizar "Estado atual" com 8.3)

- [ ] **Step 1: Adicionar seção ao `docs/assets/asset-registry.md`** documentando o formato de
      pack (`LookPack`: theme/dayNight/parallax/entityTint), que o pack é keyed pela expansão ativa
      (seam 4.6), e que atlas/áudio/locale próprios são o **ponto de extensão** (um pack futuro com
      arte adiciona os arquivos e aponta o pack para eles — REGRA 2), hoje todos usam o atlas
      `entities` + faixas procedurais recolorindo por tint/paleta.

- [ ] **Step 2: Rodar determinismo** (nada em `src/core/`, mas provar):

Run: `npm run test:determinism`
Expected: 67 verdes.

- [ ] **Step 3: Verificação visual (Playwright)** — build/dev, entrar em Play com `classic`, depois
      desbloquear+selecionar `volcano` na tela Expansões e reentrar em Play: confirmar céu/parallax/
      tint recoloridos no canvas e tokens CSS dos menus trocados ao vivo. Registrar evidência.

- [ ] **Step 4: Marcar 8.3 `[x]`** em `docs/roadmap/PHASE-08-art-and-packs.md` com nota de resultado
      e **atualizar "Estado atual" do `CLAUDE.md`** (bloco 8.3, determinismo 67, contagem de testes).

- [ ] **Step 5: Commit**

```bash
git add docs/assets/asset-registry.md docs/roadmap/PHASE-08-art-and-packs.md CLAUDE.md
git commit -m "docs(8.3): formato de pack no registro + fecha 8.3 (estado/roadmap)"
```

---

## Self-Review

- **Cobertura da spec:** pack model (T1) ✓; tema CSS reativo (T2) ✓; canvas lê pack — dia/noite +
  parallax + tint (T3) ✓; composição com dia/noite via `dayNight[timeOfDayForSeed]` (T1+T3) ✓;
  packs alternativos volcano/glacier (T1) ✓; docs de formato + seam de extensão (T4) ✓; determinismo
  67 (T4) ✓; i18n sem strings novas ✓.
- **Placeholders:** nenhum "TBD"; todo código concreto.
- **Consistência de tipos:** `LookPack`/`ParallaxPaint`/`packForId`/`applyPackTheme`/`bindPackTheme`/
  `ensureLayerTexture(layer,color,packId)`/`drawSpriteEntity(e,scrollX,entityTint)` usados
  consistentemente entre tasks.
</content>
