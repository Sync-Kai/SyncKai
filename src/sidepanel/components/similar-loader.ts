import { createLogger } from '../../browser/logger';
import { getOpenSessions } from '../../browser/storage/sessions';
import { sendMessage } from '../../protocol/messages';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { PanelMedia, PanelRecommendation } from '../../shared/panel-media.types';
import { pickSimilar, similarLookupIds } from '../../shared/similar';
import type { PageMediaContent } from '../../ui/page-media-controller';

const log = createLogger('sidepanel');

// « Dans le même esprit » de l'onglet « En lecture » : recommandations de la fiche filtrées par les listes de l'utilisateur,
// les séries écartées de Découvrir et la règle du préquel non vu (shared/similar.ts). Sans rendu : `onChange` prévient le contrôleur.

export interface SimilarLoader {
  /** Séries proposées (au plus 5) */
  readonly items: readonly PanelRecommendation[];
  /** Fiche affichée changée (ou `force` : comptes changés, action de liste, même fiche refiltrée) */
  sync(content: PageMediaContent<PanelMedia>, force?: boolean): void;
  dispose(): void;
}

export function createSimilarLoader(onChange: () => void): SimilarLoader {
  let items: PanelRecommendation[] = [];
  /** Incrémenté à chaque lecture : une réponse plus ancienne (autre fiche, compte changé) est ignorée */
  let run = 0;
  /** Fiche (AniList) dont les recommandations sont filtrées (ou en cours de filtrage) : ses relectures ne relisent rien (RECO-07) */
  let loadedId: number | null = null;

  const show = (next: PanelRecommendation[]): void => {
    items = next;
    onChange();
  };

  const clear = (): void => {
    run++;
    loadedId = null;
    if (items.length > 0) show([]);
  };

  /** Séries écartées de Découvrir (lues au stockage de la page) ; illisibles : aucune */
  const readDismissed = async (): Promise<ReadonlySet<number>> => {
    try {
      const stored: unknown = (await chrome.storage.local.get(STORAGE_KEYS.recoDismissed))[STORAGE_KEYS.recoDismissed];
      return new Set(Array.isArray(stored) ? stored.filter((id): id is number => typeof id === 'number') : []);
    } catch (error: unknown) {
      log.debug('Séries écartées illisibles :', error);
      return new Set();
    }
  };

  /**
   * Aucun compte : pas de liste à consulter. Compte connecté dont les états manquent (échec, session changée) : rien n'est
   * proposé, rien ne prouve que les séries ne sont pas déjà en liste.
   */
  const load = async (recos: readonly PanelRecommendation[]): Promise<void> => {
    const current = ++run;
    const dismissed = await readDismissed();
    if (current !== run) return;
    const ids = similarLookupIds(recos, dismissed);
    if (ids.mediaIds.length === 0) return show([]);
    let next: PanelRecommendation[] = [];
    try {
      const sessions = await getOpenSessions();
      if (sessions.anilist === undefined && sessions.mal === undefined) next = pickSimilar(recos, { anilist: null, mal: null }, dismissed);
      else {
        const states = await sendMessage('GET_LIST_STATES', ids);
        if ((sessions.anilist === undefined || states.anilist !== null) && (sessions.mal === undefined || states.mal !== null)) next = pickSimilar(recos, states, dismissed);
      }
    } catch (error: unknown) {
      log.debug('États de liste illisibles (recommandations) :', error);
    }
    if (current === run) show(next);
  };

  return {
    get items() {
      return items;
    },
    sync(content, force = false): void {
      if (content.status !== 'ready') return clear();
      if (content.refreshing) return;
      if (!content.details) return clear();
      if (force) loadedId = null;
      if (loadedId === content.view.media.mediaId) return;
      loadedId = content.view.media.mediaId;
      if (content.details.recommendations.length === 0) {
        run++;
        if (items.length > 0) show([]);
      } else void load(content.details.recommendations);
    },
    dispose(): void {
      run++;
      items = [];
    },
  };
}
