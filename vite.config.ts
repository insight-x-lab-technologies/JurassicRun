import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // PWA real fica na Fase 7; aqui só registra sem exigir ícones.
    VitePWA({ disable: true }),
  ],
  // Vite 8 usa rolldown/oxc (não esbuild) para o transform de JSX; `esbuild.jsx` não
  // existe mais no tipo (o pacote `esbuild` nem é dependência). Equivalente em oxc:
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
});
