import { entryIdOn, TRACKER_IDS, type TrackerId } from './tracker.types';

// Lien vers la fiche d'un anime (titre et jaquette cliquables) : AniList ou MyAnimeList selon les comptes connectés
// et le réglage « Fiche ouverte par défaut ». Fonction pure, sans requête : seuls les identifiants déjà connus servent.

/** Identifiants connus de l'anime (null : pas d'équivalent connu sur ce service) */
export interface EntryIds {
  mediaId: number | null;
  malId: number | null;
}

/** Ce que l'écran sait des comptes : services connectés et service préféré (réglage, utile seulement avec les deux) */
export interface EntryLinkContext {
  connected: readonly TrackerId[];
  preferred: TrackerId;
}

export interface EntryLink {
  service: TrackerId;
  url: string;
}

const isId = (value: number | null): value is number => value !== null && Number.isInteger(value) && value > 0;

/** Page de la fiche sur le service */
export function entryUrl(service: TrackerId, id: number): string {
  return service === 'anilist' ? `https://anilist.co/anime/${id}` : `https://myanimelist.net/anime/${id}`;
}

/**
 * Service ouvert en premier : le seul compte connecté, le réglage avec les deux comptes, AniList sans compte
 * (accueil). Doublon ou service inconnu dans `connected` : ignorés.
 */
export function entryService({ connected, preferred }: EntryLinkContext): TrackerId {
  const services = TRACKER_IDS.filter((service) => connected.includes(service));
  if (services.length === 1) return services[0] ?? 'anilist';
  return services.length === 0 ? 'anilist' : preferred;
}

/**
 * Lien de la fiche : service choisi par `entryService`, repli sur l'autre service si l'anime n'y a pas
 * d'identifiant (jamais de lien cassé), null sans aucun identifiant (titre et jaquette non cliquables).
 */
export function entryLink(ids: EntryIds, context: EntryLinkContext): EntryLink | null {
  const first = entryService(context);
  const order: readonly TrackerId[] = first === 'anilist' ? ['anilist', 'mal'] : ['mal', 'anilist'];
  for (const service of order) {
    const id = entryIdOn(service, ids);
    if (isId(id)) return { service, url: entryUrl(service, id) };
  }
  return null;
}
