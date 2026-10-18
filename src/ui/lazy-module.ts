// Module d'une page chargé à la demande (import() des Réglages) dont le fichier a disparu : la page a été ouverte avant
// une reconstruction du paquet (build de développement, mise à jour) et cherche un nom de fichier qui n'existe plus.
// Sans relecture de la page, chaque clic échoue en silence. On recharge la page une fois, en demandant la réouverture du
// module ; un nouvel échec juste après n'enchaîne pas les rechargements.

/** Délai pendant lequel un second échec ne recharge plus la page (pas de boucle) */
const RELOAD_GUARD_MS = 60_000;

export interface ReloadDeps {
  /** sessionStorage de la page ; null : indisponible (rechargement sans garde ni réouverture) */
  storage: Storage | null;
  reload: () => void;
  now: () => number;
}

function pageStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const DEFAULT_DEPS: ReloadDeps = { storage: null, reload: () => location.reload(), now: () => Date.now() };
const defaults = (): ReloadDeps => ({ ...DEFAULT_DEPS, storage: pageStorage() });

const reloadKey = (name: string): string => `synckai:lazyReload:${name}`;
const reopenKey = (name: string): string => `synckai:lazyReopen:${name}`;

/** Fichier d'un import() introuvable (Chrome, Firefox, Safari), pas une exception levée par le module lui-même */
function isMissingModule(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /dynamically imported module|importing a module script failed/i.test(error.message);
}

/**
 * Charge le module ; fichier introuvable : page rechargée (une fois par RELOAD_GUARD_MS) avec une demande de réouverture
 * lue au démarrage par consumeReopenRequest. Rend null sur tout échec (l'hôte retentera au prochain clic).
 */
export async function loadOrReload<T>(load: () => Promise<T>, name: string, deps: ReloadDeps = defaults(), onError?: (error: unknown) => void): Promise<T | null> {
  try {
    return await load();
  } catch (error: unknown) {
    onError?.(error);
    if (!isMissingModule(error)) return null;
    const { storage, now } = deps;
    try {
      const last = Number(storage?.getItem(reloadKey(name)) ?? 0);
      if (storage && now() - last < RELOAD_GUARD_MS) return null;
      storage?.setItem(reloadKey(name), String(now()));
      storage?.setItem(reopenKey(name), '1');
    } catch {
      // Stockage plein ou refusé : rechargement quand même
    }
    deps.reload();
    return null;
  }
}

/** Réouverture demandée avant le rechargement (lue une seule fois) */
export function consumeReopenRequest(name: string, deps: Pick<ReloadDeps, 'storage'> = defaults()): boolean {
  try {
    const { storage } = deps;
    if (storage?.getItem(reopenKey(name)) !== '1') return false;
    storage.removeItem(reopenKey(name));
    return true;
  } catch {
    return false;
  }
}
