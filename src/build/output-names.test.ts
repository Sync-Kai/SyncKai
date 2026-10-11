import { describe, expect, it } from 'vitest';
import { BACKGROUND_CHUNK_FILE, DEFAULT_CHUNK_FILE, jsFileNames, sortWebAccessibleResources } from './output-names';

describe('jsFileNames', () => {
  const name = jsFileNames('src/background/background.ts');

  it('service worker : nom fixe, quel que soit le dossier (POSIX ou Windows)', () => {
    expect(name({ facadeModuleId: '/home/runner/work/SyncKai/SyncKai/src/background/background.ts' })).toBe(BACKGROUND_CHUNK_FILE);
    expect(name({ facadeModuleId: 'C:\\Users\\x\\autre-dossier\\src\\background\\background.ts' })).toBe(BACKGROUND_CHUNK_FILE);
  });

  it('autres chunks : nom haché par défaut', () => {
    expect(name({ facadeModuleId: '/repo/src/content/content.ts' })).toBe(DEFAULT_CHUNK_FILE);
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
