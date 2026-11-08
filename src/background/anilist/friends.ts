import { t } from '../../i18n';
import { keep } from '../../shared/lru';
import { isFriendsQueryData, reduceFriends, FRIENDS_PER_PAGE, type FriendsSummary } from '../../shared/friends';
import type { MessageResponse } from '../../protocol/messages';
import { accountFingerprint } from '../../browser/storage/sessions';
import { anilistQuery } from './client';
import { ApiError, type ApiErrorCode } from '../errors';
import { createLogger } from '../../browser/logger';

const log = createLogger('anilist');

// Amis AniList qui ont la série affichée (fiche « Sur cette page », panneau). Une requête par fiche, file interactive,
// jamais groupée ni préchargée (budget décidé le 2026-11-08, spec 2.5.0 §5.4). Gardée en mémoire du service worker
// seulement, jamais dans chrome.storage, les sauvegardes ou le rapport de diagnostic (règles d'AniList : pas de
// stockage des données de l'API) ; perdue quand le worker s'endort, ce qui est voulu.

const FRIENDS_QUERY = /* GraphQL */ `
  query Friends($id: Int) {
    Page(perPage: ${FRIENDS_PER_PAGE}) {
      pageInfo { total }
      mediaList(mediaId: $id, isFollowing: true, sort: [STATUS, SCORE_DESC]) {
        status
        progress
        score(format: POINT_10_DECIMAL)
        user { id name avatar { medium } }
      }
    }
  }
`;

/** Durée de vie d'un résumé : un ami qui avance dans la série est vu au plus tard après ce délai */
export const FRIENDS_CACHE_TTL_MS = 10 * 60_000;
/**
 * Échec gardé (cache négatif) : une interface qui redemande aussitôt (rendu, redétection) n'envoie rien pendant ce délai,
 * en particulier après une session expirée (TOKEN_INVALID, session fermée par le client) : pas de boucle de relance
 */
export const FRIENDS_ERROR_TTL_MS = 10_000;
/** Erreurs gardées 10 s ; réseau, erreur d'API et réponse invalide restent relançables aussitôt (« Réessayer ») */
const CACHED_ERROR_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>(['TOKEN_INVALID', 'NOT_AUTHENTICATED', 'RATE_LIMITED']);
export const MAX_FRIENDS_KEYS = 100;

type CachedFriends = { at: number; summary: FriendsSummary } | { at: number; error: ApiError };

const cache = new Map<string, CachedFriends>();
const inFlight = new Map<string, Promise<FriendsSummary | null>>();
/** Compte des entrées gardées : un autre compte (déconnexion, reconnexion) vide le cache */
let cacheAccount: string | null = null;

/** Vide le cache et les requêtes en cours (tests) */
export function clearFriendsCache(): void {
  cache.clear();
  inFlight.clear();
  cacheAccount = null;
}

/** Entrée encore valable, sinon undefined (périmée : retirée) */
function cached(key: string, now: number): CachedFriends | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > ('error' in hit ? FRIENDS_ERROR_TTL_MS : FRIENDS_CACHE_TTL_MS)) {
    cache.delete(key);
    return undefined;
  }
  return hit;
}

async function fetchFriends(mediaId: number, account: string, key: string): Promise<FriendsSummary | null> {
  try {
    const data = await anilistQuery(FRIENDS_QUERY, isFriendsQueryData, { id: mediaId }, 'interactive');
    const summary = reduceFriends(data);
    if (summary === null) throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.anilist'));
    // Session changée pendant la requête (déconnexion, autre compte) : données de l'ancien compte, ni gardées ni renvoyées
    if ((await accountFingerprint('anilist')) !== account || cacheAccount !== account) return null;
    keep(cache, key, { at: Date.now(), summary }, MAX_FRIENDS_KEYS);
    return summary;
  } catch (error: unknown) {
    if (error instanceof ApiError && CACHED_ERROR_CODES.has(error.code) && cacheAccount === account) keep(cache, key, { at: Date.now(), error }, MAX_FRIENDS_KEYS);
    throw error;
  }
}

/**
 * Amis AniList (personnes suivies) qui ont la série `mediaId`, résumés. null : pas de session AniList (ou session changée
 * pendant la requête). Lève une ApiError (session expirée, absente ou limite atteinte : gardée 10 s, rien n'est renvoyé
 * à AniList entre-temps).
 */
export async function getAniListFriends(mediaId: number): Promise<FriendsSummary | null> {
  const account = await accountFingerprint('anilist');
  if (account !== cacheAccount) {
    // Déconnexion ou autre compte : rien de l'ancien compte n'est gardé
    cache.clear();
    inFlight.clear();
    cacheAccount = account;
  }
  if (account === null) return null;
  const key = `${account}:${mediaId}`;
  const hit = cached(key, Date.now());
  if (hit) {
    if ('error' in hit) throw hit.error;
    return hit.summary;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = fetchFriends(mediaId, account, key).finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
}

/** Session absente ou expirée : bloc masqué, jamais « Indisponible » (la session expirée a son propre affichage) */
const HIDDEN_ERROR_CODES: ReadonlySet<ApiError['code']> = new Set(['TOKEN_INVALID', 'NOT_AUTHENTICATED']);

/**
 * Réponse du message GET_ANILIST_FRIENDS : `none` sans session (absente ou expirée) ou sans ami qui a la série (rien à
 * afficher)
 */
export async function friendsResponse(mediaId: number): Promise<MessageResponse<'GET_ANILIST_FRIENDS'>> {
  try {
    const summary = await getAniListFriends(mediaId);
    if (summary === null || summary.friends.length === 0) return { status: 'none' };
    return { status: 'ok', summary };
  } catch (error: unknown) {
    if (error instanceof ApiError) return HIDDEN_ERROR_CODES.has(error.code) ? { status: 'none' } : { status: 'error', message: error.message };
    log.error('Erreur inattendue (getAniListFriends) :', error);
    return { status: 'error', message: t('error.unexpected') };
  }
}
