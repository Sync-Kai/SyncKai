// Enregistrement des scripts Netflix (logique pure, API du navigateur injectée : testable sans chrome.*).
// Branché sur chrome.scripting et chrome.permissions par netflix-access.ts.
import { NETFLIX_MATCHES } from '../shared/target-pages';

/** Identifiants des scripts enregistrés (stables : servent à les retrouver et à les retirer) */
export const NETFLIX_SCRIPT_IDS = { bridge: 'synckai-netflix-bridge', content: 'synckai-netflix-content' } as const;

const OWN_IDS: readonly string[] = Object.values(NETFLIX_SCRIPT_IDS);

/** Chemins des scripts dans le paquet (fournis par le build via `?script`) */
export interface NetflixScriptPaths {
  bridge: string;
  content: string;
}

/**
 * - Pont MAIN à `document_start` : son écouteur est posé avant que la page ne s'exécute et bien avant toute
 *   demande du script isolé (il ne lit rien dans le DOM : aucun coût d'attente).
 * - Script isolé à `document_idle`, comme les scripts du manifeste (Crunchyroll / ADN) : DOM prêt, chargement
 *   de la page non ralenti. Tout netflix.com (pas seulement /watch) : Netflix est une SPA, on arrive au lecteur
 *   depuis l'accueil sans rechargement. Cadre principal uniquement.
 */
export function netflixContentScripts(paths: NetflixScriptPaths): chrome.scripting.RegisteredContentScript[] {
  const common = { matches: [...NETFLIX_MATCHES], allFrames: false, persistAcrossSessions: true };
  return [
    { ...common, id: NETFLIX_SCRIPT_IDS.bridge, js: [paths.bridge], runAt: 'document_start', world: 'MAIN' },
    { ...common, id: NETFLIX_SCRIPT_IDS.content, js: [paths.content], runAt: 'document_idle' },
  ];
}

/** Sous-ensemble de chrome.permissions / chrome.scripting utilisé par la réconciliation */
export interface NetflixScriptingApi {
  hasAccess(): Promise<boolean>;
  registeredIds(): Promise<string[]>;
  register(scripts: chrome.scripting.RegisteredContentScript[]): Promise<void>;
  unregister(ids: string[]): Promise<void>;
}

export type ReconcileResult = 'registered' | 'unregistered' | 'unchanged';

/**
 * Aligne les scripts enregistrés sur la permission : accordée → les deux scripts, retirée → aucun.
 * `reregister` (installation, mise à jour) : réenregistrés même s'ils existent (chemins propres au build).
 */
export async function reconcileNetflixScripts(api: NetflixScriptingApi, paths: NetflixScriptPaths, reregister: boolean): Promise<ReconcileResult> {
  const [granted, ids] = await Promise.all([api.hasAccess(), api.registeredIds()]);
  const existing = ids.filter((id) => OWN_IDS.includes(id));
  if (!granted) {
    if (existing.length === 0) return 'unchanged';
    await api.unregister(existing);
    return 'unregistered';
  }
  if (!reregister && existing.length === OWN_IDS.length) return 'unchanged';
  if (existing.length > 0) await api.unregister(existing);
  await api.register(netflixContentScripts(paths));
  return 'registered';
}

/** true si un changement de permissions concerne Netflix (les autres sont ignorés sans rien lire) */
export function touchesNetflix(permissions: { origins?: string[] }): boolean {
  return (permissions.origins ?? []).some((origin) => NETFLIX_MATCHES.includes(origin));
}

// ─── Onglets déjà ouverts ─────────────────────────────────────────────────

/** Sous-ensemble de chrome.tabs / chrome.scripting utilisé pour l'injection dans les onglets ouverts */
export interface NetflixInjectionApi {
  hasAccess(): Promise<boolean>;
  /** Onglets netflix.com ouverts (tabs.query par URL : permission d'hôte suffisante, sans `tabs`) */
  netflixTabIds(): Promise<number[]>;
  /** Exécute un fichier du paquet dans la frame principale de l'onglet */
  inject(tabId: number, file: string, world: 'MAIN' | 'ISOLATED'): Promise<void>;
}

/**
 * Accès tout juste accordé : les scripts enregistrés ne s'appliquent qu'aux pages chargées ensuite, ils sont
 * donc exécutés dans les onglets Netflix déjà ouverts (pont MAIN d'abord, puis script isolé : le pont doit
 * écouter avant la première demande). Les deux scripts se protègent d'une double exécution.
 * Un onglet en échec (déchargé, page d'erreur…) n'empêche pas les autres : `onError`, jamais d'exception.
 * Retourne le nombre d'onglets où les deux scripts ont été exécutés.
 */
export async function injectIntoOpenNetflixTabs(
  api: NetflixInjectionApi,
  paths: NetflixScriptPaths,
  onError: (tabId: number | null, error: unknown) => void,
): Promise<number> {
  let tabIds: number[];
  try {
    if (!(await api.hasAccess())) return 0;
    tabIds = await api.netflixTabIds();
  } catch (error: unknown) {
    onError(null, error);
    return 0;
  }
  const results = await Promise.all(
    tabIds.map(async (tabId) => {
      try {
        await api.inject(tabId, paths.bridge, 'MAIN');
        await api.inject(tabId, paths.content, 'ISOLATED');
        return true;
      } catch (error: unknown) {
        onError(tabId, error);
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}
