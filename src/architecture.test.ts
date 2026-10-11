import { describe, expect, it } from 'vitest';
import { EDGES, layerFiles, reachableFrom, type Edge } from './test/import-graph';

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

  it('background/ ne dépend du contenu que pour les scripts enregistrés de Netflix et Disney+ (`?script`)', () => {
    const registeredScripts = (e: Edge): boolean => e.from === 'background/platform-access.ts' && e.spec.endsWith('.iife.ts?script');
    expect(violations('background', ['content'], registeredScripts)).toEqual([]);
  });
});

describe('scripts de contenu légers (PERF-01)', () => {
  /** Modules réellement embarqués par les scripts de contenu (Crunchyroll, ADN, Netflix, Disney+) : imports de valeurs seuls */
  const contentModules = reachableFrom(layerFiles('content'), { valuesOnly: true });

  it('aucun module réservé au service worker ni aux pages de l’extension', () => {
    const heavy = [
      // Gardes des payloads de tous les messages (et leurs dépendances : import, comparaison, agenda)
      'background/message-guards.ts',
      'shared/agenda.ts',
      'shared/compare.ts',
      'shared/cr-import.ts',
      // Icônes et grand dessin de Kai (kai-small.ts suffit à la bulle)
      'ui/icons.ts',
      // Écritures des exclusions et rapprochement des liens (exclusions-core.ts suffit à la lecture)
      'shared/exclusions.ts',
      'shared/platform-links.ts',
      // Descripteurs des plateformes (logos, hôtes, liens) : platform-ids.ts suffit
      'shared/platforms.ts',
    ];
    expect(contentModules.has('shared/messages.ts')).toBe(true);
    expect(heavy.filter((path) => contentModules.has(path))).toEqual([]);
  });

  it('shared/messages.ts n’importe que des types (sendMessage seul y est du code)', () => {
    expect(edges.filter((e) => e.from === 'shared/messages.ts' && !e.typeOnly).map(describeEdge)).toEqual([]);
  });
});
