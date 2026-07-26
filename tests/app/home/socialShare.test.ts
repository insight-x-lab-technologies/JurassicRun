import { describe, it, expect } from 'vitest';
import {
  SHARE_NETWORKS,
  shareHref,
  actionFor,
  type SharePayload,
} from '@app/home/socialShare';

const payload: SharePayload = {
  title: 'JurassicRun',
  text: 'Jogue JurassicRun — um side-scroller de pterodáctilo!',
  url: 'https://example.com/JurassicRun/?a=1&b=2',
};

describe('SHARE_NETWORKS', () => {
  it('cobre as redes pedidas, sem duplicar id', () => {
    const ids = SHARE_NETWORKS.map((n) => n.id);
    expect(ids).toEqual([
      'whatsapp', 'telegram', 'instagram', 'tiktok', 'youtube', 'wechat', 'email', 'link',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('`intent` ⇔ href não-nulo (tabela coerente com shareHref)', () => {
    for (const { id, action } of SHARE_NETWORKS) {
      expect(shareHref(id, payload) === null, id).toBe(action === 'copy');
      expect(actionFor(id)).toBe(action);
    }
  });
});

describe('shareHref', () => {
  it('WhatsApp leva texto + URL num único parâmetro percent-encoded', () => {
    const href = shareHref('whatsapp', payload)!;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
    expect(text).toBe(`${payload.text} ${payload.url}`);
  });

  it('Telegram separa url e text, e não vaza o & da query do jogo', () => {
    const href = shareHref('telegram', payload)!;
    const q = new URL(href).searchParams;
    expect(q.get('url')).toBe(payload.url);
    expect(q.get('text')).toBe(payload.text);
  });

  it('e-mail monta mailto com assunto e corpo', () => {
    const href = shareHref('email', payload)!;
    expect(href.startsWith('mailto:?')).toBe(true);
    const q = new URLSearchParams(href.slice('mailto:?'.length));
    expect(q.get('subject')).toBe(payload.title);
    expect(q.get('body')).toBe(`${payload.text}\n\n${payload.url}`);
  });

  it('redes sem intent de link de terceiros retornam null (fluxo = copiar)', () => {
    for (const id of ['instagram', 'tiktok', 'youtube', 'wechat', 'link'] as const) {
      expect(shareHref(id, payload), id).toBeNull();
    }
  });
});
