# Fase 1 — Núcleo determinístico headless

**Objetivo:** uma simulação de jogo completa, jogável "no papel" (sem render), totalmente
determinística e coberta por testes. Esta é a fundação de tudo.

## Itens

### 1.1 RNG
- [x] PRNG portável (mulberry32/xoshiro) + hash de seed estável.
- [x] API: `next()`, `range(min,max)`, `pick(array)`, fork por stream.
- [x] Testes: reprodutibilidade, distribuição básica.

### 1.2 Derivação de seeds
- [x] Endless (aleatória externa, exibível), Diária (`hash(dataUTC)`), Semanal (`hash(semanaISO)`).
- [x] Testes: mesma data ⇒ mesma seed; datas diferentes ⇒ seeds diferentes.

### 1.3 Modelo de mundo + loop de passo fixo
- [x] `WorldState`, `Entity`, `Hitbox`, `sim.step(FIXED_DT, inputs)`.
- [x] Física do pterodáctilo (gravidade, flap), scroll horizontal.
- [x] Testes: independência de fps (1/2/5 steps por "frame" ⇒ estado idêntico).

### 1.4 Geração de obstáculos (formatos variados)
- [x] Catálogo de tipos de obstáculo com hitboxes distintas (não só retângulos).
- [x] `SpawnGenerator` keyed por distância, consumindo o Rng.
- [x] Testes: mesma seed ⇒ mesma sequência de obstáculos.

### 1.5 Coletáveis (pássaros-moeda)
- [x] Geração determinística; coleta incrementa "comida".
- [x] Testes.

### 1.6 Colisão
- [ ] AABB/círculo/polígono; detecção dino×obstáculo e dino×coletável.
- [ ] Detecção de near-miss (passar perto sem colidir).
- [ ] Testes.

### 1.7 Dificuldade
- [ ] Função pura `difficulty(distância|nível)` → gaps, velocidade, densidade.
- [ ] Nível aumenta com a distância; **reinicia a cada partida**.
- [ ] Testes.

### 1.8 Economia e score
- [ ] Comida coletada, multiplicadores, distância como score base.
- [ ] Testes (inclui multiplicadores e bordas).

### 1.9 Replay / golden master
- [ ] Suporte a rodar `sim(seed, InputTimeline)` headless e hashear o estado.
- [ ] Golden master para seeds fixas (detecta regressão de determinismo).

## Definição de pronto
- Toda a simulação roda headless. Bateria de determinismo verde no CI.
- `verify-determinism` passa. Cobertura alta em `src/core/`.
