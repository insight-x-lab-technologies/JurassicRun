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
- [ ] Manhã/tarde/noite: paletas/iluminação de fundo. **Não** afeta a simulação.

### 3.4 Clima (afeta gameplay)
- [ ] Chuva leve, tempestade, vento, neve — alteram física (ex.: vento muda empuxo) de forma
      **determinística** (derivada do estado/Rng semeado).
- [ ] `WeatherGenerator` keyed por distância.
- [ ] Testes: mesma seed ⇒ mesma sequência de clima e mesmo efeito.

## Definição de pronto
- Power-ups e clima funcionam em jogo, com testes de determinismo verdes.
