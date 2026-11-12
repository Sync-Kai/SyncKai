// Suggestions ajoutées ou écartées pendant qu'un lot se calcule : le calcul les retire avant d'écrire (feuille : importée
// par batch.ts et messages.ts). Mémoire du worker seulement : un calcul interrompu par sa fin ne reprend pas.

import type { RecoItem } from '../../shared/recommendations';
import type { TrackerId } from '../../shared/tracker.types';

let building = false;
/** Par service : id de la fiche AniList, ou idMal pour une écriture MyAnimeList (RECO-03) */
const touched: Record<TrackerId, Set<number>> = { anilist: new Set(), mal: new Set() };
const clear = (): void => {
  touched.anilist.clear();
  touched.mal.clear();
};

export const beginBuild = (): void => {
  building = true;
  clear();
};
export const endBuild = (): void => {
  building = false;
  clear();
};
export const noteTouched = (service: TrackerId, id: number): void => {
  if (building) touched[service].add(id);
};
export const forgetTouched = (id: number): void => {
  touched.anilist.delete(id);
};
/** Ids AniList des fiches de `items` touchées pendant le calcul (par id AniList, ou par idMal) */
export const touchedIds = (items: readonly RecoItem[]): ReadonlySet<number> =>
  new Set([...touched.anilist, ...items.flatMap((i) => (i.card.idMal !== null && touched.mal.has(i.card.idMal) ? [i.card.id] : []))]);
