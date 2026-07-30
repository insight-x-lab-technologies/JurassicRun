import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { appVersion } from '../../src/build/appVersion';

const pkg: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf-8'),
);

describe('appVersion', () => {
  it('devolve exatamente o `version` do package.json real', () => {
    const expected = (pkg as { version: string }).version;
    expect(appVersion()).toBe(expected);
  });

  it('tem formato semver plausível', () => {
    expect(appVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
