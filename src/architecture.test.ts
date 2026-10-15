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

  it('browser/ (accès aux API du navigateur) ne dépend d’aucune couche applicative', () => {
    expect(violations('browser', ['ui', 'popup', 'sidepanel', 'content', 'background', 'import', 'import-cr'])).toEqual([]);
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

  it('imports `?script` (chemins des scripts produits par crxjs) dans platform-access.ts et history-reader.ts seulement', () => {
    // Service worker : scripts des plateformes optionnelles enregistrés à la demande. Page d'import : lecteurs de l'historique
    // Crunchyroll / ADN injectés dans l'onglet juste avant le port, pour les garder hors du script de contenu du manifeste
    const SCRIPT_IMPORTERS: readonly string[] = ['background/platform-access.ts', 'import-cr/history-reader.ts'];
    expect(edges.filter((e) => e.spec.includes('?script') && !isTestFile(e.from) && !SCRIPT_IMPORTERS.includes(e.from)).map(describeEdge)).toEqual([]);
  });

  it('les écrans ne dépendent du contenu que pour les lecteurs de l’historique (`?script` de history-reader.ts)', () => {
    const historyReader = (e: Edge): boolean => e.from === 'import-cr/history-reader.ts' && e.spec === '../content/history/history.iife.ts?script';
    expect(['popup', 'sidepanel', 'import', 'import-cr'].flatMap((screen) => violations(screen, ['content'], historyReader))).toEqual([]);
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
      // Réglages complets (délais de l'Agenda, lecteur préféré…) : content-settings.ts suffit (getContentSettings)
      'shared/settings.ts',
      'browser/storage/settings-access.ts',
    ];
    expect(contentModules.has('protocol/messages.ts')).toBe(true);
    expect(heavy.filter((path) => contentModules.has(path))).toEqual([]);
  });

  /** Scripts isolés du manifeste, un par plateforme (une page ne charge que le sien) */
  const MANIFEST_SCRIPTS = { crunchyroll: 'content/crunchyroll/content-crunchyroll.iife.ts', adn: 'content/adn/content-adn.iife.ts' } as const;

  it('les scripts du manifeste (Crunchyroll, ADN) n’embarquent pas les lecteurs de l’historique (injectés à la demande)', () => {
    const readers = ['content/crunchyroll/history.ts', 'content/crunchyroll/history-port.ts', 'content/adn/history.ts', 'content/lib/history-port.ts', 'content/lib/page-fetch.ts'];
    for (const entry of Object.values(MANIFEST_SCRIPTS)) {
      const manifestScript = reachableFrom([entry], { valuesOnly: true });
      expect(manifestScript.has('content/start.ts'), entry).toBe(true);
      expect(readers.filter((path) => manifestScript.has(path)), entry).toEqual([]);
    }
    expect(reachableFrom(['content/history/history.iife.ts'], { valuesOnly: true }).has('content/adn/history.ts')).toBe(true);
  });

  it('chaque script du manifeste n’embarque que l’adapter de sa plateforme', () => {
    const crunchyroll = reachableFrom([MANIFEST_SCRIPTS.crunchyroll], { valuesOnly: true });
    const adn = reachableFrom([MANIFEST_SCRIPTS.adn], { valuesOnly: true });
    expect(crunchyroll.has('content/crunchyroll/adapter.ts')).toBe(true);
    expect(adn.has('content/adn/adapter.ts')).toBe(true);
    expect([...crunchyroll].filter((path) => path.startsWith('content/adn/'))).toEqual([]);
    expect([...adn].filter((path) => path.startsWith('content/crunchyroll/'))).toEqual([]);
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
  const TOKEN_ACCESS = 'browser/tokens/access.ts';
  /** Exception connue : le rapport de diagnostic des pages masque les jetons (lecture seule des secrets, pour les expurger) */
  const DIAGNOSTICS_EXCEPTION = 'browser/storage/diagnostics-store.ts';

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

describe('shared/ : pur, sans API du navigateur', () => {
  /** Vrais appels `chrome.*` (hors commentaires), IndexedDB ou `navigator.locks` : tout cela vit dans browser/ */
  const BROWSER_API = /\b(?:chrome|browser)\.(?:storage|runtime|permissions|action|sidePanel|tabs|scripting|commands|alarms|windows|i18n|identity|notifications)\b|\bindexedDB\b|\bnavigator\.locks\b/;
  /**
   * Imports de `shared/` (et de i18n/) vers `browser/` encore en place (hors tests) : la liste ne fait que baisser.
   * Chacun est une constante, un type ou un helper de stockage lu par une règle pure, à déplacer ou inverser un jour.
   */
  const SHARED_TO_BROWSER: readonly string[] = [
    'i18n/core.ts → browser/logger.ts',
    'i18n/core.ts → browser/storage/content-settings.ts',
    'shared/backup.ts → browser/storage/engagement-store.ts',
    'shared/backup.ts → browser/storage/reviews.ts',
    'shared/diagnostics.ts → browser/error-journal.ts',
    'shared/exclusions.ts → browser/storage/exclusions-read.ts',
    'shared/match-diagnostic.ts → browser/storage/session-cache.ts',
    'shared/preferred-player.ts → browser/platform-access.ts',
    'shared/preferred-player.ts → browser/storage/lock.ts',
    'shared/preferred-player.ts → browser/storage/settings-access.ts',
  ];

  it('aucun module de shared/ n’appelle une API du navigateur', () => {
    expect(modulesMatching(layerFiles('shared'), BROWSER_API)).toEqual([]);
  });

  it('shared/ et i18n/ n’importent de browser/ que les liens figés (valeurs et types)', () => {
    const current = [...new Set(edges.filter((e) => ['shared', 'i18n'].includes(layerOf(e.from)) && !isTestFile(e.from) && layerOf(e.to) === 'browser').map((e) => `${e.from} → ${e.to}`))].sort();
    expect(current.filter((link) => !SHARED_TO_BROWSER.includes(link))).toEqual([]);
  });

  it('la liste figée ne contient que des liens qui existent encore (elle baisse, elle ne ment pas)', () => {
    const current = new Set(edges.map((e) => `${e.from} → ${e.to}`));
    expect(SHARED_TO_BROWSER.filter((link) => !current.has(link))).toEqual([]);
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
    // chrome.storage.local.onChanged : 0 depuis PERF-17 (décision du 2026-10-15). Il réveillait le service worker à chaque
    // écriture locale d'une page ou d'un script de contenu ; l'alarme des sorties est tenue à jour là où ses conditions
    // changent (browser/airing-alarm.ts)
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

  it('aucun écouteur de storage.onChanged dans background/ : toute écriture locale réveillerait le service worker (PERF-17)', () => {
    const found = layerFiles('background').filter((file) => /\bstorage(?:\.(?:local|session|sync))?\.onChanged\.addListener\(/.test(withoutComments(SOURCES.get(file) ?? '')));
    expect(found).toEqual([]);
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
