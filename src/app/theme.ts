/**
 * Aplicação do tema CSS do pack look&feel ativo (8.3). Um effect assina a expansão ativa
 * (seam 4.6) e reescreve as custom properties de :root ⇒ reskin AO VIVO dos menus DOM.
 * tokens.css mantém os defaults (= classic) como fallback pré-JS. Cosmético ⇒ não toca core.
 */
import { effect } from '@preact/signals';
import { packForId, type LookPack } from '@render/packs';
import { entitlementsService } from '@services/entitlements';

/** Escreve as custom properties do pack no elemento raiz (default <html>). */
export function applyPackTheme(pack: LookPack, root: HTMLElement = document.documentElement): void {
  for (const [prop, value] of Object.entries(pack.theme)) {
    root.style.setProperty(prop, value);
  }
  const base = import.meta.env.BASE_URL; // termina com '/'
  root.style.setProperty('--bg-screen', `url(${base}ui/${pack.bgScreen}.png)`);
  root.style.setProperty('--ui-panel', `url(${base}ui/panel.png)`);
  root.style.setProperty('--ui-button', `url(${base}ui/button.primary.png)`);
  root.style.setProperty('--ui-button-ghost', `url(${base}ui/button.secondary.png)`);
}

/** Liga a reatividade tema↔expansão ativa. Retorna cleanup do effect. */
export function bindPackTheme(): () => void {
  return effect(() => {
    applyPackTheme(packForId(entitlementsService.activeExpansion.value.id));
  });
}
