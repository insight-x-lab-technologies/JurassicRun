import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ATLAS_SOURCES } from '../../scripts/gen-atlas.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS_DIR = join(ROOT, 'docs/assets');
const REGISTRY = join(ASSETS_DIR, 'asset-registry.md');

function specPathsInRegistry(): string[] {
  const md = readFileSync(REGISTRY, 'utf8');
  const matches = md.match(/specs\/[A-Za-z0-9._-]+\.md/g) ?? [];
  return [...new Set(matches)];
}

describe('asset registry ↔ specs parity', () => {
  it('every spec path referenced in the registry exists on disk', () => {
    const missing = specPathsInRegistry().filter(
      (p) => !existsSync(join(ASSETS_DIR, p)),
    );
    expect(missing).toEqual([]);
  });

  it('the registry references at least one spec path', () => {
    expect(specPathsInRegistry().length).toBeGreaterThan(0);
  });

  it('every new UI/background spec carries an AI generation prompt block', () => {
    const NEW_SPECS = [
      'logo.app',
      'ui.panel.frame',
      'ui.button',
      'ui.header.emblem',
      'ui.statchip.frame',
      'ui.medals',
      'ui.nav.bar',
      'ui.icons',
      'bg.screen',
      'expansion.covers',
    ];
    const missing = NEW_SPECS.filter((name) => {
      const file = join(ASSETS_DIR, 'specs', `${name}.md`);
      if (!existsSync(file)) return true;
      return !readFileSync(file, 'utf8').includes(
        '## Prompt para geração por IA',
      );
    });
    expect(missing).toEqual([]);
  });
});

describe('entidades in-game: arte real presente', () => {
  it('todo id de ATLAS_SOURCES tem o PNG-fonte em public/art/final/', () => {
    const missing = ATLAS_SOURCES.filter(
      (s) => !existsSync(join(ROOT, 'public/art/final', s.file)),
    );
    expect(missing).toEqual([]);
  });

  it('o registro marca as 11 entidades in-game como `art`', () => {
    const md = readFileSync(REGISTRY, 'utf8');
    for (const s of ATLAS_SOURCES) {
      const row = md.split('\n').find((l) => l.includes(`\`${s.id}\``));
      expect(row, `sem linha no registro: ${s.id}`).toBeDefined();
      expect(row, `${s.id} não está \`art\``).toMatch(/\bart\b/);
    }
  });
});
