import { describe, expect, it } from 'vitest';
import {
  SUPABASE_SCHEMA,
  TABLES,
  TABLE_NAMES,
  ONLINE_MODES,
  VERIFIED_TABLES,
  TABLE_COLUMNS,
} from '@services/online/schema';

describe('online schema constants', () => {
  it('nomeia o schema dedicado', () => {
    expect(SUPABASE_SCHEMA).toBe('jurassicrun');
  });

  it('expõe as 4 tabelas canônicas', () => {
    expect(TABLES).toEqual({
      players: 'players',
      scores: 'scores',
      challengeEntries: 'challenge_entries',
      trophies: 'trophies',
    });
    expect([...TABLE_NAMES].sort()).toEqual(
      ['challenge_entries', 'players', 'scores', 'trophies'],
    );
  });

  it('lista os modos online e as tabelas com verified', () => {
    expect(ONLINE_MODES).toEqual(['endless', 'daily', 'weekly']);
    expect(VERIFIED_TABLES).toEqual(['scores', 'challenge_entries']);
  });

  it('declara colunas por tabela cobrindo cada tabela', () => {
    for (const t of TABLE_NAMES) {
      expect(TABLE_COLUMNS[t]?.length ?? 0).toBeGreaterThan(0);
    }
    expect(TABLE_COLUMNS['players']).toContain('name');
    expect(TABLE_COLUMNS['scores']).toContain('verified');
    expect(TABLE_COLUMNS['challenge_entries']).toContain('final_hash');
    expect(TABLE_COLUMNS['trophies']).toContain('trophy_id');
  });
});
