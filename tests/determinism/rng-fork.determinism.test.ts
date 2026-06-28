import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';

function take(rng: { nextUint32(): number }, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng.nextUint32());
  return out;
}

describe('Rng — fork (streams independentes)', () => {
  it('forks de ids diferentes geram sequências diferentes', () => {
    const parent = createRng('seed');
    const a = take(parent.fork('spawn'), 16);
    const b = take(parent.fork('weather'), 16);
    expect(a).not.toEqual(b);
  });

  it('fork(id) é estável independentemente de quanto o pai consumiu', () => {
    const p1 = createRng('seed');
    const forkBefore = take(p1.fork('spawn'), 16);

    const p2 = createRng('seed');
    take(p2, 50); // pai consome bastante antes
    const forkAfter = take(p2.fork('spawn'), 16);

    expect(forkAfter).toEqual(forkBefore);
  });

  it('fork não é afetado pela própria sequência do pai e vice-versa', () => {
    const parent = createRng('seed');
    const child = parent.fork('spawn');
    // consumir o filho não muda o pai
    const childRun = take(child, 8);
    const parentRun = take(parent, 8);
    const freshParent = take(createRng('seed'), 8);
    expect(parentRun).toEqual(freshParent);
    // e o filho é reproduzível
    expect(take(createRng('seed').fork('spawn'), 8)).toEqual(childRun);
  });

  it('seed do filho reflete a chave combinada', () => {
    const child = createRng('seed').fork('spawn');
    expect(child.seed).toBe('seed::spawn');
  });

  it('fork aceita streamId numérico', () => {
    const parent = createRng('seed');
    expect(parent.fork(0).seed).toBe('seed::0');
    expect(take(parent.fork(0), 4)).not.toEqual(take(parent.fork(1), 4));
  });
});
