// Graphe des imports relatifs de src/, tests compris, lu par Vite (sources brutes) sans dépendance. Partagé par le
// test des frontières des modules (src/architecture.test.ts) et celui des expéditeurs de messages (messages.test.ts).
// Imports de types inclus : un cycle de types finit souvent en cycle de valeurs.

/** Sources de src/, clés relatives à src/ ("popup/popup.ts") */
export const SOURCES = new Map(
  Object.entries(import.meta.glob<string>(['../**/*.ts', '!../**/*.d.ts'], { query: '?raw', import: 'default', eager: true })).map(([path, code]) => [
    path.slice(3),
    code,
  ]),
);

/** Imports statiques (`import … from`, `export … from`, `import '…'`) et dynamiques (`import('…')`) */
const IMPORT_RE = /(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

export interface Edge {
  from: string;
  to: string;
  spec: string;
}

/** Chemin relatif à src/ visé par un spécifieur relatif (`?script` retiré, extension ou index.ts implicites), sinon null */
function resolveImport(from: string, spec: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of (spec.split('?')[0] ?? spec).split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  const base = parts.join('/');
  return [base, `${base}.ts`, `${base}/index.ts`].find((path) => SOURCES.has(path)) ?? null;
}

function buildEdges(): Edge[] {
  return [...SOURCES].flatMap(([file, code]) =>
    [...code.matchAll(IMPORT_RE)].flatMap((match): Edge[] => {
      const spec = match[1] ?? match[2];
      if (spec === undefined || !spec.startsWith('.')) return [];
      const target = resolveImport(file, spec);
      return target ? [{ from: file, to: target, spec }] : [];
    }),
  );
}

export const EDGES: readonly Edge[] = buildEdges();

const isTest = (path: string): boolean => path.endsWith('.test.ts') || path.startsWith('test/');

/** Modules du code de l'extension (hors tests) atteignables depuis `roots`, racines comprises */
export function reachableFrom(roots: readonly string[]): Set<string> {
  const seen = new Set(roots.filter((root) => !isTest(root)));
  const pending = [...seen];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    for (const edge of EDGES) {
      if (edge.from !== file || isTest(edge.to) || seen.has(edge.to)) continue;
      seen.add(edge.to);
      pending.push(edge.to);
    }
  }
  return seen;
}

/** Fichiers du code de l'extension (hors tests) d'une couche (`content`, `popup`…) */
export function layerFiles(layer: string): string[] {
  return [...SOURCES.keys()].filter((path) => path.startsWith(`${layer}/`) && !isTest(path));
}
