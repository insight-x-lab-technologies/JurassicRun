/**
 * Resolve o `base` do Vite a partir de uma env var `BASE_PATH`, permitindo o mesmo
 * build servir de raízes diferentes (GitHub Pages em `/JurassicRun/`, itch.io em base
 * relativa `./`) sem fixar nada no vite.config. Módulo puro (molde de manifest.ts) ⇒
 * testável sem rodar o build.
 *
 * - Ausente/vazio ⇒ `'/'` (dev local e testes).
 * - Base relativa (começa com `.`: `.`, `./`, `./algo`, `..`, `../algo`) ⇒ retornada como
 *   veio (caso legítimo do Vite para hospedagem em path arbitrário, ex.: itch.io); um
 *   `..` acidental não é reinterpretado como absoluto `/../` inválido.
 * - Base absoluta ⇒ normalizada com barra inicial e final (evita o footgun de assets
 *   404 quando falta a barra final).
 */
export function resolveBasePath(env: Record<string, string | undefined>): string {
  const raw = env.BASE_PATH?.trim();
  if (!raw) return '/';
  if (raw.startsWith('.')) return raw;
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}
