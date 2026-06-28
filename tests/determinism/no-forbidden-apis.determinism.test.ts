import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_DIR = fileURLToPath(new URL('../../src/core', import.meta.url));

const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /\bMath\s*\.\s*random\b/, label: 'Math.random' },
  { pattern: /\bDate\s*\.\s*now\b/, label: 'Date.now' },
  { pattern: /\bperformance\s*\.\s*now\b/, label: 'performance.now' },
  { pattern: /\bnew\s+Date\b/, label: 'new Date' },
  { pattern: /\bsetTimeout\s*\(/, label: 'setTimeout' },
  { pattern: /\bsetInterval\s*\(/, label: 'setInterval' },
  { pattern: /\brequestAnimationFrame\s*\(/, label: 'requestAnimationFrame' },
  { pattern: /from\s+['"]phaser['"]/, label: "import 'phaser'" },
  { pattern: /from\s+['"]preact/, label: "import 'preact'" },
  { pattern: /from\s+['"]@preact\//, label: "import '@preact/*'" },
];

function findForbiddenApis(source: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map((f) => f.label);
}

function collectTsFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(collectTsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('guarda de determinismo do core (camada B)', () => {
  it('o detector pega APIs proibidas numa fixture', () => {
    const bad = `const r = Math.random(); const t = Date.now();`;
    expect(findForbiddenApis(bad).sort()).toEqual(['Date.now', 'Math.random']);
  });

  it('o detector não acusa código limpo', () => {
    const good = `export function step(dt: number) { return dt * 2; }`;
    expect(findForbiddenApis(good)).toEqual([]);
  });

  it('src/core/ não contém nenhuma API proibida', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(CORE_DIR)) {
      const hits = findForbiddenApis(readFileSync(file, 'utf8'));
      if (hits.length) offenders.push(`${file}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
