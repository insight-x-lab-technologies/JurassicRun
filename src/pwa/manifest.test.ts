import { describe, it, expect } from 'vitest';
import { pwaOptions } from './manifest';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('pwaOptions', () => {
  it('usa autoUpdate + injeção automática do registro', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
    expect(pwaOptions.injectRegister).toBe('auto');
  });

  it('não fixa scope/start_url absolutos (derivados do base em 7.3)', () => {
    const m = pwaOptions.manifest;
    if (m && typeof m === 'object') {
      expect(m.scope).toBeUndefined();
      expect(m.start_url).toBeUndefined();
    }
  });

  it('desliga o SW em dev', () => {
    expect(pwaOptions.devOptions?.enabled).toBe(false);
  });
});

describe('pwaOptions.manifest', () => {
  const m = pwaOptions.manifest;

  it('tem nome, display standalone e cores hex válidas', () => {
    expect(m && typeof m !== 'boolean').toBe(true);
    if (m && typeof m === 'object') {
      expect(m.name).toBeTruthy();
      expect(m.short_name).toBeTruthy();
      expect(m.display).toBe('standalone');
      expect(m.theme_color).toMatch(HEX);
      expect(m.background_color).toMatch(HEX);
    }
  });

  it('tem ícones 192 e 512 "any" + um 512 "maskable"', () => {
    if (m && typeof m === 'object') {
      const icons = m.icons ?? [];
      expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
      const any512 = icons.find((i) => i.sizes === '512x512' && (i.purpose ?? 'any').includes('any'));
      const mask512 = icons.find((i) => i.sizes === '512x512' && (i.purpose ?? '').includes('maskable'));
      expect(any512).toBeDefined();
      expect(mask512).toBeDefined();
    }
  });

  it('usa caminhos de ícone relativos (corretos sob qualquer base)', () => {
    if (m && typeof m === 'object') {
      for (const i of m.icons ?? []) expect(i.src.startsWith('/')).toBe(false);
    }
  });
});
