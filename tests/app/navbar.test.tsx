// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { NavBar } from '../../src/app/components/NavBar';
import { route, resetToHome } from '../../src/app/router';

afterEach(() => resetToHome());

describe('NavBar', () => {
  it('renderiza os 7 destinos e destaca o atual', () => {
    const host = document.createElement('div');
    render(<NavBar current="nest" />, host);
    const items = host.querySelectorAll('.navbar__item');
    expect(items.length).toBe(7);
    expect(host.querySelector('.navbar__item--active')?.getAttribute('data-testid')).toBe('navbar-nest');
  });

  it('navega ao clicar num destino', () => {
    const host = document.createElement('div');
    render(<NavBar current="nest" />, host);
    (host.querySelector('[data-testid="navbar-shop"]') as HTMLButtonElement).click();
    expect(route.value).toBe('shop');
  });
});
