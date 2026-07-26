# 9.4 — Animação cosmética idle de obstáculo (design)

> Item 9.4 da Fase 9 (Frente A — arte/render). **`src/core/` intocado**: a animação é 100%
> cosmética, a hitbox lógica não muda um bit. Determinismo permanece **67**.

## Problema

Os obstáculos são completamente estáticos. Depois de 9.2 (composição segmentada) a cena ficou
correta mas "morta": árvores, cipós e estalactites não se mexem, o que faz o mundo parecer uma
imagem colada atrás do dino. O item pede micro-animação idle por obstáculo com **colisão
idêntica** e **60 fps sem GC**.

## Decisão de abordagem: animação PROCEDURAL por transformação (não frames de atlas)

O roadmap sugeria "frames idle por obstáculo" (tira de 4 frames por parte, Apêndice A.2) reusando
o mecanismo de anim do dino. **Rejeitado**, pelos mesmos motivos que fizeram 9.3 ser procedural:

1. **Custo de arte desproporcional.** Hoje as partes segmentadas são **placeholder procedural**
   (`gen-obstacle-placeholder.mjs`). Uma tira de 4 frames × 3 partes × 2 obstáculos × 3 temas = 72
   frames de placeholder cujo movimento seria inventado pelo gerador — valor visual ~nulo. Pior:
   travaria a arte AAA real futura em entregar 4× frames por parte.
2. **`Image` não anima.** O pool de obstáculos é de `Phaser.GameObjects.Image` (escolha de 8.2/9.2
   por alocação-zero). Anim de Phaser exige `Sprite` com estado próprio por objeto; trocar o pool
   custaria memória e complexidade por frame para pouco ganho.
3. **Funciona com qualquer arte.** Uma transformação (deslocamento) aplicada ao frame existente
   embala tanto o placeholder de hoje quanto a arte real de amanhã, sem retrabalho.
4. **Orçamento de precache.** Atlas cresceria ~4× nas partes segmentadas (regressão do gotcha de
   precache de 8.1).

O caminho de frames continua **documentado** nos asset-specs (campo *Animação*) como variante
futura opcional — REGRA 5 honrada sem branch morto no código (precedente `dino.hit.md`, 9.3).

## Movimentos (um por obstáculo)

| Obstáculo | Âncora (core) | Idle | Descrição |
|---|---|---|---|
| `obstacle.tree` | `floor` | `sway` (âncora embaixo) | balanço lateral crescente da base rígida até a copa |
| `obstacle.vine` | `ceiling` | `sway` (âncora em cima) | balanço maior, ponta solta pendendo |
| `obstacle.stalactite` | `ceiling` | `drip` | gota se formando na ponta e caindo, em ciclo |
| `obstacle.boulder` | `floating` | — | pedra no chão: estática de propósito |

## Invariante crítica: o balanço NÃO pode descobrir a hitbox

9.2 entregou "a borda visível coincide com a hitbox". Deslocar um segmento por `dx` descobriria
uma tira de `|dx|` da caixa lógica — regressão direta daquele aceite ("colisão no vazio").

**Solução: sangria (bleed) igual à amplitude.** Um obstáculo com `sway` de amplitude `A` desenha
cada segmento com largura `W + 2A` (a arte segmentada é full-bleed opaca, então alargar não abre
vão). Como `|dx| ≤ A`, o intervalo coberto `[cx+dx−W/2−A, cx+dx+W/2+A]` contém `[cx−W/2, cx+W/2]`
**para qualquer instante** — cobertura provada por construção, não por tuning. Amplitudes
pequenas (`A ≈ 0,6` na árvore de `W=12`; `A ≈ 0,8` no cipó de `W=8`) mantêm o alargamento em
+10~20 %, invisível, e ainda dão 2–5 px de balanço na resolução de render (W5).

A estalactite (`polygon`, 1 sprite) **não se desloca**: a gota é desenhada à parte, então a
cobertura fica byte-idêntica à de hoje.

## Arquitetura (puro × casca — padrão do projeto)

### `src/render/idle.ts` (PURO, testável, sem Phaser/DOM)

Molde: `death.ts`/`particles.ts` — funções fechadas no tempo, scratch de saída, zero alocação.

```ts
export const IDLE_WRAP_SECONDS = 100;      // relógio cosmético embrulha sem salto
export function wrapIdleTime(t: number): number;          // t % IDLE_WRAP_SECONDS
export function idlePhaseFor(worldX: number): number;      // fase por instância, 0..2π
export interface IdleSway { dx: number }
export function swayOffset(amp, t01, elapsed, phase, out: IdleSway): IdleSway;
export interface IdleDrip { x: number; y: number; radius: number; alpha: number; visible: boolean }
export function dripAt(elapsed: number, phase: number, out: IdleDrip): IdleDrip;
export function idleMotionFor(typeId: string): IdleSpec | null;  // memoizado (REGRA 3)
```

- **sway:** `dx = amp · ease(t01) · sin(2π·f·elapsed + phase)`, `f = 0,4 Hz`, `ease(t01) = t01²`
  (a extremidade ancorada fica cravada; a livre balança o máximo). `t01` = distância normalizada
  do segmento até a âncora.
- **drip:** ciclo de 2,5 s. `0…40 %` a gota engorda parada na ponta; `40…100 %` cai com
  `y = queda · q²` e some (`alpha` linear no fim). Fase por instância dessincroniza as gotas.
- **Embrulho sem salto:** `0,4 Hz × 100 s = 40` ciclos e `100 s ÷ 2,5 s = 40` ciclos ⇒ ambos os
  movimentos fecham exatamente no embrulho (nada de "pulo" após minutos de partida, e nenhuma
  perda de precisão de `float` com o tempo).
- **Fase por instância:** derivada da posição `x` do obstáculo (constante no mundo — o mundo é que
  rola), **sem RNG** — cosmético e estável, sem tocar o serviço determinístico de RNG.

### `src/render/manifest.ts` (config de arte — REGRA 2)

Campo novo opcional em `kind:'sprite'`:

```ts
readonly idle?:
  | { readonly kind: 'sway'; readonly anchor: 'top' | 'bottom'; readonly amp: number }
  | { readonly kind: 'drip' };
```

Ligar/desligar/tunar a animação de um obstáculo = editar o manifesto, não o render.

### `src/render/GameScene.ts` (casca)

- **Relógio cosmético local:** `idleElapsed = wrapIdleTime(idleElapsed + delta)`, acumulado só
  quando não pausado. Não existe no core, não entra em hash, não afeta a sim.
- `drawSegmentedEntity`: se `idle.kind === 'sway'`, para cada segmento calcula `t01` pela âncora
  (`top`: `(cy−top)/H`; `bottom`: `(bottom−cy)/H`), obtém `dx` do scratch e chama `placeSeg` com
  `cx + dx` e largura `W + 2·amp`.
- `drawSpriteEntity`: se `idle.kind === 'drip'`, desenha a gota no `Graphics` já existente
  (`fillCircle`, mesma técnica das partículas de 9.3) na ponta inferior do bbox.
- **Alocação-zero:** scratches de campo (`idleSwayScratch`, `idleDripScratch`), `idleMotionFor`
  memoizado, nenhuma string concatenada por frame.

## Testes

Puros (Vitest), em `tests/render/idle.test.ts`:

- `swayOffset`: `dx = 0` em `t01 = 0` (âncora cravada) e em `amp = 0`; `|dx| ≤ amp` sempre;
  monotônico em `t01` para um mesmo instante; períodico em `1/f`; fases diferentes ⇒ valores
  diferentes no mesmo instante; escreve no `out` e devolve a MESMA referência (alocação-zero).
- **Propriedade de cobertura:** varrendo instantes/`t01`, `|dx| ≤ amp` ⇒ um segmento de largura
  `W + 2·amp` centrado em `cx + dx` contém `[cx−W/2, cx+W/2]`.
- `dripAt`: invisível/parada na fase de formação, cai monotonicamente depois, `alpha` termina em 0,
  ciclo se repete, fases distintas dessincronizam.
- `wrapIdleTime`: embrulha em 100 s e o estado visual em `t` e `t + 100` é idêntico (sway e drip).
- `idleMotionFor`: spec para tree/vine/stalactite, `null` para boulder/dino/power-ups/coletáveis,
  **identidade estável** entre chamadas (memoização — REGRA 3).

Guarda existente de manifesto (`tests/render/manifest.test.ts`) continua válida; acrescenta-se a
checagem de que só ids de obstáculo têm `idle`.

## Fora de escopo (YAGNI)

- Frames de atlas animados (variante futura, documentada nos specs).
- Idle para coletáveis/power-ups (flutuar moeda etc.) — pertence a 9.5, não a este item.
- Recolor da gota por tema/pack — cor constante agora; o seam de pack já existe se um tema quiser.
- Parar o idle durante `dying`/`dead`: o mundo congela, o cenário seguir respirando é desejável.

## Aceite (do roadmap)

- Obstáculos com micro-animação idle ⇒ árvore/cipó balançam, estalactite pinga.
- **Colisão idêntica:** `src/core/` intocado, determinismo 67, e a cobertura visual da hitbox
  preservada por construção (sangria = amplitude).
- 60 fps sem GC: nenhuma alocação por frame (scratch + memoização + pool de `Image` existente).
