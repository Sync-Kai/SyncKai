import { describe, expect, it } from 'vitest';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS } from '../platforms/registry';
import {
  assetFileName,
  BACKGROUND_CHUNK_FILE,
  DEFAULT_ASSET_FILE,
  DEFAULT_CHUNK_FILE,
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

  it('dossier inconnu ou fichier hors src/content/{dossier}/ : inchangé', () => {
    const entry = { matches: ['*://*.netflix.com/*'], resources: ['src/content/hidive/a.iife.js', 'src/content/a.iife.js'] };
    expect(splitRegisteredScripts([entry])).toEqual([entry]);
  });

  it('motifs identiques au registre des plateformes', () => {
    expect(Object.keys(REGISTERED_SCRIPT_MATCHES)).toEqual(STREAMING_PLATFORMS.filter(isOptionalPlatform));
    for (const platform of STREAMING_PLATFORMS.filter(isOptionalPlatform)) {
      expect(REGISTERED_SCRIPT_MATCHES[platform]).toEqual(PLATFORMS[platform].optionalMatches);
    }
  });
});
