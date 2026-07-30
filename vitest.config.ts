import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { appVersion } from './src/build/appVersion';

export default defineConfig({
  plugins: [tsconfigPaths()],
  // Este config NÃO estende `vite.config.ts` — são arquivos separados e independentes.
  // Sem este `define` aqui também, qualquer teste que renderize a Home explode com
  // `ReferenceError: __APP_VERSION__ is not defined`. Não "limpar" esta duplicação.
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
