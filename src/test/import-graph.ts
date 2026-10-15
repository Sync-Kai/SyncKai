// Graphe des imports relatifs de src/, tests compris, lu par Vite (sources brutes) sans dépendance. Partagé par le
// test des frontières des modules (src/architecture.test.ts), celui des expéditeurs de messages
// (background/message-guards.test.ts) et celui des traductions des scripts de contenu (i18n/content.test.ts).
// Imports de types inclus (marqués `typeOnly`) : un cycle de types finit souvent en cycle de valeurs.

/** Sources de src/, clés relatives à src/ ("popup/popup.ts") */
export const SOURCES = new Map(
  Object.entries(import.meta.glob<string>(['../**/*.ts', '!../**/*.d.ts'], { query: '?raw', import: 'default', eager: true })).map(([path, code]) => [
    path.slice(3),
    code,
  ]),
);

/** Imports statiques (`import … from`, `export … from`, `import '…'`) et dynamiques (`import('…')`) */
const IMPORT_RE = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

export interface Edge {
  from: string;
  to: string;
  spec: string;
  /** `import type` / `export type` : effacé à la compilation, absent du bundle */
  typeOnly: boolean;
}

/** Chemin relatif à src/ visé par un spécifieur relatif (`?script` retiré, extension ou index.ts implicites), sinon null */
export function resolveImport(from: string, spec: string): string | null {
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
      const spec = match[2] ?? match[3];
      if (spec === undefined || !spec.startsWith('.')) return [];
      const target = resolveImport(file, spec);
      return target ? [{ from: file, to: target, spec, typeOnly: match[1] !== undefined }] : [];
    }),
  );
}

export const EDGES: readonly Edge[] = buildEdges();

const isTest = (path: string): boolean => path.endsWith('.test.ts') || path.startsWith('test/');

/** Import `?script` de crxjs : le chemin du script produit (une chaîne), jamais son code, qui forme un bundle à part */
const isScriptPath = (edge: Edge): boolean => edge.spec.endsWith('?script');

/**
 * Modules du code de l'extension (hors tests) atteignables depuis `roots`, racines comprises. `valuesOnly` : sans
 * suivre les `import type` / `export type`, soit les modules réellement embarqués dans le bundle. Les imports `?script`
 * ne sont jamais suivis (le script visé est une entrée à part).
 */
export function reachableFrom(roots: readonly string[], { valuesOnly = false }: { valuesOnly?: boolean } = {}): Set<string> {
  const seen = new Set(roots.filter((root) => !isTest(root)));
  const pending = [...seen];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    for (const edge of EDGES) {
      if (edge.from !== file || (valuesOnly && edge.typeOnly) || isScriptPath(edge) || isTest(edge.to) || seen.has(edge.to)) continue;
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
