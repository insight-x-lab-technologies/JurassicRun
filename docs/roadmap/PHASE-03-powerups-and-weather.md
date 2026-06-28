# Fase 3 — Power-ups & clima

**Objetivo:** profundidade de gameplay com power-ups coletáveis e condições ambientais,
tudo determinístico.

## Itens

### 3.1 Sistema de power-ups (core + render)
- [ ] Framework de efeitos temporários com duração em steps.
- [ ] Power-ups: escudo, vida extra, câmera lenta (slow-mo), ímã (atrai pássaros),
      moeda dobrada, e ganchos para mais.
- [ ] Geração determinística keyed por distância.
- [ ] Testes de cada efeito (determinístico).

### 3.2 Câmera lenta sem quebrar determinismo
- [ ] Slow-mo afeta a *percepção* (render/escala de tempo visual) sem violar passo fixo da sim;
      definir claramente o modelo (ex.: a sim conta steps "lentos" de forma determinística).

### 3.3 Tempo do dia (cosmético)
- [ ] Manhã/tarde/noite: paletas/iluminação de fundo. **Não** afeta a simulação.

### 3.4 Clima (afeta gameplay)
- [ ] Chuva leve, tempestade, vento, neve — alteram física (ex.: vento muda empuxo) de forma
      **determinística** (derivada do estado/Rng semeado).
- [ ] `WeatherGenerator` keyed por distância.
- [ ] Testes: mesma seed ⇒ mesma sequência de clima e mesmo efeito.

## Definição de pronto
- Power-ups e clima funcionam em jogo, com testes de determinismo verdes.
