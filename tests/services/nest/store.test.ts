import { describe, it, expect } from 'vitest';
import { DINO_ROSTER, STARTER_DINO_ID, dinoById } from '@services/nest/roster';
import { initialNestState, isOwned, ownedDinos, setActive, purchase } from '@services/nest/store';

describe('roster', () => {
  it('tem ~10 dinos, ids únicos, starter grátis com trait none', () => {
    expect(DINO_ROSTER.length).toBeGreaterThanOrEqual(10);
    const ids = DINO_ROSTER.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const starter = dinoById(STARTER_DINO_ID)!;
    expect(starter.price).toBe(0);
    expect(starter.traitKind).toBe('none');
  });
  it('todo dino tem nameKey e descrição de traço mapeável', () => {
    for (const d of DINO_ROSTER) {
      expect(d.nameKey).toMatch(/^dino\./);
      expect(typeof d.hue).toBe('number');
    }
  });
});

describe('nest store', () => {
  it('estado inicial possui e ativa o starter', () => {
    const s = initialNestState();
    expect(s.owned).toEqual([STARTER_DINO_ID]);
    expect(s.activeId).toBe(STARTER_DINO_ID);
    expect(isOwned(s, STARTER_DINO_ID)).toBe(true);
  });

  it('setActive só ativa dino possuído', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    expect(setActive(s, paid.id).activeId).toBe(STARTER_DINO_ID); // não possuído ⇒ no-op
  });

  it('purchase: saldo suficiente adiciona à posse e devolve o custo', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const r = purchase(s, paid.id, paid.price + 10);
    expect(r.result).toBe('ok');
    expect(r.spent).toBe(paid.price);
    expect(isOwned(r.state, paid.id)).toBe(true);
  });

  it('purchase: saldo insuficiente não muda o estado', () => {
    const s = initialNestState();
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const r = purchase(s, paid.id, paid.price - 1);
    expect(r.result).toBe('insufficient');
    expect(r.spent).toBe(0);
    expect(isOwned(r.state, paid.id)).toBe(false);
  });

  it('purchase: já possuído / id desconhecido', () => {
    const s = initialNestState();
    expect(purchase(s, STARTER_DINO_ID, 999).result).toBe('alreadyOwned');
    expect(purchase(s, 'nope', 999).result).toBe('unknown');
  });

  it('ownedDinos resolve DinoDefs possuídos', () => {
    const s = initialNestState();
    expect(ownedDinos(s).map((d) => d.id)).toEqual([STARTER_DINO_ID]);
  });
});
