import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/render'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function sourceFiles(): string[] {
  return ROOTS.flatMap(walk).filter((f) => /\.tsx?$/.test(f));
}

// Nó de texto JSX cru: ">Palavra ...<" começando com letra, só letras/pontuação
// (exclui {expressões}, glifos/emoji decorativos e código como ">(0)" ou "=> <").
const JSX_TEXT = />([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ,.!?'’-]*)</;
// Literal de string passado direto ao Phaser em vez de t(...).
const SETTEXT_LITERAL = /\.setText\(\s*['"`]/;
const ADDTEXT_LITERAL = /add\.text\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*['"`]/;

// Remove comentário de linha para não gerar falso-positivo em "//>texto".
const stripLineComment = (line: string): string => line.replace(/\/\/.*$/, '');

describe('no-hardcoded-strings', () => {
  it('o scanner realmente encontra arquivos-fonte (não passa por vacuidade)', () => {
    expect(sourceFiles().length).toBeGreaterThan(10);
  });

  it("nenhum nó de texto JSX cru — todo texto de UI via {t('chave')}", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles().filter((f) => f.endsWith('.tsx'))) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = JSX_TEXT.exec(stripLineComment(line));
          if (m) offenders.push(`${file}:${i + 1}  >${m[1]}<`);
        });
    }
    expect(offenders, `texto JSX hardcoded — use {t('chave')}:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  it('nenhum texto Phaser hardcoded — add.text/setText recebe t(...)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = stripLineComment(line);
          if (SETTEXT_LITERAL.test(code) || ADDTEXT_LITERAL.test(code)) {
            offenders.push(`${file}:${i + 1}  ${line.trim()}`);
          }
        });
    }
    expect(offenders, `texto Phaser hardcoded — passe t('chave'):\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
