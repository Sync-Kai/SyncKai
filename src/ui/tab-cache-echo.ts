// Anti-écho du cache de la fiche de l'onglet (`chrome.storage.session`), extrait du contrôleur de la fiche
// (ui/page-media-controller.ts, audit 4-§3) : un écran reconnaît ses propres écritures pour ne relire la page que
// quand la fiche a été réécrite AILLEURS (synchro par le service worker, action dans l'autre écran).
import { isCachedPageMedia } from '../browser/storage/page-media-cache';

/** Horodatages de ses propres écritures gardés pour reconnaître leur écho */
export const OWN_WRITES_KEPT = 8;

export interface OwnWrites {
  /**
   * Écriture à venir : horodatage unique (`resolvedAt` de l'entrée) retenu AVANT l'écriture. storage.onChanged est émis
   * pendant l'écriture, avant son retour : retenu après coup, l'écho de sa propre écriture passait pour une fiche
   * réécrite ailleurs ; après un choix de saison (cache ignoré), chaque écho relançait RESOLVE_PAGE_MEDIA, qui
   * réécrivait le cache… boucle sans fin, jusqu'à la limite de requêtes AniList.
   */
  stamp(): number;
  has(resolvedAt: number): boolean;
}

export function createOwnWrites(kept: number = OWN_WRITES_KEPT): OwnWrites {
  const stamps: number[] = [];
  return {
    stamp(): number {
      let at = Date.now();
      while (stamps.includes(at)) at++;
      stamps.push(at);
      if (stamps.length > kept) stamps.shift();
      return at;
    },
    has: (resolvedAt) => stamps.includes(resolvedAt),
  };
}

/**
 * Changement du cache de l'onglet à suivre (relecture de la page) : fiche réécrite par un autre que cet écran, ou fiche
 * effacée (commentaire ou retrait depuis l'autre écran : forgetCachedPageMedia), sinon l'écran garderait l'état des
 * listes d'avant l'action. Écho de sa propre écriture, ou valeur illisible : ignoré.
 */
export function isForeignCacheChange(change: chrome.storage.StorageChange, own: OwnWrites): boolean {
  const entry: unknown = change.newValue;
  if (entry === undefined && isCachedPageMedia(change.oldValue)) return true;
  return isCachedPageMedia(entry) && !own.has(entry.resolvedAt);
}
