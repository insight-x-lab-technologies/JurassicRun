/**
 * Lê o `version` do `package.json` da raiz do repo, em build time. Fonte única da
 * verdade para o número exibido na Home: em vez de duplicar o literal em `vite.config.ts`
 * e `vitest.config.ts` (que dessincronizaria a cada bump), os dois configs chamam este
 * helper e injetam o resultado como a constante global `__APP_VERSION__` via `define`
 * (substituição textual — o bundle do app nunca importa o JSON inteiro, só a string).
 *
 * Resolve o caminho relativo a este próprio módulo (`import.meta.url`), não a
 * `process.cwd()`: o cwd varia entre `npm run build`, `vitest` e CI, mas a posição deste
 * arquivo em relação ao `package.json` é sempre a mesma.
 *
 * Roda em Node em build time — nunca é importado pelo código do app (`src/core`,
 * `src/app`, `src/render`), só pelos configs. `node:fs`/`node:url` são permitidos aqui.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);

export function appVersion(): string {
  const raw = readFileSync(fileURLToPath(PACKAGE_JSON_URL), 'utf-8');
  const pkg: unknown = JSON.parse(raw);

  if (typeof pkg !== 'object' || pkg === null || !('version' in pkg)) {
    throw new Error('appVersion: package.json não tem campo "version".');
  }

  const version = (pkg as { version: unknown }).version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('appVersion: campo "version" do package.json não é uma string válida.');
  }

  return version;
}
