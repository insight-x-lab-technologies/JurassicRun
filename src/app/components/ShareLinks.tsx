import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import { i18n } from '@services/i18n';
import {
  SHARE_NETWORKS,
  shareHref,
  type ShareNetwork,
  type SharePayload,
} from '../home/socialShare';

/**
 * Linha de compartilhamento da Home: ícones pequenos, um por rede.
 *
 * Glifos são **SVG inline monocromático** (`currentColor`), não PNG: são 8 marcas, precisam ficar
 * nítidas a 20px, herdar o dourado do tema e não custar 8 requisições nem entrada de atlas. São
 * silhuetas simples no estilo de linha da iconografia do jogo, não reproduções das logomarcas.
 */

const SVG_PROPS = {
  viewBox: '0 0 24 24',
  width: '100%',
  height: '100%',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.7,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
};

function Glyph({ id }: { id: ShareNetwork }): VNode {
  switch (id) {
    case 'whatsapp': // balão de conversa com fone
      return (
        <svg {...SVG_PROPS}>
          <path d="M3.8 20.2l1.2-3.5a8 8 0 1 1 3 2.9l-4.2.6z" />
          <path d="M9 9.6c.3 2.6 2.8 5.1 5.4 5.4.6.1 1.3-.4 1.4-1l.1-.7-2-1-.8.9c-1-.5-1.8-1.3-2.3-2.3l.9-.8-1-2-.7.1c-.6.1-1.1.8-1 1.4z" />
        </svg>
      );
    case 'telegram': // avião de papel
      return (
        <svg {...SVG_PROPS}>
          <path d="M21.5 3.5L2.8 10.6l5.4 1.8 1.8 5.4 2.6-3.6 4.2 3.1z" />
          <path d="M8.2 12.4L21.5 3.5l-8.9 10.7" />
        </svg>
      );
    case 'instagram': // moldura + lente
      return (
        <svg {...SVG_PROPS}>
          <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
          <circle cx="12" cy="12" r="4.1" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tiktok': // nota musical
      return (
        <svg {...SVG_PROPS}>
          <path d="M14 3.5v10.9a3.6 3.6 0 1 1-3-3.55" />
          <path d="M14 3.5c.4 2.6 2.2 4.2 4.8 4.4" />
        </svg>
      );
    case 'youtube': // tela + play
      return (
        <svg {...SVG_PROPS}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
          <path d="M10.4 9.4l4.7 2.6-4.7 2.6z" />
        </svg>
      );
    case 'wechat': // dois balões
      return (
        <svg {...SVG_PROPS}>
          <path d="M9 4.2c3.6 0 6.5 2.3 6.5 5.2S12.6 14.6 9 14.6c-.7 0-1.4-.1-2-.3l-2.7 1.2.8-2.2C3.7 12.4 2.5 11 2.5 9.4c0-2.9 2.9-5.2 6.5-5.2z" />
          <path d="M16 9.6c3 0 5.5 2 5.5 4.4 0 1.4-.8 2.6-2.1 3.4l.7 2-2.3-1c-.6.2-1.2.3-1.8.3-3 0-5.5-2-5.5-4.4" />
        </svg>
      );
    case 'email': // envelope
      return (
        <svg {...SVG_PROPS}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
          <path d="M3.2 6.6L12 12.8l8.8-6.2" />
        </svg>
      );
    case 'link': // elo de corrente
      return (
        <svg {...SVG_PROPS}>
          <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3" />
          <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3" />
        </svg>
      );
  }
}

export interface ShareLinksProps {
  readonly payload: SharePayload;
  /** Copiar para a área de transferência; ausente quando o ambiente não suporta. */
  readonly copy?: (text: string) => Promise<void>;
  /** Abrir intent; casca injeta `window.open`. */
  readonly openUrl?: (url: string) => void;
}

export function ShareLinks({ payload, copy, openUrl }: ShareLinksProps): VNode {
  const [copied, setCopied] = useState<ShareNetwork | null>(null);

  const onCopy = (id: ShareNetwork): void => {
    if (!copy) return;
    void copy(payload.url)
      .then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 1600);
      })
      .catch(() => {
        /* clipboard negado: silencioso, compartilhar é best-effort */
      });
  };

  return (
    <div class="home__social" data-testid="home-social">
      {SHARE_NETWORKS.map(({ id, brand }) => {
        const href = shareHref(id, payload);
        const label =
          href === null
            ? i18n.t('share.copyFor', { network: brand })
            : i18n.t('share.via', { network: brand });
        return (
          <button
            key={id}
            type="button"
            class={`social-link${copied === id ? ' social-link--copied' : ''}`}
            data-testid={`share-${id}`}
            title={label}
            aria-label={label}
            onClick={() => (href === null ? onCopy(id) : openUrl?.(href))}
          >
            <Glyph id={id} />
          </button>
        );
      })}
      <span class="sr-only" role="status">
        {copied !== null ? i18n.t('share.copied') : ''}
      </span>
    </div>
  );
}

/** Casca: payload + clipboard + abertura reais. Não usar em teste. */
export function defaultShareLinkProps(): ShareLinksProps {
  const url = typeof location !== 'undefined' ? location.href : 'https://jurassicrun.app';
  const props: {
    payload: SharePayload;
    copy?: (text: string) => Promise<void>;
    openUrl?: (url: string) => void;
  } = {
    payload: { title: i18n.t('share.title'), text: i18n.t('share.text'), url },
  };
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.clipboard?.writeText) props.copy = (t) => nav.clipboard.writeText(t);
  if (typeof window !== 'undefined') props.openUrl = (u) => window.open(u, '_blank', 'noopener');
  return props;
}
