import { describe, it, expect } from 'vitest';
import {
  FONT_CHOICES,
  DEFAULT_FONT,
  isFontChoice,
  fontStackFor,
} from '@services/settings/fonts';
import { initialSettingsState, setFont } from '@services/settings/store';

describe('catálogo de fontes', () => {
  it('toda escolha tem uma pilha com display e body não-vazios', () => {
    for (const choice of FONT_CHOICES) {
      const stack = fontStackFor(choice);
      expect(stack.label.length).toBeGreaterThan(0);
      expect(stack.display.length).toBeGreaterThan(0);
      expect(stack.body.length).toBeGreaterThan(0);
    }
  });

  it('toda pilha termina no fallback de sistema (locales CJK/Devanagari)', () => {
    // Cinzel/Marcellus/Exo 2 não têm glifos ja/zh/ko/hi: sem fallback, esses idiomas quebram.
    for (const choice of FONT_CHOICES) {
      expect(fontStackFor(choice).body).toContain('system-ui');
      expect(fontStackFor(choice).display).toContain('system-ui');
    }
  });

  it('o default está no catálogo', () => {
    expect(FONT_CHOICES).toContain(DEFAULT_FONT);
  });

  it('isFontChoice rejeita valor fora do catálogo', () => {
    expect(isFontChoice('cinzel')).toBe(true);
    expect(isFontChoice('comic-sans')).toBe(false);
    expect(isFontChoice('')).toBe(false);
  });

  it('alocação-zero: a mesma escolha devolve a MESMA referência', () => {
    expect(fontStackFor('cinzel')).toBe(fontStackFor('cinzel'));
  });
});

describe('setFont', () => {
  it('troca a fonte', () => {
    expect(setFont(initialSettingsState(), 'exo2').font).toBe('exo2');
  });

  it('fonte inválida devolve a MESMA referência (no-op), como setLanguage', () => {
    const s = initialSettingsState();
    expect(setFont(s, 'papyrus')).toBe(s);
  });
});
