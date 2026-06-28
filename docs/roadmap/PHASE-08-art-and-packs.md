# Fase 8 — Arte AAA & packs look&feel

**Objetivo:** substituir os placeholders geométricos por arte PNG gerada por IA, sem perder
performance, e habilitar packs cosméticos compráveis.

## Itens

### 8.1 Produção de arte a partir das asset-specs
- [ ] Gerar imagens via IA seguindo `docs/assets/specs/*` e `asset-registry.md`.
- [ ] Empacotar em texture atlases.

### 8.2 Trocar manifesto geométrico → sprite
- [ ] Atualizar entradas do manifesto para `kind: "sprite"`. **Sem** tocar core/hitboxes.
- [ ] Validar 60fps com atlases (budget de draw calls, culling, pooling).

### 8.3 Packs look&feel
- [ ] Formato de pack (atlases + sons + fundos + overrides de manifesto + locales opcionais).
- [ ] Carregamento dinâmico de pack; troca em runtime; gameplay/determinismo inalterados.

### 8.4 Monetização real (gateway plugável)
- [ ] Implementar provider real de entitlements por trás da interface (ADR-0004):
      compra de packs/moedas via gateway (ex.: Ko-Fi shop/Stripe) + validação (Edge Function).
- [ ] Manter honor-system como fallback.

## Definição de pronto
- Jogo com arte AAA a 60fps; ao menos 1 pack alternativo funcional; compra de pack plugável.
