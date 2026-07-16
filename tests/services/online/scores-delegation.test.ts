import { describe, it, expect } from 'vitest';
import { OnlineService } from '@services/online';
import { memoryOnlineClient } from '@services/online/client';

// perfil mínimo p/ init
const profileStub = { activeProfile: { value: null } } as never;

describe('OnlineService scores', () => {
  it('offline ⇒ submitScore no-op e fetchScores vazio', async () => {
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: profileStub });
    expect(svc.online.value).toBe(false);
    await svc.submitScore({ mode: 'endless', seed: 's', score: 1, distance: 1, food: 0, nearMisses: 0, level: 0 });
    expect(await svc.fetchScores('endless')).toHaveLength(0);
  });

  it('online ⇒ submitScore anexa playerId e delega ao client', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config: { url: 'u', anonKey: 'k' }, client, profile: profileStub });
    expect(svc.online.value).toBe(true);
    await svc.submitScore({ mode: 'endless', seed: 's', score: 5, distance: 2, food: 0, nearMisses: 0, level: 1 });
    expect(client.submittedScores[0]).toMatchObject({ playerId: 'uid-1', score: 5 });
  });
});
