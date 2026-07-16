import { describe, it, expect } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';

describe('memoryOnlineClient', () => {
  it('signInAnonymously resolve com o uid e conta chamadas', async () => {
    const c = memoryOnlineClient({ uid: 'uid-1' });
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(c.signInCount).toBe(2);
  });

  it('signInAnonymously rejeita quando failSignIn', async () => {
    const c = memoryOnlineClient({ failSignIn: true });
    await expect(c.signInAnonymously()).rejects.toThrow();
  });

  it('upsertPlayer registra os players enviados', async () => {
    const c = memoryOnlineClient();
    await c.upsertPlayer({ id: 'uid-1', name: 'Rex', avatar: '120' });
    expect(c.upserts).toEqual([{ id: 'uid-1', name: 'Rex', avatar: '120' }]);
  });
});
