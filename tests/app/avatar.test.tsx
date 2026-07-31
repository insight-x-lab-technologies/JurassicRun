// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { Avatar } from '@app/components/Avatar';
import type { Profile } from '@services/profile';

const profile: Profile = { id: 'p1', name: 'Rex', createdAt: 0, avatarId: 'a03' };

describe('Avatar', () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renderiza o PNG do avatar escolhido', () => {
    render(<Avatar profile={profile} />, container);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('ui/avatar.a03.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('cai para a inicial quando a imagem falha', async () => {
    render(<Avatar profile={profile} />, container);
    container.querySelector('img')!.dispatchEvent(new Event('error', { bubbles: false }));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('R');
  });
});
