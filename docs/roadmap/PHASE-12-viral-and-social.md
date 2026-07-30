# Fase 12 — Viral & social

**Objetivo:** transformar cada jogador em canal de aquisição. Barata pro que entrega: reusa o
replay determinístico (trunfo raro do projeto) e o share da 4.x. Fecha com **soft launch** no
itch/Pages para medir retenção real (telemetria 11.7) antes de gastar o pico de portal (Fase 13).

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.

## Premissas (NÃO violar)

- `src/core/` **intocado** — ghost re-simula com o core existente como função pura.
- Offline-first: link de desafio funciona 100% sem servidor; ghost do líder mundial degrada para
  ghost local sem rede.
- i18n 10 idiomas em toda string nova.

## Itens

### 12.1 Link de desafio compartilhável
- [ ] URL `?challenge=<seed>&by=<nome>&score=<n>`: quem abre cai no briefing (9.9) em modo
      "versus" — card "Fulano fez N nesta seed, te desafio" — e joga a MESMA partida
      (modificadores da seed idênticos, garantido pelo contrato 9.9).
- [ ] Zero servidor: tudo no URL. Score do desafiante é exibição/meta a bater, não entra em
      leaderboard (não verificável — honesto e suficiente).
- [ ] Botão de compartilhar no Game Over e no briefing (reusa share 4.x); após a partida, tela de
      comparação "você X × Fulano N" + re-desafiar.
- [ ] Sanitizar `by` (comprimento/charset) — vira texto na tela de terceiros.

**Toca:** router/boot (parse de query), `ChallengeBrief`, GameOver, share, i18n. **Aceite:** abrir
o link em aparelho limpo joga a mesma seed com as mesmas regras; comparação correta; sem rede ok.

### 12.2 Corrida fantasma (ghost)
- [ ] Ghost = replay re-simulado passo a passo em paralelo (core como função pura, mundo próprio,
      mesma seed ⇒ mesmo campo) e renderizado como dino translúcido **sem colisão** + tag de nome.
      Nada muda na partida do jogador — camada 100% cosmética.
- [ ] Seam `GhostProvider`: (a) **recorde local** (replays já persistidos — funciona offline);
      (b) **top-1 do leaderboard central** (endpoint/select na tabela de submissões 6.4, que já
      guarda a timeline; conferir RLS 6.1 para leitura pública da timeline do top).
- [ ] Escolha no briefing: correr contra ninguém / seu recorde / líder. Padrão: seu recorde.
- [ ] Perf: 1 sim extra por frame de passo fixo no orçamento de 60fps — medir; se apertar,
      pré-computar posições do ghost no load (timeline é finita e conhecida).

**Toca:** `src/render/` (entidade ghost), briefing, serviço de replays, Supabase (RLS/select),
i18n. **Aceite:** ghost reproduz exatamente a corrida gravada (posições batem com a re-sim);
zero efeito no estado da partida (goldens intactos); 60fps mantido com ghost ativo.

### 12.3 Card de share (imagem)
- [ ] Canvas offscreen compõe imagem com skin equipada, score, seed e link: 1080×1920 (story) e
      1200×630 (og/link preview). Web Share API level 2 (files) com fallback de download.
- [ ] Gatilhos: Game Over (recorde novo), pódio de desafio, troféu desbloqueado.

**Toca:** serviço de share, GameOver/telas, i18n (texto do card localizado). **Aceite:** imagem
gerada bate com o estado (score/skin corretos); share nativo no mobile; fallback desktop baixa PNG.

### 12.4 Marco: soft launch
- [ ] Publicar no itch.io + Pages (pipelines 7.3/7.4 prontos) com as fases 11+12 dentro.
- [ ] 2 semanas de coleta: D1/D7 (consulta 11.7), partidas/sessão, % de shares clicados.
- [ ] Critério de avanço para a Fase 13: D1 ≥ 25% OU decisão consciente do usuário de seguir
      mesmo assim (é hobby — dado informa, não trava).

**Toca:** nada de código (deploy + análise). **Aceite:** números de retenção reais documentados
no fechamento da fase.

## Ordem de execução

12.1 → 12.3 → 12.2 → 12.4. (Link primeiro — mais barato e destrava o card; ghost por último —
único com Supabase/perf; soft launch fecha.)

## Definição de pronto (fase)

- `check` + `npm test` suíte inteira verdes; `src/core/` intocado ⇒ det inalterado.
- Link de desafio circula de verdade (testado entre 2 aparelhos); ghost corre no desafio diário;
  card compartilha no WhatsApp; soft launch no ar com telemetria coletando.
