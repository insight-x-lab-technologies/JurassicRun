// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  memorySettingsStorage,
  localStorageSettingsStorage,
  parseState,
  STORAGE_KEY,
} from '@services/settings/storage';
import { initialSettingsState } from '@services/settings/store';

describe('settings/storage', () => {
  it('parseState: JSON inválido ⇒ defaults', () => {
    expect(parseState('não-é-json')).toEqual(initialSettingsState());
    expect(parseState('[]')).toEqual(initialSettingsState());
    expect(parseState('null')).toEqual(initialSettingsState());
  });

  it('parseState saneia por campo sem descartar os válidos', () => {
    const raw = JSON.stringify({
      volume: 250,          // fora de faixa ⇒ 100
      menuMusic: 'sim',     // não-boolean ⇒ default true
      gameplayMusic: false, // válido ⇒ preservado
      language: 'xx',       // desconhecido ⇒ en
      font: 'papyrus',      // fora do catálogo ⇒ default
    });
    expect(parseState(raw)).toEqual({
      volume: 100,
      menuMusic: true,
      gameplayMusic: false,
      language: 'en',
      font: 'cinzel',
    });
  });

  it('parseState preserva valores válidos', () => {
    const raw = JSON.stringify({
      volume: 40, menuMusic: false, gameplayMusic: true, language: 'ja', font: 'exo2',
    });
    expect(parseState(raw)).toEqual({
      volume: 40, menuMusic: false, gameplayMusic: true, language: 'ja', font: 'exo2',
    });
  });

  it('memory storage: round-trip', () => {
    const st = memorySettingsStorage();
    const next = { volume: 10, menuMusic: false, gameplayMusic: false, language: 'de' as const, font: 'marcellus' as const };
    st.save(next);
    expect(st.load()).toEqual(next);
  });

  it('localStorage storage: save→load round-trip', () => {
    localStorage.clear();
    const st = localStorageSettingsStorage();
    const next = { volume: 25, menuMusic: false, gameplayMusic: true, language: 'fr' as const, font: 'exo2' as const };
    st.save(next);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 1, volume: 25 });
    expect(st.load()).toEqual(next);
  });

  it('localStorage vazio ⇒ defaults', () => {
    localStorage.clear();
    expect(localStorageSettingsStorage().load()).toEqual(initialSettingsState());
  });
});
