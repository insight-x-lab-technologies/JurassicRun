import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // PWA real fica na Fase 7; aqui só registra sem exigir ícones.
    VitePWA({ disable: true }),
  ],
});
