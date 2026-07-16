import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';
import { OnlineService } from '@services/online';
import { signal } from '@preact/signals';

function fakeProfile() {
  return { activeProfile: signal({ id: 'p1', name: 'Rex', createdAt: 0 }) };
}
const config = { url: 'x', anonKey: 'y' };

const entry = {
  mode: 'daily' as const, seed: 'daily:2026-07-16',
  score: 10, distance: 20, food: 3, nearMisses: 1,
  timeline: [true, false, true], finalHash: 'abc',
};

describe('OnlineService.submitChallengeEntry', () => {
  it('anexa o uid e delega ao cliente quando online', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    await svc.submitChallengeEntry(entry);
    expect(client.submittedChallenges).toEqual([{ ...entry, playerId: 'uid-1' }]);
  });

  it('é no-op offline (não lança)', async () => {
    const client = memoryOnlineClient();
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: fakeProfile() });
    await expect(svc.submitChallengeEntry(entry)).resolves.toBeUndefined();
    expect(client.submittedChallenges).toEqual([]);
  });

  it('fetchVerifiedPlayers delega e devolve os ids', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1', verifiedPlayers: ['uid-9'] });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    expect(await svc.fetchVerifiedPlayers('daily', 'daily:2026-07-16')).toEqual(['uid-9']);
  });
});
