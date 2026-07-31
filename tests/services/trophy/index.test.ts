import { describe, it, expect } from 'vitest';
import { TrophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { initialTrophyState, type MatchSummary, type TrophyMatchMode } from '@services/trophy/store';
import type { MatchMode } from '@render/matchFactory';

/** Helper: `MatchSummary` completo com defaults neutros, sobrescrevendo o que o teste precisar. */
const match = (m: Partial<MatchSummary> = {}): MatchSummary => ({
  distance: 0, food: 0, nearMisses: 0, score: 0,
  level: 1, coins: 0, powerups: 0, mode: 'endless', playedAt: 0,
  ...m,
});

// Nota: TrophyService é exportado (a classe) além do singleton, para testar isolado.
describe('TrophyService', () => {
  it('recordMatch atualiza sinais, retorna newlyUnlocked e persiste', () => {
    const storage = memoryTrophyStorage();
    const svc = new TrophyService();
    svc.init(storage);
    expect(svc.unlockedCount.value).toBe(0);

    const newly = svc.recordMatch(match({ distance: 1200 }));
    expect(newly).toEqual(expect.arrayContaining(['firstFlight', 'centurion']));
    expect(svc.unlockedCount.value).toBe(newly.length);
    expect(svc.unlockedIds.value).toContain('centurion');

    // persistiu: uma nova instância carregando o mesmo storage vê o estado.
    const svc2 = new TrophyService();
    svc2.init(storage);
    expect(svc2.unlockedIds.value).toContain('centurion');
  });

  it('recordMatch sem novos desbloqueios não cresce a contagem', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage());
    svc.recordMatch(match()); // firstFlight
    const before = svc.unlockedCount.value;
    const newly = svc.recordMatch(match());
    expect(newly).toEqual([]);
    expect(svc.unlockedCount.value).toBe(before);
  });

  it('init sem arg parte de estado vazio (memory default)', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(initialTrophyState()));
    expect(svc.unlockedIds.value).toEqual([]);
  });

  it('recordDailyPodium dobra dailyPodiums e desbloqueia o pódio diário', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage());
    svc.recordMatch(match({ mode: 'daily' }));
    const newly = svc.recordDailyPodium(1);
    expect(newly).toContain('dailyPodium');
    expect(svc.stats.value.dailyPodiums).toBe(1);
  });

  it('recordDailyPodium fora do pódio não dobra nem desbloqueia', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage());
    svc.recordMatch(match({ mode: 'daily' }));
    expect(svc.recordDailyPodium(7)).toEqual([]);
    expect(svc.stats.value.dailyPodiums).toBe(0);
  });

  it('rank semanal de pódio desbloqueia weeklyPodium pelo agregado', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage());
    const newly = svc.recordMatch(match({ mode: 'weekly' }), { weeklyRank: 3 });
    expect(newly).toContain('weeklyPodium');
    expect(svc.stats.value.weeklyPodiums).toBe(1);
  });

  it('MatchMode do render é atribuível a TrophyMatchMode (uniões não divergiram)', () => {
    const modes: TrophyMatchMode[] = ['endless', 'daily', 'weekly'] satisfies MatchMode[];
    expect(modes).toHaveLength(3);
  });
});
