/** Services de suivi sur lesquels SyncKai écrit la progression */
export type TrackerId = 'anilist' | 'mal';

export const TRACKER_IDS: readonly TrackerId[] = ['anilist', 'mal'];

export const TRACKER_LABELS: Record<TrackerId, string> = {
  anilist: 'AniList',
  mal: 'MyAnimeList',
};

/**
 * Identifiant de la fiche sur un service, une seule règle pour tous les chemins (audit 6-D9) : AniList = fiche AniList
 * (`mediaId`), MAL = `malId` ; null sans équivalent sur ce service.
 */
export function entryIdOn(service: TrackerId, ids: { mediaId: number | null; malId: number | null }): number | null {
  return service === 'anilist' ? ids.mediaId : ids.malId;
}

export function isTrackerId(value: unknown): value is TrackerId {
  return typeof value === 'string' && (TRACKER_IDS as readonly string[]).includes(value);
}
