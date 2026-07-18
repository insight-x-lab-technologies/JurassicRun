import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SUPABASE_SCHEMA,
  TABLE_NAMES,
  TABLE_COLUMNS,
  VERIFIED_TABLES,
  REDEMPTION_TABLE,
  REDEMPTION_COLUMNS,
} from '@services/online/schema';

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      '../../supabase/migrations/20260708000000_jr_schema.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('migração casa com as constantes do schema', () => {
  it('cria o schema dedicado', () => {
    expect(SQL).toContain(`create schema if not exists ${SUPABASE_SCHEMA}`);
  });

  it('cria cada tabela no schema dedicado', () => {
    for (const t of TABLE_NAMES) {
      expect(SQL).toContain(`create table if not exists ${SUPABASE_SCHEMA}.${t} (`);
    }
  });

  it('declara cada coluna esperada de cada tabela', () => {
    for (const t of TABLE_NAMES) {
      const start = SQL.indexOf(`${SUPABASE_SCHEMA}.${t} (`);
      const body = SQL.slice(start, SQL.indexOf(');', start));
      for (const col of TABLE_COLUMNS[t]) {
        expect(body, `${t}.${col}`).toMatch(new RegExp(`\\b${col}\\b`));
      }
    }
  });

  it('habilita RLS em todas as tabelas', () => {
    for (const t of TABLE_NAMES) {
      expect(SQL).toContain(`alter table ${SUPABASE_SCHEMA}.${t}`);
      expect(SQL).toMatch(
        new RegExp(`alter table ${SUPABASE_SCHEMA}\\.${t}\\s+enable row level security`),
      );
    }
  });

  it('tem policy de select e de insert por tabela', () => {
    for (const t of TABLE_NAMES) {
      expect(SQL, `${t} select`).toContain(`create policy ${t}_select_public on ${SUPABASE_SCHEMA}.${t}`);
      expect(SQL, `${t} insert`).toContain(`create policy ${t}_insert_own on ${SUPABASE_SCHEMA}.${t}`);
    }
  });

  it('trava verified ao service_role e anexa o trigger nas tabelas com verified', () => {
    expect(SQL).toContain('function jurassicrun.lock_verified()');
    expect(SQL).toContain(`auth.role() is distinct from 'service_role'`);
    for (const t of VERIFIED_TABLES) {
      expect(SQL).toMatch(
        new RegExp(`create trigger lock_verified before insert or update on ${SUPABASE_SCHEMA}\\.${t}`),
      );
    }
  });

  it('cria a tabela redemption_codes no schema dedicado', () => {
    expect(SQL).toContain(`create table if not exists ${SUPABASE_SCHEMA}.${REDEMPTION_TABLE} (`);
  });

  it('declara as colunas de redemption_codes', () => {
    const start = SQL.indexOf(`${SUPABASE_SCHEMA}.${REDEMPTION_TABLE} (`);
    const body = SQL.slice(start, SQL.indexOf(');', start));
    for (const col of REDEMPTION_COLUMNS) {
      expect(body, `redemption_codes.${col}`).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it('habilita RLS em redemption_codes sem policy de cliente (deny-by-default)', () => {
    expect(SQL).toMatch(
      new RegExp(`alter table ${SUPABASE_SCHEMA}\\.${REDEMPTION_TABLE}\\s+enable row level security`),
    );
    expect(SQL).not.toContain(`create policy ${REDEMPTION_TABLE}_select`);
    expect(SQL).not.toContain(`create policy ${REDEMPTION_TABLE}_insert`);
  });
});
