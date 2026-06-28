import { render, h } from 'preact';
import { i18n } from '@services/i18n';

async function bootstrap(): Promise<void> {
  await i18n.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const root = document.getElementById('app');
  if (root) {
    // Shell vazio: a árvore de telas entra na Fase 4. Sem texto hardcoded — via i18n.
    render(h('div', { id: 'app-shell' }), root);
  }
}

void bootstrap();
