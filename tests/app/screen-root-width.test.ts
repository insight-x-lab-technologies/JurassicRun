// Ambiente node (default deste projeto — ver vitest.config.ts): o teste só lê arquivos-fonte,
// não renderiza nada. Guarda a invariante estrutural do 10.5: raiz de tela com `max-width` sem
// centralização assenta à esquerda dentro do `#app` (flex column, `align-items: stretch` default).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCREENS_DIR = fileURLToPath(new URL('../../src/app/screens', import.meta.url));
const GLOBAL_CSS_PATH = fileURLToPath(new URL('../../src/app/styles/global.css', import.meta.url));

// Extrai as classes modificadoras usadas como raiz de tela, ex.: `class="screen challenge-brief"`
// ⇒ `challenge-brief`. `class="screen"` sozinho (sem modificadora) não entra no conjunto.
function screenRootClasses(): Set<string> {
  const classes = new Set<string>();
  for (const file of readdirSync(SCREENS_DIR)) {
    if (!file.endsWith('.tsx')) continue;
    const source = readFileSync(`${SCREENS_DIR}/${file}`, 'utf-8');
    for (const match of source.matchAll(/class="screen\s+([^"]+)"/g)) {
      const modifiers = match[1] ?? '';
      for (const cls of modifiers.split(/\s+/).filter(Boolean)) {
        classes.add(cls);
      }
    }
  }
  return classes;
}

// Casa blocos `seletor { declarações }` do CSS. Declarações sem `{` naturalmente exclui os
// cabeçalhos `@media (...)  {` — as regras DENTRO deles caem nos próprios blocos casados.
// Comentários `/* ... */` são removidos antes: sem isso eles ficam grudados no seletor
// capturado (nenhum `{`/`}` dentro deles) e poluem a mensagem de falha.
function cssBlocks(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Array<{ selector: string; body: string }> = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    blocks.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
  }
  return blocks;
}

describe('raiz de tela: teto de largura sem centralização assenta à esquerda', () => {
  it('sanidade do extrator: encontra classes-raiz e inclui challenge-brief', () => {
    const classes = screenRootClasses();
    expect(classes.size).toBeGreaterThan(0);
    expect(classes.has('challenge-brief')).toBe(true);
  });

  it('toda classe-raiz com max-width declara margin-inline:auto ou align-self:center no mesmo bloco', () => {
    const rootClasses = screenRootClasses();
    const css = readFileSync(GLOBAL_CSS_PATH, 'utf-8');
    const blocks = cssBlocks(css);

    const offenders: string[] = [];
    for (const cls of rootClasses) {
      const token = `.${cls}`;
      for (const { selector, body } of blocks) {
        // Token exato no seletor (evita casar `.challenge-brief__stats` quando procuramos
        // `.challenge-brief`): separa por vírgula/espaço e compara o token inteiro.
        const selectors = selector.split(',').flatMap((s) => s.trim().split(/\s+/));
        if (!selectors.includes(token)) continue;
        if (!/max-width\s*:/.test(body)) continue;
        const centered = /margin-inline\s*:\s*auto/.test(body) || /align-self\s*:\s*center/.test(body);
        if (!centered) {
          offenders.push(selector);
        }
      }
    }
    expect(offenders, `raiz(es) com max-width sem centralização: ${offenders.join(', ')}`).toEqual([]);
  });
});
