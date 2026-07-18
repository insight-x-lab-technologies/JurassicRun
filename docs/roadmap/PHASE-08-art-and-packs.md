# Fase 8 — Arte AAA & packs look&feel

**Objetivo:** substituir os placeholders geométricos por arte PNG gerada por IA, sem perder
performance, e habilitar packs cosméticos compráveis.

## Itens

### 8.1 Produção de arte a partir das asset-specs
- [ ] Gerar imagens via IA seguindo `docs/assets/specs/*` e `asset-registry.md`.
- [ ] Empacotar em texture atlases.
      _Parte de especificação CONCLUÍDA (docs-only, `src/` intocado, determinismo 67):
      Style Bible `docs/assets/ART-DIRECTION.md` (paleta/materiais/tipografia/iconografia +
      regra dos dois tiers), catálogo de specs prontas-para-IA dos assets novos que os
      concepts de `ref/` introduzem (logo, UI chrome: painel/botões/header/statchip/medalhas/
      barra-de-nav/10 ícones; fundos de tela classic/volcano/glacier trocados pela expansão
      ativa + capas de expansão), realinhamento dos 24 specs existentes ao Style Bible,
      registro atualizado e guarda de paridade registro↔spec (`tests/assets/`). Migração
      concept→atual documentada em `docs/superpowers/specs/2026-07-17-art-direction-migration-
      design.md`: telas de menu são re-skin ~1:1 via tokens CSS; Game Over ganha 2 campos
      (Clima + badge recorde) em UI futura; HUD-fantasia do concept de gameplay (habilidades/
      minimapa/objetivos) REJEITADO por violar o flap-only determinístico. Nome mantido
      "JurassicRun". **Resta:** gerar as imagens (usuário, IA externa) + empacotar em atlases._

### 8.2 Trocar manifesto geométrico → sprite
- [x] Atualizar entradas do manifesto para `kind: "sprite"`. **Sem** tocar core/hitboxes.
- [x] Validar 60fps com atlases (budget de draw calls, culling, pooling).
      _CONCLUÍDO (`src/core/` intocado, determinismo 67; spec `docs/superpowers/specs/2026-07-17-
      sprite-pipeline-design.md`, plano `docs/superpowers/plans/2026-07-17-sprite-pipeline.md`).
      As 11 entidades in-game (Tier 2) passaram a renderizar por sprites de um **texture atlas
      placeholder** gerado proceduralmente (`scripts/gen-atlas.mjs`, encoder PNG puro reusando
      `gen-icons`; `public/atlas/entities.{png,json}` — JSONHash, frames = ids do manifesto). O
      manifesto virou `kind:'sprite'`; `GameScene` carrega o atlas no `preload` e desenha via
      **pool de `Image`** (alocação-zero no hot path, culling preservado, fallback primitivo
      mantido). Arte AAA real (8.1-restante) entra só trocando PNG/JSON do atlas (REGRA 2).
      Evidência Playwright: sprites do atlas renderizam; **p50 16,7ms (60fps), 0 frames >50ms**
      (sem jank; a média sub-60 é o cap de vsync do headless, não o jogo); **6 draw calls/frame**
      = batching (1 textura de atlas). Parallax/fundos e packs seguem fora de escopo (8.1/8.3)._

### 8.3 Packs look&feel
- [ ] Formato de pack (atlases + sons + fundos + overrides de manifesto + locales opcionais).
- [ ] Carregamento dinâmico de pack; troca em runtime; gameplay/determinismo inalterados.

### 8.4 Monetização real (gateway plugável)
- [ ] Implementar provider real de entitlements por trás da interface (ADR-0004):
      compra de packs/moedas via gateway (ex.: Ko-Fi shop/Stripe) + validação (Edge Function).
- [ ] Manter honor-system como fallback.

## Definição de pronto
- Jogo com arte AAA a 60fps; ao menos 1 pack alternativo funcional; compra de pack plugável.
