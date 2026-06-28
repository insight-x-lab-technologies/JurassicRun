# JurassicRun — Design Spec (Master)

> Documento de design validado na sessão de brainstorming de 2026-06-27.
> É o "porquê" de alto nível. Detalhes operacionais vivem em `docs/architecture/`,
> `docs/roadmap/` e `docs/conventions/`.

## 1. Visão

Jogo **side-scroller estilo Flappy Bird** com temática do período dos dinossauros.
O jogador controla um **pterodáctilo** que voa da esquerda para a direita, desviando de
obstáculos, comendo pássaros (moeda) e coletando power-ups. É um **PWA mobile-first**,
instalável, com leaderboards e desafios determinísticos.

Hobby project. Sem frameworks pagos. Sem custo obrigatório no lançamento.

## 2. Decisões tomadas no brainstorming

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Modelo de desenvolvimento | **SDD completo**: spec → plano → TDD → review → verificação |
| 2 | Monetização v1 | **Entitlements abstratos**: honor-system/Ko-Fi agora, gateway real plugável depois |
| 3 | Primeiro milestone jogável | **Core loop Endless** (vertical slice) |
| 4 | Backend online | **Offline-first**; Supabase numa fase dedicada posterior |

## 3. Pilares de arquitetura (inegociáveis)

1. **Separação core/render.** Toda a lógica de jogo vive em `core/` — TypeScript puro,
   headless, sem Phaser, 100% testável. Phaser apenas renderiza e captura input.
   Ver `docs/architecture/ARCHITECTURE.md`.
2. **Determinismo.** Simulação em passo fixo + PRNG com seed. Mesma seed + mesmos inputs
   ⇒ mesmo resultado em qualquer dispositivo/fps. `Math.random()` é proibido no core.
   Ver `docs/architecture/DETERMINISM.md`.
3. **Arte desacoplada da lógica.** Entidades têm hitbox lógica separada do visual.
   Trocar primitiva geométrica por PNG é editar um manifesto, não a lógica.
   Expansões alteram **apenas** cosméticos. Ver `docs/architecture/RENDERING-AND-ASSETS.md`.
4. **60fps+** em dispositivos atuais é requisito de aceitação, não meta opcional.

## 4. Stack

- **Phaser 3** (WebGL) — gameplay.
- **Preact + Signals** — UI/telas (DOM), responsiva e em 10 idiomas.
- **Vite + vite-plugin-pwa** — build, dev server, service worker, manifest.
- **TypeScript** — toda a base.
- **Vitest** — testes unitários (foco: core determinístico e economia).
- **i18next** — internacionalização (10 idiomas).
- **Supabase JS** — backend online (fase tardia).

Alternativas consideradas e rejeitadas: UI inteiramente em Phaser (pior para telas
responsivas + i18n); engine custom (esforço desnecessário). Ver ADRs em `docs/decisions/`.

## 5. Subsistemas

- `core/` — rng, simulação/mundo, dificuldade, spawn, colisão, economia, score, power-ups,
  clima, derivação de seeds.
- `render/` — cena Phaser, parallax, input, áudio, loader de manifesto de assets.
- `app/` — telas Preact (Home, Perfil, Configurações, Leaderboard, Ninho, Loja, Expansões,
  Desafios, Game Over, HUD, entrada de nome no 1º acesso).
- `services/` — i18n, persistência, áudio, entitlements, perfis, leaderboard, troféus.
- `backend/` — Supabase (fase tardia).
- `pwa/build/deploy` — manifest, SW, CI GitHub Pages → itch.io.

## 6. Escopo funcional completo (checklist de rastreabilidade)

Cada item abaixo deve estar coberto por alguma fase do roadmap. Ver
`docs/roadmap/ROADMAP.md` para o mapeamento item → fase.

- [ ] Side-scroller 2D, esquerda→direita, pterodáctilo com flap.
- [ ] Obstáculos de **formatos variados** (não só retângulos), com hitbox desacoplada.
- [ ] Pássaros comestíveis = moeda ("comida").
- [ ] Parallax multicamadas (profundidade).
- [ ] Dificuldade crescente; **reinicia do zero** a cada partida.
- [ ] Power-ups: escudo, vida extra, câmera lenta, ímã, moeda dobrada, etc.
- [ ] Ninho (Hangar): comprar ~10 pterodáctilos com traços (escudo nato, ímã permanente,
      moeda 2x/3x, etc.).
- [ ] Desafio Diário e Semanal, seed fixa, determinístico, leaderboard local + central.
- [ ] Troféus por conquistas; top-3 do desafio diário ganham troféu no perfil.
- [ ] 10 idiomas (en default, es, pt-BR, fr, it, de, ja, zh, ko, hi).
- [ ] Trilha sonora menu + gameplay; SFX nos botões.
- [ ] HUD: distância, comida, fps, nível, velocidade, seed.
- [ ] Tempos do dia (manhã/tarde/noite — cosmético) e clima (chuva/tempestade/vento/neve —
      afeta gameplay), determinísticos.
- [ ] Menu inicial: Novo Jogo (Endless), Desafio Diário, Desafio Semanal, Configurações,
      Leaderboard, Ninho, Loja, Doação (Ko-Fi/BMC), Expansões, Compartilhar
      (WhatsApp/Instagram/TikTok/E-mail/URL).
- [ ] Configurações: volume, música menu/gameplay on/off, idioma.
- [ ] Tela de Expansões: selecionar expansão ativa.
- [ ] Loja: comprar moedas, comprar expansões.
- [ ] Leaderboard: Endless, Diário, Semanal.
- [ ] Primeiro acesso pede nome do jogador.
- [ ] Home topo: nome ativo, avatar, total de moedas, nº de troféus, nível máx Endless;
      trocar/criar jogador; ID único global (Supabase); tela de Perfil ao clicar no avatar.
- [ ] Game Over overlay: distância, comida, near-misses, etc.
- [ ] Responsivo: desktop, tablet, celular; retrato e paisagem; vários tamanhos.
- [ ] PWA instalável; deploy GitHub Pages → itch.io; futuro: Google/Samsung/Huawei/Microsoft.
- [ ] Objetos geométricos substituíveis por PNG sem perda de performance.
- [ ] Packs de look&feel (cosméticos) compráveis.
- [ ] Toda imagem trocável documentada com asset-spec para geração por IA.

## 7. Riscos e mitigações

- **Determinismo quebrar entre dispositivos** → passo fixo + testes de "replay" no CI.
- **Performance com PNGs AAA** → texture atlases + batching WebGL + budget de draw calls.
- **Monetização real em PWA** → adiada; interface de entitlements isola a decisão.
- **Sessões autônomas divergirem** → CLAUDE.md + contrato de determinismo + convenções +
      testes como guardrails.
