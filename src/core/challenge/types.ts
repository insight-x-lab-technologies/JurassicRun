import type { WeatherKind } from '@core/weather';
import type { PowerupKind } from '@core/powerup';

/**
 * Regras vigentes de um desafio, derivadas por função pura da seed ⇒ idênticas para todos os
 * jogadores e recomputáveis pelo verificador anti-cheat. Dados puros, congelados.
 */
export interface ChallengeModifiers {
  /** Clima constante da partida (substitui o sequenciador de clima). */
  readonly forcedWeather: WeatherKind;
  /** Power-up que NÃO spawna neste desafio. */
  readonly bannedPowerup: PowerupKind;
}
