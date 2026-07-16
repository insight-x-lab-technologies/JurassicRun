import { describe, it, expect } from 'vitest';
import { TrophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { memoryTrophyOnline } from '@services/trophy/online';
import { initialTrophyState } from '@services/trophy/store';

const summary = { distance: 0, food: 0, nearMisses: 0, score: 0 };

describe('TrophyService online-aware', () => {
  it('recordMatch faz push dos recém-desbloqueados quando online', async () => {
    const online = memoryTrophyOnline({ online: true });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    svc.recordMatch(summary); // destrava firstFlight (gamesPlayed>=1)
    await Promise.resolve();
    expect(online.submitted.flat()).toContain('firstFlight');
  });

  it('offline: recordMatch não faz push', async () => {
    const online = memoryTrophyOnline({ online: false });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    svc.recordMatch(summary);
    await Promise.resolve();
    expect(online.submitted).toEqual([]);
  });

  it('recordDailyPodium destrava dailyPodium em rank<=3, não em rank>3', () => {
    const svc1 = new TrophyService();
    svc1.init(memoryTrophyStorage(), memoryTrophyOnline({ online: false }));
    expect(svc1.recordDailyPodium(2)).toContain('dailyPodium');

    const svc2 = new TrophyService();
    svc2.init(memoryTrophyStorage(), memoryTrophyOnline({ online: false }));
    expect(svc2.recordDailyPodium(5)).not.toContain('dailyPodium');
  });

  it('mergeFromServer une ids do servidor e faz push dos locais-só na borda online', async () => {
    // estado local começa com firstFlight já desbloqueado
    const storage = memoryTrophyStorage({
      stats: initialTrophyState().stats,
      unlocked: ['firstFlight'],
    });
    const online = memoryTrophyOnline({ online: false, trophies: ['forager'] });
    const svc = new TrophyService();
    svc.init(storage, online);
    online.setOnline(true); // borda offline→online dispara merge
    await Promise.resolve();
    await Promise.resolve();
    // servidor tinha 'forager' ⇒ agora local contém ambos
    expect(svc.unlockedIds.value).toEqual(expect.arrayContaining(['firstFlight', 'forager']));
    // 'firstFlight' era local-só ⇒ sobe ao servidor
    expect(online.submitted.flat()).toContain('firstFlight');
  });

  it('mergeFromServer filtra ids desconhecidos', async () => {
    const online = memoryTrophyOnline({ online: false, trophies: ['forager', 'BOGUS'] });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    online.setOnline(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.unlockedIds.value).toContain('forager');
    expect(svc.unlockedIds.value).not.toContain('BOGUS');
  });
});
