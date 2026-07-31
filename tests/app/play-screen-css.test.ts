// Ambiente node (default do projeto): lê o CSS-fonte. `happy-dom` não faz layout, então nada
// disto seria observável num teste de renderização (precedente 10.5).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../../src/app/styles/global.css', import.meta.url));

function stylesheet(): string {
  return readFileSync(CSS_PATH, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Blocos `seletor { declarações }`. Declarações sem `{` ⇒ cabeçalhos `@media` não viram bloco. */
function cssBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    blocks.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
  }
  return blocks;
}

function bodyOf(selector: string): string {
  const found = cssBlocks(stylesheet()).filter((b) => b.selector === selector);
  expect(found.length, `bloco não encontrado: ${selector}`).toBeGreaterThan(0);
  return found.map((b) => b.body).join('\n');
}

/** Corpo do bloco `@media (orientation: portrait) { … }` (um nível de aninhamento). */
function portraitMedia(): string {
  const css = stylesheet();
  const start = css.indexOf('@media (orientation: portrait)');
  expect(start, 'não há @media (orientation: portrait)').toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('@media (orientation: portrait) sem fechamento');
}

describe('letterbox do PlayScreen não é barra preta', () => {
  it('sanidade do extrator: acha o bloco .play-screen', () => {
    expect(cssBlocks(stylesheet()).some((b) => b.selector === '.play-screen')).toBe(true);
  });

  it('.play-screen pinta o vão com a arte de fundo do pack ativo', () => {
    expect(bodyOf('.play-screen')).toMatch(/var\(--bg-screen\)/);
  });

  it('a camada de escurecimento fica ATRÁS do canvas (senão apaga o jogo)', () => {
    expect(bodyOf('.play-screen::before')).toMatch(/z-index\s*:\s*0/);
    expect(bodyOf('.play-screen__canvas')).toMatch(/z-index\s*:\s*1/);
  });

  it('não sobrou nenhuma regra da dica de girar', () => {
    expect(stylesheet()).not.toMatch(/\.rotate-hint/);
  });
});

/** Corpo da regra de retrato cujo ALVO é `cls` (o seletor traz o descendente `.play-screen`). */
function ruleFor(cls: string): string {
  return cssBlocks(portraitMedia())
    .filter((b) => b.selector.trim().endsWith(cls))
    .map((b) => b.body)
    .join('\n');
}

describe('chrome de retrato ancora na faixa de jogo', () => {
  it('a altura da faixa é derivada da largura (o FIT é limitado pela largura em retrato)', () => {
    expect(portraitMedia()).toMatch(/--field-h\s*:\s*calc\(\s*100vw\s*\*\s*9\s*\/\s*16\s*\)/);
  });

  it('o HUD desancora do topo da tela e encosta acima da faixa', () => {
    const hud = ruleFor('.hud');
    expect(hud, 'sem regra do HUD em retrato').not.toBe('');
    expect(hud).toMatch(/top\s*:\s*auto/);
    expect(hud).toMatch(/bottom\s*:\s*calc\(/);
    expect(hud).toMatch(/var\(--field-h\)/);
  });

  it('os chips de power-up desancoram do rodapé e encostam abaixo da faixa', () => {
    const badges = ruleFor('.effect-badges');
    expect(badges, 'sem regra dos chips em retrato').not.toBe('');
    expect(badges).toMatch(/bottom\s*:\s*auto/);
    expect(badges).toMatch(/top\s*:\s*calc\(/);
    expect(badges).toMatch(/var\(--field-h\)/);
  });

  // A regressão que custou uma medição: as regras BASE de `.hud`/`.effect-badges`/`.play-screen__tap`
  // vivem MUITO depois deste `@media` no arquivo. Com especificidade igual (`.hud` vs `.hud`), a
  // base vence por ordem de cascata e a reancoragem de retrato é ignorada em silêncio — o HUD sai
  // com `top` E `bottom` aplicados, esticado (medido: 292 px de altura num 390×844). Exigir o
  // descendente `.play-screen` torna a âncora imune à posição dos blocos no arquivo.
  it('as regras de retrato vencem as regras base por ESPECIFICIDADE, não por ordem', () => {
    const weak: string[] = [];
    for (const { selector } of cssBlocks(portraitMedia())) {
      for (const part of selector.split(',')) {
        const target = part.trim();
        if (target === '' || target === '.play-screen') continue;
        if (!/^\.play-screen\s+\./.test(target)) weak.push(target);
      }
    }
    expect(weak, `seletor de retrato sem o descendente .play-screen: ${weak.join(', ')}`).toEqual([]);
  });
});
