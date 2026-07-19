// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPackTheme, bindPackTheme } from './theme';
import { packForId } from '@render/packs';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('applyPackTheme seta as custom properties do pack em :root', () => {
    applyPackTheme(packForId('volcano'));
    const primary = document.documentElement.style.getPropertyValue('--color-primary');
    expect(primary).toBe('#ff7a3c');
  });

  it('bindPackTheme reage à troca de expansão ativa', () => {
    entitlementsService.init(memoryEntitlementsStorage());
    const cleanup = bindPackTheme();
    // classic por padrão
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#4ea1ff');
    // desbloquear + selecionar volcano ⇒ tema muda ao vivo
    entitlementsService.unlock('volcano');
    entitlementsService.select('volcano');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff7a3c');
    cleanup();
  });

  it('applyPackTheme seta --bg-screen e --ui-panel', () => {
    applyPackTheme(packForId('volcano'));
    const bg = document.documentElement.style.getPropertyValue('--bg-screen');
    const panel = document.documentElement.style.getPropertyValue('--ui-panel');
    expect(bg).toContain('ui/bg.screen.volcano.png');
    expect(panel).toContain('ui/panel.png');
  });

  it('applyPackTheme seta --ui-button/--ui-button-ghost', () => {
    applyPackTheme(packForId('classic'));
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--ui-button')).toContain('ui/button.primary.png');
    expect(s.getPropertyValue('--ui-button-ghost')).toContain('ui/button.secondary.png');
  });

  it('applyPackTheme seta --ui-statchip', () => {
    applyPackTheme(packForId('classic'));
    expect(document.documentElement.style.getPropertyValue('--ui-statchip')).toContain('ui/statchip.png');
  });
});
