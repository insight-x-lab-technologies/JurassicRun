import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { applyPackTheme, bindPackTheme } from './theme';
import { packForId } from '@render/packs';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

const window = new Window();
const document = window.document;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.document = document as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.window = window as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.HTMLElement = window.HTMLElement as any;

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
});
