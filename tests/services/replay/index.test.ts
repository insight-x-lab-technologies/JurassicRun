import { describe, it, expect } from 'vitest';
import { ReplayService } from '@services/replay';
import { memoryReplayStorage } from '@services/replay/storage';
import { recordReplay, initialReplayState, type StoredReplay } from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily', seed: 'daily:2026-07-08', timeline: [true, false, true],
    score: 100, distance: 50, food: 3, nearMisses: 1,
    finalHash: 'a'.repeat(32), achievedAt: 1000, ...over,
  };
}

describe('ReplayService', () => {
  it('init carrega o estado do storage', () => {
    const seeded = recordReplay(initialReplayState(), replay());
    const svc = new ReplayService();
    svc.init(memoryReplayStorage(seeded));
    expect(svc.daily.value).toHaveLength(1);
    expect(svc.daily.value[0]!.seed).toBe('daily:2026-07-08');
  });

  it('record grava e persiste; sinal reativo atualiza', () => {
    const storage = memoryReplayStorage();
    const svc = new ReplayService();
    svc.init(storage);
    svc.record(replay({ mode: 'weekly', seed: 'weekly:x' }));
    expect(svc.weekly.value).toHaveLength(1);
    expect(storage.load().weekly).toHaveLength(1);
  });

  it('record no-op (não supera) não persiste de novo (mesma ref de estado)', () => {
    const storage = memoryReplayStorage();
    const svc = new ReplayService();
    svc.init(storage);
    svc.record(replay({ score: 250 }));
    const afterFirst = storage.load();
    svc.record(replay({ score: 100 })); // mesma seed, score menor
    expect(storage.load()).toBe(afterFirst); // save não chamado de novo
  });

  it('verify delega para verifyReplay (hash inconsistente ⇒ inválido)', () => {
    const svc = new ReplayService();
    svc.init(memoryReplayStorage());
    // finalHash forjado não corresponde à re-simulação ⇒ inválido
    expect(svc.verify(replay({ finalHash: 'a'.repeat(32) })).valid).toBe(false);
  });
});
