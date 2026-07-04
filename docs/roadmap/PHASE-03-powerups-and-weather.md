# Fase 3 — Power-ups & clima

**Objetivo:** profundidade de gameplay com power-ups coletáveis e condições ambientais,
tudo determinístico.

## Itens

### 3.1 Sistema de power-ups (core + render)
- [x] Framework de efeitos temporários com duração em steps.
- [x] Power-ups: escudo, vida extra, ímã (atrai pássaros), moeda dobrada, e ganchos
      para mais. **Slow-mo (câmera lenta) adiado ao item 3.2** (seu modelo de percepção de
      tempo é o objeto do 3.2; o framework já deixa o gancho pronto).
- [x] Geração determinística keyed por distância.
- [x] Testes de cada efeito (determinístico).

### 3.2 Câmera lenta sem quebrar determinismo
- [x] Slow-mo afeta a *percepção* (render/escala de tempo visual) sem violar passo fixo da sim;
      definir claramente o modelo (ex.: a sim conta steps "lentos" de forma determinística).

### 3.3 Tempo do dia (cosmético)
- [x] Manhã/tarde/noite: paletas/iluminação de fundo. **Não** afeta a simulação.
      (Implementado com 4 fases: manhã/tarde/entardecer/noite, derivadas da seed via `hashSeed`;
      só camada de render — `src/render/daynight.ts` + casca na `GameScene`. Core intocado.)

### 3.4 Clima (afeta gameplay)
- [x] Chuva leve, tempestade, vento, neve — alteram física (ex.: vento muda empuxo) de forma
      **determinística** (derivada do estado/Rng semeado).
- [x] `WeatherGenerator` keyed por distância.
- [x] Testes: mesma seed ⇒ mesma sequência de clima e mesmo efeito.
      (Implementado só no eixo vertical — `gravityScale`/`windY` por clima — mantendo scroll/
      distância/dificuldade/economia/spawns byte-idênticos. Módulo puro `src/core/weather/` +
      `WeatherGenerator` (stream `fork('weather')`); física aplicada 1×/step; `hashState`/
      completeness (26 chaves) + goldens re-pinados; determinismo e2e verde; indicador de clima
      no HUD (i18n 10 locales). VFX real de clima adiado à Fase 8.)

## Definição de pronto
- Power-ups e clima funcionam em jogo, com testes de determinismo verdes.
