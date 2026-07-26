/**
 * Alvos de compartilhamento da Home (puro — sem DOM, sem i18n).
 *
 * Duas naturezas, e a diferença NÃO é preguiça:
 * - `intent`: a rede publica um endpoint de compartilhamento por URL (WhatsApp, Telegram, e-mail).
 *   Abrir o link já leva o texto + a URL do jogo prontos.
 * - `copy`: Instagram, TikTok, YouTube e WeChat **não** têm intent web de compartilhar link de
 *   terceiros (só publicação autenticada pelas APIs de conteúdo). O honesto é copiar a URL para a
 *   área de transferência e deixar o jogador colar no app — que é o fluxo real dessas redes.
 *
 * `link` é o "copiar URL" explícito. A ordem do array é a ordem exibida.
 */
export type ShareNetwork =
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'wechat'
  | 'email'
  | 'link';

export type ShareAction = 'intent' | 'copy';

export interface ShareNetworkSpec {
  readonly id: ShareNetwork;
  /** Nome da marca — nome próprio, não passa por i18n (o rótulo acessível é que é traduzido). */
  readonly brand: string;
  readonly action: ShareAction;
}

export const SHARE_NETWORKS: readonly ShareNetworkSpec[] = [
  { id: 'whatsapp', brand: 'WhatsApp', action: 'intent' },
  { id: 'telegram', brand: 'Telegram', action: 'intent' },
  { id: 'instagram', brand: 'Instagram', action: 'copy' },
  { id: 'tiktok', brand: 'TikTok', action: 'copy' },
  { id: 'youtube', brand: 'YouTube', action: 'copy' },
  { id: 'wechat', brand: 'WeChat', action: 'copy' },
  { id: 'email', brand: 'E-mail', action: 'intent' },
  { id: 'link', brand: 'URL', action: 'copy' },
];

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

/**
 * URL do intent de compartilhamento, ou `null` quando a rede é do tipo `copy`.
 * Tudo percent-encoded: o texto tem espaços/acentos e a URL tem `:` e `/`.
 */
export function shareHref(id: ShareNetwork, payload: SharePayload): string | null {
  const text = encodeURIComponent(payload.text);
  const url = encodeURIComponent(payload.url);
  switch (id) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${payload.text} ${payload.url}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${url}&text=${text}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(
        `${payload.text}\n\n${payload.url}`,
      )}`;
    default:
      return null;
  }
}

/** Espelha `shareHref`: `intent` ⇔ href não-nulo. Guarda de coerência da tabela acima. */
export function actionFor(id: ShareNetwork): ShareAction {
  return SHARE_NETWORKS.find((n) => n.id === id)?.action ?? 'copy';
}
