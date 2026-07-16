import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import { onlineService } from '@services/online';
import { memoryOnlineClient } from '@services/online/client';
import type { Profile } from '@services/profile';

function fakeProfile(p: Profile | null) {
  const s = signal<Profile | null>(p);
  const view: { activeProfile: ReadonlySignal<Profile | null> } = {
    activeProfile: computed(() => s.value),
  };
  return { s, view };
}

const rex: Profile = { id: 'p1', name: 'Rex', createdAt: 0 };

describe('OnlineService', () => {
  beforeEach(async () => {
    // reset entre testes: init offline zera os sinais
    await onlineService.init({ config: null, client: null });
  });

  it('sem config ⇒ status offline, id null, sem sign-in', async () => {
    const client = memoryOnlineClient();
    await onlineService.init({ config: null, client });
    expect(onlineService.status.value).toBe('offline');
    expect(onlineService.globalPlayerId.value).toBeNull();
    expect(client.signInCount).toBe(0);
  });

  it('com config ⇒ online, id = uid, 1 upsert do perfil ativo', async () => {
    const client = memoryOnlineClient({ uid: 'uid-9' });
    const { view } = fakeProfile(rex);
    await onlineService.init({
      config: { url: 'u', anonKey: 'k' },
      client,
      profile: view,
    });
    expect(onlineService.status.value).toBe('online');
    expect(onlineService.globalPlayerId.value).toBe('uid-9');
    expect(client.upserts).toHaveLength(1);
    expect(client.upserts[0]).toMatchObject({ id: 'uid-9', name: 'Rex' });
  });

  it('trocar de perfil ⇒ re-upsert; sem mudança ⇒ sem upsert redundante', async () => {
    const client = memoryOnlineClient({ uid: 'uid-9' });
    const { s, view } = fakeProfile(rex);
    await onlineService.init({ config: { url: 'u', anonKey: 'k' }, client, profile: view });
    expect(client.upserts).toHaveLength(1);
    s.value = { id: 'p2', name: 'Ptera', createdAt: 0 };
    expect(client.upserts).toHaveLength(2);
    s.value = { id: 'p2', name: 'Ptera', createdAt: 0 }; // mesma assinatura
    expect(client.upserts).toHaveLength(2);
  });

  it('sign-in falha ⇒ status error, id null, não lança', async () => {
    const client = memoryOnlineClient({ failSignIn: true });
    const { view } = fakeProfile(rex);
    await onlineService.init({ config: { url: 'u', anonKey: 'k' }, client, profile: view });
    expect(onlineService.status.value).toBe('error');
    expect(onlineService.globalPlayerId.value).toBeNull();
  });
});
