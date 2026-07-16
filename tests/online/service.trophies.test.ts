import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';
import { OnlineService } from '@services/online';
import { signal } from '@preact/signals';

function fakeProfile() {
  return { activeProfile: signal({ id: 'p1', name: 'Rex', createdAt: 0 }) };
}
const config = { url: 'x', anonKey: 'y' };

describe('OnlineService troféus', () => {
  it('submitTrophies anexa o próprio id quando online', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    await svc.submitTrophies(['centurion']);
    expect(client.submittedTrophies).toEqual([{ playerId: 'uid-1', ids: ['centurion'] }]);
    expect(await svc.fetchTrophies()).toEqual([]);
  });

  it('offline: submitTrophies é no-op e fetchTrophies vazio', async () => {
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: fakeProfile() });
    await expect(svc.submitTrophies(['centurion'])).resolves.toBeUndefined();
    expect(await svc.fetchTrophies()).toEqual([]);
  });
});
