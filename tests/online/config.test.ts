import { describe, it, expect } from 'vitest';
import { parseOnlineConfig } from '@services/online/config';

describe('parseOnlineConfig', () => {
  it('devolve config quando url e anonKey estão presentes', () => {
    expect(
      parseOnlineConfig({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'key123',
      }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'key123' });
  });

  it('devolve null quando falta a url', () => {
    expect(parseOnlineConfig({ VITE_SUPABASE_ANON_KEY: 'key123' })).toBeNull();
  });

  it('devolve null quando falta a anonKey', () => {
    expect(parseOnlineConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
  });

  it('devolve null quando um valor é string vazia', () => {
    expect(
      parseOnlineConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'key123' }),
    ).toBeNull();
  });

  it('devolve null quando um valor não é string', () => {
    expect(
      parseOnlineConfig({ VITE_SUPABASE_URL: 123, VITE_SUPABASE_ANON_KEY: 'key123' }),
    ).toBeNull();
  });
});
