export type ExpansionTier = 'free' | 'premium';

/** Definição de meta de uma expansão cosmética (ADR-0003). Arte real = Fase 8. */
export interface ExpansionDef {
  readonly id: string;
  readonly tier: ExpansionTier;
  readonly nameKey: string; // chave i18n do nome
  readonly descKey: string; // chave i18n da descrição
  readonly hue: number;     // matiz do card placeholder, até a arte da Fase 8
}

export const DEFAULT_EXPANSION_ID = 'classic';

/** Catálogo de expansões. `classic` é o look atual (free); demais são premium placeholders. */
export const EXPANSION_CATALOG: readonly ExpansionDef[] = Object.freeze([
  { id: 'classic', tier: 'free',    nameKey: 'expansion.classic.name', descKey: 'expansion.classic.desc', hue: 200 },
  { id: 'volcano', tier: 'premium', nameKey: 'expansion.volcano.name', descKey: 'expansion.volcano.desc', hue: 12  },
  { id: 'glacier', tier: 'premium', nameKey: 'expansion.glacier.name', descKey: 'expansion.glacier.desc', hue: 190 },
]);

export function expansionById(id: string): ExpansionDef | undefined {
  return EXPANSION_CATALOG.find((e) => e.id === id);
}
