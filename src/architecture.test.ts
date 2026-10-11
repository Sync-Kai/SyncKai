import { describe, expect, it } from 'vitest';

// Frontières des modules (voir CLAUDE.md › « Frontières des modules ») : graphe des imports relatifs de src/,
// tests compris, lu par Vite (sources brutes) sans dépendance. Imports de types inclus : un cycle de types finit
// souvent en cycle de valeurs.

/** Sources de src/, clés relatives à src/ ("popup/popup.ts") */
const SOURCES = new Map(
  Object.entries(import.meta.glob<string>(['./**/*.ts', '!./**/*.d.ts'], { query: '?raw', import: 'default', eager: true })).map(([path, code]) => [
    path.slice(2),
    code,
  ]),
);

/** Imports statiques (`import … from`, `export … from`, `import '…'`) et dynamiques (`import('…')`) */
const IMPORT_RE = /(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

interface Edge {
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

const edges = buildEdges();
const layerOf = (path: string): string => path.split('/')[0] ?? path;
const describeEdge = (e: Edge): string => `${e.from} → ${e.spec}`;

/** Imports de `from` vers les couches interdites (hors liste blanche) */
function violations(from: string, forbidden: readonly string[], allowed: (e: Edge) => boolean = () => false): string[] {
  return edges.filter((e) => layerOf(e.from) === from && forbidden.includes(layerOf(e.to)) && !allowed(e)).map(describeEdge);
}

/** Cycles du graphe (parcours en profondeur) : un chemin par cycle trouvé */
function findCycles(): string[][] {
  const graph = new Map<string, string[]>();
  for (const e of edges) graph.set(e.from, [...(graph.get(e.from) ?? []), e.to]);
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (node: string): void => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const seen = state.get(next);
      if (seen === 'visiting') cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (seen === undefined) visit(next);
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

describe('frontières des modules', () => {
  it('le graphe des imports est bien lu', () => {
    expect(edges.length).toBeGreaterThan(500);
    expect(edges).toContainEqual(expect.objectContaining({ from: 'popup/components/watching-screen.ts', to: 'ui/kit.ts' }));
    expect(edges).toContainEqual(expect.objectContaining({ from: 'popup/popup.ts', to: 'i18n/index.ts' }));
  });

  it('aucun cycle d’import', () => {
    expect(findCycles().map((cycle) => cycle.join(' → '))).toEqual([]);
  });

  it('shared/ ne dépend d’aucune couche applicative', () => {
    expect(violations('shared', ['ui', 'popup', 'sidepanel', 'content', 'background', 'import', 'import-cr'])).toEqual([]);
  });

  it('ui/ ne dépend ni du popup ni du panneau latéral', () => {
    expect(violations('ui', ['popup', 'sidepanel'])).toEqual([]);
  });

  it('les écrans (popup, panneau, pages d’import) ne s’importent pas entre eux', () => {
    const screens = ['popup', 'sidepanel', 'import', 'import-cr'];
    expect(screens.flatMap((screen) => violations(screen, screens.filter((other) => other !== screen)))).toEqual([]);
  });

  it('content/ ne dépend pas du service worker', () => {
    expect(violations('content', ['background'])).toEqual([]);
  });

  it('background/ ne dépend du contenu que pour les scripts Netflix enregistrés (`?script`)', () => {
    const netflixScripts = (e: Edge): boolean => e.from === 'background/netflix-access.ts' && e.spec.endsWith('.iife.ts?script');
    expect(violations('background', ['content'], netflixScripts)).toEqual([]);
  });
});
