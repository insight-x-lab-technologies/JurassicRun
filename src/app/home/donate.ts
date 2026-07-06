/**
 * URL de doação (Ko-Fi/BuyMeACoffee). PLACEHOLDER — trocar pelo handle real antes do deploy
 * (Fase 7). Honor-system / ADR-0004.
 */
export const DONATE_URL = 'https://ko-fi.com/jurassicrun';

export interface DonateDeps {
  readonly openUrl?: (url: string) => void;
}

/** Abre a página de doação. Best-effort: engole erro (a UI segue viva). Deps injetáveis. */
export function openDonation(deps: DonateDeps = defaultDonateDeps()): void {
  const { openUrl } = deps;
  if (!openUrl) return;
  try {
    openUrl(DONATE_URL);
  } catch {
    // popup bloqueado / ambiente sem window; doação é best-effort.
  }
}

/** Casca: abre em nova aba com noopener. Não usar em teste. */
export function defaultDonateDeps(): DonateDeps {
  if (typeof window === 'undefined') return {};
  return { openUrl: (url) => window.open(url, '_blank', 'noopener') };
}
