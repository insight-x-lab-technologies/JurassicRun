# Fase 11 — Retenção & economia viva

**Objetivo:** dar ao jogador motivo de voltar todo dia (recompensa diária, missões) e motivo de
gastar moedas (skins, ovos, revive). É a fundação de TODA a monetização das fases seguintes: sem
retenção, tráfego de portal vira churn; sem sinks, comprar moeda não faz sentido.

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.
> Cada item vira spec própria ao implementar (padrão Fase 10).

## Premissas (NÃO violar)

- **Só 11.5 (revive) toca `src/core/`.** Todo o resto é serviços/app/render. Se outro item derivar
  para o core, ritual completo: re-pin de goldens se preciso + `verify-determinism` +
  `npm run build:edge`.
- **Moeda soft apenas** no gacha (11.4) — nunca dinheiro real direto em sorteio (política de lojas).
- Offline-first: tudo funciona sem rede; telemetria (11.7) é best-effort.
- i18n 10 idiomas; asset-spec para skins/ovos; pipeline contra placeholder (arte IA depois).
- Tempo de calendário (dia UTC) é lido **fora do core** (mesmo padrão das seeds de desafio 5.1).

## Itens

### 11.1 Recompensa diária + streak
- [ ] Lógica pura `dailyRewardFor(dayIndex, streak)`: tabela fixa (ex.: 50 moedas dia 1, +25/dia,
      cap 200 no dia 7+; faltou um dia ⇒ streak zera). Tuning na spec do item.
- [ ] Dia UTC pelo mesmo helper das seeds do desafio diário (5.1) — sem fuso, sem `Date` no core.
- [ ] Claim na Home (card/banner), estado persistido versionado (`jurassicrun.dailyreward.v1`),
      storage indisponível não quebra o boot (precedente 10.3).

**Toca:** serviço novo + `HomeScreen.tsx` + i18n. **Aceite:** claim credita na carteira 1× por dia
UTC; streak conta/zera certo em viradas de dia; teste de relógio simulado.

### 11.2 Missões diárias
- [ ] 3 missões/dia **derivadas da seed do dia** ⇒ o mundo inteiro tem as mesmas missões (conversa
      social grátis). Geração pura `questsForDay(dayIndex)` com RNG semeado (fork de stream,
      padrão 9.9).
- [ ] Catálogo de templates com parâmetro (colete N moedas, alcance nível N, jogue N partidas,
      N near-misses, termine com power-up X, jogue o desafio do dia…). Progresso = fold sobre
      `MatchSummary` (molde do agregado de troféus 4.7).
- [ ] Recompensa por missão + bônus por completar as 3. UI na Home + pós-Game Over.

**Toca:** serviço novo (lógica pura + casca), Home/GameOver, i18n. **Aceite:** mesmas missões para
mesma data em aparelhos distintos; progresso persiste; recompensa 1× por missão/dia.

### 11.3 Skins de pterodáctilo
- [ ] Camada cosmética **independente da expansão ativa**: skin × tema (skin = atlas próprio de
      dino, precedente multi-atlas 8.2/tema). Hitbox intocada (REGRA 2).
- [ ] Catálogo `SkinDef {id, price, raridade}`; posse persistida; equipada por perfil; render
      escolhe o atlas da skin equipada.
- [ ] Entram como recolor/tint procedural do dino atual (pipeline contra placeholder); arte AAA
      IA depois via asset-spec `docs/assets/specs/dino.skins.md` + lote no art-brief.
- [ ] ~8 skins no lançamento: parte comprável na Loja, parte exclusiva de ovos (11.4).

**Toca:** manifesto/atlas, render do dino, serviço de posse, Loja, i18n. **Aceite:** trocar skin
persiste e aparece em jogo/Home; expansão e skin combinam livremente; fps mantido.

### 11.4 Ovos (gacha leve)
- [ ] Ovo custa **moedas** (só soft currency). Choca skin/trail/avatar/moedas conforme tabela de
      raridade versionada; duplicata converte em moedas (pity implícito).
- [ ] Sorteio FORA do core (`crypto.getRandomValues`); resultado persistido antes da animação
      (reload não re-sorteia).
- [ ] UI de abertura com animação de ovo rachando (procedural primeiro, arte IA depois).

**Toca:** serviço novo, Loja/tela de ovo, i18n, asset-spec. **Aceite:** distribuição da tabela
testada (χ² grosseiro/contagem em N sorteios simulados); duplicata credita moedas; sem rede ok.

### 11.5 Revive (ÚNICO item core da fase)
- [ ] Evento novo `revive` na timeline de input: após a morte (fase `dying`), overlay oferece
      revive por moedas, 1× por partida, **só Endless**. Aceitou ⇒ evento entra na timeline,
      sim retoma com invulnerabilidade curta determinística.
- [ ] Replays continuam verificáveis (evento gravado ⇒ re-sim bate). Desafios/torneios: os 3
      verificadores (fábrica, `verifyReplay`, `verifyChallengeSubmission` — config canônica 9.9)
      **rejeitam** timeline com revive.
- [ ] Gancho futuro: fase 13 adiciona "revive grátis assistindo ad" no mesmo fluxo.
- [ ] Ritual core: goldens (timelines antigas inalteradas ⇒ hashes iguais; se o schema da timeline
      mudar, bump do `STORAGE_KEY` de replays) + `verify-determinism` + `npm run build:edge`.

**Toca:** `src/core/` (input/sim), overlay de morte, carteira, i18n. **Aceite:** mesma seed +
mesma timeline com revive ⇒ estado idêntico (teste determinismo novo); desafio rejeita revive;
Endless sem revive byte-idêntico ao de hoje.

### 11.6 Loja hub
- [ ] Loja reorganizada em abas: **Moedas** (pacotes Ko-Fi + resgate, fluxo 10.8) · **Skins** ·
      **Ovos** · **Expansões**. Fontes gratuitas de moeda continuam explícitas (10.8).

**Toca:** `ShopScreen.tsx`, i18n. **Aceite:** 4 abas navegáveis em paisagem baixa e retrato;
nenhum caminho credita moeda grátis (invariante 10.8 preservada).

### 11.8 Entrega automática da compra Ko-fi (webhook + itens de Loja)

> **Origem:** relato do usuário depois da 10.8 — "clico no pacote e cai numa página de doação".
> A 10.8 entregou o encanamento (SKU, resgate single-use, Edge Function `redeem-code`), **não** o
> fulfillment: hoje o dono do estúdio precisa ver o pedido, inventar um código, inserir no banco e
> mandar por fora. **Decisão do usuário em 2026-07-31: variante "ticket + e-mail de reserva".**

- [ ] **Itens de Loja no Ko-fi, um por pacote** (preço fixo). Hoje `Storefront.kofiUrl`
      (`storefront.ts:13`) é **uma URL só** para os 3 pacotes e aponta para a página de doação, onde
      o comprador digita o valor que quiser — a Loja mostra "US$ 4,99" e ele pode pagar US$ 1.
      `Storefront` passa a ter URL **por SKU** + mapa `direct_link_code → Sku`. O
      `direct_link_code` do item é o **único identificador confiável** que chega no webhook: o
      `?jr_sku=` que `checkoutUrlFor` monta hoje **não volta** para o servidor.
- [ ] **Edge Function nova `kofi-webhook`.** Dois detalhes que quebram em silêncio:
      (a) o Ko-fi posta `application/x-www-form-urlencoded` com um campo **`data`** contendo o JSON
      como **string** ⇒ `req.json()` NÃO serve, tem que ler o form e dar `JSON.parse` no `data`;
      (b) o `verification_token` é **segredo de servidor** — vai em `supabase secrets set`, nunca
      numa chave `VITE_*` (essas vão inteiras para o navegador).
- [ ] **Idempotência:** `kofi_transaction_id` com índice único. O Ko-fi reenvia webhook; sem isso a
      mesma compra credita duas vezes.
- [ ] **Caminho principal — ticket.** A Loja mostra um ticket curto derivado do **id anônimo do
      jogador** (Fase 6) antes de abrir o Ko-fi: "cole isto na mensagem". O webhook lê `message`,
      extrai o ticket e marca o pedido como pertencente àquele jogador. Ao voltar à Loja, o cliente
      **autenticado** pede seus pedidos pendentes e resgata sozinho — zero digitação.
      **PRÉ-REQUISITO A CONFIRMAR no painel:** o checkout de item de Loja do Ko-fi oferece campo de
      mensagem ao comprador? Se não oferecer, este caminho cai e sobra só o de e-mail.
- [ ] **Fallback — e-mail.** Quem esquecer o ticket digita o e-mail usado no Ko-fi e recebe o código,
      que cola no `RedeemCodeForm` já existente. **Risco aceito e explícito:** quem digitar o e-mail
      certo de um comprador leva o código dele. Mitigar com rate-limit; o caminho principal
      (autenticado) não tem essa brecha, então isto é exceção, não regra.
- [ ] **Restrição dura que molda tudo:** a carteira é **100% `localStorage`**
      (`wallet/storage.ts:8`) — **não existe saldo no servidor**. O webhook NUNCA credita ninguém
      direto; quem aplica moeda é sempre o cliente, puxando e validando. Qualquer desenho que
      pressuponha crédito server-side está errado.
- [ ] Preço do item no Ko-fi × `VITE_SHOP_PRICE_*` são **duas fontes de verdade** sem guarda.
      Documentar no `.env.example` e no `supabase/README.md`.

**Toca:** `src/services/purchase/storefront.ts`, `ShopScreen.tsx`, `supabase/functions/kofi-webhook/`,
migração de `redemption_codes` (colunas `kofi_transaction_id` único, `kofi_email`, `ticket`),
`.env.example`, `supabase/README.md`, i18n. **`src/core/` intocado.**
**Aceite:** pagar um item de Loja no Ko-fi com o ticket colado ⇒ voltar ao jogo e ver as moedas
creditadas sem digitar nada; sem o ticket, o resgate por e-mail entrega o código; webhook reenviado
não credita em dobro; token de verificação inválido ⇒ 401 e nada gravado.

**Custo no Ko-fi:** venda de item cobra **5%** no plano grátis (+ taxa do Stripe/PayPal). Ko-fi Gold
zera os 5% (fontes divergem: US$ 6 ou US$ 12/mês). Shop **não** exige Gold. Doação segue 0%.

### 11.7 Telemetria mínima anônima
- [ ] Eventos contáveis: `session_start`, `run_end {mode, score, durationS}`, `shop_view`,
      `egg_hatched`. **Sem PII** — só o ID anônimo 6.2. Fila local + flush best-effort
      (Supabase); sem rede ⇒ descarta silencioso, jogo idêntico.
- [ ] Toggle de opt-out em Configurações (honestidade LGPD).
- [ ] Consulta de retenção D1/D7 (SQL salvo em `docs/` — é o que valida o soft launch da Fase 12).

**Toca:** serviço novo, schema Supabase, Settings, i18n. **Aceite:** eventos chegam na tabela com
rede; sem rede zero erro; opt-out interrompe envio.

## Ordem de execução

**11.8 primeiro** (destrava receita real e é o único item com dependência externa — configuração no
painel do Ko-fi feita pelo usuário), depois 11.1 → 11.2 → 11.3 → 11.4 → 11.6 → 11.7 → **11.5 por
último** (único core, padrão D-por-último das fases 9/10). Um item por PR, SDD por subagentes.

## Definição de pronto (fase)

- `npm run check` limpo, `npm test` verde na suíte inteira.
- 11.5 fechado com `verify-determinism` verde e `build:edge` regenerado; demais itens sem tocar core.
- Jogável: login diário rende, missões giram, skin equipável, ovo choca, revive funciona em
  Endless e é rejeitado em desafio, Loja em 4 abas, telemetria opcional ligada.
