// Baixa as famílias de fonte da UI (licença OFL) do Google Fonts e as grava em public/fonts/,
// junto com o CSS de @font-face que as declara. Rodar só quando o catálogo mudar:
//   npm run fetch:fonts
//
// Por que self-host em vez de <link> para o CDN: o jogo é uma PWA que precisa funcionar OFFLINE
// (e sem custo/telemetria de terceiros). Os arquivos ficam commitados e entram no precache.
//
// Subset: latin + latin-ext apenas. Os locales ja/zh/ko/hi caem no fallback de sistema por
// cascata natural do CSS — estas famílias não têm esses glifos, e embutir CJK custaria dezenas
// de MB.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'public/fonts');
const CSS_OUT = path.join(ROOT, 'src/app/styles/fonts.css');

// Chrome moderno ⇒ o Google Fonts devolve woff2 (o menor formato).
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/** Famílias do seletor de Configurações. `slug` vira o nome do arquivo. */
export const FONT_FAMILIES = [
  { family: 'Cinzel', slug: 'cinzel', weights: [400, 600, 700] },
  { family: 'Cinzel Decorative', slug: 'cinzel-decorative', weights: [400, 700] },
  { family: 'Marcellus', slug: 'marcellus', weights: [400] },
  { family: 'Exo 2', slug: 'exo2', weights: [400, 600, 700] },
];

/** Só os subsets latinos; o resto do mundo cai no fallback de sistema. */
const SUBSETS = ['latin', 'latin-ext'];

function cssUrl({ family, weights }) {
  const name = family.replace(/ /g, '+');
  const axis = weights.length > 1 ? `:wght@${weights.join(';')}` : '';
  return `https://fonts.googleapis.com/css2?family=${name}${axis}&display=swap`;
}

/** Extrai os blocos @font-face do CSS do Google, anotados com o subset do comentário anterior. */
function parseFaces(css) {
  const faces = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const subset = m[1];
    const body = m[2];
    const weight = /font-weight:\s*(\d+)/.exec(body)?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1];
    if (weight !== undefined && url !== undefined && range !== undefined) {
      faces.push({ subset, weight: Number(weight), url, range: range.trim() });
    }
  }
  return faces;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cssBlocks = [
    '/* GERADO por scripts/fetch-fonts.mjs — não editar à mão. Fontes OFL, self-hosted. */\n',
  ];

  for (const spec of FONT_FAMILIES) {
    const res = await fetch(cssUrl(spec), { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`CSS de ${spec.family}: HTTP ${res.status}`);
    const faces = parseFaces(await res.text()).filter((f) => SUBSETS.includes(f.subset));
    if (faces.length === 0) throw new Error(`nenhum subset latino para ${spec.family}`);

    for (const face of faces) {
      const file = `${spec.slug}-${face.weight}-${face.subset}.woff2`;
      const bin = await fetch(face.url, { headers: { 'User-Agent': UA } });
      if (!bin.ok) throw new Error(`${file}: HTTP ${bin.status}`);
      writeFileSync(path.join(OUT, file), Buffer.from(await bin.arrayBuffer()));
      cssBlocks.push(
        `@font-face {\n` +
          `  font-family: '${spec.family}';\n` +
          `  font-style: normal;\n` +
          `  font-weight: ${face.weight};\n` +
          `  font-display: swap;\n` +
          // Caminho RELATIVO: o CSS empacotado vive em assets/, então '../fonts/x' resolve para
          // <base>/fonts/x — inclusive sob o subdiretório do GitHub Pages (BASE_PATH=/JurassicRun/),
          // onde um '/fonts/x' absoluto daria 404.
          `  src: url('../fonts/${file}') format('woff2');\n` +
          `  unicode-range: ${face.range};\n` +
          `}`,
      );
      console.log(`escrito public/fonts/${file}`);
    }
  }

  writeFileSync(CSS_OUT, cssBlocks.join('\n') + '\n');
  console.log(`escrito ${path.relative(ROOT, CSS_OUT)}`);
}

await main();
