import { isListStatus } from './compare';
import { isRecord } from './guards';
import type { ListStatus } from './sync.types';
import { toSafeImageUrl } from './url';

// Amis AniList (personnes que l'utilisateur suit) qui ont la série dans leur liste : réponse de la requête
// Page.mediaList(isFollowing: true) réduite à ce que la fiche affiche. Pur, testé ; rien n'est gardé au-delà du cache
// mémoire du service worker (règles d'AniList : pas de stockage des données de l'API).

/** Un ami qui a la série : note sur 10 (une décimale), null si non notée (0 chez AniList) */
export interface FriendEntry {
  id: number;
  name: string;
  avatar: string | null;
  status: ListStatus;
  progress: number;
  score: number | null;
}

/** Résumé : `total` = tous les amis qui ont la série (pageInfo.total), `friends` = les 50 premiers au plus */
export interface FriendsSummary {
  total: number;
  /** Moyenne des notes > 0, au dixième ; null avec moins de 2 notes */
  averageScore: number | null;
  scoredCount: number;
  friends: FriendEntry[];
}

/** Taille de la page demandée (perPage de la requête) : borne aussi la liste réduite */
export const FRIENDS_PER_PAGE = 50;
/** Moins de notes que ça : pas de moyenne (une seule note n'en est pas une) */
const MIN_SCORES_FOR_AVERAGE = 2;
/** Noms AniList : 20 caractères ; borne large par prudence */
const MAX_NAME_LENGTH = 64;

/** Données de la requête : seule la forme portante est vérifiée, chaque entrée l'est par le réducteur */
export interface FriendsQueryData {
  Page: { pageInfo?: unknown; mediaList: unknown[] };
}

export function isFriendsQueryData(data: unknown): data is FriendsQueryData {
  return isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.mediaList);
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Note POINT_10_DECIMAL : 0 (non notée), hors échelle ou illisible → null */
function scoreOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10) return null;
  return Math.round(value * 10) / 10;
}

function friendOf(raw: unknown): FriendEntry | null {
  if (!isRecord(raw) || !isListStatus(raw.status) || !isRecord(raw.user)) return null;
  const { id, name, avatar } = raw.user;
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return null;
  if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_NAME_LENGTH) return null;
  return {
    id,
    name,
    // Hôtes d'images autorisés seulement (IMAGE_HOSTS) : un autre domaine ne s'affiche pas
    avatar: toSafeImageUrl(isRecord(avatar) ? avatar.medium : null),
    status: raw.status,
    progress: isCount(raw.progress) ? raw.progress : 0,
    score: scoreOf(raw.score),
  };
}

/** Réponse de la requête « amis » → résumé ; null si la réponse n'a pas la forme attendue */
export function reduceFriends(data: unknown): FriendsSummary | null {
  if (!isFriendsQueryData(data)) return null;
  const friends: FriendEntry[] = [];
  const seen = new Set<number>();
  for (const raw of data.Page.mediaList) {
    const friend = friendOf(raw);
    // Un même ami compté une fois (première entrée, dans l'ordre de tri d'AniList)
    if (friend === null || seen.has(friend.id)) continue;
    seen.add(friend.id);
    friends.push(friend);
    if (friends.length === FRIENDS_PER_PAGE) break;
  }
  // Moyenne et scoredCount calculés sur les 50 premiers amis lus (taille de la page), pas sur `total`
  const scores = friends.flatMap((f) => (f.score === null ? [] : [f.score]));
  const average = scores.length >= MIN_SCORES_FOR_AVERAGE ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : null;
  const total: unknown = isRecord(data.Page.pageInfo) ? data.Page.pageInfo.total : undefined;
  return { total: Math.max(isCount(total) ? total : 0, friends.length), averageScore: average, scoredCount: scores.length, friends };
}
