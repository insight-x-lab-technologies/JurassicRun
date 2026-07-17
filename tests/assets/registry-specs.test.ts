import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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
