// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { audioService, bindButtonSfx } from '@services/audio';
import { nullAudioEngine } from '@services/audio/engine';
import { settingsService } from '@services/settings';
import { memorySettingsStorage } from '@services/settings/storage';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { resetToHome, navigate } from '@app/router';
import { i18n } from '@services/i18n';

let engine: ReturnType<typeof nullAudioEngine>;

beforeEach(async () => {
  await i18n.init();
  await settingsService.init(memorySettingsStorage());
  settingsService.setVolume(100);
  settingsService.setMenuMusic(true);
  settingsService.setGameplayMusic(true);
  settingsService.setButtonSfx(true);
  entitlementsService.init(memoryEntitlementsStorage());
  resetToHome();
  engine = nullAudioEngine();
  audioService.init(engine);
});

afterEach(() => {
  resetToHome();
});

describe('AudioService', () => {
  it('não toca música antes do unlock', () => {
    expect(engine.running).toBeNull();
    expect(engine.musicStarts).toEqual([]);
  });

  it('após unlock toca a faixa da rota corrente (menu em home)', () => {
    audioService.unlock();
    expect(engine.running).toBe('menu');
    expect(engine.resumed).toBe(true);
  });

  it('ir para play troca para gameplay; voltar troca de volta', () => {
    audioService.unlock();
    navigate('play');
    expect(engine.running).toBe('gameplay');
    expect(engine.musicStarts).toEqual(['menu', 'gameplay']);
    resetToHome();
    expect(engine.running).toBe('menu');
  });

  it('desligar menuMusic em menu ⇒ stopMusic', () => {
    audioService.unlock();
    expect(engine.running).toBe('menu');
    settingsService.setMenuMusic(false);
    expect(engine.running).toBeNull();
    expect(engine.stops).toBeGreaterThanOrEqual(1);
  });

  it('trocar de expansão troca a faixa (tema novo)', () => {
    audioService.unlock();
    expect(engine.running).toBe('menu');
    expect(engine.themeStarts).toEqual(['classic']);
    const startsBefore = engine.musicStarts.length;

    entitlementsService.grantAndSelect('volcano');

    expect(engine.running).toBe('menu');
    expect(engine.runningTheme).toBe('volcano');
    expect(engine.musicStarts.length).toBeGreaterThan(startsBefore);
    expect(engine.themeStarts[engine.themeStarts.length - 1]).toBe('volcano');
  });

  it('mudar volume ajusta ganho sem reiniciar a faixa', () => {
    audioService.unlock();
    const startsBefore = engine.musicStarts.length;
    settingsService.setVolume(50);
    expect(engine.musicStarts.length).toBe(startsBefore); // não reiniciou
    expect(engine.lastMusicGain).toBeCloseTo((0.5 * 0.5) * 0.35);
  });

  it('playSfx respeita unlock e volume', () => {
    audioService.playSfx('click');
    expect(engine.sfxPlayed).toEqual([]); // sem unlock
    audioService.unlock();
    audioService.playSfx('click');
    expect(engine.sfxPlayed).toEqual(['click']);
    settingsService.setVolume(0);
    audioService.playSfx('click');
    expect(engine.sfxPlayed).toEqual(['click']); // volume 0 ⇒ não tocou
  });

  it('bindButtonSfx dispara em clique de <button> e ignora fora', () => {
    audioService.unlock();
    const cleanup = bindButtonSfx(document.body, audioService);
    const btn = document.createElement('button');
    const div = document.createElement('div');
    document.body.append(btn, div);

    btn.click();
    expect(engine.sfxPlayed).toEqual(['click']);
    div.click();
    expect(engine.sfxPlayed).toEqual(['click']); // clique fora de botão não soa

    cleanup();
    btn.remove();
    div.remove();
  });

  it('toggle de SFX off silencia o clique mas não o gameplay', () => {
    audioService.unlock();
    settingsService.setButtonSfx(false);
    audioService.playSfx('click');
    expect(engine.sfxPlayed).toEqual([]);
    audioService.playSfx('flap');
    expect(engine.sfxPlayed).toEqual(['flap']);
    settingsService.setButtonSfx(true);
    audioService.playSfx('click');
    expect(engine.sfxPlayed).toEqual(['flap', 'click']);
  });

  it('com o toggle off, o clique em botão ainda desbloqueia o áudio', () => {
    settingsService.setButtonSfx(false);
    const cleanup = bindButtonSfx(document.body, audioService);
    const btn = document.createElement('button');
    document.body.append(btn);
    btn.click();
    expect(engine.sfxPlayed).toEqual([]);
    expect(engine.resumed).toBe(true); // unlock aconteceu ⇒ a música pode começar
    cleanup();
    btn.remove();
  });
});
