/**
 * Guarda de completude do replay × InputFrame.
 *
 * PROPÓSITO: o replay grava a `InputTimeline` como `boolean[]` — só o campo `flap` de
 * `InputFrame`. Ver `FixedStepLoop.recordedTimeline` (src/render/loop.ts), o payload em
 * `buildReplayPayload` (src/app/game/replayPayload.ts) e a reconstrução em `verifyReplay`
 * (src/services/replay/verify.ts), todos `boolean` ↔ `{ flap }`.
 *
 * Se um campo NOVO for adicionado a `InputFrame` (src/core/sim/types.ts) que afete a
 * simulação, o caminho de gravação o descartaria SILENCIOSAMENTE e a verificação de
 * integridade passaria a falhar (ou, pior, validaria um replay parcial) sem nenhum teste
 * pegando. Se este teste falhar porque `InputFrame` ganhou um campo, você precisa:
 *   1. Estender a representação gravada (o `timeline` de `StoredReplay`, `recordedTimeline`,
 *      `buildReplayPayload` e `verifyReplay`) para capturar/reconstruir o novo campo.
 *   2. Atualizar `EXPECTED_INPUT_FRAME_KEYS` aqui.
 *
 * Mesma filosofia da guarda de completude do `hashState` (item 1.9,
 * tests/core/replay/hash-completeness.test.ts). O `Record<keyof InputFrame, true>` abaixo
 * complementa esta guarda em tempo de compilação: adicionar um campo sem listá-lo aqui
 * quebra o `npm run check`.
 */
import { describe, it, expect } from 'vitest';
import type { InputFrame } from '@core/sim';

/** Conjunto exato de chaves de InputFrame que o replay sabe gravar (só `flap`). */
const EXPECTED_INPUT_FRAME_KEYS = ['flap'];

/** Trava de compilação: um campo novo em InputFrame não listado aqui quebra o tsc. */
const REQUIRED_INPUT_FRAME_KEYS: Record<keyof InputFrame, true> = { flap: true };

describe('InputFrame — guarda de completude do replay', () => {
  it('tem exatamente as chaves que a gravação de replay captura (runtime)', () => {
    const frame: InputFrame = { flap: false };
    expect(Object.keys(frame).sort()).toEqual([...EXPECTED_INPUT_FRAME_KEYS].sort());
  });

  it('a trava de compilação cobre o mesmo conjunto de chaves', () => {
    expect(Object.keys(REQUIRED_INPUT_FRAME_KEYS).sort()).toEqual([...EXPECTED_INPUT_FRAME_KEYS].sort());
  });
});
