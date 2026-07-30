/**
 * Constantes globais injetadas em build time via `define` (ver `vite.config.ts` e
 * `vitest.config.ts`, ambos alimentados por `src/build/appVersion.ts`). Substituição
 * textual: no bundle final o identificador vira o literal string, sem custo de runtime.
 */
declare const __APP_VERSION__: string;
