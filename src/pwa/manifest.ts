import type { VitePWAOptions } from 'vite-plugin-pwa';

// Cores casadas com os design tokens (src/app/styles/tokens.css).
const THEME = '#0e1116'; // --color-bg
const BACKGROUND = '#0e1116';

/**
 * Contrato do manifesto/SW da PWA, isolado como módulo puro p/ ser testável sem
 * rodar o build (molde de src/services/online/schema.ts). Consumido pela casca
 * vite.config.ts. Caminhos de ícone são relativos ⇒ corretos sob qualquer `base`
 * (o subdiretório do GitHub Pages entra em 7.3, e o plugin deriva scope/start_url).
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['icons/*.png'],
  manifest: {
    name: 'JurassicRun',
    short_name: 'JurassicRun',
    description: 'Deterministic pterodactyl side-scroller you can play offline.',
    theme_color: THEME,
    background_color: BACKGROUND,
    display: 'standalone',
    orientation: 'any',
    categories: ['games'],
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
  devOptions: { enabled: false },
};
