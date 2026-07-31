import { openExternal, defaultOpenDeps, type OpenUrlDeps } from '../openUrl';

/**
 * Doação (honor-system / ADR-0004): as duas plataformas realmente suportadas. As URLs são dado
 * puro; a abertura é injetável (casca só em `defaultDonateDeps`).
 */
export type DonatePlatform = 'buymeacoffee' | 'kofi';

export interface DonateOption {
  readonly id: DonatePlatform;
  /** Nome da plataforma — marca, não passa por i18n. */
  readonly brand: string;
  readonly url: string;
}

export const DONATE_OPTIONS: readonly DonateOption[] = [
  {
    id: 'buymeacoffee',
    brand: 'Buy Me a Coffee',
    url: 'https://buymeacoffee.com/insight.x.lab.game.studio',
  },
  { id: 'kofi', brand: 'Ko-fi', url: 'https://ko-fi.com/insightxlabgamestudio' },
];

/** URL padrão (primeira opção) — para quem só quer "abrir a doação" sem escolher plataforma. */
export const DONATE_URL = DONATE_OPTIONS[0]!.url;

export type DonateDeps = OpenUrlDeps;

/** Abre uma página de doação. Best-effort: engole erro (a UI segue viva). Deps injetáveis. */
export function openDonation(
  deps: DonateDeps = defaultDonateDeps(),
  url: string = DONATE_URL,
): void {
  openExternal(url, deps);
}

/** Casca: abre em nova aba com noopener. Não usar em teste. */
export function defaultDonateDeps(): DonateDeps {
  return defaultOpenDeps();
}
