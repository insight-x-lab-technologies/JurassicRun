import { describe, it, expect } from 'vitest';
import { memoryNestStorage } from '@services/nest/storage';
import { initialNestState } from '@services/nest/store';

describe('nest storage (memory)', () => {
  it('round-trip preserva o estado', () => {
    const s = memoryNestStorage();
    const st = { owned: ['starter', 'midas'], activeId: 'midas' };
    s.save(st);
    expect(s.load()).toEqual(st);
  });
  it('default é o estado inicial', () => {
    expect(memoryNestStorage().load()).toEqual(initialNestState());
  });
});
