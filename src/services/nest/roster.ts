import type { DinoTrait } from '@core/dino';

/** Definição de meta de um dino do roster (id, traço, preço, chaves i18n, cosmético). */
export interface DinoDef {
  readonly id: string;
  readonly traitKind: DinoTrait;
  readonly price: number;   // em moedas (placeholder de tuning)
  readonly nameKey: string; // chave i18n do nome
  readonly hue: number;     // matiz do avatar geométrico placeholder
}

export const STARTER_DINO_ID = 'starter';

/** Roster de ~10 pterodáctilos. Preços/traços são placeholders (tuning na Fase 8). */
export const DINO_ROSTER: readonly DinoDef[] = Object.freeze([
  { id: 'starter',    traitKind: 'none',       price: 0,   nameKey: 'dino.starter.name',    hue: 200 },
  { id: 'lodestone',  traitKind: 'magnet',     price: 250, nameKey: 'dino.lodestone.name',  hue: 280 },
  { id: 'goldbeak',   traitKind: 'doubleFood', price: 150, nameKey: 'dino.goldbeak.name',   hue: 45  },
  { id: 'midas',      traitKind: 'tripleFood', price: 500, nameKey: 'dino.midas.name',      hue: 50  },
  { id: 'nine-lives', traitKind: 'startLife',  price: 350, nameKey: 'dino.nine-lives.name', hue: 0   },
  { id: 'aegis',      traitKind: 'headStart',  price: 300, nameKey: 'dino.aegis.name',      hue: 210 },
  { id: 'prospector', traitKind: 'magnet',     price: 400, nameKey: 'dino.prospector.name', hue: 120 },
  { id: 'harvester',  traitKind: 'doubleFood', price: 220, nameKey: 'dino.harvester.name',  hue: 90  },
  { id: 'phoenix',    traitKind: 'startLife',  price: 600, nameKey: 'dino.phoenix.name',    hue: 20  },
  { id: 'guardian',   traitKind: 'headStart',  price: 450, nameKey: 'dino.guardian.name',   hue: 240 },
]);

export function dinoById(id: string): DinoDef | undefined {
  return DINO_ROSTER.find((d) => d.id === id);
}
