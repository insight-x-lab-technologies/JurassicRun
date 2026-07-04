import { describe, it, expect, beforeEach } from 'vitest';
import { route, navigate, back, canGoBack, resetToHome } from '@app/router';

describe('router', () => {
  beforeEach(() => resetToHome());

  it('começa na Home sem histórico para trás', () => {
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });

  it('navigate empilha e torna a tela corrente', () => {
    navigate('settings');
    expect(route.value).toBe('settings');
    expect(canGoBack()).toBe(true);
  });

  it('navegar para a rota corrente é no-op (não empilha)', () => {
    navigate('shop');
    navigate('shop');
    back();
    expect(route.value).toBe('home');
  });

  it('back desempilha para a tela anterior', () => {
    navigate('nest');
    navigate('shop');
    back();
    expect(route.value).toBe('nest');
    back();
    expect(route.value).toBe('home');
  });

  it('back na raiz (Home) é no-op', () => {
    back();
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });

  it('resetToHome limpa a pilha', () => {
    navigate('profile');
    navigate('leaderboard');
    resetToHome();
    expect(route.value).toBe('home');
    expect(canGoBack()).toBe(false);
  });
});
