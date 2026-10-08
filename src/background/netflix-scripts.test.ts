import { describe, expect, it } from 'vitest';
import { NETFLIX_SCRIPT_IDS, netflixContentScripts, reconcileNetflixScripts, touchesNetflix, type NetflixScriptingApi } from './netflix-scripts';

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
