import { describe, it, expect } from 'vitest';
import { NullInputSource } from '@render/input';

describe('NullInputSource', () => {
  it('nunca pede flap', () => {
    const src = new NullInputSource();
    expect(src.sample()).toEqual({ flap: false });
    expect(src.sample()).toEqual({ flap: false });
  });
});
