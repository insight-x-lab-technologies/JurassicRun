import { describe, it, expect } from 'vitest';
import ts from 'typescript';
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

// ---------------------------------------------------------------------------
// Scanners por AST (TypeScript). Cientes de multi-linha por construção — o
// estilo real do código (JSX com texto em linha própria; `.add.text(...)`
// encadeado; `.setText([...].join('\n'))` em array) não escapa como escaparia
// de um regex por linha.
// ---------------------------------------------------------------------------

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

const hasAlnum = (s: string): boolean => /[A-Za-zÀ-ÿ0-9]/.test(s);

// Uma chamada t(...) / i18n.t(...) — o argumento dela é chave de tradução, não
// texto visível.
function isTranslationCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ((ts.isIdentifier(node.expression) && node.expression.text === 't') ||
      (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't'))
  );
}

// Está `node` dentro de uma chamada t(...) em algum ponto até (exclusive) `stop`?
function insideTranslationCall(node: ts.Node, stop: ts.Node | undefined): boolean {
  let p: ts.Node | undefined = node.parent;
  while (p && p !== stop) {
    if (isTranslationCall(p)) return true;
    p = p.parent;
  }
  return false;
}

// Nó de texto JSX cru com conteúdo humano (letra/dígito), ignorando espaços e
// entidades HTML puras (ex.: "&nbsp;"). `{t('chave')}` é JsxExpression, não
// JsxText ⇒ não aparece aqui.
function scanJsxText(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const offenders: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const stripped = node.text.replace(/&[a-zA-Z]+;|&#\d+;/g, ' ').trim();
      if (stripped && hasAlnum(stripped)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        offenders.push(`${fileName}:${line}  "${node.text.trim()}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return offenders;
}

// O argumento de conteúdo de uma chamada Phaser: 3º arg de `.text(x, y, ...)`;
// 1º arg de `.setText(...)`.
function contentArgOf(call: ts.CallExpression): ts.Node | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  const method = call.expression.name.text;
  if (method === 'setText') return call.arguments[0];
  if (method === 'text') return call.arguments[2];
  return undefined;
}

// Literais de string "visíveis" dentro do argumento de conteúdo: com letra/
// dígito, não separador/placeholder vazio, e não dentro de um t(...).
function visibleLiteralsIn(arg: ts.Node): string[] {
  const found: string[] = [];
  const scan = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (node.text.trim() !== '' && hasAlnum(node.text) && !insideTranslationCall(node, arg.parent)) {
        found.push(node.text);
      }
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
      if (hasAlnum(raw) && !insideTranslationCall(node, arg.parent)) {
        found.push('`' + raw + '`');
      }
    }
    ts.forEachChild(node, scan);
  };
  scan(arg);
  return found;
}

function scanPhaserText(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const offenders: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const arg = contentArgOf(node);
      if (arg) {
        for (const lit of visibleLiteralsIn(arg)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          offenders.push(`${fileName}:${line}  ${lit}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return offenders;
}

describe('no-hardcoded-strings', () => {
  it('o scanner realmente encontra arquivos-fonte (não passa por vacuidade)', () => {
    expect(sourceFiles().length).toBeGreaterThan(10);
  });

  it("nenhum nó de texto JSX cru — todo texto de UI via {t('chave')}", () => {
    const offenders = sourceFiles()
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => scanJsxText(f, readFileSync(f, 'utf8')));
    expect(offenders, `texto JSX hardcoded — use {t('chave')}:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  it('nenhum texto Phaser hardcoded — add.text/setText recebe t(...)', () => {
    const offenders = sourceFiles().flatMap((f) => scanPhaserText(f, readFileSync(f, 'utf8')));
    expect(offenders, `texto Phaser hardcoded — passe t('chave'):\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  // Fixtures permanentes: provam que os scanners PEGAM os padrões reais e
  // multi-linha (JSX em linha própria, `.add.text(...)` encadeado, `.setText([
  // ...])` em array). Trava a própria correção do guarda em CI — não só a
  // ausência de violações hoje.
  describe('os scanners detectam violações no estilo real do código', () => {
    it('pega texto JSX cru multi-linha (com dígitos) e ignora {t(...)}', () => {
      const bad = `const V = () => (
        <button class="btn" type="submit">
          Level 1 Back
        </button>
      );`;
      const good = `const V = () => (
        <button class="btn" type="submit">
          {i18n.t('profile.save')}
        </button>
      );`;
      expect(scanJsxText('X.tsx', bad)).toHaveLength(1);
      expect(scanJsxText('X.tsx', good)).toEqual([]);
    });

    it('ignora glifos/emoji decorativos e entidades HTML em JSX', () => {
      const deco = `const V = () => (
        <span aria-hidden="true">🏆</span>
      );`;
      const entity = `const V = () => (
        <span>&nbsp;</span>
      );`;
      expect(scanJsxText('X.tsx', deco)).toEqual([]);
      expect(scanJsxText('X.tsx', entity)).toEqual([]);
    });

    it('pega literal em `.add.text(...)` encadeado multi-linha e ignora t()/placeholder vazio', () => {
      const bad = `this.title = this.add
        .text(VIEW_WIDTH / 2, 36, 'Game Over', { color: '#fff' });`;
      const good = `this.title = this.add
        .text(VIEW_WIDTH / 2, 36, i18n.t('gameover.title'), { color: '#fff' });`;
      const placeholder = `this.hud = this.add
        .text(HUD_X, HUD_Y, '', { fontSize: HUD_FONT_SIZE });`;
      expect(scanPhaserText('X.ts', bad)).toHaveLength(1);
      expect(scanPhaserText('X.ts', good)).toEqual([]);
      expect(scanPhaserText('X.ts', placeholder)).toEqual([]);
    });

    it('pega literal dentro de `.setText([...].join())` multi-linha e ignora array só-t() + separador', () => {
      const bad = `this.hud.setText([
        'Distance: ' + v.distance,
        i18n.t('hud.food', { value: v.food }),
      ].join('\\n'));`;
      const good = `this.hud.setText([
        i18n.t('hud.distance', { value: v.distance }),
        i18n.t('hud.weather', { value: i18n.t('weather.' + v.weather) }),
      ].join('\\n'));`;
      expect(scanPhaserText('X.ts', bad)).toHaveLength(1);
      expect(scanPhaserText('X.ts', good)).toEqual([]);
    });
  });
});
