/**
 * Packs look&feel (8.3): bundle cosmético trocável (tema CSS + paletas do mundo + tint de
 * entidades). 100% render/app ⇒ NÃO toca `src/core/` (determinismo intacto). Trocar look = editar
 * estes dados, nunca a lógica (REGRA 2). Keyed pelos ids de expansão (seam `activeExpansion`, 4.6).
 * `classic` reexporta os valores atuais ⇒ zero regressão.
 */
import { DAY_NIGHT_PALETTES, type TimeOfDay, type DayNightPalette } from './daynight';
import { PARALLAX_LAYERS } from './parallax';
import { DEFAULT_ATLAS, type AtlasRef } from './sprites';

export interface ParallaxPaint {
  readonly color: number;
}

export interface LookPack {
  readonly id: string;
  /** Custom properties CSS aplicadas em :root (reskin dos menus DOM). */
  readonly theme: Readonly<Record<string, string>>;
  /** As 4 paletas do mundo; a seleção continua derivada da seed (dia/noite 3.3). */
  readonly dayNight: Readonly<Record<TimeOfDay, DayNightPalette>>;
  /** Cor de cada camada de parallax, na ordem de PARALLAX_LAYERS. */
  readonly parallax: readonly ParallaxPaint[];
  /** Tint multiplicativo dos sprites de entidade; 0xffffff = sem alteração. */
  readonly entityTint: number;
  /** Atlas de entidades do tema; ausente ⇒ reusa o default (seam para arte alternativa, 8.1). */
  readonly atlas?: AtlasRef;
  /** Nome do fundo de tela em public/ui/ (por expansão ativa). Seam Tier-1 (8.1). */
  readonly bgScreen: string;
}

/** Cores de parallax atuais, extraídas das camadas primitivas (classic). */
const CLASSIC_PARALLAX: readonly ParallaxPaint[] = PARALLAX_LAYERS.map((l) => ({
  color: l.visual.kind === 'primitive' ? l.visual.color : 0xffffff,
}));

/** Tema padrão = valores de tokens.css. Fonte única do `classic`. */
const CLASSIC_THEME: Readonly<Record<string, string>> = {
  '--color-bg': '#0e1116',
  '--color-surface': '#1a1f2b',
  '--color-surface-2': '#232a38',
  '--color-primary': '#4ea1ff',
  '--color-accent': '#ffcf5c',
  '--color-gold': '#c9a227',
};

export const PACK_CLASSIC: LookPack = {
  id: 'classic',
  theme: CLASSIC_THEME,
  dayNight: DAY_NIGHT_PALETTES,
  parallax: CLASSIC_PARALLAX,
  entityTint: 0xffffff,
  atlas: DEFAULT_ATLAS,
  bgScreen: 'bg.screen.classic',
};

/** Vulcão — quente/basalto. Placeholders coerentes com o Style Bible (8.1); tuning na arte. */
const PACK_VOLCANO: LookPack = {
  id: 'volcano',
  theme: {
    '--color-bg': '#160d0d',
    '--color-surface': '#241315',
    '--color-surface-2': '#331b1c',
    '--color-primary': '#ff7a3c',
    '--color-accent': '#ffcf5c',
    '--color-gold': '#d98a2b',
  },
  dayNight: {
    morning: { sky: 0xffb070, ground: 0x5a2f22, ceiling: 0x3a1f24, parallaxTint: 0xffd0a0 },
    afternoon: { sky: 0xe8815a, ground: 0x5a2a20, ceiling: 0x3a1e22, parallaxTint: 0xffc0a0 },
    dusk: { sky: 0xd8542f, ground: 0x4a241a, ceiling: 0x42202a, parallaxTint: 0xff9060 },
    night: { sky: 0x2a1218, ground: 0x2a150f, ceiling: 0x22101a, parallaxTint: 0xaa5544 },
  },
  parallax: [{ color: 0x7a4a4a }, { color: 0x8a3f2a }, { color: 0x532f24 }],
  entityTint: 0xffd9c8,
  atlas: { key: 'entities.volcano', png: 'atlas/entities.volcano.png', json: 'atlas/entities.volcano.json' },
  bgScreen: 'bg.screen.volcano',
};

/** Geleira — frio/gelo. Placeholders coerentes com o Style Bible (8.1); tuning na arte. */
const PACK_GLACIER: LookPack = {
  id: 'glacier',
  theme: {
    '--color-bg': '#0b1016',
    '--color-surface': '#131d28',
    '--color-surface-2': '#1c2a38',
    '--color-primary': '#5ac8ff',
    '--color-accent': '#bfe6ff',
    '--color-gold': '#9fb8cc',
  },
  dayNight: {
    morning: { sky: 0xd6f0ff, ground: 0x8fb0c0, ceiling: 0x4a5a6a, parallaxTint: 0xe0f4ff },
    afternoon: { sky: 0xbfe6ff, ground: 0x8aa8ba, ceiling: 0x3a4a5a, parallaxTint: 0xffffff },
    dusk: { sky: 0x9ab8d8, ground: 0x6f8a9a, ceiling: 0x42506a, parallaxTint: 0xc0d8f0 },
    night: { sky: 0x18243a, ground: 0x24333f, ceiling: 0x1e2838, parallaxTint: 0x6688cc },
  },
  parallax: [{ color: 0x9fb8cc }, { color: 0x7fa8c0 }, { color: 0x5f88a0 }],
  entityTint: 0xd8ecff,
  atlas: { key: 'entities.glacier', png: 'atlas/entities.glacier.png', json: 'atlas/entities.glacier.json' },
  bgScreen: 'bg.screen.glacier',
};

export const LOOK_PACKS: readonly LookPack[] = [PACK_CLASSIC, PACK_VOLCANO, PACK_GLACIER];

/** Pack por id (= id de expansão); fallback `classic` para id desconhecido. */
export function packForId(id: string): LookPack {
  return LOOK_PACKS.find((p) => p.id === id) ?? PACK_CLASSIC;
}
