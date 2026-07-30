import { createRng } from '@core/rng';
import { WEATHER_KINDS } from '@core/weather';
import { POWERUP_KINDS } from '@core/powerup';
import type { ChallengeModifiers } from './types';

/** Stream de RNG dedicado: não interfere em obstacles/collectibles/powerups/weather. */
const CHALLENGE_STREAM = 'challenge';

/**
 * Modificadores do desafio desta seed. PURA (só `@core/rng`): mesmo `seed` ⇒ mesmas regras em
 * qualquer dispositivo, hoje e no verificador.
 *
 * CONTRATO: consome exatamente 2 saques, nesta ordem — clima, depois power-up banido.
 * Mudar a ordem, o stream ou os catálogos muda as regras de TODAS as seeds já jogadas.
 */
export function challengeModifiersForSeed(seed: string): ChallengeModifiers {
  const rng = createRng(seed).fork(CHALLENGE_STREAM);
  const forcedWeather = rng.pick(WEATHER_KINDS);
  const bannedPowerup = rng.pick(POWERUP_KINDS);
  return Object.freeze({ forcedWeather, bannedPowerup });
}
