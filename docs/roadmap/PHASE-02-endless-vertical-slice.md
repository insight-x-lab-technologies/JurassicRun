# Fase 2 — Vertical slice jogável Endless (1º MILESTONE)

**Objetivo:** o primeiro jogo de verdade na tela. Phaser renderiza a simulação da Fase 1,
com input, parallax, HUD e Game Over. Tudo geométrico. **60fps+**. Prova a base técnica.

## Itens

### 2.1 Render Phaser sobre o core
- [x] `GameScene` lê `WorldState`; interpolação entre steps.
- [x] Loop: acumulador + passo fixo (render desacoplado da sim).
- [x] Pterodáctilo, obstáculos e pássaros-moeda desenhados via manifesto (primitivas).

### 2.2 Input
- [x] Flap por toque/clique/tecla. Input amostrado por step da simulação.
- [x] Pausar/retomar.

### 2.3 Parallax multicamadas
- [x] ≥3 camadas de fundo com scrollFactors distintos (profundidade).

### 2.4 HUD
- [x] Distância, comida (moedas), **fps**, nível, velocidade do dino, **seed** em execução.
- [x] Atualização com throttle (não custa fps).

### 2.5 Fluxo de partida
- [x] Iniciar Endless com seed aleatória (exibida).
- [x] Morte ao colidir; dificuldade cresce; reinicia do zero a cada partida.

### 2.6 Game Over overlay (básico)
- [x] Estatísticas: distância, comida, near-misses. Botões reiniciar/sair.

### 2.7 Performance
- [ ] Object pooling no render; culling de fora-de-tela.
- [ ] Medir fps em desktop e mobile; alvo 60fps+. Registrar evidência.

## Definição de pronto
- Dá para jogar Endless do início ao Game Over, a 60fps, com HUD completo.
- O determinismo do core permanece intacto (render não altera simulação).
