import { render, h } from 'preact';

const root = document.getElementById('app');
if (root) {
  // Shell vazio: a árvore de telas entra na Fase 4. Sem texto hardcoded (i18n na Fase 0.4).
  render(h('div', { id: 'app-shell' }), root);
}
