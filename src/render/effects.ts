// Módulo PURO (sem phaser/DOM): dados de exibição dos efeitos ativos + curva da aura (9.5).
// Consome só constantes do core; não muda nada de simulação.
import type { ActiveEffect, PowerupKind } from '@core/powerup';
import {
  SHIELD_DURATION_STEPS,
  MAGNET_DURATION_STEPS,
  DOUBLE_COIN_DURATION_STEPS,
  SLOW_MO_DURATION_STEPS,
} from '@core/powerup';
import { FIXED_DT } from '@core/sim';

/** Ordem CANÔNICA de exibição — fixa, para o chip não pular de posição quando um efeito expira.
 *  `extraLife` fica de fora de propósito: no core é carga (`WorldState.extraLives`), não efeito. */
export const EFFECT_ORDER: readonly PowerupKind[] = Object.freeze([
  'shield', 'slowMo', 'magnet', 'doubleCoin',
]);

/** Duração NOMINAL por kind (steps) — denominador da barra. */
export const EFFECT_DURATION_STEPS: Readonly<Record<PowerupKind, number>> = Object.freeze({
  shield: SHIELD_DURATION_STEPS,
  slowMo: SLOW_MO_DURATION_STEPS,
  magnet: MAGNET_DURATION_STEPS,
  doubleCoin: DOUBLE_COIN_DURATION_STEPS,
  extraLife: 1, // não exibido; presente só para o Record ser total
});

/** Cor do anel de aura por kind (0xRRGGBB). */
export const EFFECT_COLORS: Readonly<Record<PowerupKind, number>> = Object.freeze({
  shield: 0x6fd3ff,
  slowMo: 0xb08cff,
  magnet: 0xff8a3d,
  doubleCoin: 0xffd75e,
  extraLife: 0xff6b7a,
});

export const AURA_MIN_ALPHA = 0.35;
export const AURA_MAX_ALPHA = 0.7;
export const AURA_PULSE_HZ = 1.4;

/** Dados de um chip do HUD. `seconds` é `ceil` (nunca 0 enquanto ativo); `fraction` ∈ [0,1]. */
export interface EffectView {
  readonly kind: PowerupKind;
  readonly seconds: number;
  readonly fraction: number;
}

/** Efeitos ativos → chips na ordem canônica. Chamado no throttle do HUD (~5 Hz), NÃO por frame. */
export function effectViews(effects: readonly ActiveEffect[]): EffectView[] {
  const out: EffectView[] = [];
  for (const kind of EFFECT_ORDER) {
    for (const e of effects) {
      if (e.kind !== kind) continue;
      const nominal = EFFECT_DURATION_STEPS[kind];
      const fraction = Math.min(1, Math.max(0, e.remaining / nominal));
      out.push({ kind, seconds: Math.ceil(e.remaining * FIXED_DT), fraction });
      break;
    }
  }
  return out;
}

/** Alpha pulsante da aura em função do tempo (s). Puro, sem estado. */
export function auraPulse(t: number): number {
  const mid = (AURA_MIN_ALPHA + AURA_MAX_ALPHA) / 2;
  const amp = (AURA_MAX_ALPHA - AURA_MIN_ALPHA) / 2;
  return mid + amp * Math.sin(2 * Math.PI * AURA_PULSE_HZ * t);
}

/** Distância (unidades de mundo) entre anéis concêntricos da aura. */
export const AURA_RING_GAP = 2;

/** Raio do i-ésimo anel visível (anel 0 abraça o dino; cada anel seguinte afasta um passo fixo). */
export function auraRadius(baseRadius: number, index: number): number {
  return baseRadius + index * AURA_RING_GAP;
}
