import type { ListState, ListStates } from './franchise';
import type { PanelRecommendation } from './panel-media.types';
import { hasUnseenPrequel } from './recommendations';

// « Dans le même esprit » (onglet En lecture) : filtre des recommandations de la fiche. Fonctions pures.

/** Lignes montrées (8 lues, 5 affichées : on ne lit que ce qui s'affiche) */
export const MAX_SIMILAR = 5;

/** Ids à lire dans les listes : recommandations non écartées et leurs préquels, par service */
export function similarLookupIds(recos: readonly PanelRecommendation[], dismissed: ReadonlySet<number>): { mediaIds: number[]; malIds: number[] } {
  const kept = recos.filter((r) => !dismissed.has(r.mediaId));
  return {
    mediaIds: [...new Set([...kept.map((r) => r.mediaId), ...kept.flatMap((r) => r.prequelIds)])],
    malIds: [...new Set([...kept.flatMap((r) => r.idMal ?? []), ...kept.flatMap((r) => r.prequelMalIds.flatMap((id) => id ?? []))])],
  };
}

const isSeen = (state: ListState): boolean => state?.kind === 'watched' || state?.kind === 'inProgress';

/**
 * Lignes proposées : hors listes de l'utilisateur (quel que soit le statut), hors séries écartées de Découvrir, sans suite
 * dont un préquel n'est pas vu / en cours / en revisionnage sur AniList (par id AniList) ou sur MyAnimeList (par id MAL).
 */
export function pickSimilar(recos: readonly PanelRecommendation[], states: ListStates, dismissed: ReadonlySet<number>): PanelRecommendation[] {
  const seen = new Set<number>();
  for (const [id, state] of Object.entries(states.anilist ?? {})) if (isSeen(state)) seen.add(Number(id));
  return recos
    .filter((r) => !dismissed.has(r.mediaId))
    .filter((r) => states.anilist?.[r.mediaId] == null && (r.idMal === null || states.mal?.[r.idMal] == null))
    .filter((r) => {
      // Un préquel vu sur MyAnimeList compte comme vu : seuls ceux qui ne le sont pas passent par la règle commune
      const unseenOnMal = r.prequelIds.filter((_, i) => {
        const malId = r.prequelMalIds[i] ?? null;
        return malId === null || !isSeen(states.mal?.[malId] ?? null);
      });
      return !hasUnseenPrequel(unseenOnMal, seen);
    })
    .slice(0, MAX_SIMILAR);
}
