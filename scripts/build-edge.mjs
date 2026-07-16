// scripts/build-edge.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  entryPoints: [path.join(root, 'src/services/online/verifyChallenge.ts')],
  outfile: path.join(root, 'supabase/functions/verify-challenge/_verify.bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  alias: { '@core': path.join(root, 'src/core') },
  banner: { js: '// GERADO por scripts/build-edge.mjs — NÃO editar à mão. Rode `npm run build:edge`.' },
});
console.log('edge bundle escrito.');
