# Arquitetura — JurassicRun

## Princípio central: core headless + render adapter

```
                 inputs (flaps)                 estado interpolado
   ┌──────────┐  ─────────────►  ┌───────────┐  ─────────────►  ┌──────────┐
   │  INPUT   │                  │   CORE    │                  │  RENDER  │
   │ (Phaser) │                  │ (TS puro) │                  │ (Phaser) │
   └──────────┘                  └───────────┘                  └──────────┘
                                       ▲
                                       │ seed
                                 ┌───────────┐
                                 │   RNG     │
                                 └───────────┘
```

- **`src/core/`** — simulação pura, determinística, sem dependências de runtime gráfico.
  Recebe `inputs` e `dt fixo`, produz `WorldState`. Não conhece Phaser, Preact ou DOM.
- **`src/render/`** — lê `WorldState` e desenha com Phaser. Interpola entre dois estados de
  simulação para suavidade visual independente do fps de tela.
- **`src/app/`** — shell em Preact: telas, navegação, overlays, HUD.
- **`src/services/`** — i18n, persistência, áudio, entitlements, perfis, leaderboard, troféus.
- **`src/backend/`** — cliente Supabase (fase tardia), atrás de interfaces dos services.

Regra de dependências (sentido único):

```
app  ─►  services  ─►  core
 └────►  render   ─►  core
render ─►  services (áudio/assets)        core ─► (nada de runtime; só utilitários puros)
```

`core` é a folha. Nada em `core` importa de `app`, `render`, `services`, `backend`,
`phaser`, `preact` ou APIs de browser. Isto é verificado por lint/teste.

## Loop de simulação (passo fixo)

```
accumulator += frameDelta
while (accumulator >= FIXED_DT) {
    sim.step(FIXED_DT, collectInputsForThisStep())
    accumulator -= FIXED_DT
}
render(sim.current, sim.previous, accumulator / FIXED_DT)   // interpolação
```

- `FIXED_DT = 1/60`. A simulação avança em incrementos idênticos em qualquer hardware.
- O render pode rodar a 30, 60, 120, 144 Hz — o resultado da simulação não muda.
- Inputs são amostrados e associados ao step da simulação, não ao frame de render.

## Modelo de dados do mundo (core)

- `WorldState`: posição/velocidade do pterodáctilo, lista de obstáculos ativos, coletáveis,
  power-ups ativos, clima atual, distância, nível, moedas da partida, near-misses, vivo/morto.
- `Entity`: `{ id, type, transform, hitbox, kinematics, tags }`. **Sem dados visuais.**
- `Hitbox`: AABB / círculo / polígono convexo — independente da arte.

## Geração procedural determinística

- Um `Rng` por partida, semeado pela `seed`.
- Geradores (`SpawnGenerator`, `WeatherGenerator`, `PowerupGenerator`) consomem o `Rng` em
  pontos **keyed por posição no mundo** (ex.: a cada N unidades de distância), nunca por
  relógio. Assim o conteúdo é função pura de `(seed, distância)`.
- `Difficulty(distância|nível)` é função pura → controla gaps, velocidade, densidade.

## Camada de render (Phaser)

- Uma `GameScene` que assina o `WorldState`.
- Parallax: múltiplas camadas de fundo com fatores de velocidade distintos (profundidade).
- Entidades desenhadas via **manifesto de assets** (geométrico ou atlas PNG). Ver
  `RENDERING-AND-ASSETS.md`.
- HUD pode ser DOM (Preact) sobreposto ao canvas, atualizado com throttle (não a cada frame
  para campos textuais caros). FPS é medido na camada de render, nunca afeta a simulação.

## App shell (Preact)

- Router simples de telas (state machine). Cada tela é um componente isolado.
- Estado compartilhado via signals (`@preact/signals`): perfil ativo, moedas, settings, idioma.
- Telas: Home, Perfil, Configurações, Leaderboard, Ninho, Loja, Expansões, Desafios,
  GameOver, HUD, NameEntry. Ver roadmap Fase 4/5.

## Services (interfaces estáveis, implementações trocáveis)

- `PersistenceService` — localStorage agora; sync Supabase depois (mesma interface).
- `LeaderboardService` — local agora; central depois.
- `EntitlementsService` — quais packs/expansões o jogador possui. Honor-system/Ko-Fi agora;
  gateway real plugável depois (ver ADR-0004).
- `ProfileService` — perfis locais + ID global (Supabase, fase tardia).
- `AudioService` — música menu/gameplay, SFX, volume, mute.
- `I18nService` — wrapper i18next.
- `TrophyService` — conquistas e troféus.

## Determinismo é testável

A simulação ser pura significa que podemos, no CI: rodar a mesma seed + timeline de inputs
duas vezes e comparar o hash do estado final. Ver `DETERMINISM.md` e a skill
`verify-determinism`.

## Estrutura de pastas alvo (criada na Fase 1)

```
src/
  core/        # simulação determinística (TS puro)
    rng/
    sim/
    spawn/
    collision/
    economy/
    difficulty/
    weather/
    seed/
  render/      # Phaser
  app/         # Preact (telas)
  services/
  backend/     # Supabase (fase tardia)
  assets/      # manifesto + (futuro) atlases
  i18n/        # locales JSON
tests/
```
