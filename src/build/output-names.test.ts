import { describe, expect, it } from 'vitest';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS } from '../platforms/registry';
import {
  assetFileName,
  BACKGROUND_CHUNK_FILE,
  crxIifeIntermediates,
  DEFAULT_ASSET_FILE,
  DEFAULT_CHUNK_FILE,
  dropExtensionInjectedScripts,
  IMPORT_CR_CHUNK_FILE,
  isExtensionInjectedScript,
  jsFileNames,
  REGISTERED_SCRIPT_MATCHES,
  sortWebAccessibleResources,
  splitRegisteredScripts,
} from './output-names';

describe('assetFileName', () => {
  it('catalogues de traduction : nom fixe assets/locales/<code>.json (chemin absolu ou relatif, POSIX ou Windows)', () => {
    expect(assetFileName({ originalFileNames: ['src/i18n/locales/pt-BR.json'] })).toBe('assets/locales/[name][extname]');
    expect(assetFileName({ originalFileNames: ['/home/runner/work/SyncKai/SyncKai/src/i18n/locales/es-419.json'] })).toBe('assets/locales/[name][extname]');
    expect(assetFileName({ originalFileNames: ['C:\\Users\\x\\SyncKai\\src\\i18n\\locales\\ja.json'] })).toBe('assets/locales/[name][extname]');
  });

  it('autres fichiers : nom haché par défaut', () => {
    expect(assetFileName({ originalFileNames: ['src/popup/popup.css'] })).toBe(DEFAULT_ASSET_FILE);
    expect(assetFileName({ originalFileNames: ['src/i18n/locales/notes/ja.json'] })).toBe(DEFAULT_ASSET_FILE);
    expect(assetFileName({ originalFileNames: ['public/_locales/fr/messages.json'] })).toBe(DEFAULT_ASSET_FILE);
    expect(assetFileName({ originalFileNames: [] })).toBe(DEFAULT_ASSET_FILE);
  });
});

describe('jsFileNames', () => {
  const name = jsFileNames('src/background/background.ts');

  it('service worker : nom fixe, quel que soit le dossier (POSIX ou Windows)', () => {
    expect(name({ facadeModuleId: '/home/runner/work/SyncKai/SyncKai/src/background/background.ts' })).toBe(BACKGROUND_CHUNK_FILE);
    expect(name({ facadeModuleId: 'C:\\Users\\x\\autre-dossier\\src\\background\\background.ts' })).toBe(BACKGROUND_CHUNK_FILE);
  });

  it('autres chunks : nom haché par défaut', () => {
    expect(name({ facadeModuleId: '/repo/src/popup/popup.ts' })).toBe(DEFAULT_CHUNK_FILE);
    expect(name({ facadeModuleId: '/repo/src/other/src/background/background.tsx' })).toBe(DEFAULT_CHUNK_FILE);
    expect(name({ facadeModuleId: null })).toBe(DEFAULT_CHUNK_FILE);
  });

  it('page d’import d’historique (import `?script` des lecteurs) : nom fixe, quel que soit le dossier', () => {
    expect(name({ facadeModuleId: '/home/runner/work/SyncKai/SyncKai/src/import-cr/import-cr.html' })).toBe(IMPORT_CR_CHUNK_FILE);
    expect(name({ facadeModuleId: 'C:\\Users\\x\\autre-dossier\\src\\import-cr\\import-cr.html' })).toBe(IMPORT_CR_CHUNK_FILE);
    expect(name({ facadeModuleId: '/repo/src/import-cr/import-cr.ts' })).toBe(DEFAULT_CHUNK_FILE);
  });

  it('chemin source préfixé par ./', () => {
    expect(jsFileNames('./src/background/background.ts')({ facadeModuleId: '/r/src/background/background.ts' })).toBe(BACKGROUND_CHUNK_FILE);
  });
});

describe('sortWebAccessibleResources', () => {
  it('trie les ressources de chaque entrée sans réordonner les entrées ni modifier l’original', () => {
    const entries = [
      { matches: ['*://*.netflix.com/*'], resources: ['src/b.iife.js', 'src/a.iife.js'] },
      { matches: ['*://*.crunchyroll.com/*'], resources: ['assets/z.js', 'assets/m.js'] },
    ];
    expect(sortWebAccessibleResources(entries)).toEqual([
      { matches: ['*://*.netflix.com/*'], resources: ['src/a.iife.js', 'src/b.iife.js'] },
      { matches: ['*://*.crunchyroll.com/*'], resources: ['assets/m.js', 'assets/z.js'] },
    ]);
    expect(entries[0]?.resources).toEqual(['src/b.iife.js', 'src/a.iife.js']);
  });
});

describe('dropExtensionInjectedScripts', () => {
  const history = 'src/content/history/history.iife.js';

  it('lecteurs de l’historique retirés de toute entrée ; entrée vidée supprimée ; reste inchangé', () => {
    const merged = { matches: ['*://*.netflix.com/*', '*://*.disneyplus.com/*'], resources: ['src/content/netflix/page-bridge.iife.js', history], use_dynamic_url: false };
    const alone = { matches: ['*://*.primevideo.com/*'], resources: [history] };
    const other = { matches: ['*://*.netflix.com/*'], resources: ['assets/a.js'] };
    expect(dropExtensionInjectedScripts([merged, alone, other])).toEqual([{ ...merged, resources: ['src/content/netflix/page-bridge.iife.js'] }, other]);
  });

  it('script injecté : dossier history/ de src/content seulement', () => {
    expect(isExtensionInjectedScript(history)).toBe(true);
    expect(isExtensionInjectedScript('src/content/netflix/content-netflix.iife.js')).toBe(false);
    expect(isExtensionInjectedScript('src/content/history.iife.js')).toBe(false);
    expect(isExtensionInjectedScript('assets/history.iife.ts-DB6mW7yU.js')).toBe(false);
  });
});

describe('splitRegisteredScripts', () => {
  it('une entrée par plateforme, limitée à ses motifs ; autres ressources laissées en place', () => {
    const merged = {
      matches: ['*://*.netflix.com/*', '*://*.disneyplus.com/*'],
      resources: ['src/content/netflix/page-bridge.iife.js', 'src/content/disney/page-bridge.iife.js', 'src/content/disney/content-disney.iife.js', 'assets/x.js'],
      use_dynamic_url: false,
    };
    const other = { matches: ['*://*.crunchyroll.com/*'], resources: ['assets/a.js'] };
    expect(splitRegisteredScripts([other, merged])).toEqual([
      other,
      { matches: ['*://*.netflix.com/*', '*://*.disneyplus.com/*'], resources: ['assets/x.js'], use_dynamic_url: false },
      { matches: ['*://*.netflix.com/*'], resources: ['src/content/netflix/page-bridge.iife.js'], use_dynamic_url: false },
      { matches: ['*://*.disneyplus.com/*'], resources: ['src/content/disney/page-bridge.iife.js', 'src/content/disney/content-disney.iife.js'], use_dynamic_url: false },
    ]);
  });

  it('dossier inconnu, fichier hors src/content/{dossier}/ ou script du manifeste (Crunchyroll, ADN) : inchangé', () => {
    const entry = { matches: ['*://*.netflix.com/*'], resources: ['src/content/hidive/a.iife.js', 'src/content/a.iife.js'] };
    expect(splitRegisteredScripts([entry])).toEqual([entry]);
    const manifestScripts = { matches: ['*://*.netflix.com/*'], resources: ['src/content/crunchyroll/content-crunchyroll.iife.js', 'src/content/adn/content-adn.iife.js'] };
    expect(splitRegisteredScripts([manifestScripts])).toEqual([manifestScripts]);
    expect(isExtensionInjectedScript('src/content/adn/content-adn.iife.js')).toBe(false);
  });

  it('motifs identiques au registre des plateformes', () => {
    expect(Object.keys(REGISTERED_SCRIPT_MATCHES)).toEqual(STREAMING_PLATFORMS.filter(isOptionalPlatform));
    for (const platform of STREAMING_PLATFORMS.filter(isOptionalPlatform)) {
      expect(REGISTERED_SCRIPT_MATCHES[platform]).toEqual(PLATFORMS[platform].optionalMatches);
    }
  });
});

describe('crxIifeIntermediates', () => {
  it('chunk du build principal d’un script IIFE et chunks qu’il est seul à importer ; partagés avec une page conservés', () => {
    const bundle = {
      'assets/page-bridge.iife.ts-a.js': { type: 'chunk', isEntry: true, facadeModuleId: 'C:\\repo\\src\\content\\netflix\\page-bridge.iife.ts', imports: ['assets/bridge-protocol-b.js'] },
      'assets/bridge-protocol-b.js': { type: 'chunk', imports: [] },
      'assets/content-netflix.iife.ts-c.js': { type: 'chunk', isEntry: true, facadeModuleId: '/repo/src/content/netflix/content-netflix.iife.ts', imports: ['assets/start-d.js', 'assets/title-e.js'] },
      'assets/start-d.js': { type: 'chunk', imports: ['assets/title-e.js'] },
      'assets/title-e.js': { type: 'chunk', imports: [] },
      'assets/popup-f.js': { type: 'chunk', isEntry: true, facadeModuleId: '/repo/src/popup/popup.html', imports: ['assets/title-e.js'] },
      'src/content/netflix/page-bridge.iife.js': { type: 'asset' },
      'assets/popup-g.css': { type: 'asset' },
    } as const;
    expect(crxIifeIntermediates(bundle)).toEqual(['assets/bridge-protocol-b.js', 'assets/content-netflix.iife.ts-c.js', 'assets/page-bridge.iife.ts-a.js', 'assets/start-d.js']);
  });

  it('aucun script IIFE : rien à retirer', () => {
    expect(crxIifeIntermediates({ 'assets/popup-f.js': { type: 'chunk', isEntry: true, facadeModuleId: '/repo/src/popup/popup.html' } })).toEqual([]);
  });
});
