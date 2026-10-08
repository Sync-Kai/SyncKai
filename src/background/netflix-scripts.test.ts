import { describe, expect, it } from 'vitest';
import {
  injectIntoOpenNetflixTabs,
  NETFLIX_SCRIPT_IDS,
  netflixContentScripts,
  reconcileNetflixScripts,
  touchesNetflix,
  type NetflixInjectionApi,
  type NetflixScriptingApi,
} from './netflix-scripts';

const PATHS = { bridge: 'src/content/netflix/page-bridge.iife.js', content: 'src/content/netflix/content-netflix.iife.js' };

/** Faux navigateur : permission et scripts enregistrés en mémoire, appels relevés */
function fakeApi(granted: boolean, registered: string[]): NetflixScriptingApi & { calls: string[]; ids: Set<string> } {
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

describe('netflixContentScripts', () => {
  it('pont MAIN au plus tôt, script isolé à document_idle, netflix.com uniquement, conservés au redémarrage', () => {
    const [bridge, content] = netflixContentScripts(PATHS);
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

describe('reconcileNetflixScripts', () => {
  it('accès accordé, rien d’enregistré → les deux scripts', async () => {
    const api = fakeApi(true, []);
    expect(await reconcileNetflixScripts(api, PATHS, false)).toBe('registered');
    expect([...api.ids].sort()).toEqual([...BOTH].sort());
  });

  it('accès accordé, déjà enregistrés → inchangé, sauf réenregistrement demandé (mise à jour)', async () => {
    const api = fakeApi(true, [...BOTH, 'autre-script']);
    expect(await reconcileNetflixScripts(api, PATHS, false)).toBe('unchanged');
    expect(api.calls).toEqual([]);
    expect(await reconcileNetflixScripts(api, PATHS, true)).toBe('registered');
    expect(api.calls).toEqual([`unregister:${BOTH.join(',')}`, `register:${BOTH.join(',')}`]);
    // Les scripts d'autrui ne sont jamais touchés
    expect(api.ids.has('autre-script')).toBe(true);
  });

  it('enregistrement partiel → complété sans identifiant en double', async () => {
    const api = fakeApi(true, [NETFLIX_SCRIPT_IDS.content]);
    expect(await reconcileNetflixScripts(api, PATHS, false)).toBe('registered');
    expect(api.ids.size).toBe(2);
  });

  it('accès retiré → scripts retirés ; rien d’enregistré → inchangé', async () => {
    const api = fakeApi(false, [...BOTH]);
    expect(await reconcileNetflixScripts(api, PATHS, true)).toBe('unregistered');
    expect(api.ids.size).toBe(0);
    expect(await reconcileNetflixScripts(fakeApi(false, ['autre-script']), PATHS, true)).toBe('unchanged');
  });
});

describe('touchesNetflix', () => {
  it('ne réagit qu’à l’origine Netflix', () => {
    expect(touchesNetflix({ origins: ['*://*.netflix.com/*'] })).toBe(true);
    expect(touchesNetflix({ origins: ['*://*.crunchyroll.com/*'] })).toBe(false);
    expect(touchesNetflix({ permissions: ['scripting'] } as { origins?: string[] })).toBe(false);
    expect(touchesNetflix({})).toBe(false);
  });
});

/** Faux navigateur pour l'injection : onglets ouverts, onglets en échec, appels relevés */
function fakeInjection(granted: boolean, tabIds: number[], failing: number[] = []): NetflixInjectionApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    hasAccess: () => Promise.resolve(granted),
    netflixTabIds: () => Promise.resolve(tabIds),
    inject: (tabId, file, world) => {
      if (failing.includes(tabId)) return Promise.reject(new Error('Frame with ID 0 was removed.'));
      calls.push(`${tabId}:${world}:${file}`);
      return Promise.resolve();
    },
  };
}

describe('injectIntoOpenNetflixTabs', () => {
  it('chaque onglet ouvert : pont MAIN puis script isolé', async () => {
    const api = fakeInjection(true, [7, 9]);
    expect(await injectIntoOpenNetflixTabs(api, PATHS, () => undefined)).toBe(2);
    for (const tabId of [7, 9]) {
      expect(api.calls.filter((call) => call.startsWith(`${tabId}:`))).toEqual([`${tabId}:MAIN:${PATHS.bridge}`, `${tabId}:ISOLATED:${PATHS.content}`]);
    }
  });

  it('onglet en échec (déchargé, page d’erreur) : signalé, les autres onglets sont traités', async () => {
    const api = fakeInjection(true, [3, 4], [3]);
    const errors: (number | null)[] = [];
    expect(await injectIntoOpenNetflixTabs(api, PATHS, (tabId) => errors.push(tabId))).toBe(1);
    expect(errors).toEqual([3]);
    expect(api.calls).toEqual([`4:MAIN:${PATHS.bridge}`, `4:ISOLATED:${PATHS.content}`]);
  });

  it('accès absent (retiré entre-temps) ou aucun onglet : rien n’est exécuté', async () => {
    const denied = fakeInjection(false, [1]);
    expect(await injectIntoOpenNetflixTabs(denied, PATHS, () => undefined)).toBe(0);
    expect(denied.calls).toEqual([]);
    expect(await injectIntoOpenNetflixTabs(fakeInjection(true, []), PATHS, () => undefined)).toBe(0);
  });

  it('lecture des onglets impossible : signalée, jamais d’exception', async () => {
    const api: NetflixInjectionApi = { ...fakeInjection(true, []), netflixTabIds: () => Promise.reject(new Error('boom')) };
    const errors: (number | null)[] = [];
    expect(await injectIntoOpenNetflixTabs(api, PATHS, (tabId) => errors.push(tabId))).toBe(0);
    expect(errors).toEqual([null]);
  });
});
