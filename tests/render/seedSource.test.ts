import { describe, it, expect } from 'vitest';
import { endlessSeedFromUint32 } from '@render/seedSource';
import { endlessSeed, randomEndlessToken } from '@core/seed';

describe('endlessSeedFromUint32', () => {
  it('produz endless:<token de 7 chars Crockford>', () => {
    const s = endlessSeedFromUint32(0);
    expect(s).toMatch(/^endless:[0-9A-HJKMNP-TV-Z]{7}$/);
  });

  it('é determinística e casa com endlessSeed(randomEndlessToken(v))', () => {
    const v = 123456789;
    expect(endlessSeedFromUint32(v)).toBe(endlessSeed(randomEndlessToken(v)));
    expect(endlessSeedFromUint32(v)).toBe(endlessSeedFromUint32(v));
  });

  it('trata o valor como uint32 (>>>0) para negativos/grandes', () => {
    expect(endlessSeedFromUint32(-1)).toBe(endlessSeedFromUint32(0xffffffff));
    expect(endlessSeedFromUint32(0x1_0000_0000)).toBe(endlessSeedFromUint32(0));
  });
});
