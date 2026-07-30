# Fase 14 — Play Store (TWA + Play Billing)

**Objetivo:** distribuir o PWA como app Android na Play Store via Trusted Web Activity e abrir
IAP de verdade (compra de moedas com dinheiro real via Google Play Billing). Fecha também o débito
7.5 (wrappers de outras lojas) como opcional.

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.

## Premissas (NÃO violar)

- `src/core/` **intocado**.
- **Única despesa aceita do projeto:** US$25 de taxa única do Play Console — **ação do usuário**,
  como toda ação externa/irreversível (publicar, criar conta).
- O provider de compra (seam 8.4/10.8) ganha implementação nova; o fluxo Ko-Fi continua intacto
  nos flavors web. Nenhum processador de pagamento próprio (decisão travada 10.8).
- PWA continua funcionando idêntico fora do TWA.

## Itens

### 14.1 Empacotamento TWA
- [ ] Bubblewrap (ou PWABuilder) gerando o projeto Android a partir do manifest do PWA; script
      versionado em `scripts/` com bump de `versionCode` amarrado à versão do `package.json` (10.2).
- [ ] `assetlinks.json` servido no domínio do Pages (valida a TWA sem barra de URL).
- [ ] Ícones adaptativos/splash pelo pipeline de arte IA (asset-spec).
- [ ] **Ações do usuário:** conta Play Console (US$25), assinatura via Play App Signing.

**Toca:** `scripts/`, manifest PWA, docs. **Aceite:** APK/AAB instala e abre fullscreen sem barra
de URL; build reproduzível pelo script.

### 14.2 Play Billing via Digital Goods API
- [ ] Provider `playBilling` no seam de compra: Digital Goods API + Payment Request (funciona em
      TWA) para os SKUs de moedas (`COIN_SKU_AMOUNTS` small/medium/large — preços definidos no
      Play Console).
- [ ] Validação server-side: Edge Function `verify-play-purchase` confere o purchase token na
      Play Developer API (service account gratuita, secret no Supabase) antes de creditar;
      `consume()` após crédito para permitir recompra.
- [ ] Flavor `play`: seções Ko-Fi E resgate de código somem (política do Google: bem digital
      dentro do app só via Play Billing; resgate de código compraria fora da loja ⇒ risco de
      violação — esses fluxos ficam só nos flavors web).
- [ ] Sem rede/validação indisponível: compra não conclui, mensagem honesta, nada creditado.

**Toca:** `src/services/purchase/`, Edge Function nova, `ShopScreen` por flavor, i18n.
**Aceite:** compra de teste (license testing) credita moedas 1×; token inválido não credita;
recompra funciona após consume; flavors web inalterados.

### 14.3 Listing & conformidade
- [ ] Assets de listing pelo pipeline de arte IA: screenshots (retrato+paisagem — 10.9 pronto),
      feature graphic, ícone — asset-spec `docs/assets/specs/store.listing.md`.
- [ ] Página de privacy policy (rota estática no Pages) cobrindo telemetria 11.7 e conta anônima
      6.2; formulário Data Safety coerente com ela.
- [ ] Content rating (IARC), países, ficha em EN+PT no mínimo (as 10 línguas do jogo ajudam ASO).

**Toca:** página estática, docs, Play Console. **Aceite:** app em produção na Play Store (review
aprovado) — publicar é **ação do usuário**.

### 14.4 Wrappers extras (débito 7.5) — OPCIONAL
- [ ] Samsung Galaxy Store / Huawei AppGallery / Microsoft Store a partir do mesmo TWA/PWA, um
      por vez, SÓ se o retorno da Play justificar o esforço. Sem billing próprio de cada loja na
      primeira leva (moedas só via web/Ko-Fi nesses flavors, ou loja oculta).

**Toca:** scripts de empacote. **Aceite:** decisão registrada (feito ou adiado com razão).

## Ordem de execução

14.1 → 14.3 → 14.2 → 14.4. (Empacotar e listar primeiro valida o canal com review do Google antes
de investir no billing; 14.4 só depois de dados reais.)

## Definição de pronto (fase)

- `check` + suíte inteira verdes; core intocado.
- App instalável da Play Store; compra de moedas real funcionando com validação server-side;
  flavors web byte-equivalentes em comportamento ao pré-fase.
