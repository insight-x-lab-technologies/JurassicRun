#!/usr/bin/env node
// Empacota o build estático para upload no itch.io (jogo HTML5).
// Roda `npm run build` com BASE_PATH=./ (assets relativos, ver src/pwa/base.ts) e
// zipa o CONTEÚDO de dist/ com index.html na raiz do zip (requisito do player itch).
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'dist');
const zipPath = join(repoRoot, 'jurassicrun-itch.zip');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });

console.log('[package-itch] build com BASE_PATH=./');
run('npm', ['run', 'build'], { env: { ...process.env, BASE_PATH: './' } });

if (!existsSync(distDir)) {
  console.error('[package-itch] dist/ não encontrado após o build');
  process.exit(1);
}

if (existsSync(zipPath)) rmSync(zipPath);

console.log('[package-itch] zipando conteúdo de dist/ (index.html na raiz)');
// -r recursivo, -X sem metadados extra de plataforma; cwd=dist ⇒ index.html no topo do zip.
run('zip', ['-r', '-X', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });

console.log(`[package-itch] pronto: ${zipPath}`);
