/**
 * Catálogo de fontes da UI (W6) — módulo PURO (sem DOM), no molde de `@i18n/locales`.
 *
 * A escolha vira duas custom properties (`--font-display` para títulos/botões, `--font-body`
 * para texto), aplicadas em `:root`. Os locales ja/zh/ko/hi não têm glifos nestas famílias
 * latinas e caem no fallback de sistema por cascata natural do CSS.
 */

export const FONT_CHOICES = ['cinzel', 'marcellus', 'exo2', 'system'] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export const DEFAULT_FONT: FontChoice = 'cinzel';

/** Pilha de fallback — igual à de tokens.css, para o CSS gerado bater com o default. */
const FALLBACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface FontStack {
  /** Nome exibido no seletor. Nome próprio ⇒ NÃO passa por i18n. */
  readonly label: string;
  readonly display: string;
  readonly body: string;
}

const STACKS: Readonly<Record<FontChoice, FontStack>> = Object.freeze({
  cinzel: {
    label: 'Cinzel',
    display: `'Cinzel Decorative', 'Cinzel', ${FALLBACK}`,
    body: `'Cinzel', ${FALLBACK}`,
  },
  marcellus: {
    label: 'Marcellus',
    display: `'Marcellus', ${FALLBACK}`,
    body: `'Marcellus', ${FALLBACK}`,
  },
  exo2: {
    label: 'Exo 2',
    display: `'Exo 2', ${FALLBACK}`,
    body: `'Exo 2', ${FALLBACK}`,
  },
  system: {
    label: 'System',
    display: FALLBACK,
    body: FALLBACK,
  },
});

export function isFontChoice(v: string): v is FontChoice {
  return (FONT_CHOICES as readonly string[]).includes(v);
}

/** Pilha de uma escolha. Alocação-zero: devolve o objeto congelado do catálogo. */
export function fontStackFor(choice: FontChoice): FontStack {
  return STACKS[choice];
}
