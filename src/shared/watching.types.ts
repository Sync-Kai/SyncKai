import { isRecord } from './guards';
import type { AniListErrorCode } from './anilist.types';
import type { StreamingPlatform } from './episode.types';
import { platformFromHost, STREAMING_PLATFORMS } from '../platforms/registry';
import { primeIdInLink } from '../platforms/prime/metadata';
import type { Result } from './result';
import type { TrackerId } from './tracker.types';
import { toSafeUrl } from './url';

/** Lien vers la série (ou le dernier épisode vu) sur une plateforme de streaming */
export interface PlatformLink {
  platform: StreamingPlatform;
  url: string;
}

/** Prochain épisode annoncé (catalogue AniList), timestamps en ms */
export interface NextEpisode {
  episode: number;
  airingAt: number;
}

export type AiringStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'HIATUS' | 'CANCELLED';

/** Un anime "en cours" dans la liste de l'utilisateur (AniList ou MyAnimeList) */
export interface WatchingEntry {
  /** Identifiant AniList (null si la fiche MAL n'a pas d'équivalent AniList) */
  mediaId: number | null;
  malId: number | null;
  title: string;
  coverUrl: string | null;
  /** Épisodes vus selon la liste de l'utilisateur */
  progress: number;
  totalEpisodes: number | null;
  /** Date de dernière mise à jour de l'entrée de liste (ms), null si inconnue */
  updatedAt: number | null;
  nextEpisode: NextEpisode | null;
  airingStatus: AiringStatus | null;
  /** Plateformes où ouvrir l'anime (liens AniList + historique SyncKai), sans doublon de plateforme */
  platforms: PlatformLink[];
  /** Dernière synchro faite par SyncKai pour cette fiche (issue de l'historique), sinon null */
  lastSync: { platform: StreamingPlatform; at: number; episodeUrl: string } | null;
  /** Page de la fiche sur le service affiché (anilist.co ou myanimelist.net) */
  siteUrl: string;
}

export interface WatchingList {
  service: TrackerId;
  entries: WatchingEntry[];
  /** Moment de la récupération (ms) : sert au cache et à l'affichage "mis à jour il y a…" */
  fetchedAt: number;
}

export type WatchingResult = Result<WatchingList, AniListErrorCode>;

/** Pastille d'état d'une ligne "En cours" (calculée à l'affichage, l'heure change) */
export type NextEpisodeBadge =
  /** Épisode déjà sorti et pas encore vu : à regarder maintenant */
  | { kind: 'available'; label: string }
  /** Compte à rebours jusqu'à la sortie du prochain épisode */
  | { kind: 'upcoming'; label: string }
  /** Série terminée (ou annulée) */
  | { kind: 'finished'; label: string }
  /** Aucune information de diffusion */
  | { kind: 'unknown'; label: string };

const isNullableNumber = (v: unknown): v is number | null => v === null || typeof v === 'number';

/**
 * Lien relu du stockage (SEC-04) : https, hôte de la plateforme annoncée (Prime Video : aussi amazon.<tld>, comme les liens
 * AniList). Un script de contenu peut écrire dans `storage.local` : ces URL deviennent des `href` du popup et des onglets
 * ouverts par les alertes, jamais une adresse étrangère.
 */
function isPlatformUrl(platform: unknown, value: unknown): boolean {
  if (typeof value !== 'string' || !(STREAMING_PLATFORMS as readonly unknown[]).includes(platform)) return false;
  const safe = toSafeUrl(value);
  if (safe === null) return false;
  return platformFromHost(new URL(safe).hostname) === platform || (platform === 'prime' && primeIdInLink(safe) !== null);
}

const isPlatformLink = (value: unknown): value is PlatformLink => isRecord(value) && isPlatformUrl(value.platform, value.url);

/** Page de la fiche sur AniList ou MyAnimeList (https, hôte exact) */
const isSiteUrl = (value: unknown): boolean => typeof value === 'string' && (toSafeUrl(value, 'anilist.co') !== null || toSafeUrl(value, 'myanimelist.net') !== null);

/**
 * Validation d'une liste mise en cache dans le stockage : forme de l'entrée (superficielle) et, en profondeur, toutes les
 * URL qui deviennent des liens (`platforms[].url`, `lastSync.episodeUrl`, `siteUrl`, SEC-04). Une liste altérée est refusée
 * en bloc : le cache est alors absent et la liste relue sur le service.
 */
export function isWatchingList(value: unknown): value is WatchingList {
  return (
    isRecord(value) &&
    (value.service === 'anilist' || value.service === 'mal') &&
    typeof value.fetchedAt === 'number' &&
    Array.isArray(value.entries) &&
    value.entries.every(
      (e: unknown) =>
        isRecord(e) &&
        typeof e.title === 'string' &&
        typeof e.progress === 'number' &&
        isNullableNumber(e.totalEpisodes) &&
        Array.isArray(e.platforms) &&
        e.platforms.every(isPlatformLink) &&
        (e.lastSync === null || (isRecord(e.lastSync) && isPlatformUrl(e.lastSync.platform, e.lastSync.episodeUrl))) &&
        isSiteUrl(e.siteUrl),
    )
  );
}

/** Modes de tri de la liste « Mes séries » (choix persisté dans les préférences du popup) */
export type WatchingSort = 'next-episode' | 'recent' | 'title' | 'remaining';

export const WATCHING_SORTS: readonly WatchingSort[] = ['next-episode', 'recent', 'title', 'remaining'];

export const DEFAULT_WATCHING_SORT: WatchingSort = 'next-episode';

export function isWatchingSort(value: unknown): value is WatchingSort {
  return typeof value === 'string' && (WATCHING_SORTS as readonly string[]).includes(value);
}
