/**
 * Abrir URL externa (doação, checkout do Ko-fi). Casca injetável: o teste passa um `openUrl`
 * espião; a produção usa `window.open`. Best-effort — popup bloqueado não derruba a UI.
 */
export interface OpenUrlDeps {
  readonly openUrl?: (url: string) => void;
}

export function openExternal(url: string, deps: OpenUrlDeps = defaultOpenDeps()): void {
  const { openUrl } = deps;
  if (!openUrl) return;
  try {
    openUrl(url);
  } catch {
    // popup bloqueado / ambiente sem window.
  }
}

/** Casca: nova aba com `noopener`. Não usar em teste. */
export function defaultOpenDeps(): OpenUrlDeps {
  if (typeof window === 'undefined') return {};
  return { openUrl: (url) => window.open(url, '_blank', 'noopener') };
}
