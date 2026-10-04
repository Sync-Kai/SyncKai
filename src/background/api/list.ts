import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { getValidToken } from '../../shared/storage';
import type { ListStatusChange } from '../../shared/sync.types';
import type { ListEntryState, ListStatus, WriteStatus } from '../sync/rules';
import { isAniListScoreFormat, type AniListScoreFormat } from '../sync/score';
import { anilistQuery } from './client';
import { ApiError } from './errors';

export interface MediaListInfo {
  mediaId: number;
  title: string;
  episodes: number | null;
  /** Entrée de la liste de l'utilisateur, null si l'anime n'y est pas */
  entry: ListEntryState | null;
}

const MEDIA_ENTRY_QUERY = /* GraphQL */ `
  query MediaEntry($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      episodes
      title { userPreferred }
      mediaListEntry { status progress repeat score }
    }
  }
`;

const SAVE_PROGRESS_MUTATION = /* GraphQL */ `
  mutation SaveProgress($mediaId: Int!, $progress: Int!, $status: MediaListStatus!, $repeat: Int) {
    SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status, repeat: $repeat) {
      status
      progress
      repeat
    }
  }
`;

const SAVE_SCORE_MUTATION = /* GraphQL */ `
  mutation SaveScore($mediaId: Int!, $score: Float!) {
    SaveMediaListEntry(mediaId: $mediaId, score: $score) {
      status
      progress
      repeat
    }
  }
`;

const SCORE_FORMAT_QUERY = /* GraphQL */ `
  query ScoreFormat {
    Viewer {
      mediaListOptions { scoreFormat }
    }
  }
`;

const LIST_STATUSES: Record<ListStatus, true> = {
  CURRENT: true,
  PLANNING: true,
  COMPLETED: true,
  DROPPED: true,
  PAUSED: true,
  REPEATING: true,
};

function parseEntry(value: unknown): ListEntryState | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !Object.hasOwn(LIST_STATUSES, value.status)) return null;
  const entry: ListEntryState = { status: value.status as ListStatus, progress: typeof value.progress === 'number' ? value.progress : 0 };
  if (typeof value.repeat === 'number') entry.repeat = value.repeat;
  // 0 = pas de note sur AniList
  if (typeof value.score === 'number' && value.score > 0) entry.score = value.score;
  return entry;
}

interface MediaEntryData {
  Media: { id: number; episodes: unknown; title: unknown; mediaListEntry: unknown };
}

function isMediaEntryData(data: unknown): data is MediaEntryData {
  return isRecord(data) && isRecord(data.Media) && typeof data.Media.id === 'number';
}

interface SaveProgressData {
  SaveMediaListEntry: unknown;
}

function isSaveProgressData(data: unknown): data is SaveProgressData {
  return isRecord(data) && isRecord(data.SaveMediaListEntry);
}

interface ScoreFormatData {
  Viewer: { mediaListOptions: { scoreFormat: AniListScoreFormat } };
}

function isScoreFormatData(data: unknown): data is ScoreFormatData {
  return (
    isRecord(data) &&
    isRecord(data.Viewer) &&
    isRecord(data.Viewer.mediaListOptions) &&
    isAniListScoreFormat(data.Viewer.mediaListOptions.scoreFormat)
  );
}

/** Lit la fiche et l'entrée de liste de l'utilisateur (juste avant d'écrire, pour une donnée fraîche). */
export async function getMediaListInfo(mediaId: number): Promise<MediaListInfo> {
  const { Media } = await anilistQuery(MEDIA_ENTRY_QUERY, isMediaEntryData, { id: mediaId });
  const title = isRecord(Media.title) && typeof Media.title.userPreferred === 'string' ? Media.title.userPreferred : `#${mediaId}`;
  return {
    mediaId,
    title,
    episodes: typeof Media.episodes === 'number' ? Media.episodes : null,
    entry: parseEntry(Media.mediaListEntry),
  };
}

function parseSaved(data: SaveProgressData): ListEntryState {
  const entry = parseEntry(data.SaveMediaListEntry);
  if (!entry) throw new ApiError('INVALID_RESPONSE', t('api.invalidAfterUpdate.anilist'));
  return entry;
}

/**
 * Variables de SaveMediaListEntry (pur, testable). Les statuts communs portent les noms de
 * l'énumération AniList MediaListStatus (CURRENT, PAUSED, DROPPED, COMPLETED, REPEATING) : aucune conversion.
 */
export function anilistEntryVariables(
  mediaId: number,
  progress: number,
  status: WriteStatus | ListStatusChange,
  repeat?: number,
): Record<string, number | string> {
  const variables: Record<string, number | string> = { mediaId, progress, status };
  if (repeat !== undefined) variables.repeat = repeat;
  return variables;
}

/** `repeat` : nouveau nombre de revisionnages (fin d'un revisionnage), sinon inchangé */
export async function saveProgress(mediaId: number, progress: number, status: WriteStatus, repeat?: number): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_PROGRESS_MUTATION, isSaveProgressData, anilistEntryVariables(mediaId, progress, status, repeat)));
}

/** Changement de statut manuel (En pause, Abandonné, Terminé) : même mutation que la progression */
export async function saveListStatus(mediaId: number, status: ListStatusChange, progress: number, repeat?: number): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_PROGRESS_MUTATION, isSaveProgressData, anilistEntryVariables(mediaId, progress, status, repeat)));
}

/** Format de note du profil, gardé en mémoire le temps de vie du service worker (lié au token : changement de compte = relecture) */
let scoreFormatCache: { accessToken: string; format: AniListScoreFormat } | null = null;

export async function getScoreFormat(): Promise<AniListScoreFormat> {
  const token = await getValidToken();
  if (scoreFormatCache && token?.accessToken === scoreFormatCache.accessToken) return scoreFormatCache.format;
  const { Viewer } = await anilistQuery(SCORE_FORMAT_QUERY, isScoreFormatData);
  if (token) scoreFormatCache = { accessToken: token.accessToken, format: Viewer.mediaListOptions.scoreFormat };
  return Viewer.mediaListOptions.scoreFormat;
}

/** `score` déjà converti dans le format du profil (voir toAniListScore) */
export async function saveScore(mediaId: number, score: number): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_SCORE_MUTATION, isSaveProgressData, { mediaId, score }));
}
