import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STOREFRONT,
  KOFI_PAGE_URL,
  parseStorefront,
  formatPrice,
  checkoutUrlFor,
} from '@services/purchase/storefront';
import { DONATE_OPTIONS } from '@app/home/donate';

describe('storefront — defaults', () => {
  it('tem preço positivo em unidades menores para os 3 SKUs de moeda', () => {
    for (const id of ['small', 'medium', 'large'] as const) {
      const p = DEFAULT_STOREFRONT.prices[id];
      expect(Number.isInteger(p.amountMinor)).toBe(true);
      expect(p.amountMinor).toBeGreaterThan(0);
      expect(p.currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('preço cresce com o tamanho do pacote', () => {
    const { small, medium, large } = DEFAULT_STOREFRONT.prices;
    expect(small.amountMinor).toBeLessThan(medium.amountMinor);
    expect(medium.amountMinor).toBeLessThan(large.amountMinor);
  });

  // Guarda de sincronia: Loja e Doação têm de apontar para a MESMA página do estúdio.
  it('a URL do Ko-fi é a mesma da tela de doação', () => {
    const kofi = DONATE_OPTIONS.find((o) => o.id === 'kofi');
    expect(kofi?.url).toBe(KOFI_PAGE_URL);
  });
});

describe('storefront — parseStorefront', () => {
  it('sem env devolve os defaults', () => {
    expect(parseStorefront({})).toEqual(DEFAULT_STOREFRONT);
  });

  it('sobrescreve URL, moeda e preços válidos', () => {
    const sf = parseStorefront({
      VITE_SHOP_KOFI_URL: 'https://ko-fi.com/outro',
      VITE_SHOP_CURRENCY: 'brl',
      VITE_SHOP_PRICE_SMALL: '990',
      VITE_SHOP_PRICE_MEDIUM: 2490,
      VITE_SHOP_PRICE_LARGE: '4990',
    });
    expect(sf.kofiUrl).toBe('https://ko-fi.com/outro');
    expect(sf.prices.small).toEqual({ amountMinor: 990, currency: 'BRL' });
    expect(sf.prices.medium.amountMinor).toBe(2490);
    expect(sf.prices.large.amountMinor).toBe(4990);
  });

  it('ignora valores inválidos campo a campo, sem lançar', () => {
    const sf = parseStorefront({
      VITE_SHOP_KOFI_URL: '   ',
      VITE_SHOP_CURRENCY: 'reais',
      VITE_SHOP_PRICE_SMALL: 'grátis',
      VITE_SHOP_PRICE_MEDIUM: -5,
      VITE_SHOP_PRICE_LARGE: 1.5,
    });
    expect(sf).toEqual(DEFAULT_STOREFRONT);
  });
});

describe('storefront — formatPrice', () => {
  it('formata unidades menores como dinheiro da língua ativa', () => {
    const s = formatPrice({ amountMinor: 199, currency: 'USD' }, 'en');
    expect(s).toContain('1.99');
  });

  it('moeda inválida não quebra: cai no formato textual', () => {
    const s = formatPrice({ amountMinor: 199, currency: 'XX' }, 'en');
    expect(s).toContain('1.99');
    expect(s).toContain('XX');
  });
});

describe('storefront — checkoutUrlFor', () => {
  it('anexa o SKU como query na URL base', () => {
    const url = checkoutUrlFor(DEFAULT_STOREFRONT, 'coins:small');
    expect(url.startsWith(`${KOFI_PAGE_URL}?`)).toBe(true);
    expect(url).toContain('jr_sku=coins%3Asmall');
  });

  it('preserva query já existente na base', () => {
    const sf = { ...DEFAULT_STOREFRONT, kofiUrl: 'https://ko-fi.com/x?ref=game' };
    expect(checkoutUrlFor(sf, 'coins:large')).toBe(
      'https://ko-fi.com/x?ref=game&jr_sku=coins%3Alarge',
    );
  });

  // Concatenar cegamente poria a query DENTRO do fragmento (`#foo?jr_sku=…`), onde nenhum
  // parser HTTP a lê — o SKU se perderia em silêncio e o pedido chegaria sem rastreio.
  it('põe o SKU na query, não dentro do fragmento', () => {
    const sf = { ...DEFAULT_STOREFRONT, kofiUrl: 'https://ko-fi.com/x#tip' };
    expect(checkoutUrlFor(sf, 'coins:small')).toBe('https://ko-fi.com/x?jr_sku=coins%3Asmall#tip');
  });

  it('URL base inválida não lança (cai na concatenação)', () => {
    const sf = { ...DEFAULT_STOREFRONT, kofiUrl: 'nao-e-url' };
    expect(() => checkoutUrlFor(sf, 'coins:small')).not.toThrow();
    expect(checkoutUrlFor(sf, 'coins:small')).toContain('jr_sku=coins%3Asmall');
  });
});
