// Enregistrement des scripts des plateformes à accès optionnel (Netflix, Disney+, Prime Video) : logique pure, API du navigateur
// injectée (testable sans chrome.*). Branché sur chrome.scripting et chrome.permissions par platform-access.ts.
// Chaque plateforme a deux scripts : un pont dans le monde MAIN de la page et le script de contenu isolé.
import { PLATFORMS, type StreamingPlatform } from '../shared/platforms';

/** Plateformes dont les scripts sont enregistrés à la demande (`optionalMatches` non vide dans le registre) */
export const SCRIPTED_PLATFORMS = ['netflix', 'disney', 'prime'] as const satisfies readonly StreamingPlatform[];

export type ScriptedPlatform = (typeof SCRIPTED_PLATFORMS)[number];

/** Identifiants des scripts enregistrés (stables : servent à les retrouver et à les retirer) */
export function platformScriptIds(platform: ScriptedPlatform): { bridge: string; content: string } {
  return { bridge: `synckai-${platform}-bridge`, content: `synckai-${platform}-content` };
}

/** Motifs de la plateforme (= sa permission optionnelle) */
export function platformMatches(platform: ScriptedPlatform): string[] {
  return [...PLATFORMS[platform].optionalMatches];
}

/** Chemins des scripts dans le paquet (fournis par le build via `?script`) */
export interface PlatformScriptPaths {
  bridge: string;
  content: string;
}

/**
 * - Pont MAIN à `document_start` : son écouteur (Netflix) ou son observateur de requêtes (Disney+, Prime Video) est posé avant
 *   que la page ne s'exécute et bien avant toute demande du script isolé.
 * - Script isolé à `document_idle`, comme les scripts du manifeste (Crunchyroll / ADN) : DOM prêt, chargement
 *   de la page non ralenti. Tout le site (pas seulement le lecteur) : SPA, on arrive au lecteur depuis l'accueil
 *   sans rechargement. Cadre principal uniquement.
 */
export function platformContentScripts(platform: ScriptedPlatform, paths: PlatformScriptPaths): chrome.scripting.RegisteredContentScript[] {
  const ids = platformScriptIds(platform);
  const common = { matches: platformMatches(platform), allFrames: false, persistAcrossSessions: true };
  return [
    { ...common, id: ids.bridge, js: [paths.bridge], runAt: 'document_start', world: 'MAIN' },
    { ...common, id: ids.content, js: [paths.content], runAt: 'document_idle' },
  ];
}

/** Sous-ensemble de chrome.permissions / chrome.scripting utilisé par la réconciliation (une plateforme) */
export interface PlatformScriptingApi {
  hasAccess(): Promise<boolean>;
  registeredIds(): Promise<string[]>;
  register(scripts: chrome.scripting.RegisteredContentScript[]): Promise<void>;
  unregister(ids: string[]): Promise<void>;
}

export type ReconcileResult = 'registered' | 'unregistered' | 'unchanged';

/**
 * Aligne les scripts enregistrés de la plateforme sur sa permission : accordée → les deux scripts, retirée → aucun.
 * `reregister` (installation, mise à jour) : réenregistrés même s'ils existent (chemins propres au build).
 * Les scripts des autres plateformes (et d'autrui) ne sont jamais touchés.
 */
export async function reconcilePlatformScripts(
  api: PlatformScriptingApi,
  platform: ScriptedPlatform,
  paths: PlatformScriptPaths,
  reregister: boolean,
): Promise<ReconcileResult> {
  const own: readonly string[] = Object.values(platformScriptIds(platform));
  const [granted, ids] = await Promise.all([api.hasAccess(), api.registeredIds()]);
  const existing = ids.filter((id) => own.includes(id));
  if (!granted) {
    if (existing.length === 0) return 'unchanged';
    await api.unregister(existing);
    return 'unregistered';
  }
  if (!reregister && existing.length === own.length) return 'unchanged';
  if (existing.length > 0) await api.unregister(existing);
  await api.register(platformContentScripts(platform, paths));
  return 'registered';
}

/** true si un changement de permissions concerne la plateforme (les autres sont ignorés sans rien lire) */
export function touchesPlatform(platform: ScriptedPlatform, permissions: { origins?: string[] }): boolean {
  const matches = platformMatches(platform);
  return (permissions.origins ?? []).some((origin) => matches.includes(origin));
}

// ─── Onglets déjà ouverts ─────────────────────────────────────────────────

/** Sous-ensemble de chrome.tabs / chrome.scripting utilisé pour l'injection dans les onglets ouverts (une plateforme) */
export interface PlatformInjectionApi {
  hasAccess(): Promise<boolean>;
  /** Onglets ouverts sur la plateforme (tabs.query par URL : permission d'hôte suffisante, sans `tabs`) */
  tabIds(): Promise<number[]>;
  /** Exécute un fichier du paquet dans la frame principale de l'onglet */
  inject(tabId: number, file: string, world: 'MAIN' | 'ISOLATED'): Promise<void>;
}

/**
 * Accès tout juste accordé, ou extension mise à jour : les scripts enregistrés ne s'appliquent qu'aux pages
 * chargées ensuite, ils sont donc exécutés dans les onglets déjà ouverts de la plateforme (pont MAIN d'abord, puis
 * script isolé : le pont doit être en place avant la première demande). Les deux scripts se protègent d'une double
 * exécution (pont : une fois par version de protocole ; script isolé : l'instance orpheline s'arrête).
 * Un onglet en échec (déchargé, page d'erreur…) n'empêche pas les autres : `onError`, jamais d'exception.
 * Retourne le nombre d'onglets où les deux scripts ont été exécutés.
 */
export async function injectIntoOpenTabs(
  api: PlatformInjectionApi,
  paths: PlatformScriptPaths,
  onError: (tabId: number | null, error: unknown) => void,
): Promise<number> {
  let tabIds: number[];
  try {
    if (!(await api.hasAccess())) return 0;
    tabIds = await api.tabIds();
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
