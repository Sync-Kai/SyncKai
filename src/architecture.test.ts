import { describe, expect, it } from 'vitest';
import { EDGES, type Edge } from './test/import-graph';

// Frontières des modules (voir CLAUDE.md › « Frontières des modules ») : graphe des imports relatifs de src/, tests
// compris (src/test/import-graph.ts).

const edges = EDGES;
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
