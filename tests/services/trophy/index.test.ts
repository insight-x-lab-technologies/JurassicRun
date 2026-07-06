import { describe, it, expect } from 'vitest';
import { TrophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { initialTrophyState } from '@services/trophy/store';

// Nota: TrophyService é exportado (a classe) além do singleton, para testar isolado.
describe('TrophyService', () => {
  it('recordMatch atualiza sinais, retorna newlyUnlocked e persiste', () => {
    const storage = memoryTrophyStorage();
    const svc = new TrophyService();
    svc.init(storage);
    expect(svc.unlockedCount.value).toBe(0);

    const newly = svc.recordMatch({ distance: 1200, food: 0, nearMisses: 0, score: 0 });
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
    svc.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 }); // firstFlight
    const before = svc.unlockedCount.value;
    const newly = svc.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 });
    expect(newly).toEqual([]);
    expect(svc.unlockedCount.value).toBe(before);
  });

  it('init sem arg parte de estado vazio (memory default)', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(initialTrophyState()));
    expect(svc.unlockedIds.value).toEqual([]);
  });
});
