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
> restart voltando a `ready` com `deathElapsed` 0. **Review final: NOT READY → 1 Important**
> (o "pop" inicial, `dropFactor` negativo ≈ −4% de `maxDrop`, podia levar o sprite acima de `y=0`
> numa morte colada no teto) **corrigido inline** — clamp nas duas pontas e nunca acima do próprio
> ponto de impacto; revalidado (morte no teto: `deathY=14`, `minY=14` ⇒ o pop não sobe mais, queda
> até `y≈120`). Nota de ambiente: o relógio usa o `delta` do
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

### 9.4 Animação cosmética de obstáculo (#10) — CONCLUÍDA
- [x] Idle por obstáculo (árvore/cipó balançando, estalactite pingando) tocado no render;
      **hitbox fica estática** (lógica intacta).
- [x] Sem alocação por frame: curvas puras com scratch + `idleMotionFor` memoizado, sobre o pool
      de `Image` existente.

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano
> `docs/superpowers/{specs,plans}/2026-07-25-obstacle-idle-animation*`).
> **Decisão: animação PROCEDURAL por transformação, não frames de atlas** (mesma escolha de 9.3).
> A tira de 4 frames do Apêndice A.2 custaria 72 frames de PLACEHOLDER (4 frames × 3 partes ×
> 2 obstáculos × 3 temas) com movimento inventado pelo gerador, travaria a arte AAA real em
> entregar 4× frames por parte, inflaria o atlas/precache e ainda exigiria trocar o pool de
> `Image` (alocação-zero, 8.2/9.2) por `Sprite` com estado de anim por objeto. A transformação
> embala placeholder e arte real sem retrabalho; o caminho de frames fica **documentado** no
> campo *Animação* dos asset-specs de obstáculo (REGRA 5 sem branch morto no código).
> **Invariante crítica — a sangria:** deslocar um segmento por `dx` descobriria uma tira `|dx|` da
> hitbox, regressão direta do aceite de 9.2 ("a borda visível cobre a caixa"). Quem balança
> desenha cada segmento com largura `W + 2·amp` (arte full-bleed opaca), e como `|dx| ≤ amp` a
> cobertura vale **por construção**, em qualquer instante — não por tuning.
> Puro×casca: `src/render/idle.ts` (`swayOffset` = `amp·t01²·sin(2π·0,4 Hz·t + fase)`, com a
> extremidade **presa** em `t01=0` — âncora `bottom` na árvore, `top` no cipó; `dripAt` = ciclo de
> 2,5 s, gota engorda parada 40 % do ciclo, cai em `q²` e desvanece; `idlePhaseFor(x)` dessincroniza
> por instância **sem RNG**, e `wrapIdleTime` embrulha o relógio em 100 s — 0,4 Hz e 2,5 s fecham
> **40 ciclos exatos** ⇒ embrulho invisível e sem degradar precisão de float) + casca `GameScene`
> (relógio `idleElapsed` que congela na pausa, `swayDx` por segmento, gota no `Graphics` já
> existente como as partículas de 9.3 — a estalactite `polygon` **não** se desloca, cobertura
> byte-idêntica). Ligar/tunar/desligar = campo `idle` no manifesto (REGRA 2); `obstacle.boulder`
> fica estático de propósito.
> **Review final: READY** com 2 Minor, ambos corrigidos inline: (a) `deltaMs` do relógio idle sem
> clamp (volta de aba em background daria salto) ⇒ clampado em `MAX_FRAME_TIME` como no
> `FixedStepLoop`; (b) faltava a guarda prometida na spec ⇒ `manifest.test.ts` passa a exigir que
> **só ids `obstacle.*`** tenham `idle`.
> **Validação Playwright** (build de produção, exposição TEMP `window.__jrSway`/`__jrDrip`
> revertida): 219 amostras em partidas reais ⇒ árvore `freeDx ∈ [−0,50; +0,49]` (amp 0,6) e cipó
> `[−0,66; +0,65]` (amp 0,8) — balançando de fato; **0 violações de cobertura** (cap e base sempre
> com `segLeft ≤ hitLeft` e `segRight ≥ hitRight`); gota em 94 amostras, fase de formação em `y=0`
> e queda até `y≈24,7` de 26; **0 erros de console**. Gotcha reconfirmado: medir o segmento livre
> (na árvore é o `cap`, não a `base` — a base é a extremidade PRESA) e SW cacheia `dist` antigo
> (unregister + clear caches + `?nocache`).
> Suíte **843** testes, `check` limpo, determinismo **67**.
> **Backlog:** arte AAA real segmentada (A.2) e, se um dia ela vier animada, a variante de frames.

**Toca:** `src/render/GameScene.ts`, `scripts/gen-atlas.mjs` (strips de frames por obstáculo),
`docs/assets/specs/obstacle.*.md` (campo animação). **Core intocado.** Prompt: incluído nos specs
de obstáculo do [Apêndice A.2](#a2-obst%C3%A1culos-segmentados-92) (variante animada opcional).

**Aceite:** obstáculos com micro-animação idle; colisão idêntica; 60fps sem GC.

---

## Frente B — Feedback de jogo

### 9.5 Indicador de power-up ativo + traço do dino (#7, resolve o #2) — CONCLUÍDA
- [x] HUD DOM: **badges** dos efeitos ativos (`world.effects[]`) com **barra de duração**
      esvaziando (`remaining` em steps ⇒ segundos = `remaining × FIXED_DT`, determinístico).
- [x] **Aura** ao redor do dino no canvas por efeito ativo (cor por tipo; alocação-zero, cacheada
      na transição).
- [x] Mostrar o **traço permanente** do dino ativo do Ninho (ex.: `magnet` sempre, `doubleFood`)
      como badge fixo — assim o jogador vê o efeito da escolha do Ninho no gameplay.

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano
> `docs/superpowers/{specs,plans}/2026-07-25-active-powerup-indicator*`). Puro×casca: novo
> `src/render/effects.ts` (`EFFECT_ORDER` = ordem canônica de EXIBIÇÃO `shield,slowMo,magnet,
> doubleCoin`, não a ordem de pickup; `EFFECT_DURATION_STEPS` lidas das constantes do core, sem
> duplicar número; `EFFECT_COLORS`; `EffectView {kind, seconds=ceil(remaining×FIXED_DT), fraction
> ∈[0,1]}`; `effectViews()`; `auraPulse(t)` alpha 0,35–0,70 a 1,4 Hz; `auraRadius`/`AURA_RING_GAP`).
> **Ponte refeita:** o payload do HUD saiu do `MatchSnapshot` (montado 1×/frame no rAF) e virou
> `GameHandle.hud()`, chamado só no gate de ~200 ms — **menos alocação por frame que antes**, mesmo
> com payload maior (`effects`, `extraLives`, `trait`); o traço vem de `world.trait` (verdade da
> partida — nos desafios é `'none'`), não do `nestService`. `EffectBadges.tsx` (DOM, canto inferior
> esquerdo, `pointer-events:none`, `aria-hidden`): chip por efeito com nome + segundos + barra
> esvaziando; chip de vidas extras (`❤ ×N`, some em 0); chip fixo do traço (some em `'none'`).
> Glifos são **emoji** (glifo de fonte, sem asset novo — precedente `📱↻`); 13 chaves i18n novas
> nos 10 locales (`powerup.*.name`, `trait.*.name`, `hud.seconds`, `hud.extraLives`). **Aura no
> canvas** (`GameScene`): um anel por efeito ativo, cor por tipo, raio `max(w,h)/2+margem +
> i·gap`, alpha pulsante pelo relógio `idleElapsed` (congela na pausa), desenhado no `this.gfx` já
> existente ⇒ atrás do dino; **não** aparece durante `dying`; alocação-zero.
> **Decisões:** aura só para efeitos TEMPORÁRIOS (traço permanente ficaria aceso a partida
> inteira = ruído ⇒ vira chip fixo); `extraLife` é carga (`world.extraLives`), não efeito, logo
> chip sem barra; `fraction` usa a duração NOMINAL do catálogo ⇒ o escudo curto do traço
> `headStart` (180 de 300 steps) nasce de propósito com barra parcial.
> **Review:** 1 Important (a tradução `ja` de `trait.headStart` era transliteração katakana
> `ヘッドスタート` ⇒ virou `先行スタート`); gotcha recorrente do SW cacheando `dist` antigo na
> validação (unregister + clear caches + `?nocache`). **Validação Playwright** (build de produção,
> exposição TEMP `window.__jr95` revertida): com `shield`+`magnet` ativos e 1 vida extra ⇒ 3 chips
> (`🛡Shield 5s` barra 99,7%, `🧲Magnet 3s` barra 49,7%, `❤Extra life ×1`); após 2s as barras caíram
> para 83%/35,8% (esvaziando de fato); zero sobreposição com o HUD (chips `left:8,bottom:712` ×
> HUD `left:1081,top:8`); screenshot com `shield+slowMo+magnet` mostrou 3 anéis concêntricos nas
> cores certas (azul/roxo/laranja), atrás do sprite. Suíte **864** testes, `check` limpo.
> **Backlog:** largura da barra sem arredondamento (`fraction*100` pode dar dízima); comentário no
> `GameScene` atribui o z-order da aura à ordem de criação quando o real é `setDepth(0)` vs
> `setDepth(1)`; `seconds` não compensa `SLOW_MO_TIME_SCALE` durante o slow-mo (decisão de design
> documentada). **Frente B concluída.**

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

### 9.6 Áudio procedural rico (#5) — CONCLUÍDA
- [x] Reescrever `src/services/audio/tracks.ts` + `engine.ts`: música **multi-camada**
      (baixo + percussão + melodia + harmonia/pad), com tempo/tom/escala distintos por contexto
      (menu vs. gameplay) e por tema (classic/volcano/glacier).
- [x] **SFX distintos e agradáveis**: flap, coleta de comida, colisão/morte, ativação de
      power-up, game over, clique de menu (hoje só existe `click`).
- [x] Manter tudo procedural (osciladores + envelopes + ruído filtrado), zero arquivo, offline.
- [x] **Extra (fora do escopo original):** seam de **trilha de arquivo** — se existir
      `public/audio/<tema>/<contexto>.mp3`, ele entra em crossfade por cima do procedural.

> **CONCLUÍDA** (`src/core/` intocado, determinismo **67**; spec/plano
> `docs/superpowers/{specs,plans}/2026-07-27-rich-procedural-audio*`). Puro×casca em 3 módulos
> novos: **`music.ts`** (modelo GENERATIVO, não 6 partituras à mão — `MusicScore {bpm, modo,
> progressão, 4 × LayerSpec}` + `voicesForBar(score, bar, out)` que recicla objetos `Voice` num
> scratch; a variação de melodia vem de um **LCG semeado por `(id da partitura, índice do
> compasso)`** ⇒ mesma barra sempre soa igual, o loop de 8 compassos não enjoa e o teste consegue
> afirmar o resultado — sem `Math.random`, no espírito da REGRA 1 mesmo fora do core);
> **`sfx.ts`** (9 SFX como pilha de parciais `SfxLayer` com envelope AD, glide e ruído filtrado +
> `sfxDetune` cíclico para o flap não virar metralhadora); **`musicSource.ts`** (URL da faixa de
> arquivo sob `import.meta.env.BASE_URL`). Casca `engine.ts`: buses separados de música/SFX sob um
> `DynamicsCompressor` de destino, **ruído branco cacheado 1× por LCG**, scheduler que agenda por
> **compasso** (lookahead 25 ms / janela 0,35 s) e renderer de SFX multi-camada.
> **Tema = expansão ativa** (`musicThemeFor` na `policy`, seam 4.6/8.3): trocar de pack troca a
> música ao vivo, como já fazia com o tema CSS.
> **SFX de gameplay:** `src/render/audioEvents.ts` é um detector PURO que faz **diff de escalares
> do `WorldState`** (flap por borda de `lastFlap`, coin/nearMiss/levelUp por contador, powerup por
> bitmask de kinds, block por `extraLives` caindo com `alive` true, hit por `alive true→false`),
> alocação-zero, encaminhado pelo `GameScene`. O `gameOver` (cauda longa) sai da transição 1× para
> `dying` de 9.3, não do detector por-frame.
> **Decisões:** (a) música multi-camada **generativa** em vez de partituras fixas — 6 combinações
> saem de ~30 linhas de dados por score, e trocar o "sabor" de um tema é editar modo/tônica/timbre;
> (b) **SFX NÃO vão para o Suno** — latência zero e variação por evento pedem procedural;
> (c) o seam de arquivo entrou **agora** porque o usuário já vai gerar trilhas no Suno
> (`docs/audio/specs/SUNO-BRIEF.md` traz os 6 prompts prontos): é a REGRA 2 aplicada a áudio, e
> sem arquivo nada muda; (d) os `.mp3` ficam **fora do precache** do SW (`globPatterns` não inclui
> `mp3`) — são grandes e opcionais.
> **Bug do plano corrigido na Task 5:** rearmar o baseline do detector por `world.tick` não cobria
> a **primeira** partida (`0 < -1` é falso) e `createWorld` começa com `level: 1` — e um traço pode
> começar com escudo ativo ⇒ `levelUp`/`powerup` espúrios no 1º frame. Trocado por comparação de
> **referência** do `WorldState` (o `MatchController` só troca o objeto em `startMatch`).
> **Review final: NOT READY** apenas pelo gate de processo (faltava a validação de browser);
> 0 Critical/Important de código. Os 4 Minor foram corrigidos inline: limiter no destino,
> fade-out de 0,4 s no `stopMusic` da trilha de arquivo (o `stop()` seco estalava),
> guarda de `content-type` no `tryFile` e remoção de um `sfxBus.gain.value = 1` redundante.
> **Validação Playwright** (build de produção, SW desregistrado, instrumentando `AudioContext` —
> sem exposição TEMP no código): menu glacier = baixo 65,4 Hz + pad 261,6 + melodia variando por
> barra + 8 hats, com o compasso fechando em **3529 ms = exatamente 4 beats a 68 bpm**; `Select`
> em Volcano troca os timbres na hora (sawtooth F2 87,3 + **8 kicks** 160→45 Hz); gameplay usa
> outro score (36 sawtooth + 18 square); **6 taps ⇒ 6 flaps**, 1 moeda ⇒ arpejo 988+1319,
> morte ⇒ **1 hit** (180→55) + gameOver **1×** (392/311/233); as 3 URLs de trilha foram buscadas
> (seam ligado) e a ausência caiu no procedural; **0 erros de console**; fps 7,3 sob SwiftShader
> headless (mesma faixa de 9.3/9.4 — GPU-bound, não áudio).
> **Gotcha novo:** medir SFX no browser exige **uma única chamada** de `evaluate` que joga E lê —
> o jogo continua rodando no intervalo entre duas chamadas, e a morte cai nesse buraco.
> Suíte **908** testes, `check` limpo, determinismo **67**.
> **Backlog:** `engine.ts` em ~355 linhas (acima do guia de 300 — separar um módulo de síntese
> numa próxima passada); `levelUp`/`nearMiss`/`powerup`/`block` provados só por teste unitário
> (difíceis de forçar no browser); ducking da música durante SFX; trilhas reais do Suno.

**Estado atual:** placeholder do 4.10 — sequência de notas trivial + 1 SFX de clique. O
`AudioEngine` é a costura; reescrita fica atrás dela sem mexer nos consumidores.

**Toca:** `src/services/audio/*`. Sem strings i18n. `docs/audio/specs/` documenta as trilhas.
**Core intocado.**

**Aceite:** música de menu e de gameplay claramente mais ricas e distintas; SFX por evento;
respeita volume/toggles; sem custo/arquivo.

### 9.7 Toggle de SFX de clique em Configurações (#6) — CONCLUÍDA
- [x] `SettingsState.buttonSfx: boolean` no molde de `menuMusic`/`gameplayMusic` (saneado por
      campo, persistido, reativo). Sem bump de versão do storage: estado antigo carrega com o
      default `true`.
- [x] `resolveAudioTarget` ganha `AudioInput.buttonSfx` → `AudioTarget.uiSfxGain`
      (`buttonSfx ? sfxGain : 0`, campo NOVO — sobrescrever `sfxGain` silenciaria o gameplay).
      Classificação pura `sfxChannelFor(id): 'ui' | 'game'` em `sfx.ts` (só `click` é de UI);
      `AudioService.playSfx` escolhe o ganho pelo canal. `bindButtonSfx` **não muda**: o gate fica
      no `playSfx`, senão o `unlock()` do 1º gesto morreria junto e a música nunca começaria.
- [x] `SettingsScreen`: novo toggle; chave i18n `settings.buttonSfx` nos 10 locales.

**Escopo decidido:** silencia **só o SFX de clique**; os 8 SFX de gameplay do 9.6 seguem no volume
geral (o canal `game` é a costura pronta caso se queira um toggle deles depois).
Spec `docs/superpowers/specs/2026-07-27-sfx-toggle-design.md`, plano `…/plans/2026-07-27-sfx-toggle.md`.

**Toca:** `src/services/settings/*`, `src/services/audio/*`, `src/app/.../SettingsScreen`,
locales. **Core intocado.**

**Aceite:** desligar o SFX de clique silencia os cliques e persiste no reload; demais áudios
inalterados.

---

## Frente D — Conteúdo / desafios (toca core → determinismo)

### 9.8 Novos tipos de obstáculo (#9) — CONCLUÍDA
- [x] Adicionar 2–3 obstáculos via skill `add-gameplay-entity` (lógica determinística + hitbox
      desacoplada + asset-spec + testes). Candidatos: `rock_arch` (multi-hitbox, adiado do 1.4),
      um obstáculo estreito **flutuante** (gap vertical), um par **chão+teto** que estreita a
      passagem.
- [x] Integrar ao `OBSTACLE_CATALOG` / distribuição de spawn; re-pin de goldens se a sequência de
      spawn mudar; `verify-determinism` verde.

> **CONCLUÍDA** (determinismo **67**, suíte **935**; spec/plano
> `docs/superpowers/{specs,plans}/2026-07-28-new-obstacle-types*`, execução SDD por 4 tasks
> `.superpowers/sdd/2026-07-28-new-obstacle-types/`). **Os 3 candidatos entraram, todos:**
> `obstacle.spire` (tipo SIMPLES, `SimpleSpawnType`, aabb flutuante `halfW 4–6 × halfH 24–34` ⇒
> 8–12×48–68 unidades), `obstacle.gate` (composto, 2 peças aabb `halfW=5` no mesmo `dx=0` — teto
> + chão, fresta `38–52`, braços `≥12`, **mesma tag** `obstacle.gate` nas duas peças) e
> `obstacle.rock_arch` (composto, 3 peças — 2 pernas `aabb(5, legH/2)` `legH∈[34,50]` em
> `dx=∓18`, tag `obstacle.rock_arch.leg`, + 1 trave `aabb(23,4)` fixa em `dx=0`, tag
> `obstacle.rock_arch.span`; `rock_arch` estava adiado desde o item 1.4 por ser não-convexo).
> **Mecanismo novo no gerador** (Task 1): `SpawnType` virou union `SimpleSpawnType |
> CompositeSpawnType` (`makePieces(rng, field): SpawnPiece[]`, opcional); `SpawnGenerator.
> generateUpTo` ramifica por `type.makePieces !== undefined`, preservando o caminho simples
> byte-a-byte (prova mais forte de não-regressão: os goldens do catálogo **por-tag** não mudam
> quando só o mecanismo entra, antes do catálogo real crescer). Tuning de `gate`/`rock_arch` é
> **ABSOLUTO**, calibrado só para o campo lógico fixo `worldHeight=180`/`yMargin=8` (faixa útil
> `y∈[8,172]`); toda passagem garantida **≥30 unidades** (testes de justiça).
> **Determinismo:** catálogo de obstáculos cresceu de 4 para 7 tipos ⇒ `rng.pick` sobre range maior
> muda a sequência do fork `'obstacles'` ⇒ 3 dos 4 goldens de `replay.determinism.test.ts`
> re-pinados (o cenário "sem seed" fica inalterado, mundo sem spawner); `_verify.bundle.js`
> regenerado (`npm run build:edge`). **`STORAGE_KEY` de replays bumpado `v1→v2`**
> (`src/services/replay/storage.ts`) — o catálogo novo muda a sequência de spawn e `finalHash`
> de replays antigos não recomputa mais; o bump descarta essas entradas de propósito.
> **Efeitos colaterais descobertos e corrigidos durante as tasks** (todos documentados nos
> relatórios/`progress.md` do SDD): clamp do `gate` degenerado (campo minúsculo não gera hitbox
> invertida); pin de consumo de RNG dos tipos compostos; ordem das peças do `rock_arch` por `dx`
> crescente (preserva x global não-decrescente no stream, sem mudar tuning); recalibração de
> `economy`/`weather.determinism.test.ts` e de uma seed em `verifyChallenge.test.ts` (campos-teste
> legados com `worldHeight` bem maior que 180 ficam mais sensíveis ao `gate`, que pode ocupar quase
> toda a coluna vertical fora da fresta nesses campos — não é regressão de justiça, o campo real
> 320×180 segue provado); e, só na verificação final da Task 4 (1ª vez que a suíte completa rodou
> desde a Task 2), `tests/core/sim/powerups-world.test.ts` (mesmo fenômeno, `worldHeight=600`) —
> recalibrado (`flapEvery` 20→30). **Gotcha do processo:** Tasks 1–3 rodaram só arquivos-alvo (por
> causa do timeout conhecido de `tests/render/atlas.test.ts`), então essa última regressão só
> apareceu no `npm test` completo da Task 4 — rodar a suíte cheia pelo menos 1× antes de fechar um
> item que toca `src/core/spawn` é o que teria pego mais cedo.
> **Render/arte (Task 3):** entram como placeholder primitivo (`kind:'primitive'`, cor exata da
> hitbox ⇒ cobertura perfeita) — `obstacle.spire`/`obstacle.gate`/`ARCH_LEG_TAG`/`ARCH_SPAN_TAG` em
> `src/render/manifest.ts`; guarda de completude do manifesto expande tipos compostos em peças
> reais antes de checar (`obstacle.rock_arch` bare nunca é emitido, só suas peças).
> **Asset-specs (Task 4):** `docs/assets/specs/obstacle.{spire,gate,rock_arch}.md` + Lote G (12
> imagens, pendente) em `docs/assets/PHASE-09-ART-BRIEF.md`. **Achado de review registrado nos
> specs:** `GameScene.sizeFor` cacheia `displaySize` por `typeId` — as duas peças do `gate`
> (mesma tag, alturas bem diferentes) e a perna do `rock_arch` (altura variável entre spawns)
> exigem composição **SEGMENTADA** (precedente 9.2) quando a arte real entrar, não 1-sprite-por-tag
> (o caminho que `boulder`/`stalactite` usam hoje) — só a trave (`span`, dimensão fixa) pode seguir
> 1 sprite único.

**Toca:** `src/core/spawn/catalog.ts` (+ `sim/hitbox` se multi-hitbox), goldens de replay,
`docs/assets/specs/obstacle.*.md`, atlas. Prompt: [Apêndice A.4](#a4-novos-obst%C3%A1culos-98).

**Aceite:** novos obstáculos jogáveis e justos; determinismo provado; arte cobre a hitbox
(usa a composição por segmentos do 9.2).

### 9.9 Briefing + modificadores de desafio por seed (#8) — CONCLUÍDA
- [x] **Briefing screen** (DOM) antes de Diário/Semanal: recorde atual (local + central se
      online), seed do período, e as **regras do dia** (traço proibido = padrão + os
      modificadores derivados da seed). Botões Jogar / Voltar.
      Entregue como `ChallengeScreen` (casca com estado `playing`, seed capturada 1×/montagem,
      `key` por modo) + `ChallengeBrief` (apresentação) + `buildChallengeBrief` (view-model PURO
      que devolve chaves i18n, nunca texto). `PlayScreen` ganhou `onExit` ⇒ sair do jogo volta ao
      briefing com o recorde já atualizado. Sem rota nova.
- [x] **Modificadores determinísticos:** função pura `challengeModifiersForSeed(seed)` em
      `src/core/challenge/`. Decidido **sempre os dois eixos, nunca opcionais**:
      `{ forcedWeather: WeatherKind; bannedPowerup: PowerupKind }` (zero ramo condicional; o
      briefing sempre mostra 2 regras concretas). RNG forkado no stream `'challenge'`;
      **CONTRATO de ordem: 2 saques — `pick(WEATHER_KINDS)` e depois `pick(POWERUP_KINDS)`**
      (mudar ordem/stream/catálogo muda as regras de todas as seeds já jogadas).
- [x] `createWorld`, quando em modo desafio (flag `challenge:true` + seed), **deriva os
      modificadores internamente** e os aplica: `weather = forcedWeather` **e
      `weatherGenerator = null`** (clima constante, sem sequenciador nem saques de clima); o
      `powerupSpawner` recebe `powerupCatalogExcluding(banido)` — array congelada e **memoizada
      por kind** (zero alocação, ref estável p/ as comparações estruturais). `pick` consome 1
      saque com 4 ou 5 tipos ⇒ contagem de saques inalterada. `weather:false` continua vencendo.
- [x] **Verificação:** builder único `challengeWorldConfig(seed)` em `@core/challenge` é a FONTE
      DA VERDADE — usado por `createMatchFactory` (daily/weekly), `verifyReplay` e
      `verifyChallengeSubmission` (antes: literal `{seed, trait:'none'}` copiado em 3 lugares).
      `_verify.bundle.js` regenerado. `STORAGE_KEY` de replays **v2→v3** (os `finalHash` gravados
      antes de 9.9 não recomputam com os modificadores).
- [x] **Sem campos novos em `WorldState`** ⇒ `hashState` intocado, teste de completude intocado,
      os 4 goldens de Endless **nos mesmos valores** (prova de que o caminho comum não mudou).
      Golden novo de modo-desafio + fps-independência. det **67 → 73**.

**Notas de determinismo:** os modificadores só alteram campos já hasheados (`weather`, entidades
de power-up emitidas) ⇒ possivelmente **sem novas chaves em `hashState`**. Goldens de replay atuais
são Endless/no-challenge ⇒ **não re-pinam**; adicionar um golden de modo-desafio é recomendado. O
bundle de verificação **precisa regenerar**. *(Confirmado na execução: zero campo novo, zero
re-pin dos 4 goldens de Endless, bundle regenerado.)*

**Débito conhecido (aceito, pré-lançamento):** o leaderboard local (`jurassicrun.leaderboard.v1`)
**não é versionado** e não registra sob quais regras o score foi obtido. Um recorde da mesma seed
gravado ANTES de 9.9 (clima sorteado, todos os power-ups) segue aparecendo como `yourBest` no
briefing, indistinguível de um obtido sob as regras novas — `buildChallengeBrief` filtra só por
igualdade de seed. Mesmo padrão de risco já aceito para `challenge_entries.verified` (sinal, não
gate). Se um dia importar, a correção é versionar a chave do leaderboard como se fez com os
replays (`v2→v3`).

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

## A.4 — Novos obstáculos (9.8) — hitbox e core CONCLUÍDOS, arte PENDENTE

A hitbox lógica e o mecanismo de multi-peça (`CompositeSpawnType`) já existem no core (ver a
entrada 9.8 acima). Os prompts abaixo ficam como o registro histórico do plano original; os
**asset-specs definitivos**, com as dimensões exatas travadas na implementação e a estratégia de
composição (segmentada, precedente 9.2), são `docs/assets/specs/obstacle.{spire,gate,
rock_arch}.md` — os prompts prontos para gerar (formato cap/body/base, por tema) estão no
**Lote G** de `docs/assets/PHASE-09-ART-BRIEF.md`. Use esses, não os prompts genéricos abaixo.

- **rock_arch** (multi-hitbox, passagem no meio): autorar como pé-esquerdo + topo + pé-direito,
  com o **vão central transparente** (a hitbox é o arco, não o vão).
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
  Implementado no core como `obstacle.gate` (par de peças `aabb`, não `tree`+`stalactite`).

> Ao adicionar cada obstáculo: entrada no `docs/assets/asset-registry.md` (status `spec`→`art`),
> asset-spec em `docs/assets/specs/`, e goldens re-pinados se a sequência de spawn mudar.
