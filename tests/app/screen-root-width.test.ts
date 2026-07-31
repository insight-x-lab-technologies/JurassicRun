// Ambiente node (default deste projeto — ver vitest.config.ts): o teste só lê arquivos-fonte,
// não renderiza nada. Guarda a invariante estrutural do 10.5: raiz de tela com `max-width` sem
// centralização assenta à esquerda dentro do `#app` (flex column, `align-items: stretch` default).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCREENS_DIR = fileURLToPath(new URL('../../src/app/screens', import.meta.url));
const STYLES_DIR = fileURLToPath(new URL('../../src/app/styles', import.meta.url));

// Todos os CSS da pasta de estilos, não só o `global.css`: se um estilo de tela migrar de arquivo,
// a guarda não pode ficar cega para ele (achado do review da Task 1).
function allStylesheets(): Array<{ file: string; css: string }> {
  return readdirSync(STYLES_DIR)
    .filter((file) => file.endsWith('.css'))
    .map((file) => ({ file, css: readFileSync(`${STYLES_DIR}/${file}`, 'utf-8') }));
}

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

  // O extrator só enxerga `class="screen X"` literal. Uma raiz montada dinamicamente
  // (`class={`screen ${x}`}` / clsx) sairia do conjunto e desligaria a checagem daquela tela EM
  // SILÊNCIO — o pior modo de falha de uma guarda. Aqui isso vira erro visível.
  it('nenhuma tela monta a classe raiz dinamicamente (senão o extrator fica cego)', () => {
    const dynamicRoots: string[] = [];
    for (const file of readdirSync(SCREENS_DIR)) {
      if (!file.endsWith('.tsx')) continue;
      const source = readFileSync(`${SCREENS_DIR}/${file}`, 'utf-8');
      for (const match of source.matchAll(/class=\{([^}]*)\}/g)) {
        if (/\bscreen\b/.test(match[1] ?? '')) dynamicRoots.push(`${file}: ${match[0]}`);
      }
    }
    expect(dynamicRoots, `classe raiz dinâmica: ${dynamicRoots.join(' | ')}`).toEqual([]);
  });

  it('toda classe-raiz com max-width declara margin-inline:auto ou align-self:center no mesmo bloco', () => {
    const rootClasses = screenRootClasses();

    const offenders: string[] = [];
    for (const { file, css } of allStylesheets()) {
      for (const { selector, body } of cssBlocks(css)) {
        if (!/max-width\s*:/.test(body)) continue;
        // Só o ALVO do seletor conta — o último composto de cada parte, depois do último
        // combinador (` `, `>`, `+`, `~`). Assim `.leaderboard .foo { max-width }` (teto num
        // DESCENDENTE, legítimo) não é acusado, mas `.screen.challenge-brief` (composto, sem
        // espaço: é a própria raiz) é. Tokens inteiros ⇒ `.challenge-brief__stats` nunca conta
        // como `.challenge-brief`.
        const targets = selector
          .split(',')
          .flatMap((part) => part.trim().split(/[\s>+~]+/).slice(-1))
          .flatMap((compound) => compound.match(/\.[A-Za-z0-9_-]+/g) ?? []);
        const cited = new Set(targets);
        const hitsRoot = [...rootClasses].some((cls) => cited.has(`.${cls}`));
        if (!hitsRoot) continue;
        const centered = /margin-inline\s*:\s*auto/.test(body) || /align-self\s*:\s*center/.test(body);
        if (!centered) offenders.push(`${file}: ${selector}`);
      }
    }
    expect(offenders, `raiz(es) com max-width sem centralização: ${offenders.join(', ')}`).toEqual([]);
  });
});
