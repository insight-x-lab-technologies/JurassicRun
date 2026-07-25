# Fase 9 — Melhorias estruturais

**Objetivo:** endereçar 10 lacunas estruturais reportadas pelo usuário antes de iniciar features
novas: parallax em camadas com transparência, feedback de dino/power-up, cobertura de hitbox dos
obstáculos, animação de morte, áudio rico, toggle de SFX, briefing de desafio com modificadores
por seed, novos obstáculos e animação cosmética de obstáculo.

> Cada item vira uma **spec própria** (`docs/superpowers/specs/`) na hora de implementar. Este
> arquivo é o guarda-chuva da fase: escopo, decisões travadas, notas de determinismo e os
> **prompts de geração de asset prontos** (apêndice ao fim).

## Premissas mantidas (NÃO violar)

- **Determinismo** (REGRA 1): nada de `Math.random`/`Date.now`/`performance.now` em `src/core/`;
  passo fixo; mesma seed+inputs ⇒ mesmo estado. Itens que tocam core re-pinam goldens e passam
  `verify-determinism`.
- **Arte desacoplada** (REGRA 2): colisão usa hitbox lógica, nunca pixels. A correção do #3 é
  **arte cobrir a hitbox**, jamais hitbox seguir a arte.
- **Justiça de leaderboard**: campo lógico fixo 320×180; desafios reproduzíveis/verificáveis a
  partir de `seed + timeline`. Modificadores de desafio (#8) são **função pura da seed**,
  idênticos para todos, recomputados pelo verificador.
- **Hobby sem custo, PWA offline**: áudio (#5) é **procedural** (sem arquivos); assets de imagem
  são gerados pelo usuário a partir das specs deste arquivo e servidos localmente.
- **Performance 60fps**: sem alocação por frame no hot path.

## Decisões de produto travadas

| # | Pedido | Decisão |
|---|--------|---------|
| 2 | Dino do Ninho no gameplay | **Só indicador de poder** (sem skin nova de dino). O traço já funciona; o feedback vem do #7. |
| 5 | Áudio | **Procedural muito mais rico** (multi-camada + SFX variados). Sem arquivos `.ogg`. |
| 8 | Briefing de desafio | **Briefing + modificadores derivados da seed** (idênticos p/ todos; verificador recomputa). |
| 10 | Obstáculos animados | **Só cosmética** (frames idle no render; hitbox estática). |

---

## Frente A — Arte / render (determinismo intocado)

### 9.1 Parallax em camadas com transparência (#1) — CONCLUÍDA
- [x] Regerar as camadas de parallax como **PNGs recortados com canal alpha** (silhuetas, não
      retângulos opacos), permitindo que as camadas se intercalem para dar profundidade.
- [x] Adicionar uma 4ª camada de **objetos de impacto** (foreground) à frente do `near`.
- [x] Ajustar `scripts/gen-ui.mjs` para fatiar/exportar **preservando alpha** (modo single por
      arquivo; sem `chroma`/`hardAlpha`/`padBottomTo`/`trimChromaEdges` — a transparência já vem
      do PNG-fonte).
- [x] Recalibrar `PARALLAX_LAYERS` (`dispHeight`/`baseFromBottom`/`scrollFactor`) e
      `PARALLAX_SOURCE_WORLD_WIDTH` para a arte nova.

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano `docs/superpowers/{specs,
> plans}/2026-07-24-parallax-alpha-layers*`). **Construída contra PLACEHOLDER alpha procedural**
> (decisão do usuário: pipeline agora, arte AAA real dropa depois só trocando os 12 PNG-fonte —
> REGRA 2; precedente do atlas 8.2/áudio 4.10). Novo `scripts/gen-parallax-placeholder.mjs` gera 12
> silhuetas tileáveis (topo transparente, perspectiva atmosférica far→near, `impact` esparso com
> gating por cossenos SEM fase ⇒ tileável sem costura no wrap); `gen-ui.mjs` processa em **modo
> single alpha** (`opaque:true`=sem trim, sem chroma) e o pipeline opaco legado (chroma + bandas
> `bg.layers`) foi aposentado. `PARALLAX_LAYERS` = 4 camadas (`bg.layer.impact`, scrollFactor
> 0.15/0.35/0.6/0.85); `impact` fica **atrás do mundo** (depth negativo — justiça/legibilidade
> travadas ⇒ não oclui obstáculos), honrando "à frente do near" como a camada de fundo mais
> próxima. **Calibração-chave:** `dispHeight` = altura NATURAL da textura (texH/densidade = texH/2 =
> 192/192/224/256) ⇒ box aterrada no chão mostra a textura inteira (dispHeight menor cortava o
> rodapé/silhueta). Verificação Playwright (build prod, 3 temas): backdrop `bg.screen` VAZA pelos
> topos transparentes (classic golden-hour, volcano lava, glacier aurora), tint daynight preservado,
> sem costura de chroma. Review final opus **"READY TO MERGE"** (0 Critical/Important). Suíte
> **793/154**, check limpo. **Backlog:** arte AAA real (12 paths do Apêndice A.1); profundidade
> sutil (silhuetas placeholder low-contrast; arte real coese fixa); FPS não-medido sob GPU real
> (SwiftShader headless); `PARALLAX_SOURCE_WORLD_WIDTH`/dispHeight recalibram com dims da arte real.

**Estado atual (causa):** as 3 tiras (`parallax.far/mid/near`) são bandas **opacas** fatiadas de
uma folha fotorreal (`<theme>_ui-parallax.chromakey.png`), então empilham como 4 planos isolados
(inclui o backdrop `bg.screen`) e as "colunas" que o usuário vê são as costuras de tiling.
**Correção:** camadas transparentes independentes que deixam a de trás vazar.

**Approach:** 4 camadas por tema, scrollFactor crescente (profundidade):
`far` 0.15 · `mid` 0.35 · `near` 0.6 · `impact` 0.85. `bg.screen` (backdrop de tela cheia) fica
atrás de tudo com o céu. `ParallaxVisual` já tem o ramo `sprite` — só entram texturas com alpha.

**Toca:** `scripts/gen-ui.mjs`, `src/render/parallax.ts`, `src/render/GameScene.ts` (posição/
depth da 4ª camada), `docs/assets/specs/bg.layer.*.md`. **Core intocado.** Prompt de geração:
[Apêndice A.1](#a1-parallax-em-camadas-91).

**Aceite:** 3–4 camadas visíveis com profundidade e alpha (fundo vaza), sem costura de tiling
visível no scroll, tint de daynight preservado, 60fps.

### 9.2 Obstáculos cobrem a hitbox — composição por segmentos (#3) — CONCLUÍDA
- [x] Trocar o "esticar 1 PNG para o bbox" por **montagem por segmentos** (9-slice / tiling
      vertical) que preenche exatamente qualquer altura aleatória da hitbox.
- [x] Arte nova por obstáculo em **3 partes**: `base` (encosta no chão/teto), `body` (segmento
      repetível), `cap` (ponta). Atlas `obstacles` ganha os frames `<id>.{base,body,cap}`.
- [x] Render monta `cap + N×body + base` cobrindo a hitbox (N = ceil((altura − base − cap) /
      body), alocação-zero via pool de `Image` já existente).

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano `docs/superpowers/{specs,
> plans}/2026-07-24-segmented-obstacles*`). **Escopo:** só obstáculos de hitbox **`aabb`**
> (`obstacle.tree`/`obstacle.vine`) são segmentados — é neles que o retângulo alto e fino de altura
> variável distorcia o sprite único. `obstacle.stalactite` (polygon/triângulo) e `obstacle.boulder`
> (circle) seguem **1 sprite** (a forma da arte casa a forma da hitbox, sem o problema). **Pipeline
> contra PLACEHOLDER procedural** (precedente 9.1/8.2): `scripts/gen-obstacle-placeholder.mjs` gera
> as 6 tiras `[cap|body|base]` por tema (full-bleed opaco, `body` tileável); a arte AAA real dropa
> só trocando os PNG-fonte (prompts A.2). Peças: modo `parts` no `gen-atlas.mjs` (fatia a tira,
> largura consistente via união do X-bbox + escala única ⇒ `dw` idêntico entre partes, altura
> própria; emite `<id>.{cap,body,base}` nos 3 atlas de tema); helpers PUROS `sprites.ts`
> (`segmentFramesFor` memoizado + `layoutSegments` alocação-zero via scratch); casca `GameScene`
> (`drawSegmentedEntity` monta cap+N×body+base pelo pool de `Image`, `segDimCache` chaveado por
> frame ⇒ zero alocação por frame — REGRA 3); guardas de atlas exigem as 3 partes por id segmentado.
> Execução SDD por subagentes (4 tasks + review por task + review final opus): Task 1 fix inline
> (implementador apagara 8 testes de sprite ⇒ restaurados), Task 4 finalizada INLINE (subagente caiu
> por limite de sessão), review final **1 Important REGRA 3** (alocação por frame em
> `segmentFramesFor`/`segDims`) CORRIGIDO inline (memoização; precedente de bloqueio 8.3 T3).
> **Validação Playwright** (exposição TEMP `window.__jrGame` revertida): árvore aabb `halfH≈33` →
> `cap + 4×body + base`, largura constante 15px, cobertura contígua 81px = `H×renderScale` sem vão
> nem distorção; stalactite/boulder = 1 sprite. FPS não-medido sob GPU real (SwiftShader headless);
> composição sem custo/alocação por frame. Suíte **802/802**, `check` limpo. **Backlog:** arte AAA
> real segmentada (prompts A.2); animação idle cosmética por parte (9.4); segmentar stalactite se a
> arte triangular real exigir.

**Estado atual (causa):** hitbox de altura aleatória por instância (`aabb(6, rng.range(24,40))`);
o render só faz `setDisplaySize(bbox)` de um sprite único ⇒ distorce/deixa vazios, criando a
percepção de "colisão no vazio". ⚠️ **Não** mexer na colisão (REGRA 2) — a arte é que passa a
cobrir 100% da caixa.

**Toca:** `src/render/GameScene.ts` (montagem segmentada), `src/render/sprites.ts` (helper de
composição), `docs/assets/specs/obstacle.*.md`, `scripts/gen-atlas.mjs` (empacotar 3 frames por
obstáculo). **Core intocado.** Prompt de geração: [Apêndice A.2](#a2-obst%C3%A1culos-segmentados-92).

**Aceite:** obstáculos de qualquer altura preenchidos sem distorção nem vazio; a borda visível
coincide com a hitbox (validação Playwright sobrepondo hitbox×sprite); 60fps.

### 9.3 Animação de morte do dino (#4) — CONCLUÍDA
- [x] Fase cosmética **`dying`** no render entre `world.alive → false` e o overlay DOM de Game
      Over: impacto/queda do dino + partículas (penas/poeira) + screen-shake curto.
- [x] Só então revelar `<GameOverOverlay>` (atrasar o `snapshot.phase==='dead'` visível por
      ~0.6–0.9s de animação, sem tocar o core que já congela na morte).

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano `docs/superpowers/{specs,
> plans}/2026-07-25-dino-death-animation*`). **Duração 0,75 s.** Puro×casca: `src/render/death.ts`
> (curvas puras — `deathVisual(elapsed, out)`: rotação `2π·1,25·p²`, `dropFactor = −0,5p + 1,5p²`
> (pop para cima → queda que chega exatamente ao chão em p=1), shake amortecido `(1−p)²` a 18/23,4 Hz,
> flash de impacto 0,12 s) + `src/render/particles.ts` (14 partículas **stateless**: o estado da
> partícula `i` no tempo `t` é função fechada, ângulo áureo no lugar de RNG) + relógio cosmético no
> `MatchController` (`deathElapsed`/`dying`; `advance` acumula tempo REAL em `dead` sem rodar steps
> nem redisparar `onGameOver`). Casca: `GameScene` (transições 1×: congela o flap, memoriza o ponto
> de impacto, aplica rotação/queda clampada ao chão/tint/partículas no `Graphics` já existente/shake
> só na câmera — o `scrollX` de mundo de parallax e culling **não** leva shake; na saída repõe
> rotação, tint, `scrollY` e religa a anim) + `startGame` (`MatchSnapshot.dying`, `isDead` do
> restart exige `!dying`) + `PlayScreen` (gate de re-render com `prevDying`).
> **Decisões:** (a) `dying` é **booleano**, não um membro novo de `MatchPhase` — `phase==='dead'`
> segue significando "partida acabou" para hooks/HUD/controles, zero churn de tipos; (b) os efeitos
> de fim de partida (moedas, leaderboard, troféus, replay, submissão online) continuam disparando no
> **instante da morte** — sair da tela durante a animação não perde progresso; (c) restart bloqueado
> durante o `dying` (o toque residual do flap fatal não pula a cena); (d) **os frames `dino.hit.*`
> do Apêndice A.3 ficaram FORA** — a animação é procedural sobre o frame de flap congelado; sem arte
> real, um placeholder derivado só acrescentaria 5 frames × 3 atlas com ganho ~nulo. O asset-spec
> ficou documentado (`docs/assets/specs/dino.hit.md`, com o how-to de 4 passos para plugar a arte
> real depois) — REGRA 5 honrada sem branch morto no código.
> **Validação Playwright** (build de produção, exposição TEMP `window.__jr` revertida): morte no
> chão e morte no teto; overlay revelado **exatamente** quando `deathElapsed` satura em 0,75 e
> `dying` vira false (`revealedWhileDying: false`); durante a fase, rotação evoluindo, tint saindo do
> vermelho de impacto, `camera.scrollY` oscilando (shake) e — na morte no teto — o dino caindo de
> y=3 para y≈115 unidades de mundo; após o fim, rotação 0/`scrollY` 0/anim de flap religada e
> restart voltando a `ready` com `deathElapsed` 0. Nota de ambiente: o relógio usa o `delta` do
> Phaser (mesma base de tempo do resto do jogo), que é suavizado/limitado — sob GPU headless
> (SwiftShader, ~4–9 fps) a animação estica em tempo de parede; a 60 fps são os 0,75 s nominais.
> Suíte **823/157**, `check` limpo, determinismo **67**. **Backlog:** arte real `dino.hit` (A.3);
> amplitude do shake (1,6 unidade de mundo) é conservadora porque as faixas de chão/teto têm
> `scrollFactor 0` e não tremem junto — revisitar junto com 9.4.

**Toca:** `src/render/GameScene.ts` (estado dying + tween/partículas), `src/render/match.ts` ou a
ponte `startGame`→snapshot (flag de "morte em animação"), atlas `dino.hit.*` (frames). **Core
intocado.** Prompt: [Apêndice A.3](#a3-frames-de-morte-do-dino-93).

**Aceite:** ao colidir, o dino reage visualmente (impacto/queda) antes do Game Over; overlay DOM
aparece após a animação; determinismo do core inalterado.

### 9.4 Animação cosmética de obstáculo (#10)
- [ ] Frames idle por obstáculo (vinha/folhas balançando, estalactite pingando/vibrando) tocados
      no render; **hitbox fica estática** (lógica intacta).
- [ ] Reusar o mecanismo de `Sprite` animado do dino (anim por atlas), aplicado às `Image` do pool
      de obstáculos, sem alocação por frame.

**Toca:** `src/render/GameScene.ts`, `scripts/gen-atlas.mjs` (strips de frames por obstáculo),
`docs/assets/specs/obstacle.*.md` (campo animação). **Core intocado.** Prompt: incluído nos specs
de obstáculo do [Apêndice A.2](#a2-obst%C3%A1culos-segmentados-92) (variante animada opcional).

**Aceite:** obstáculos com micro-animação idle; colisão idêntica; 60fps sem GC.

---

## Frente B — Feedback de jogo

### 9.5 Indicador de power-up ativo + traço do dino (#7, resolve o #2)
- [ ] HUD DOM: **badges** dos efeitos ativos (`world.effects[]`) com **barra de duração**
      esvaziando (`remaining` em steps ⇒ segundos = `remaining × FIXED_DT`, determinístico).
- [ ] **Aura** ao redor do dino no canvas por efeito ativo (cor por tipo; alocação-zero, cacheada
      na transição).
- [ ] Mostrar o **traço permanente** do dino ativo do Ninho (ex.: `magnet` sempre, `doubleFood`)
      como badge fixo — assim o jogador vê o efeito da escolha do Ninho no gameplay.

**Estado atual:** os efeitos existem em `world.effects` com `remaining`; nada os exibe. O traço do
dino é aplicado em `createWorld` mas sem indicação visual. Isto entrega o feedback que faltava do
#2 sem arte nova de dino.

**Toca:** `src/app` (componente HUD de efeitos), `src/render/GameScene.ts` (aura), `src/render/
hud.ts` (dados de efeitos → snapshot), i18n `hud.effect.*` / nomes de power-up (reusar
`powerup.*`/`trait.*` se já existirem; senão add-locale nos 10). **Core intocado.**

**Aceite:** ao pegar/ter um power-up, aparece badge + duração decrescente + aura; o traço do dino
ativo é visível; sem strings hardcoded.

---

## Frente C — Áudio / UX

### 9.6 Áudio procedural rico (#5)
- [ ] Reescrever `src/services/audio/tracks.ts` + `engine.ts`: música **multi-camada**
      (baixo + percussão + melodia + harmonia/pad), com tempo/tom/escala distintos por contexto
      (menu vs. gameplay) e por tema (classic/volcano/glacier).
- [ ] **SFX distintos e agradáveis**: flap, coleta de comida, colisão/morte, ativação de
      power-up, game over, clique de menu (hoje só existe `click`).
- [ ] Manter tudo procedural (osciladores + envelopes + ruído filtrado), zero arquivo, offline.

**Estado atual:** placeholder do 4.10 — sequência de notas trivial + 1 SFX de clique. O
`AudioEngine` é a costura; reescrita fica atrás dela sem mexer nos consumidores.

**Toca:** `src/services/audio/*`. Sem strings i18n. `docs/audio/specs/` documenta as trilhas.
**Core intocado.**

**Aceite:** música de menu e de gameplay claramente mais ricas e distintas; SFX por evento;
respeita volume/toggles; sem custo/arquivo.

### 9.7 Toggle de SFX de clique em Configurações (#6)
- [ ] `SettingsState.buttonSfx: boolean` no molde de `menuMusic`/`gameplayMusic` (saneado por
      campo, persistido, reativo).
- [ ] `resolveAudioTarget` / `bindButtonSfx` respeitam o toggle (SFX silenciado quando off).
- [ ] `SettingsScreen`: novo toggle; chave i18n `settings.buttonSfx` nos 10 locales (skill
      `add-locale`).

**Toca:** `src/services/settings/*`, `src/services/audio/*`, `src/app/.../SettingsScreen`,
locales. **Core intocado.**

**Aceite:** desligar o SFX de clique silencia os cliques e persiste no reload; demais áudios
inalterados.

---

## Frente D — Conteúdo / desafios (toca core → determinismo)

### 9.8 Novos tipos de obstáculo (#9)
- [ ] Adicionar 2–3 obstáculos via skill `add-gameplay-entity` (lógica determinística + hitbox
      desacoplada + asset-spec + testes). Candidatos: `rock_arch` (multi-hitbox, adiado do 1.4),
      um obstáculo estreito **flutuante** (gap vertical), um par **chão+teto** que estreita a
      passagem.
- [ ] Integrar ao `OBSTACLE_CATALOG` / distribuição de spawn; re-pin de goldens se a sequência de
      spawn mudar; `verify-determinism` verde.

**Toca:** `src/core/spawn/catalog.ts` (+ `sim/hitbox` se multi-hitbox), goldens de replay,
`docs/assets/specs/obstacle.*.md`, atlas. Prompt: [Apêndice A.4](#a4-novos-obst%C3%A1culos-98).

**Aceite:** novos obstáculos jogáveis e justos; determinismo provado; arte cobre a hitbox
(usa a composição por segmentos do 9.2).

### 9.9 Briefing + modificadores de desafio por seed (#8)
- [ ] **Briefing screen** (DOM) antes de Diário/Semanal: recorde atual (local + central se
      online), seed do período, e as **regras do dia** (traço proibido = padrão + os
      modificadores derivados da seed). Botões Jogar / Voltar.
- [ ] **Modificadores determinísticos:** função pura `challengeModifiersForSeed(seed)` em
      `src/core/challenge/` (usa `hashSeed` de `@core/rng`, sem `Date`/random) → ex.:
      `{ forcedWeather?: WeatherKind, bannedPowerup?: PowerupKind }`.
- [ ] `createWorld`, quando em modo desafio (flag `challenge:true` + seed), **deriva os
      modificadores internamente** e os aplica (clima fixo ao invés do gerado; spawner de power-up
      pula o tipo banido). Idênticos para todos os jogadores.
- [ ] **Verificação:** `verifyReplay`/`verify-challenge` reconstroem `{seed, trait:'none',
      challenge:true}` ⇒ recomputam os mesmos modificadores da seed ⇒ replays seguem válidos.
      Regenerar `_verify.bundle.js` (`build:edge`).

**Notas de determinismo:** os modificadores só alteram campos já hasheados (`weather`, entidades
de power-up emitidas) ⇒ possivelmente **sem novas chaves em `hashState`**. Goldens de replay atuais
são Endless/no-challenge ⇒ **não re-pinam**; adicionar um golden de modo-desafio é recomendado. O
bundle de verificação **precisa regenerar**.

**Toca:** `src/core/challenge/` (novo), `src/core/sim/world.ts` (aplicação), `src/render/
matchFactory.ts` (flag challenge), `src/app` (briefing screen), `src/services/online/
verifyChallenge.ts` + bundle, i18n `challenge.brief.*`. **Core tocado (determinístico).**

**Aceite:** tela de briefing mostra recorde + regras; modificadores idênticos por seed p/ todos;
`verify-determinism` verde; verificação de replay de desafio válida com os modificadores.

---

## Ordem de execução

**A → B → C → D.** Arte/feedback primeiro (maior impacto percebido), core/desafios por último.
Execução SDD por subagentes, **um item por PR**, com review por task + review final + (nos itens D)
`determinism-guardian`. Assets de imagem gerados pelo usuário a partir do apêndice antes do item
correspondente; áudio (#5) não tem dependência externa.

## Definição de pronto (fase)
- `npm run check` limpo, `npm test` verde, `verify-determinism` verde nos itens que tocaram core.
- Parallax com profundidade real; obstáculos cobrindo a hitbox; morte animada; power-ups visíveis;
  áudio rico + toggle de SFX; briefing de desafio com modificadores por seed; ≥2 obstáculos novos.

---

# Apêndice — Prompts de geração de asset (prontos)

> **Regras gerais para todos os prompts:** fundo **transparente** (PNG com alpha), **sem texto**,
> **sem sombra projetada no chão** (a não ser onde indicado), estilo coerente com
> `docs/assets/ART-DIRECTION.md`. Gerar **um tema por vez** (classic / volcano / glacier) trocando
> só a paleta indicada. Salvar na pasta-fonte indicada; o pipeline (`gen-ui`/`gen-atlas`) processa
> para `public/ui` / `public/atlas`.

## A.1 — Parallax em camadas (9.1)

Gerar **4 PNGs transparentes por tema** (far, mid, near, impact). Cada um é uma faixa horizontal
**tileável** (a borda esquerda casa com a direita) com **topo transparente** para a camada de trás
vazar. NÃO é uma cena fotorreal fechada — é uma silhueta/recorte por plano.

| Camada | Arquivo-fonte | Dimensão (px) | Conteúdo | Transparência |
|--------|---------------|---------------|----------|---------------|
| far | `public/art/themes/<tema>/parallax/far.png` | 2048 × 384 | linha de montanhas/horizonte distante | topo 100% transparente; silhueta na metade inferior |
| mid | `public/art/themes/<tema>/parallax/mid.png` | 2048 × 384 | colinas/rochas médias | topo transparente; corpo na parte de baixo |
| near | `public/art/themes/<tema>/parallax/near.png` | 2048 × 448 | vegetação/relevo próximo | topo transparente; base cheia |
| impact | `public/art/themes/<tema>/parallax/impact.png` | 2048 × 512 | objetos de destaque em 1º plano (troncos, folhas grandes, pedras), **esparsos** | ~70% transparente (só os objetos) |

**Requisitos técnicos (todas as camadas):**
- Tileável na horizontal (seamless left↔right) — **crítico** para o scroll infinito.
- Nada de céu opaco: o céu é o backdrop `bg.screen`; estas camadas são só o relevo com alpha.
- Iluminação neutra (aceita tint de daynight por cima). Sem gradiente de céu embutido.
- Vista lateral 2D, plana (sem perspectiva forte).

**Prompt (far):**
```
Seamless horizontal side-scrolling parallax layer, distant mountain range silhouette on a fully
transparent background, only the lower half contains the mountain ridge, upper half completely
transparent (no sky), tileable left to right edges matching, flat 2D game art, neutral even
lighting, no text, no characters. PALETTE: <tokens do tema>.
```

**Prompt (mid):**
```
Seamless horizontal parallax layer, mid-distance rolling hills and rock formations, transparent
background, transparent upper area, content anchored to the bottom, tileable left-right, flat 2D
side-scroller art, neutral lighting, no sky, no text. PALETTE: <tokens do tema>.
```

**Prompt (near):**
```
Seamless horizontal parallax layer, near foreground terrain with dense vegetation/foliage rising
from the bottom edge, transparent background and transparent top, tileable left-right, flat 2D
game art, strong readable silhouette, no sky, no text. PALETTE: <tokens do tema>.
```

**Prompt (impact):**
```
Seamless horizontal foreground overlay layer, a few large sparse foreground elements (big leaves,
tree trunks, hanging vines, rocks) spread across a mostly transparent canvas (about 70% empty),
tileable left-right, flat 2D side-scroller art, high contrast silhouette, no sky, no ground line,
no text. PALETTE: <tokens do tema>.
```

**PALETTE por tema (substituir `<tokens do tema>`):**
- classic: `jungle canyon at golden hour, warm greens #3a7d34, olive, warm brown rock, hazy amber horizon`
- volcano: `volcanic wasteland, dark basalt greys, ember orange #ff5a1e glow, ash haze, red-black rock`
- glacier: `frozen tundra, pale ice blue #bfe6f2, white snow, cold grey rock, aurora teal glow`

## A.2 — Obstáculos segmentados (9.2)

Cada obstáculo vira **3 frames** que se montam para preencher qualquer altura da hitbox
(estreita, `halfW ≈ 4–6` ⇒ largura ~10–12px lógicos; altura variável). Autorar como **tira
vertical** com as 3 partes empilhadas, ou 3 PNGs separados.

| Parte | Papel | Regra de tiling |
|-------|-------|-----------------|
| `cap` | ponta (topo p/ obstáculo de chão; base p/ obstáculo de teto) | não repete |
| `body` | miolo repetível | **tileável na vertical** (topo casa com a base) |
| `base` | onde encosta (chão/teto) | não repete |

**Dimensões-fonte (por obstáculo, @1x lógico; exportar @2x):**
- Largura: **96 px** (bate com specs atuais; o render escala para a hitbox).
- `cap`: 96 × 96 · `body`: 96 × 64 (seamless vertical) · `base`: 96 × 64.

**A largura visível deve preencher a hitbox** (nada de conteúdo "flutuando" no centro com bordas
vazias) — o corpo ocupa a largura toda; a colisão continua sendo a hitbox lógica.

**obstacle.tree — prompts:**
```
cap:  Top of a prehistoric tree: dense fern-like canopy crown, flat cartoon vector, bold dark
      outline, transparent background, fills the horizontal width, no trunk below, no text.
body: Vertically seamless tileable segment of a thick prehistoric tree trunk, bark texture, flat
      cartoon vector, bold outline, fills full width, top edge matches bottom edge for tiling,
      transparent background, no text.
base: Base of a prehistoric tree trunk with roots spreading onto the ground, flat cartoon vector,
      bold outline, fills full width, transparent background, no cast shadow, no text.
PALETTE: trunk #6b4a2b, foliage #2f6b2f, outline #2a1a10 (classic). Volcano: charred bark, ember
cracks. Glacier: frost-covered bark, pale blue.
```

**obstacle.vine (teto) — prompts:** (cap = fixação no teto; body = liana repetível; base = ponta)
```
cap:  Vine attachment growing down from a ceiling/rock edge, flat cartoon vector, bold outline,
      fills width, transparent background, no text.
body: Vertically seamless tileable hanging vine/liana segment with small leaves, flat cartoon
      vector, fills width, top matches bottom, transparent background, no text.
base: Dangling tip of a hanging vine with a cluster of leaves, flat cartoon vector, bold outline,
      transparent background, no text.
PALETTE: vine #2f6b2f, leaves #3a7d34, outline #1e3d1e (classic; volcano/glacier recolor).
```

**obstacle.stalactite (teto, ponta) — prompts:** (cap = fixação larga; body = corpo cônico
repetível; base = ponta afiada)
```
cap:  Wide base of a stalactite fused to the ceiling rock, flat cartoon vector, bold outline,
      fills width, transparent background, no text.
body: Vertically tileable tapering rock stalactite mid-section, flat cartoon vector, subtle
      striations, fills width, top matches bottom, transparent background, no text.
base: Sharp pointed tip of a stone stalactite, flat cartoon vector, bold outline, transparent
      background, no text.
PALETTE: rock #7a6b5a, highlight #a89684, outline #3a2f26 (classic; volcano basalt/glacier ice).
```

**obstacle.boulder** é `circle` (não segmentado): manter 1 sprite que **preenche o círculo**
(sem bordas transparentes internas):
```
A round prehistoric boulder that fills a circular frame edge to edge, flat cartoon vector, bold
outline, simple cel shading, transparent background outside the circle only, no cast shadow,
no text. PALETTE: rock #7a6b5a, outline #3a2f26 (classic; volcano/glacier recolor).
```

**Variante animada (9.4, opcional por obstáculo):** exportar o `body`/`cap` como **strip
horizontal de 4 frames** de micro-movimento (vinha balançando, gota na estalactite, folhas
tremendo). Mesmo tamanho por frame; loop suave (frame 4 volta ao 1).
```
4-frame horizontal sprite strip of the same <obstacle part> with a subtle idle animation
(<swaying leaves / dripping tip / trembling>), loopable, identical framing per frame, flat
cartoon vector, transparent background, no text.
```

## A.3 — Frames de morte do dino (9.3)

Strip horizontal de **5 frames** do dino batendo/caindo (impacto → giro → queda). Mesmo
enquadramento por frame; alinhado ao `dino.default`.

- Arquivo-fonte: `public/art/themes/<tema>/dinos/dino.hit.png` (strip 1×5).
- Tamanho por frame: igual aos frames de `dino.default`.

```
5-frame horizontal sprite strip of a cartoon pterodactyl getting hit and tumbling: frame 1 impact
recoil (eyes shut, wings back), frames 2-3 spinning/tumbling, frames 4-5 falling limp with a few
feathers coming loose. Flat cartoon vector, bold dark outline, consistent framing and size per
frame, transparent background, no text. PALETTE: match the existing dino sprite.
```

Partículas (penas/poeira) e screen-shake são **procedurais no render** (não precisam de asset).

## A.4 — Novos obstáculos (9.8)

Definir a hitbox lógica no core primeiro (skill `add-gameplay-entity`), depois gerar a arte
**segmentada** (mesmo esquema do A.2: cap/body/base) cobrindo a hitbox.

- **rock_arch** (multi-hitbox, passagem no meio): autorar como pé-esquerdo + topo + pé-direito,
  com o **vão central transparente** (a hitbox é o arco, não o vão). Confirmar o modelo de
  multi-hitbox no core antes de gerar.
```
A prehistoric stone arch/rock gateway seen from the side, two vertical rock pillars joined by a
top span, the central passage fully transparent, flat cartoon vector, bold outline, transparent
background, no text. PALETTE: rock #7a6b5a, outline #3a2f26.
```
- **floating spire** (obstáculo estreito flutuante, gap vertical): 1 sprite que preenche o bbox.
```
A narrow floating rock spire / crystal shard, tall and thin, filling its frame vertically, flat
cartoon vector, bold outline, subtle inner glow, transparent background, no text.
```
- **chão+teto (par que estreita a passagem)**: reusar `tree`+`stalactite` posicionados como par
  (sem arte nova) OU gerar um `pillar` simétrico segmentado (cap/body/base) para os dois lados.

> Ao adicionar cada obstáculo: entrada no `docs/assets/asset-registry.md` (status `spec`→`art`),
> asset-spec em `docs/assets/specs/`, e goldens re-pinados se a sequência de spawn mudar.
