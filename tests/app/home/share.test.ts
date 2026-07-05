import { describe, it, expect, vi } from 'vitest';
import { shareGame } from '@app/home/share';

const payload = { title: 'T', text: 'x', url: 'http://localhost/' };

describe('shareGame', () => {
  it('usa navigator.share quando disponível', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = vi.fn().mockResolvedValue(undefined);
    const r = await shareGame({ payload, share, clipboard });
    expect(r).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('cai no clipboard quando não há share', async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined);
    const r = await shareGame({ payload, clipboard });
    expect(r).toBe('copied');
    expect(clipboard).toHaveBeenCalledWith('http://localhost/');
  });

  it('retorna unsupported sem share nem clipboard', async () => {
    expect(await shareGame({ payload })).toBe('unsupported');
  });

  it('engole cancelamento/erro do share (não propaga)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    const r = await shareGame({ payload, share });
    expect(r).toBe('unsupported');
  });
});
