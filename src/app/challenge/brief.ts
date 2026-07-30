import { challengeModifiersForSeed } from '@core/challenge';

/** Entrada de placar reduzida ao que o briefing precisa (local ou central). */
export interface BriefScore {
  readonly seed: string;
  readonly score: number;
}

/** Regra vigente do desafio. Carrega CHAVES i18n, nunca texto pronto (REGRA 4). */
export type ChallengeRule =
  | { readonly kind: 'weather'; readonly valueKey: string }
  | { readonly kind: 'bannedPowerup'; readonly valueKey: string }
  | { readonly kind: 'trait'; readonly valueKey: string };

/** View-model do briefing: tudo que a tela mostra, sem tocar em DOM/serviços. */
export interface ChallengeBriefView {
  readonly seed: string;
  readonly periodLabel: string;
  readonly yourBest: number | null;
  readonly worldBest: number | null;
  readonly rules: readonly ChallengeRule[];
}

/** Melhor score da seed dada; null se não houver tentativa. */
function bestFor(entries: readonly BriefScore[], seed: string): number | null {
  let best: number | null = null;
  for (const e of entries) {
    if (e.seed !== seed) continue;
    if (best === null || e.score > best) best = e.score;
  }
  return best;
}

/**
 * Monta o briefing de um desafio. PURA: recebe os placares já lidos dos serviços e deriva as
 * regras da própria seed — a mesma função que a simulação usa ⇒ a tela nunca mente sobre as
 * regras.
 */
export function buildChallengeBrief(input: {
  readonly seed: string;
  readonly localEntries: readonly BriefScore[];
  readonly centralEntries: readonly BriefScore[];
}): ChallengeBriefView {
  const { seed, localEntries, centralEntries } = input;
  const mods = challengeModifiersForSeed(seed);
  const colon = seed.indexOf(':');
  return {
    seed,
    periodLabel: colon >= 0 ? seed.slice(colon + 1) : seed,
    yourBest: bestFor(localEntries, seed),
    worldBest: bestFor(centralEntries, seed),
    rules: [
      { kind: 'weather', valueKey: `weather.${mods.forcedWeather}` },
      { kind: 'bannedPowerup', valueKey: `powerup.${mods.bannedPowerup}.name` },
      { kind: 'trait', valueKey: 'trait.none.name' },
    ],
  };
}
