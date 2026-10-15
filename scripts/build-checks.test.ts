import { describe, expect, it } from 'vitest';
import {
  DISNEY_PATTERN,
  NETFLIX_PATTERN,
  PRIME_PATTERN,
  registeredScriptPlatform,
  checkAccessDeclarations,
  checkCommands,
  checkFontFormats,
  checkUnreferencedFiles,
  checkLocaleCatalogs,
  checkMainWorldBridge,
  checkManifestScriptBudgets,
  checkNoDevMarkers,
  isMainWorldBridge,
  localeCatalogFiles,
  MANIFEST_SCRIPT_BUDGETS,
  checkContentSecurityPolicy,
  checkWebAccessibleResources,
  fileReferences,
  hasDynamicImport,
  manifestReferences,
  manifestScriptFiles,
  reachableFiles,
  type BuiltManifest,
} from './build-checks.ts';
import { isExtensionInjectedScript } from '../src/build/output-names.ts';

const CR = ['*://*.crunchyroll.com/*'];
const ADN = ['*://animationdigitalnetwork.com/*', '*://*.animationdigitalnetwork.com/*'];
const CR_SCRIPT = 'src/content/crunchyroll/content-crunchyroll.iife.js';
const ADN_SCRIPT = 'src/content/adn/content-adn.iife.js';
const netflixEntry = { matches: [NETFLIX_PATTERN], resources: ['src/content/netflix/a.iife.js', 'src/content/netflix/b.iife.js'] };
const disneyEntry = { matches: [DISNEY_PATTERN], resources: ['src/content/disney/a.iife.js', 'src/content/disney/b.iife.js'] };
const primeEntry = { matches: [PRIME_PATTERN], resources: ['src/content/prime/a.iife.js', 'src/content/prime/b.iife.js'] };
const crEntry = { matches: CR, resources: ['assets/start-x.js'] };

const base: BuiltManifest = {
  version: '1.0.0',
  default_locale: 'en',
  icons: { '16': 'icons/icon-16.png' },
  permissions: ['storage', 'scripting'],
  host_permissions: CR,
  optional_host_permissions: [NETFLIX_PATTERN, DISNEY_PATTERN, PRIME_PATTERN],
  background: { service_worker: 'service-worker-loader.js' },
  content_scripts: [
    { matches: CR, js: [CR_SCRIPT] },
    { matches: ADN, js: [ADN_SCRIPT] },
  ],
  web_accessible_resources: [netflixEntry, disneyEntry, primeEntry],
  action: { default_popup: 'src/popup/popup.html', default_icon: { '16': 'icons/icon-16.png' } },
};

describe('manifestReferences', () => {
  it('liste sans doublon les fichiers cités, sans les motifs', () => {
    const refs = manifestReferences({ ...base, web_accessible_resources: [...(base.web_accessible_resources ?? []), { matches: CR, resources: ['assets/*'] }] });
    expect(refs).toEqual([
      'icons/icon-16.png',
      'src/popup/popup.html',
      'service-worker-loader.js',
      CR_SCRIPT,
      ADN_SCRIPT,
      'src/content/netflix/a.iife.js',
      'src/content/netflix/b.iife.js',
      'src/content/disney/a.iife.js',
      'src/content/disney/b.iife.js',
      'src/content/prime/a.iife.js',
      'src/content/prime/b.iife.js',
      '_locales/en/messages.json',
    ]);
  });

  it('Firefox : scripts d’arrière-plan et barre latérale', () => {
    const refs = manifestReferences({ background: { scripts: ['service-worker-loader.js'] }, sidebar_action: { default_panel: 'src/sidepanel/sidepanel.html' } });
    expect(refs).toEqual(['src/sidepanel/sidepanel.html', 'service-worker-loader.js']);
  });
});

describe('manifestScriptFiles', () => {
  it('sépare le pont du monde MAIN (budget à part) des scripts isolés', () => {
    const manifest: BuiltManifest = {
      content_scripts: [
        { matches: CR, js: ['src/content/crunchyroll/page-bridge.iife.js'], world: 'MAIN' },
        { matches: CR, js: [CR_SCRIPT] },
        { matches: CR, js: ['assets/other.js'], world: 'ISOLATED' },
      ],
    };
    expect(manifestScriptFiles(manifest, 'MAIN')).toEqual(['src/content/crunchyroll/page-bridge.iife.js']);
    expect(manifestScriptFiles(manifest, 'ISOLATED')).toEqual([CR_SCRIPT, 'assets/other.js']);
    expect(manifestScriptFiles({}, 'MAIN')).toEqual([]);
  });
});

describe('checkManifestScriptBudgets', () => {
  it('un budget par script isolé du manifeste (Crunchyroll, ADN), le pont MAIN à part', () => {
    const bridge = { matches: CR, js: ['src/content/crunchyroll/page-bridge.iife.js'], world: 'MAIN' };
    expect(checkManifestScriptBudgets({ content_scripts: [bridge, ...(base.content_scripts ?? [])] })).toEqual([]);
    expect(MANIFEST_SCRIPT_BUDGETS.map((budget) => budget.file)).toEqual([CR_SCRIPT, ADN_SCRIPT]);
  });

  it('script isolé sans budget, budget sans script', () => {
    expect(checkManifestScriptBudgets({ content_scripts: [{ matches: CR, js: [CR_SCRIPT, 'src/content/content.iife.js'] }] })).toEqual([
      'src/content/content.iife.js : script isolé du manifeste sans budget',
      `script de contenu ADN (${ADN_SCRIPT}) absent du manifeste`,
    ]);
  });

  it('scripts du manifeste : ni scripts enregistrés d’une plateforme optionnelle, ni scripts injectés par l’extension, ni ponts MAIN', () => {
    for (const file of [CR_SCRIPT, ADN_SCRIPT]) {
      expect(registeredScriptPlatform(file), file).toBeNull();
      expect(isExtensionInjectedScript(file), file).toBe(false);
      expect(isMainWorldBridge(file), file).toBe(false);
    }
  });
});

describe('checkWebAccessibleResources', () => {
  it('manifeste conforme', () => {
    expect(checkWebAccessibleResources(base)).toEqual([]);
  });

  it('chunks du script Crunchyroll / ADN exposés à ses sites (chargeur ESM de crxjs) : la page détecterait l’extension', () => {
    expect(checkWebAccessibleResources({ ...base, web_accessible_resources: [crEntry, netflixEntry, disneyEntry, primeEntry] })).toEqual([
      'web_accessible_resources ["*://*.crunchyroll.com/*"] : ressources exposées aux sites des scripts du manifeste (*://*.crunchyroll.com/*)',
    ]);
  });

  it('scripts Netflix exposés à tous les sites (exposition par défaut de crxjs)', () => {
    const errors = checkWebAccessibleResources({ web_accessible_resources: [{ ...netflixEntry, matches: ['http://*/*', 'https://*/*'] }, disneyEntry, primeEntry] });
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toMatch(/tous les sites/);
    expect(errors.join('\n')).toMatch(/hors de/);
  });

  it('<all_urls>, repère crxjs non résolu, entrée Netflix mêlée, scripts Netflix absents', () => {
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ matches: ['<all_urls>'], resources: ['assets/x.js'] }] })).toEqual([
      'web_accessible_resources ["<all_urls>"] : ressources exposées à tous les sites',
      'web_accessible_resources : scripts Netflix (*.iife.js) absents',
      'web_accessible_resources : scripts Disney+ (*.iife.js) absents',
      'web_accessible_resources : scripts Prime Video (*.iife.js) absents',
    ]);
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ ...netflixEntry, resources: [...netflixEntry.resources, '<dynamic_resource>'] }, disneyEntry, primeEntry] })).toEqual([
      'web_accessible_resources ["*://*.netflix.com/*"] : ressource non résolue « <dynamic_resource> »',
      'web_accessible_resources ["*://*.netflix.com/*"] : entrée Netflix mêlée à d\'autres ressources',
    ]);
  });

  it('scripts de deux plateformes réunis sous l’union des motifs (sortie brute de crxjs)', () => {
    const merged = { matches: [NETFLIX_PATTERN, DISNEY_PATTERN], resources: [...netflixEntry.resources, ...disneyEntry.resources] };
    const errors = checkWebAccessibleResources({ web_accessible_resources: [merged, primeEntry] });
    expect(errors).toEqual([
      expect.stringMatching(/scripts Netflix .* exposés hors de \*:\/\/\*\.netflix\.com/),
      expect.stringMatching(/entrée Netflix mêlée/),
      expect.stringMatching(/scripts Disney\+ .* exposés hors de \*:\/\/\*\.disneyplus\.com/),
      expect.stringMatching(/entrée Disney\+ mêlée/),
    ]);
  });

  it('lecteurs de l’historique (injectés par la page d’import) exposés aux sites : refusés (sortie brute de crxjs)', () => {
    const history = 'src/content/history/history.iife.js';
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ ...netflixEntry, resources: [...netflixEntry.resources, history] }, disneyEntry, primeEntry] })).toEqual([
      `web_accessible_resources ["*://*.netflix.com/*"] : scripts injectés par l'extension exposés aux sites (${history})`,
      'web_accessible_resources ["*://*.netflix.com/*"] : entrée Netflix mêlée à d\'autres ressources',
    ]);
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ matches: [PRIME_PATTERN], resources: [history] }, netflixEntry, disneyEntry, primeEntry] })).toEqual([
      `web_accessible_resources ["${PRIME_PATTERN}"] : scripts injectés par l'extension exposés aux sites (${history})`,
    ]);
    expect(registeredScriptPlatform(history)).toBeNull();
    expect(isMainWorldBridge(history)).toBe(false);
  });

  it('scripts du manifeste (Crunchyroll, ADN) exposés à un site : refusés, aucune plateforme optionnelle ne les revendique', () => {
    expect(checkWebAccessibleResources({ ...base, web_accessible_resources: [{ matches: [PRIME_PATTERN], resources: [CR_SCRIPT, ADN_SCRIPT] }, netflixEntry, disneyEntry, primeEntry] })).toEqual([
      `web_accessible_resources ["${PRIME_PATTERN}"] : scripts sans plateforme connue (${CR_SCRIPT}, ${ADN_SCRIPT})`,
    ]);
  });

  it('plateforme d’un script enregistré : dossier connu uniquement', () => {
    expect(registeredScriptPlatform('src/content/disney/page-bridge.iife.js')).toBe('disney');
    expect(registeredScriptPlatform('src/content/netflix/content-netflix.iife.js')).toBe('netflix');
    expect(registeredScriptPlatform('src/content/prime/page-bridge.iife.js')).toBe('prime');
    expect(registeredScriptPlatform('src/content/hidive/a.iife.js')).toBeNull();
    expect(registeredScriptPlatform('assets/a.js')).toBeNull();
  });
});

describe('checkAccessDeclarations', () => {
  it('identique au manifeste source', () => {
    expect(checkAccessDeclarations(base, base)).toEqual([]);
  });

  it('permission ajoutée, Netflix déplacé en accès obligatoire ou en script de contenu', () => {
    const errors = checkAccessDeclarations(
      {
        ...base,
        permissions: ['storage', 'scripting', 'tabs'],
        host_permissions: [...CR, NETFLIX_PATTERN],
        optional_host_permissions: [],
        content_scripts: [{ matches: [...CR, NETFLIX_PATTERN] }],
      },
      base,
    );
    expect(errors).toHaveLength(9);
    expect(errors[0]).toMatch(/^permissions :/);
  });
});

describe('checkContentSecurityPolicy', () => {
  const csp = { extension_pages: "script-src 'self'; object-src 'self'; img-src 'self' https://s4.anilist.co" };

  it('identique au manifeste source', () => {
    expect(checkContentSecurityPolicy({ content_security_policy: csp }, { content_security_policy: csp })).toEqual([]);
  });

  it('retirée ou élargie par le build, absente du manifeste source', () => {
    expect(checkContentSecurityPolicy({}, { content_security_policy: csp })).toHaveLength(1);
    const wider = { extension_pages: `${csp.extension_pages} https:` };
    expect(checkContentSecurityPolicy({ content_security_policy: wider }, { content_security_policy: csp })[0]).toMatch(/^content_security_policy/);
    expect(checkContentSecurityPolicy({}, {})).toEqual(['content_security_policy.extension_pages absente du manifeste source']);
  });
});

describe('checkCommands', () => {
  const episode = { suggested_key: { default: 'Alt+Shift+K' }, description: '__MSG_cmdCompleteEpisode__' };
  const panel = { suggested_key: { default: 'Alt+Shift+1' }, description: '__MSG_cmdOpenSidePanel__' };
  const chromeBuilt: BuiltManifest = { side_panel: { default_path: 'src/sidepanel/sidepanel.html' }, commands: { 'complete-episode': episode, 'open-side-panel': panel } };
  const firefoxBuilt: BuiltManifest = {
    sidebar_action: { default_panel: 'src/sidepanel/sidepanel.html' },
    commands: { 'complete-episode': episode, _execute_sidebar_action: panel },
  };

  it('Chrome : open-side-panel ; Firefox : _execute_sidebar_action', () => {
    expect(checkCommands(chromeBuilt, chromeBuilt, 'chrome')).toEqual([]);
    expect(checkCommands(firefoxBuilt, firefoxBuilt, 'firefox')).toEqual([]);
  });

  it('Firefox livré avec la commande Chrome (non transformée) : refusé', () => {
    const errors = checkCommands(chromeBuilt, firefoxBuilt, 'firefox');
    expect(errors).toEqual([
      expect.stringMatching(/^commands : .* ≠ manifeste source/),
      'commands : _execute_sidebar_action absente (raccourci du panneau latéral, firefox)',
      'commands : open-side-panel inattendue sur firefox',
      'commands : _execute_sidebar_action sans sidebar_action',
    ]);
  });

  it('Firefox : touche suggérée sur une lettre d’accès des menus (EN, FR, DE) refusée, macOS exclu ; Chrome non concerné', () => {
    const commands = {
      'complete-episode': { suggested_key: { default: 'Alt+Shift+S', windows: 'Alt+H', mac: 'Alt+Shift+F' } },
      _execute_sidebar_action: { suggested_key: { default: 'Alt+Shift+P', linux: 'Alt+Shift+9' } },
    };
    const built: BuiltManifest = { ...firefoxBuilt, commands };
    expect(checkCommands(built, built, 'firefox')).toEqual([
      'commands : Alt+Shift+S (complete-episode) ouvre un menu de Firefox (lettre d’accès)',
      'commands : Alt+H (complete-episode) ouvre un menu de Firefox (lettre d’accès)',
      'commands : Alt+Shift+P (_execute_sidebar_action) ouvre un menu de Firefox (lettre d’accès)',
    ]);
    // Alt+Shift+chiffre accepté (Alt+Shift+1 : panneau latéral)
    expect(checkCommands(firefoxBuilt, firefoxBuilt, 'firefox')).toEqual([]);
    expect(checkCommands(chromeBuilt, chromeBuilt, 'chrome')).toEqual([]);
  });

  it('commandes retirées par le build', () => {
    expect(checkCommands({ side_panel: chromeBuilt.side_panel }, chromeBuilt, 'chrome')).toEqual([
      expect.stringMatching(/^commands : \{\} ≠/),
      'commands : open-side-panel absente (raccourci du panneau latéral, chrome)',
    ]);
  });

  it('plus de 4 touches suggérées, touche en double', () => {
    const commands = {
      'complete-episode': episode,
      'open-side-panel': panel,
      a: { suggested_key: { default: 'Alt+Shift+A' } },
      b: { suggested_key: { default: 'Alt+Shift+B' } },
      c: { suggested_key: { default: 'alt+shift+k' } },
    };
    const built: BuiltManifest = { ...chromeBuilt, commands };
    expect(checkCommands(built, built, 'chrome')).toEqual([
      'commands : 5 touches suggérées (Chrome en accepte 4 au plus)',
      'commands : alt+shift+k (default) suggérée pour complete-episode et c',
    ]);
  });
});

describe('fileReferences', () => {
  it('JS : imports relatifs, import() et chemins du paquet entre guillemets ou accents graves', () => {
    const code =
      'import{t as e}from"./guards-a.js";import"./side.js";const m=()=>import("./lazy.js");' +
      'chrome.runtime.getURL("assets/src-content.ts-b.js");x.getURL(`icons/icon-128.png`);' +
      "const p='src/content/netflix/page-bridge.iife.js',d=`icons/icon-${s}.png`,t='src/content/';";
    expect(fileReferences('assets/background.js', code)).toEqual([
      'assets/guards-a.js',
      'assets/lazy.js',
      'assets/side.js',
      'assets/src-content.ts-b.js',
      'icons/icon-128.png',
      'src/content/netflix/page-bridge.iife.js',
    ]);
    expect(fileReferences('service-worker-loader.js', "import './assets/background.js';\n")).toEqual(['assets/background.js']);
  });

  it('HTML (chemins absolus ou relatifs) et CSS (url), URL externes ignorées', () => {
    const html = '<script type="module" src="/assets/popup.js"></script><link href="./local.css"><a href="https://anilist.co">';
    expect(fileReferences('src/popup/popup.html', html)).toEqual(['assets/popup.js', 'src/popup/local.css']);
    const css = '@font-face{src:url(/assets/a.woff2) format("woff2"),url("./b.woff")}.x{background:url(data:image/png;base64,AA)}';
    expect(fileReferences('assets/popup.css', css)).toEqual(['assets/a.woff2', 'assets/b.woff']);
  });
});

describe('reachableFiles', () => {
  it('fermeture des références, cycles compris', () => {
    const graph: Record<string, string[]> = { a: ['b'], b: ['c', 'a'], c: [], d: ['a'] };
    expect([...reachableFiles(['a'], (file) => graph[file] ?? [])].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('checkUnreferencedFiles', () => {
  it('intermédiaires de crxjs refusés, langues de _locales acceptées', () => {
    const files = new Set(['manifest.json', 'assets/start-x.js', 'assets/page-bridge.iife.ts-y.js', '_locales/fr/messages.json']);
    expect(checkUnreferencedFiles(files, new Set(['manifest.json', 'assets/start-x.js']))).toEqual(['assets/page-bridge.iife.ts-y.js : fichier du paquet que rien ne référence']);
  });
});

describe('checkFontFormats', () => {
  it('woff2 seul : .woff de repli de @fontsource refusé', () => {
    expect(checkFontFormats(['assets/nunito-latin-400-normal-a.woff2', 'assets/nunito-latin-400-normal-b.woff', 'assets/x.css'])).toEqual([
      'assets/nunito-latin-400-normal-b.woff : police hors woff2',
    ]);
  });
});

describe('hasDynamicImport', () => {
  it('chargeur crxjs détecté, textes i18n ignorés', () => {
    expect(hasDynamicImport('(async()=>{await import(\n/* @vite-ignore */\nchrome.runtime.getURL("x.js"))})()')).toBe(true);
    expect(hasDynamicImport('(function(){var t={"a":`Open the Crunchyroll import (new tab)`}})()')).toBe(false);
  });
});

describe('checkLocaleCatalogs', () => {
  const FR = '{\n  "common.close": "Fermer"\n}\n';
  const PLACEHOLDER = '{\n  "common.close": "Close"\n}\n';
  /** Catalogues sources hors anglais : fr traduit, pt-BR et ja provisoires (copies identiques de l'anglais) */
  const sources = new Map([
    ['fr', FR],
    ['pt-BR', PLACEHOLDER],
    ['ja', PLACEHOLDER],
  ]);
  const reader = (contents: Record<string, string>) => (file: string): string => contents[file] ?? '';

  it('chaque langue dans un fichier référencé, contenus identiques regroupés en un seul fichier', () => {
    const files = new Set(['assets/locales/fr.json', 'assets/locales/ja.json', 'assets/background.js']);
    const read = reader({ 'assets/locales/fr.json': FR, 'assets/locales/ja.json': PLACEHOLDER });
    expect(checkLocaleCatalogs(files, files, sources, read)).toEqual([]);
    expect(localeCatalogFiles(files)).toEqual(['assets/locales/fr.json', 'assets/locales/ja.json']);
  });

  it('langue absente ou jamais référencée ; anglais dupliqué ; fichier sans catalogue source', () => {
    const files = new Set(['assets/locales/fr.json', 'assets/locales/en.json', 'assets/locales/xx.json']);
    const read = reader({ 'assets/locales/fr.json': FR, 'assets/locales/en.json': PLACEHOLDER, 'assets/locales/xx.json': '{}' });
    expect(checkLocaleCatalogs(files, new Set(['assets/locales/en.json']), sources, read)).toEqual([
      'catalogue fr (assets/locales/fr.json) jamais référencé par le code',
      'assets/locales/en.json : anglais dupliqué (déjà embarqué dans le code)',
      'assets/locales/xx.json : aucun catalogue source de ce contenu',
    ]);
    // Traduction modifiée après le build : le fichier du paquet ne correspond plus à la source
    expect(checkLocaleCatalogs(new Set(['assets/locales/fr.json']), new Set(['assets/locales/fr.json']), new Map([['fr', FR.replace('Fermer', 'Clore')]]), read)).toEqual([
      'catalogue fr absent de assets/locales/ (contenu de src/i18n/locales/fr.json)',
      'assets/locales/fr.json : aucun catalogue source de ce contenu',
    ]);
  });
});

describe('ponts du monde MAIN', () => {
  it('reconnaît les ponts passifs de chaque plateforme, pas les scripts isolés', () => {
    expect(isMainWorldBridge('src/content/netflix/page-bridge.iife.js')).toBe(true);
    expect(isMainWorldBridge('src/content/crunchyroll/page-bridge.iife.js')).toBe(true);
    expect(isMainWorldBridge('src/content/netflix/content-netflix.iife.js')).toBe(false);
    expect(isMainWorldBridge('assets/page-bridge.iife.ts-abc.js')).toBe(false);
  });

  it('signale les API d’extension, les en-têtes, les cookies et les stockages de la page', () => {
    const file = 'src/content/prime/page-bridge.iife.js';
    expect(checkMainWorldBridge(file, '(function(){const r=await fetch(u);return r.clone().json()})()')).toEqual([]);
    expect(checkMainWorldBridge(file, 'chrome.runtime.sendMessage(1)')).toEqual([`${file} : « chrome. » interdit dans un pont du monde MAIN`]);
    expect(checkMainWorldBridge(file, 'x.setRequestHeader(a,b);document.cookie;localStorage.getItem(k)').length).toBe(3);
    expect(checkMainWorldBridge(file, 'r.headers.get(`authorization`)')).toEqual([`${file} : « .headers » interdit dans un pont du monde MAIN`]);
  });
});

describe('marqueurs de build de développement', () => {
  it('signale la clé du diagnostic et les journaux [disney]', () => {
    expect(checkNoDevMarkers('assets/a.js', 'const a="[SyncKai:sync]"')).toEqual([]);
    expect(checkNoDevMarkers('assets/a.js', 'k="debug:matchDiagnostic";console.info(`[disney] x`)')).toHaveLength(2);
  });
});
