// Menu du compte de la barre d'état (docs/design/README.md › Account menu) : règles pures (testées). Le profil et ses
// statistiques viennent de la même requête (GET_VIEWER / GET_MAL_VIEWER, profil en cache) : à l'ouverture, une seule
// relecture au plus, quand la dernière date de plus d'une heure.
import type { AccountStats } from '../shared/account-stats';
import type { AniListViewer } from '../shared/anilist.types';
import type { MalViewer } from '../shared/mal.types';
import type { AccountState } from './state';

/** Statistiques relues à l'ouverture du menu au-delà (le profil seul l'est toutes les 6 h, PROFILE_TTL_MS) */
export const ACCOUNT_STATS_TTL_MS = 60 * 60 * 1000;

type Viewer = AniListViewer | MalViewer;

/**
 * Profil et statistiques à relire à l'ouverture : profil connu mais lu il y a plus d'une heure (date inconnue ou du
 * futur comprises) ou sans statistiques (profil d'avant le menu), ou lecture précédente en échec. Profil en cours de
 * lecture (démarrage de la page) : la requête en vol suffit
 */
export function menuNeedsRefresh(state: AccountState<Viewer>, fetchedAt: number | null, now: number): boolean {
  if (state.status !== 'logged-in') return false;
  if (state.viewer === null) return state.error !== null;
  if (state.viewer.stats === undefined || fetchedAt === null || fetchedAt > now) return true;
  return now - fetchedAt >= ACCOUNT_STATS_TTL_MS;
}

/** Tuiles : statistiques connues (gardées pendant une relecture), squelette pendant la lecture, sinon masquées */
export function statsView(state: AccountState<Viewer>, refreshing: boolean): AccountStats | 'loading' | 'hidden' {
  if (state.status !== 'logged-in') return 'hidden';
  const stats = state.viewer?.stats;
  if (stats) return stats;
  if (refreshing || (state.viewer === null && state.error === null)) return 'loading';
  return 'hidden';
}

/** Page du profil (comme Réglages › Comptes) */
export function profileUrl(viewer: Viewer): string {
  return 'siteUrl' in viewer ? viewer.siteUrl : `https://myanimelist.net/profile/${encodeURIComponent(viewer.name)}`;
}

/** Jours de visionnage : entier à partir de 10 (« 54 j »), une décimale en dessous (« 2,5 j »), format de la langue */
export function formatStatDays(days: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: days < 10 ? 1 : 0 }).format(days);
}
