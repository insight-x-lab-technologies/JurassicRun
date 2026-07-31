// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { HomeScreen } from '@app/screens/HomeScreen';
import { route, resetToHome } from '@app/router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Lê o `package.json` diretamente com `node:path`/`node:fs`, em vez de importar
// `src/build/appVersion.ts`: este arquivo roda sob `@vitest-environment happy-dom`, que
// substitui o `URL` global do Node por um polyfill — o `new URL('../../package.json',
// import.meta.url)` do helper resolve contra `http://localhost:3000/` (location mockada),
// não contra o caminho real do arquivo, e `fileURLToPath` rejeita o resultado
// ("URL must be of scheme file"). `path.resolve`/`fileURLToPath(import.meta.url)` não
// passam pelo `URL` global, então funcionam sob qualquer ambiente de teste.
function readPackageVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(here, '../../package.json');
  const raw = readFileSync(pkgPath, 'utf-8');
  const pkg: unknown = JSON.parse(raw);
  if (typeof pkg !== 'object' || pkg === null || typeof (pkg as { version?: unknown }).version !== 'string') {
    throw new Error('readPackageVersion: package.json sem campo "version" válido.');
  }
  return (pkg as { version: string }).version;
}

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('HomeScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    profileService.init(memoryProfileStorage(emptyState()));
    profileService.create('Rex');
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<HomeScreen />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra nome do perfil ativo e os 3 chips de stats', () => {
    expect(container.textContent).toContain('Rex');
    expect(container.textContent).toContain(i18n.t('home.coins'));
    expect(container.textContent).toContain(i18n.t('home.trophies'));
    expect(container.textContent).toContain(i18n.t('home.level'));
  });

  it('clicar em Novo Jogo navega para play', () => {
    click(
      [...container.querySelectorAll('button')].find(
        (b) => b.textContent === i18n.t('home.newGame'),
      )!,
    );
    expect(route.value).toBe('play');
  });

  it('clicar na identidade navega para o perfil', () => {
    click(container.querySelector('[data-testid="home-identity"]'));
    expect(route.value).toBe('profile');
  });

  it('renderiza os itens de menu de navegação', () => {
    const txt = container.textContent ?? '';
    for (const key of [
      'nav.daily',
      'nav.weekly',
      'nav.nest',
      'nav.shop',
      'nav.expansions',
      'nav.leaderboard',
      'nav.settings',
      'nav.donate',
    ]) {
      expect(txt).toContain(i18n.t(key));
    }
  });

  it('Doação é um item do MESMO grid do menu (mesmo tamanho dos demais)', () => {
    const grid = container.querySelector('.home__grid')!;
    const labels = [...grid.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toContain(i18n.t('nav.donate'));
    // ao lado de Configurações: penúltimo e último da mesma grade
    expect(labels.at(-2)).toContain(i18n.t('nav.settings'));
    expect(labels.at(-1)).toContain(i18n.t('nav.donate'));
  });

  it('clicar em Doação navega para a tela de doação', () => {
    const grid = container.querySelector('.home__grid')!;
    click([...grid.querySelectorAll('button')].find((b) => b.textContent?.includes(i18n.t('nav.donate')))!);
    expect(route.value).toBe('donate');
  });

  it('troca o botão Compartilhar por uma linha de ícones de redes sociais', () => {
    expect(container.textContent).not.toContain(i18n.t('nav.share'));
    const social = container.querySelector('[data-testid="home-social"]')!;
    expect(social).not.toBeNull();
    for (const id of ['whatsapp', 'telegram', 'instagram', 'tiktok', 'youtube', 'wechat', 'email', 'link']) {
      expect(social.querySelector(`[data-testid="share-${id}"]`), id).not.toBeNull();
    }
  });

  it('mostra o aviso de copyright no rodapé da Home', () => {
    expect(container.querySelector('.home__copyright')?.textContent).toContain(i18n.t('home.copyright'));
  });

  it('mostra a versão do app no rodapé, lida do package.json', () => {
    const versionEl = container.querySelector('[data-testid="app-version"]');
    expect(versionEl).not.toBeNull();
    expect(versionEl?.textContent).toBe(`v${readPackageVersion()}`);
  });

  it('a versão fica DENTRO do parágrafo de copyright, sem custo de altura novo', () => {
    expect(
      container.querySelector('.home__copyright [data-testid="app-version"]'),
    ).not.toBeNull();
  });

  it('o topo mostra o avatar escolhido do perfil ativo', () => {
    profileService.setAvatar('a08');
    render(<HomeScreen />, container);
    const img = container.querySelector('.home__identity img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('avatar.a08.png');
  });
});
