import type { Sku } from './sku';

/** Pacote de moedas vendável. Mesmos ids de `COIN_SKU_AMOUNTS`. */
export type CoinSkuId = 'small' | 'medium' | 'large';

/** Preço em UNIDADES MENORES (centavos) — inteiro. Dinheiro nunca em float. */
export interface PriceTag {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface Storefront {
  readonly kofiUrl: string;
  readonly prices: Readonly<Record<CoinSkuId, PriceTag>>;
}

/**
 * Página do estúdio no Ko-fi. É a MESMA de `DONATE_OPTIONS` (`src/app/home/donate.ts`);
 * um teste de sincronia guarda as duas contra divergência silenciosa.
 */
export const KOFI_PAGE_URL = 'https://ko-fi.com/insightxlabgamestudio';

const DEFAULT_CURRENCY = 'USD';

/**
 * Preços default (tuning de hobby, como `COIN_SKU_AMOUNTS`). Existem para a Loja funcionar
 * SEM `.env` — `parseStorefront` só sobrescreve o que vier válido.
 */
export const DEFAULT_STOREFRONT: Storefront = Object.freeze({
  kofiUrl: KOFI_PAGE_URL,
  prices: Object.freeze({
    small: { amountMinor: 199, currency: DEFAULT_CURRENCY },
    medium: { amountMinor: 499, currency: DEFAULT_CURRENCY },
    large: { amountMinor: 999, currency: DEFAULT_CURRENCY },
  }),
});

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Aceita number ou string numérica; exige inteiro positivo (centavos). */
function positiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** ISO-4217 tem 3 letras. Qualquer outra coisa é lixo de configuração. */
function currencyCode(v: unknown): string | null {
  if (!nonEmptyString(v)) return null;
  const up = v.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

const ENV_PRICE_KEY: Readonly<Record<CoinSkuId, string>> = {
  small: 'VITE_SHOP_PRICE_SMALL',
  medium: 'VITE_SHOP_PRICE_MEDIUM',
  large: 'VITE_SHOP_PRICE_LARGE',
};

/**
 * Puro: monta a vitrine a partir de um objeto env-like, campo a campo. Nunca lança e nunca
 * devolve estado parcial — o que não vier válido fica no default.
 */
export function parseStorefront(env: Record<string, unknown>): Storefront {
  const kofiUrl = nonEmptyString(env['VITE_SHOP_KOFI_URL'])
    ? (env['VITE_SHOP_KOFI_URL'] as string).trim()
    : DEFAULT_STOREFRONT.kofiUrl;
  const currency = currencyCode(env['VITE_SHOP_CURRENCY']);

  const ids: readonly CoinSkuId[] = ['small', 'medium', 'large'];
  const prices = {} as Record<CoinSkuId, PriceTag>;
  for (const id of ids) {
    const fallback = DEFAULT_STOREFRONT.prices[id];
    prices[id] = {
      amountMinor: positiveInt(env[ENV_PRICE_KEY[id]]) ?? fallback.amountMinor,
      currency: currency ?? fallback.currency,
    };
  }
  return { kofiUrl, prices: Object.freeze(prices) };
}

/**
 * Formata para exibição na língua ativa. `Intl` recusa moeda fora do ISO-4217 lançando
 * `RangeError` — nesse caso cai num formato textual em vez de derrubar a tela.
 */
export function formatPrice(price: PriceTag, locale: string): string {
  const units = price.amountMinor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: price.currency,
    }).format(units);
  } catch {
    return `${price.currency} ${units.toFixed(2)}`;
  }
}

/**
 * URL de checkout. O SKU viaja na query para o pedido chegar rastreável ao fulfillment manual
 * (`supabase/README.md`). A UI também mostra o SKU, porque o Ko-fi não garante prefill de mensagem.
 */
export function checkoutUrlFor(sf: Storefront, sku: Sku): string {
  try {
    // `URL` põe o parâmetro na QUERY mesmo quando a base tem fragmento; concatenar cegamente
    // geraria `#foo?jr_sku=…`, que vira parte do fragmento e some para qualquer parser HTTP.
    const url = new URL(sf.kofiUrl);
    url.searchParams.set('jr_sku', sku);
    return url.toString();
  } catch {
    // URL base absurda vinda de env: melhor um link concatenado do que uma tela quebrada.
    const sep = sf.kofiUrl.includes('?') ? '&' : '?';
    return `${sf.kofiUrl}${sep}jr_sku=${encodeURIComponent(sku)}`;
  }
}

/** Casca: lê o ambiente Vite. */
export function storefront(): Storefront {
  return parseStorefront(import.meta.env as unknown as Record<string, unknown>);
}
