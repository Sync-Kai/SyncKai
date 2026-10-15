import { describe, expect, it } from 'vitest';
import { EDGES, SOURCES, layerFiles, reachableFrom, resolveImport, type Edge } from './test/import-graph';

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

  it('platforms/ (savoir par plateforme) ne dépend d’aucune couche applicative', () => {
    expect(violations('platforms', ['ui', 'popup', 'sidepanel', 'content', 'background', 'import', 'import-cr'])).toEqual([]);
  });

  it('protocol/ (contrats entre contextes d’exécution) ne dépend d’aucune couche applicative', () => {
    expect(violations('protocol', ['ui', 'popup', 'sidepanel', 'content', 'background', 'import', 'import-cr'])).toEqual([]);
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
      // Réduction de l'historique ADN : faite dans la page d'import, le script de contenu ne lit que l'API
      'platforms/adn/history.ts',
      // Icônes et grand dessin de Kai (kai-small.ts suffit à la bulle)
      'ui/icons.ts',
      // Écritures des exclusions et rapprochement des liens (exclusions-core.ts suffit à la lecture)
      'shared/exclusions.ts',
      'platforms/links.ts',
      // Descripteurs des plateformes (logos, hôtes, liens) : platforms/ids.ts suffit
      'platforms/registry.ts',
    ];
    expect(contentModules.has('protocol/messages.ts')).toBe(true);
    expect(heavy.filter((path) => contentModules.has(path))).toEqual([]);
  });

  it('protocol/messages.ts n’importe que des types (sendMessage seul y est du code)', () => {
    expect(edges.filter((e) => e.from === 'protocol/messages.ts' && !e.typeOnly).map(describeEdge)).toEqual([]);
  });
});

// ── Filets de sécurité du réaménagement des dossiers : règles qui valent déjà aujourd'hui et qui suivent chaque déplacement ──

const isTestFile = (path: string): boolean => path.endsWith('.test.ts') || path.startsWith('test/');

/** Code d'un module sans les commentaires (lignes de commentaire et fin de ligne ` // …`) */
function withoutComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

/** Modules hors tests qui contiennent `pattern` sur une ligne de code */
function modulesMatching(files: Iterable<string>, pattern: RegExp): string[] {
  return [...files].filter((file) => pattern.test(withoutComments(SOURCES.get(file) ?? ''))).sort();
}

describe('monde MAIN des ponts de page', () => {
  /** Modules purs que les ponts passifs peuvent embarquer (aucun accès aux API d'extension) */
  const MAIN_SAFE_SHARED: readonly string[] = ['shared/guards.ts', 'shared/match-signals.ts', 'shared/title.ts'];
  const bridges = layerFiles('content').filter((file) => /^content\/[a-z0-9-]+\/page-bridge\.iife\.ts$/.test(file));

  it('les quatre ponts sont trouvés', () => {
    expect(bridges).toHaveLength(4);
  });

  it('un pont n’atteint que son protocole et des modules purs de la liste blanche', () => {
    for (const bridge of bridges) {
      const platform = bridge.split('/')[1] ?? '';
      const allowed = (file: string): boolean =>
        file === bridge || file === `content/${platform}/bridge-protocol.ts` || file.startsWith(`platforms/${platform}/`) || MAIN_SAFE_SHARED.includes(file);
      const reached = [...reachableFrom([bridge], { valuesOnly: true })];
      expect(reached.filter((file) => !allowed(file)), bridge).toEqual([]);
    }
  });

  it('aucun module atteint par un pont n’appelle chrome. ni browser. (absents du monde MAIN)', () => {
    const reached = new Set(bridges.flatMap((bridge) => [...reachableFrom([bridge], { valuesOnly: true })]));
    expect(modulesMatching(reached, /\b(?:chrome|browser)\.[a-z]/)).toEqual([]);
  });
});

describe('déchiffrement des jetons (token-access)', () => {
  const TOKEN_ACCESS = 'shared/token-access.ts';
  /** Exception connue : le rapport de diagnostic des pages masque les jetons (lecture seule des secrets, pour les expurger) */
  const DIAGNOSTICS_EXCEPTION = 'shared/diagnostics-store.ts';

  it('seul le service worker importe token-access (et l’exception du diagnostic)', () => {
    const importers = edges.filter((e) => e.to === TOKEN_ACCESS && !e.typeOnly && !isTestFile(e.from)).map((e) => e.from);
    expect(importers.filter((from) => layerOf(from) !== 'background' && from !== DIAGNOSTICS_EXCEPTION)).toEqual([]);
  });

  it('les scripts de contenu et les pages d’import n’atteignent pas token-access', () => {
    for (const layer of ['content', 'import', 'import-cr']) {
      expect(reachableFrom(layerFiles(layer), { valuesOnly: true }).has(TOKEN_ACCESS), layer).toBe(false);
    }
  });
});

describe('content/ n’embarque que le kit d’interface sûr', () => {
  /** Fichiers de `ui/` autorisés dans les scripts de contenu (bulle de Kai, notes) ; le reste de `ui/` reste hors de leur bundle */
  const CONTENT_SAFE_UI: readonly string[] = ['ui/rating.ts', 'ui/star-rating.ts', 'ui/kai-small.ts', 'ui/svg.ts'];

  it('les modules de ui/ atteignables depuis le contenu sont ceux de la liste blanche', () => {
    const reached = [...reachableFrom(layerFiles('content'), { valuesOnly: true })].filter((file) => layerOf(file) === 'ui');
    expect(reached.filter((file) => !CONTENT_SAFE_UI.includes(file))).toEqual([]);
  });

  it('aucun import de ui/ hors liste blanche depuis le contenu, types compris', () => {
    const imports = edges.filter((e) => layerOf(e.from) === 'content' && !isTestFile(e.from) && layerOf(e.to) === 'ui');
    expect(imports.filter((e) => !CONTENT_SAFE_UI.includes(e.to)).map(describeEdge)).toEqual([]);
  });
});

describe('shared/ : cliquet des modules qui appellent une API du navigateur', () => {
  /** Modules de `shared/` qui font de vrais appels `chrome.*` (hors commentaires), IndexedDB ou `navigator.locks` : la liste ne fait que baisser */
  const BROWSER_API_MODULES: readonly string[] = [
    'shared/agenda-store.ts',
    'shared/backup-store.ts',
    'shared/badge.ts',
    'shared/cr-import-store.ts',
    'shared/diagnostics-store.ts',
    'shared/engagement-store.ts',
    'shared/error-journal.ts',
    'shared/exclusions-core.ts',
    'shared/exclusions.ts',
    'shared/host-access.ts',
    'shared/platform-access.ts',
    'shared/platform-links-store.ts',
    'shared/session-cache.ts',
    'shared/settings.ts',
    'shared/side-panel.ts',
    'shared/storage-lock-core.ts',
    'shared/storage-lock.ts',
    'shared/storage.ts',
    'shared/sync-queue-store.ts',
    'shared/token-key-store.ts',
  ];
  const BROWSER_API = /\b(?:chrome|browser)\.(?:storage|runtime|permissions|action|sidePanel|tabs|scripting|commands|alarms|windows|i18n|identity|notifications)\b|\bindexedDB\b|\bnavigator\.locks\b/;

  it('aucun nouveau module de shared/ n’appelle une API du navigateur', () => {
    const current = modulesMatching(layerFiles('shared'), BROWSER_API);
    expect(current.filter((file) => !BROWSER_API_MODULES.includes(file))).toEqual([]);
  });

  it('la liste figée ne contient que des modules qui existent et appellent encore une API (elle baisse, elle ne ment pas)', () => {
    const current = modulesMatching(layerFiles('shared'), BROWSER_API);
    expect(BROWSER_API_MODULES.filter((file) => !current.includes(file))).toEqual([]);
  });
});

describe('service worker : pas de nouvel écouteur d’événement du navigateur', () => {
  /** Écouteurs `addListener` de `background/` par événement : chacun peut réveiller le service worker (CLAUDE.md : il reste inactif) */
  const LISTENERS: Readonly<Record<string, number>> = {
    'chrome.alarms.onAlarm': 3,
    'chrome.commands.onCommand': 1,
    'chrome.notifications.onButtonClicked': 1,
    'chrome.notifications.onClicked': 1,
    'chrome.permissions.onAdded': 1,
    'chrome.permissions.onRemoved': 1,
    'chrome.runtime.onInstalled': 7,
    'chrome.runtime.onMessage': 1,
    'chrome.runtime.onStartup': 6,
    'chrome.storage.local.onChanged': 1,
  };

  it('aucun événement ni écouteur de plus que la liste figée', () => {
    const counts = new Map<string, number>();
    for (const file of layerFiles('background')) {
      for (const match of withoutComments(SOURCES.get(file) ?? '').matchAll(/\b((?:chrome|browser)\.[A-Za-z.]+)\.addListener\(/g)) {
        counts.set(match[1] ?? '', (counts.get(match[1] ?? '') ?? 0) + 1);
      }
    }
    const added = [...counts].filter(([event, count]) => count > (LISTENERS[event] ?? 0)).map(([event, count]) => `${event} : ${count} (figé : ${LISTENERS[event] ?? 0})`);
    expect(added).toEqual([]);
  });
});

describe('intégrité des simulations (vi.mock)', () => {
  it('chaque chemin relatif de vi.mock / vi.doMock / vi.importActual désigne un fichier existant', () => {
    const missing: string[] = [];
    for (const [file, code] of SOURCES) {
      for (const match of code.matchAll(/\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\(\s*['"](\.[^'"]*)['"]/g)) {
        const spec = match[1] ?? '';
        if (resolveImport(file, spec) === null) missing.push(`${file} → ${spec}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
