import { describe, it, expect } from 'vitest';
import { resolveBasePath } from './base';

describe('resolveBasePath', () => {
  it('default para "/" quando BASE_PATH ausente', () => {
    expect(resolveBasePath({})).toBe('/');
  });

  it('default para "/" quando BASE_PATH vazio', () => {
    expect(resolveBasePath({ BASE_PATH: '' })).toBe('/');
  });

  it('default para "/" quando BASE_PATH é só espaços', () => {
    expect(resolveBasePath({ BASE_PATH: '   ' })).toBe('/');
  });

  it('normaliza absoluto sem barras para ter as duas', () => {
    expect(resolveBasePath({ BASE_PATH: 'JurassicRun' })).toBe('/JurassicRun/');
  });

  it('adiciona barra final quando falta', () => {
    expect(resolveBasePath({ BASE_PATH: '/JurassicRun' })).toBe('/JurassicRun/');
  });

  it('mantém absoluto já bem-formado', () => {
    expect(resolveBasePath({ BASE_PATH: '/JurassicRun/' })).toBe('/JurassicRun/');
  });

  it('passa base relativa "./" inalterada (itch.io)', () => {
    expect(resolveBasePath({ BASE_PATH: './' })).toBe('./');
  });

  it('passa base relativa "." inalterada', () => {
    expect(resolveBasePath({ BASE_PATH: '.' })).toBe('.');
  });
});
