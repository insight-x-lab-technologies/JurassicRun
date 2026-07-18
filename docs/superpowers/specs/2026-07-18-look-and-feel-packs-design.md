# Spec — Packs look&feel (Fase 8.3)

> **Data:** 2026-07-18
> **Item de roadmap:** 8.3 (Packs look&feel).
> **Regra travada:** `src/core/` **não é tocado** — packs são 100% cosméticos ⇒ determinismo 67
> intacto por construção. Colisão continua por hitbox lógica (REGRA 2); trocar look = editar
> dados de pack, nunca lógica.

## Objetivo

Um **pack look&feel** é um bundle cosmético (tema de UI + paletas do mundo + tint das entidades,
com atlas/áudio/locale como pontos de extensão) que reskina o jogo inteiro sem alterar gameplay.
O usuário troca o pack ativo e a mudança se reflete ao vivo. Esta entrega constrói o **sistema +
seam + ao menos 1 pack alternativo funcional** com recolor procedural (sem depender da arte AAA
externa da 8.1-restante).

## Decisões de produto (autônomas — reportadas para correção de rumo)

1. **Pack ≡ expansão ativa.** Reusamos o seam `entitlementsService.activeExpansion` (construído
   na 4.6 e anotado como *"SEAM da Fase 8: o render lê a expansão ativa daqui"*). Os packs são
   keyed pelos ids de expansão existentes: `classic` (free, look atual), `volcano` e `glacier`
   (premium). Ganhamos de graça: unlock (honor-system agora, gateway na 8.4), seleção, persistência
   e a tela `ExpansionsScreen`. **Não** criamos `PackService`/storage/tela paralelos (evita
   sistema duplicado; a decisão da 8.1 já fundia "fundos por expansão" nesse seam).
2. **Recolor sem arte nova.** Os packs placeholder recolorem via três eixos que já existem no
   render: (a) **tema CSS** (custom properties em `:root`), (b) **paletas dia/noite** do mundo
   (céu/chão/teto/tint de parallax + cores das camadas), (c) **tint das entidades** (sprites do
   atlas). Isso prova a troca ponta-a-ponta sem gerar um segundo atlas/áudio.
3. **`classic` = look atual, zero regressão.** Os valores do pack `classic` são exatamente os
   atuais (`DAY_NIGHT_PALETTES`, `PARALLAX_LAYERS`, tokens de `tokens.css`, tint `0xffffff`).
4. **Atlas/áudio/locale reais = seam documentado, não código morto.** O formato de pack referencia
   uma *chave* de atlas e um *conjunto* de faixas; hoje todos os packs apontam para o atlas
   `entities` e as faixas procedurais, recolorindo por tint/paleta. Um pack futuro com arte própria
   entra adicionando os arquivos e apontando o pack para eles (REGRA 2) — sem tocar consumidores.
   Não adicionamos campos inertes agora (YAGNI); a extensão está documentada em `asset-registry.md`.

## Composição com dia/noite (importante para determinismo)

O tempo do dia (3.3) é **derivado da seed** (`timeOfDayForSeed(seed) % 4`) e define qual das 4
paletas o mundo usa. O pack fornece o **conjunto** das 4 paletas; a seleção continua sendo a seed.
Assim pack (cosmético, escolha do jogador) e dia/noite (derivado da seed, justiça de leaderboard)
são **ortogonais e componíveis**: `palette = activePack.dayNight[timeOfDayForSeed(seed)]`. Nenhuma
entrada de gameplay muda ⇒ determinismo intacto.

## Arquitetura

### Módulo puro `src/render/packs.ts` (novo, testável, sem serviços/DOM/phaser)

```ts
export interface LookPack {
  readonly id: string;                         // = id de expansão
  readonly theme: Readonly<Record<string, string>>; // custom properties CSS (--color-*, --color-gold…)
  readonly dayNight: Readonly<Record<TimeOfDay, DayNightPalette>>; // 4 paletas do mundo
  readonly parallax: readonly ParallaxPaint[]; // cor de cada camada (mesma ordem de PARALLAX_LAYERS)
  readonly entityTint: number;                 // 0xffffff = sem tint (classic)
}
export const PACK_CLASSIC: LookPack;           // valores atuais — zero regressão
export const LOOK_PACKS: readonly LookPack[];  // classic, volcano, glacier
export function packForId(id: string): LookPack; // fallback classic para id desconhecido
```

- `PackClassic.dayNight` reexporta os valores de `DAY_NIGHT_PALETTES`; `parallax` reexporta as
  cores de `PARALLAX_LAYERS`; `theme` reexporta os tokens padrão de `tokens.css` (fonte única).
- Guarda de completude (teste): **todo** `EXPANSION_CATALOG[i].id` tem um `LookPack`.

### Tema CSS — `src/app/theme.ts` (novo) + fiação em `main.tsx`

- `applyPackTheme(pack)`: para cada `[prop, value]` de `pack.theme`, `document.documentElement.
  style.setProperty(prop, value)`. `classic` seta os mesmos valores do `tokens.css` (idempotente).
- `bindPackTheme()`: um `effect(@preact/signals)` que assina `entitlementsService.activeExpansion`
  e chama `applyPackTheme(packForId(active.id))` ⇒ **troca de tema AO VIVO** nos menus (molde do
  `audioService.init` reativo). Chamado no bootstrap após `entitlementsService.init()`.
- `tokens.css` mantém os defaults (= `classic`) como fallback pré-JS.

### Canvas — `GameScene` lê o pack ativo (casca, pode importar serviços)

- `applyDayNight(seed)` passa a usar `packForId(entitlementsService.activeExpansion.value.id)`:
  paleta = `pack.dayNight[timeOfDayForSeed(seed)]`; cores das camadas de parallax = `pack.parallax`
  (regenera as texturas de silhueta por pack — a chave de textura inclui o id do pack para não
  colidir/cachear errado); tint de parallax da paleta como hoje.
- Tint de entidade: `pack.entityTint` aplicado a cada sprite do pool + ao dino no `update`
  (`img.setTint(tint)`; `0xffffff` = neutro). Zero alocação no hot path (só `setTint` escalar).
- Como o jogo Phaser é destruído ao navegar para Expansões e recriado ao voltar a Play (4.1), a
  seleção de pack já é relida no próximo mount. A comparação por seed do `applyDayNight` ganha
  também o id do pack aplicado (`appliedPackId`) para reagir caso pack mude sem a seed mudar.

## Packs alternativos (placeholder, tuning da 8.1-arte na sequência)

- **`volcano`** — quente: tema CSS com `--color-primary`/`--color-accent` âmbar/laranja; paletas
  dia/noite avermelhadas; parallax em tons de basalto; `entityTint` levemente quente.
- **`glacier`** — frio: tema azul-gelo; paletas dia/noite azuladas/claras; parallax gelo;
  `entityTint` levemente frio.
- Valores são **placeholders** coerentes com o Style Bible (`docs/assets/ART-DIRECTION.md`),
  refinados quando a arte AAA chegar.

## i18n

Nenhuma string nova: nomes/descrições das expansões já existem (`expansion.*` nos 10 locales).

## Testes

- `packs.test.ts` (puro): `packForId` fallback; guarda de completude expansão↔pack; `classic`
  bate byte-a-byte com `DAY_NIGHT_PALETTES`/`PARALLAX_LAYERS` (prova zero-regressão).
- `theme.test.ts` (happy-dom): `applyPackTheme` seta as custom properties em `documentElement`;
  `bindPackTheme` reage à troca do sinal `activeExpansion` (mudar expansão → props mudam) e o
  cleanup descarta o effect.
- `verify-determinism`: 67 inalterado (nada em `src/core/`).

## Fora de escopo (adiado)

- Atlas/áudio/locale próprios por pack (entram com a arte externa da 8.1; seam documentado).
- Compra de pack via gateway real (8.4; hoje unlock honor-system via entitlements).
- Tuning fino das paletas volcano/glacier (8.1-arte).
- Reagir a troca de pack **durante** uma partida em andamento (o jogo é destruído ao navegar;
  desnecessário).
</content>
</invoke>
