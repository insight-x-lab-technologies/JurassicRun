import { describe, it, expect, vi } from 'vitest';
import { createMatchFactory, type MatchFactoryDeps } from '@render/matchFactory';
import { challengeWorldConfig } from '@core/challenge';
import type { WorldConfig, WorldState } from '@core/sim';

// createWorld fake: devolve um WorldState-marcador carregando a config recebida.
function fakeDeps(overrides: Partial<MatchFactoryDeps> = {}): MatchFactoryDeps {
  let endlessN = 0;
  return {
    randomEndlessSeed: () => `endless:R${endlessN++}`,
    dailyChallengeSeed: vi.fn(() => 'daily:2026-07-07'),
    weeklyChallengeSeed: vi.fn(() => 'weekly:2026-W28'),
    activeTrait: () => 'magnet',
    createWorld: (config: WorldConfig) => ({ __config: config }) as unknown as WorldState,
    ...overrides,
  };
}

describe('createMatchFactory', () => {
  it('endless: sorteia nova seed a cada chamada e usa o trait ativo', () => {
    const factory = createMatchFactory('endless', fakeDeps());
    const a = factory();
    const b = factory();
    expect(a.seedLabel).toBe('endless:R0');
    expect(b.seedLabel).toBe('endless:R1');
    expect((a.world as unknown as { __config: WorldConfig }).__config).toEqual({
      seed: 'endless:R0',
      trait: 'magnet',
    });
  });

  it('daily: captura a seed 1× (restart replaya) e força trait none', () => {
    const deps = fakeDeps();
    const factory = createMatchFactory('daily', deps);
    const a = factory();
    const b = factory();
    expect(a.seedLabel).toBe('daily:2026-07-07');
    expect(b.seedLabel).toBe('daily:2026-07-07'); // mesma seed no restart
    expect(deps.dailyChallengeSeed).toHaveBeenCalledTimes(1); // resolvida só na criação
    expect((a.world as unknown as { __config: WorldConfig }).__config).toEqual(
      challengeWorldConfig('daily:2026-07-07'),
    );
  });

  it('weekly: captura a seed 1× e força trait none', () => {
    const deps = fakeDeps();
    const factory = createMatchFactory('weekly', deps);
    expect(factory().seedLabel).toBe('weekly:2026-W28');
    expect(factory().seedLabel).toBe('weekly:2026-W28');
    expect(deps.weeklyChallengeSeed).toHaveBeenCalledTimes(1);
    expect((factory().world as unknown as { __config: WorldConfig }).__config.trait).toBe('none');
  });
});

describe('createMatchFactory — modo desafio usa a config canônica', () => {
  function depsWithCapture(captured: WorldConfig[]): MatchFactoryDeps {
    return {
      randomEndlessSeed: () => 'endless:AAAAAAA',
      dailyChallengeSeed: () => 'daily:2026-03-03',
      weeklyChallengeSeed: () => 'weekly:2026-W10',
      activeTrait: () => 'none',
      createWorld: (c: WorldConfig): WorldState => {
        captured.push(c);
        return {} as WorldState;
      },
    };
  }

  it('daily usa exatamente challengeWorldConfig(seed)', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('daily', depsWithCapture(captured))();
    expect(captured[0]).toEqual(challengeWorldConfig('daily:2026-03-03'));
  });

  it('weekly usa exatamente challengeWorldConfig(seed)', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('weekly', depsWithCapture(captured))();
    expect(captured[0]).toEqual(challengeWorldConfig('weekly:2026-W10'));
  });

  it('endless NÃO liga a flag de desafio', () => {
    const captured: WorldConfig[] = [];
    createMatchFactory('endless', depsWithCapture(captured))();
    expect(captured[0]?.challenge).toBeUndefined();
  });
});
