# ADR-0004 — Monetização e entitlements
- Status: Aceita
- Data: 2026-06-27

## Contexto
PWA no GitHub Pages não tem gateway de pagamento nativo nem validação confiável de compra
sem backend. O projeto é hobby, sem investimento obrigatório. Ainda assim, deve ser possível
vender packs/expansões e moedas no futuro.

## Decisão
Abstrair tudo atrás de um `EntitlementsService`. Na v1: moeda do jogo (comida) para compras
in-game; doação via Ko-Fi/BuyMeACoffee; packs desbloqueados por "código de doação"
(honor-system). A interface já prevê um provider de gateway real (ex.: Ko-Fi shop/Stripe +
validação por Edge Function) a ser plugado na Fase 8, sem refatorar consumidores.

## Consequências
- v1 sem custo e sem risco legal/financeiro.
- Migração para compra real é trocar a implementação do provider, não a UI.
- Expansões permanecem puramente cosméticas (ADR-0003) — sem pay-to-win.

## Alternativas consideradas
- Gateway real desde o início: contraria "sem investimento" e adiciona complexidade cedo.
- Sem nenhuma camada de abstração: travaria a monetização futura. Rejeitada.
