# Glossário — JurassicRun

Vocabulário compartilhado para que todas as sessões/agentes usem os mesmos termos.

- **Core / simulação** — código determinístico em `src/core/`, sem render.
- **WorldState** — snapshot completo do estado de jogo num step da simulação.
- **Step** — um avanço da simulação de `FIXED_DT` (1/60 s).
- **FIXED_DT** — passo de tempo fixo da simulação (1/60 s).
- **InputTimeline** — sequência de inputs (flaps) por step; com a seed, determina o resultado.
- **Seed** — semente do PRNG. Endless: aleatória. Diária/Semanal: derivada da data.
- **Rng** — serviço de números pseudoaleatórios determinístico, semeado pela seed.
- **Hitbox** — forma de colisão lógica (AABB/círculo/polígono), independente da arte.
- **Entity** — objeto da simulação (dino, obstáculo, pássaro-moeda, power-up).
- **Pássaro-moeda / comida** — coletável que serve como moeda do jogo.
- **Manifesto de assets** — mapa de tipo lógico → representação visual (primitiva ou sprite).
- **Renderable** — interface que o render usa para desenhar uma entidade.
- **Atlas** — sprite sheet empacotado para batching no WebGL.
- **Parallax** — camadas de fundo com velocidades distintas (profundidade).
- **Power-up** — efeito temporário coletado em jogo (escudo, ímã, câmera lenta, etc.).
- **Traço (trait)** — característica permanente de um pterodáctilo do Ninho (ex.: escudo nato).
- **Ninho / Hangar** — tela onde se compra/seleciona pterodáctilos.
- **Expansão / Pack** — bundle cosmético (atlases, sons, fundos) que não altera gameplay.
- **Entitlement** — direito de posse de um pack/expansão pelo jogador.
- **Near-miss** — passar muito perto de um obstáculo sem colidir (estatística do Game Over).
- **Clima** — chuva/tempestade/vento/neve (afetam gameplay) — determinístico.
- **Tempo do dia** — manhã/tarde/noite (apenas cosmético).
- **Desafio Diário/Semanal** — partida com seed fixa por período, determinística, rankeada.
- **Asset-spec** — documento que especifica uma imagem trocável para geração por IA.
