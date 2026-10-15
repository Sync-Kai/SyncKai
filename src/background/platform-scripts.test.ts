import { describe, expect, it } from 'vitest';
import { isOptionalPlatform, STREAMING_PLATFORMS } from '../platforms/registry';
import {
  injectIntoOpenTabs,
  platformContentScripts,
  platformScriptIds,
  reconcilePlatformScripts,
  SCRIPTED_PLATFORMS,
  touchesPlatform,
  type PlatformInjectionApi,
  type PlatformScriptingApi,
} from './platform-scripts';

const NETFLIX_SCRIPT_IDS = platformScriptIds('netflix');
const DISNEY_SCRIPT_IDS = platformScriptIds('disney');

const PATHS = { bridge: 'src/content/netflix/page-bridge.iife.js', content: 'src/content/netflix/content-netflix.iife.js' };

/** Faux navigateur : permission et scripts enregistrés en mémoire, appels relevés */
function fakeApi(granted: boolean, registered: string[]): PlatformScriptingApi & { calls: string[]; ids: Set<string> } {
  const ids = new Set(registered);
  const calls: string[] = [];
  return {
    calls,
    ids,
    hasAccess: () => Promise.resolve(granted),
    registeredIds: () => Promise.resolve([...ids]),
    register: (scripts) => {
      for (const script of scripts) {
        if (ids.has(script.id)) return Promise.reject(new Error(`Duplicate script ID '${script.id}'`));
        ids.add(script.id);
      }
      calls.push(`register:${scripts.map((s) => s.id).join(',')}`);
      return Promise.resolve();
    },
    unregister: (list) => {
      for (const id of list) ids.delete(id);
      calls.push(`unregister:${list.join(',')}`);
      return Promise.resolve();
    },
  };
}

const BOTH = [NETFLIX_SCRIPT_IDS.bridge, NETFLIX_SCRIPT_IDS.content];

describe('SCRIPTED_PLATFORMS', () => {
  it('= plateformes à accès optionnel du registre', () => {
    expect([...SCRIPTED_PLATFORMS]).toEqual(STREAMING_PLATFORMS.filter(isOptionalPlatform));
  });

  it('identifiants historiques de Netflix conservés (scripts déjà enregistrés retrouvés après mise à jour)', () => {
    expect(NETFLIX_SCRIPT_IDS).toEqual({ bridge: 'synckai-netflix-bridge', content: 'synckai-netflix-content' });
    expect(DISNEY_SCRIPT_IDS).toEqual({ bridge: 'synckai-disney-bridge', content: 'synckai-disney-content' });
    expect(platformScriptIds('prime')).toEqual({ bridge: 'synckai-prime-bridge', content: 'synckai-prime-content' });
  });
});

describe('platformContentScripts', () => {
  it('pont MAIN au plus tôt, script isolé à document_idle, netflix.com uniquement, conservés au redémarrage', () => {
    const [bridge, content] = platformContentScripts('netflix', PATHS);
    expect(bridge).toEqual({
      id: NETFLIX_SCRIPT_IDS.bridge,
      js: [PATHS.bridge],
      matches: ['*://*.netflix.com/*'],
      runAt: 'document_start',
      world: 'MAIN',
      allFrames: false,
      persistAcrossSessions: true,
    });
    expect(content).toEqual({
      id: NETFLIX_SCRIPT_IDS.content,
      js: [PATHS.content],
      matches: ['*://*.netflix.com/*'],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    });
  });
});

describe('reconcilePlatformScripts', () => {
  it('accès accordé, rien d’enregistré → les deux scripts', async () => {
    const api = fakeApi(true, []);
    expect(await reconcilePlatformScripts(api, 'netflix', PATHS, false)).toBe('registered');
    expect([...api.ids].sort()).toEqual([...BOTH].sort());
  });

  it('accès accordé, déjà enregistrés → inchangé, sauf réenregistrement demandé (mise à jour)', async () => {
    const api = fakeApi(true, [...BOTH, 'autre-script']);
    expect(await reconcilePlatformScripts(api, 'netflix', PATHS, false)).toBe('unchanged');
    expect(api.calls).toEqual([]);
    expect(await reconcilePlatformScripts(api, 'netflix', PATHS, true)).toBe('registered');
    expect(api.calls).toEqual([`unregister:${BOTH.join(',')}`, `register:${BOTH.join(',')}`]);
    // Les scripts d'autrui ne sont jamais touchés
    expect(api.ids.has('autre-script')).toBe(true);
  });

  it('enregistrement partiel → complété sans identifiant en double', async () => {
    const api = fakeApi(true, [NETFLIX_SCRIPT_IDS.content]);
    expect(await reconcilePlatformScripts(api, 'netflix', PATHS, false)).toBe('registered');
    expect(api.ids.size).toBe(2);
  });

  it('accès retiré → scripts retirés ; rien d’enregistré → inchangé', async () => {
    const api = fakeApi(false, [...BOTH]);
    expect(await reconcilePlatformScripts(api, 'netflix', PATHS, true)).toBe('unregistered');
    expect(api.ids.size).toBe(0);
    expect(await reconcilePlatformScripts(fakeApi(false, ['autre-script']), 'netflix', PATHS, true)).toBe('unchanged');
  });
});

describe('reconcilePlatformScripts — Disney+', () => {
  const DISNEY_PATHS = { bridge: 'src/content/disney/page-bridge.iife.js', content: 'src/content/disney/content-disney.iife.js' };
  const DISNEY = [DISNEY_SCRIPT_IDS.bridge, DISNEY_SCRIPT_IDS.content];

  it('pont MAIN à document_start et script isolé sur disneyplus.com uniquement', () => {
    const scripts = platformContentScripts('disney', DISNEY_PATHS);
    expect(scripts.map((script) => [script.id, script.js, script.matches, script.runAt, script.world])).toEqual([
      [DISNEY_SCRIPT_IDS.bridge, [DISNEY_PATHS.bridge], ['*://*.disneyplus.com/*'], 'document_start', 'MAIN'],
      [DISNEY_SCRIPT_IDS.content, [DISNEY_PATHS.content], ['*://*.disneyplus.com/*'], 'document_idle', undefined],
    ]);
  });

  it('chaque plateforme ne touche que ses propres scripts', async () => {
    const api = fakeApi(true, [...BOTH]);
    expect(await reconcilePlatformScripts(api, 'disney', DISNEY_PATHS, false)).toBe('registered');
    expect([...api.ids].sort()).toEqual([...BOTH, ...DISNEY].sort());
    const revoked = fakeApi(false, [...BOTH, ...DISNEY]);
    expect(await reconcilePlatformScripts(revoked, 'disney', DISNEY_PATHS, true)).toBe('unregistered');
    expect([...revoked.ids].sort()).toEqual([...BOTH].sort());
  });

  it('Prime Video : pont MAIN à document_start et script isolé sur primevideo.com uniquement', () => {
    const paths = { bridge: 'src/content/prime/page-bridge.iife.js', content: 'src/content/prime/content-prime.iife.js' };
    expect(platformContentScripts('prime', paths).map((script) => [script.id, script.matches, script.runAt, script.world])).toEqual([
      ['synckai-prime-bridge', ['*://*.primevideo.com/*'], 'document_start', 'MAIN'],
      ['synckai-prime-content', ['*://*.primevideo.com/*'], 'document_idle', undefined],
    ]);
    expect(touchesPlatform('prime', { origins: ['*://*.primevideo.com/*'] })).toBe(true);
    expect(touchesPlatform('prime', { origins: ['*://*.disneyplus.com/*'] })).toBe(false);
  });

  it('ne réagit qu’à l’origine Disney+', () => {
    expect(touchesPlatform('disney', { origins: ['*://*.disneyplus.com/*'] })).toBe(true);
    expect(touchesPlatform('disney', { origins: ['*://*.netflix.com/*'] })).toBe(false);
    expect(touchesPlatform('netflix', { origins: ['*://*.disneyplus.com/*'] })).toBe(false);
  });
});

describe('touchesPlatform', () => {
  it('ne réagit qu’à l’origine Netflix', () => {
    expect(touchesPlatform('netflix', { origins: ['*://*.netflix.com/*'] })).toBe(true);
    expect(touchesPlatform('netflix', { origins: ['*://*.crunchyroll.com/*'] })).toBe(false);
    expect(touchesPlatform('netflix', { permissions: ['scripting'] } as { origins?: string[] })).toBe(false);
    expect(touchesPlatform('netflix', {})).toBe(false);
  });
});

/** Faux navigateur pour l'injection : onglets ouverts, onglets en échec, appels relevés */
function fakeInjection(granted: boolean, tabIds: number[], failing: number[] = []): PlatformInjectionApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    hasAccess: () => Promise.resolve(granted),
    tabIds: () => Promise.resolve(tabIds),
    inject: (tabId, file, world) => {
      if (failing.includes(tabId)) return Promise.reject(new Error('Frame with ID 0 was removed.'));
      calls.push(`${tabId}:${world}:${file}`);
      return Promise.resolve();
    },
  };
}

describe('injectIntoOpenTabs', () => {
  it('chaque onglet ouvert : pont MAIN puis script isolé', async () => {
    const api = fakeInjection(true, [7, 9]);
    expect(await injectIntoOpenTabs(api, PATHS, () => undefined)).toBe(2);
    for (const tabId of [7, 9]) {
      expect(api.calls.filter((call) => call.startsWith(`${tabId}:`))).toEqual([`${tabId}:MAIN:${PATHS.bridge}`, `${tabId}:ISOLATED:${PATHS.content}`]);
    }
  });

  it('onglet en échec (déchargé, page d’erreur) : signalé, les autres onglets sont traités', async () => {
    const api = fakeInjection(true, [3, 4], [3]);
    const errors: (number | null)[] = [];
    expect(await injectIntoOpenTabs(api, PATHS, (tabId) => errors.push(tabId))).toBe(1);
    expect(errors).toEqual([3]);
    expect(api.calls).toEqual([`4:MAIN:${PATHS.bridge}`, `4:ISOLATED:${PATHS.content}`]);
  });

  it('accès absent (retiré entre-temps) ou aucun onglet : rien n’est exécuté', async () => {
    const denied = fakeInjection(false, [1]);
    expect(await injectIntoOpenTabs(denied, PATHS, () => undefined)).toBe(0);
    expect(denied.calls).toEqual([]);
    expect(await injectIntoOpenTabs(fakeInjection(true, []), PATHS, () => undefined)).toBe(0);
  });

  it('lecture des onglets impossible : signalée, jamais d’exception', async () => {
    const api: PlatformInjectionApi = { ...fakeInjection(true, []), tabIds: () => Promise.reject(new Error('boom')) };
    const errors: (number | null)[] = [];
    expect(await injectIntoOpenTabs(api, PATHS, (tabId) => errors.push(tabId))).toBe(0);
    expect(errors).toEqual([null]);
  });
});
