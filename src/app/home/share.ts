import { i18n } from '@services/i18n';

export type ShareResult = 'shared' | 'copied' | 'unsupported';

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

export interface ShareDeps {
  readonly payload: SharePayload;
  readonly share?: (data: SharePayload) => Promise<void>;
  readonly clipboard?: (text: string) => Promise<void>;
}

/**
 * Compartilha o jogo. Best-effort: tenta a Web Share API, cai no clipboard,
 * e nunca propaga erro/cancelamento (a UI segue viva). Deps injetáveis p/ teste.
 */
export async function shareGame(deps: ShareDeps): Promise<ShareResult> {
  const { payload, share, clipboard } = deps;
  if (share) {
    try {
      await share(payload);
      return 'shared';
    } catch {
      return 'unsupported'; // usuário cancelou ou API falhou
    }
  }
  if (clipboard) {
    try {
      await clipboard(payload.url);
      return 'copied';
    } catch {
      return 'unsupported';
    }
  }
  return 'unsupported';
}

/** Casca: lê navigator/i18n/location reais. Não usar em teste. */
export function defaultShareDeps(): ShareDeps {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const url = typeof location !== 'undefined' ? location.href : 'https://jurassicrun.app';
  const deps: ShareDeps & { share?: ShareDeps['share']; clipboard?: ShareDeps['clipboard'] } = {
    payload: { title: i18n.t('share.title'), text: i18n.t('share.text'), url },
  };
  // Só define as chaves quando a API existe (exactOptionalPropertyTypes: sem undefined explícito).
  if (nav?.share) deps.share = (data) => nav.share!(data);
  if (nav?.clipboard?.writeText) deps.clipboard = (t) => nav.clipboard!.writeText(t);
  return deps;
}
