import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import { getValidToken } from '../../browser/tokens/access';
import type { ManualListStatus } from '../../shared/sync.types';
import type { ListEntryState, ListStatus, WriteStatus } from '../sync/rules';
import { aniListScores, isAniListScoreFormat, type AniListScoreFormat } from '../../shared/score';
import type { EntryWrite } from '../../shared/compare';
import { readListNotes } from '../../shared/list-notes';
import { anilistQuery } from './client';
import { ApiError } from '../errors';
import type { RequestLane } from '../rate-limit';

export interface MediaListInfo {
  mediaId: number;
  title: string;
  episodes: number | null;
  /** Entrée de la liste de l'utilisateur, null si l'anime n'y est pas */
  entry: ListEntryState | null;
  /** Identifiant de l'entrée de liste (MediaList.id, requis pour la retirer), null hors liste */
  entryId: number | null;
  /** Commentaire de l'entrée (MediaList.notes), null s'il est vide */
  notes: string | null;
}

/** Entrée de liste de l'utilisateur connecté (MediaEntry, et lecture groupée de la fiche de la page : page-batch.ts) */
export const MEDIA_LIST_ENTRY_FIELDS = 'mediaListEntry { id status progress repeat score notes }';

const MEDIA_ENTRY_QUERY = /* GraphQL */ `
  query MediaEntry($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      episodes
      title { userPreferred }
      ${MEDIA_LIST_ENTRY_FIELDS}
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
  Media: { id: number; episodes: unknown; title: unknown; mediaListEntry: unknown } & Record<string, unknown>;
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

/**
 * Lit la fiche et l'entrée de liste de l'utilisateur (juste avant d'écrire, pour une donnée fraîche). `lane` : 'background'
 * pour une tâche de fond (import, alignement : place réservée avant le verrou de la fiche, voir jobs/runner.ts)
 */
export async function getMediaListInfo(mediaId: number, lane: RequestLane = 'interactive'): Promise<MediaListInfo> {
  const { Media } = await anilistQuery(MEDIA_ENTRY_QUERY, isMediaEntryData, { id: mediaId }, lane);
  return toMediaListInfo(mediaId, Media);
}

/** Fiche brute portant `episodes`, `title { userPreferred }` et `mediaListEntry` (MEDIA_ENTRY_QUERY, lecture groupée) */
export function toMediaListInfo(mediaId: number, Media: Record<string, unknown>): MediaListInfo {
  const title = isRecord(Media.title) && typeof Media.title.userPreferred === 'string' ? Media.title.userPreferred : `#${mediaId}`;
  const entry = parseEntry(Media.mediaListEntry);
  const raw = entry && isRecord(Media.mediaListEntry) ? Media.mediaListEntry : null;
  return {
    mediaId,
    title,
    episodes: typeof Media.episodes === 'number' ? Media.episodes : null,
    entry,
    entryId: raw && typeof raw.id === 'number' ? raw.id : null,
    notes: raw ? readListNotes(raw.notes) : null,
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
  status: WriteStatus | ManualListStatus,
  repeat?: number,
): Record<string, number | string> {
  const variables: Record<string, number | string> = { mediaId, progress, status };
  if (repeat !== undefined) variables.repeat = repeat;
  return variables;
}

/** `repeat` : nouveau nombre de revisionnages (fin d'un revisionnage), sinon inchangé ; `lane` : voir getMediaListInfo */
export async function saveProgress(mediaId: number, progress: number, status: WriteStatus, repeat?: number, lane: RequestLane = 'interactive'): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_PROGRESS_MUTATION, isSaveProgressData, anilistEntryVariables(mediaId, progress, status, repeat), lane));
}

/** Statut manuel (En pause, Abandonné, Terminé, ajout À regarder / En cours) : même mutation que la progression */
export async function saveListStatus(mediaId: number, status: ManualListStatus, progress: number, repeat?: number): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_PROGRESS_MUTATION, isSaveProgressData, anilistEntryVariables(mediaId, progress, status, repeat)));
}

/** Format de note du profil, gardé en mémoire le temps de vie du service worker (lié au token : changement de compte = relecture) */
let scoreFormatCache: { accessToken: string; format: AniListScoreFormat } | null = null;

export async function getScoreFormat(lane: RequestLane = 'interactive'): Promise<AniListScoreFormat> {
  const token = await getValidToken();
  if (scoreFormatCache && token?.accessToken === scoreFormatCache.accessToken) return scoreFormatCache.format;
  const { Viewer } = await anilistQuery(SCORE_FORMAT_QUERY, isScoreFormatData, {}, lane);
  if (token) scoreFormatCache = { accessToken: token.accessToken, format: Viewer.mediaListOptions.scoreFormat };
  return Viewer.mediaListOptions.scoreFormat;
}

/** `score` déjà converti dans le format du profil (voir toAniListScore) */
export async function saveScore(mediaId: number, score: number): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_SCORE_MUTATION, isSaveProgressData, { mediaId, score }));
}

// ─── Alignement depuis la comparaison des listes ──────────────────────────

const SAVE_ENTRY_MUTATION = /* GraphQL */ `
  mutation SaveEntry($mediaId: Int!, $status: MediaListStatus, $progress: Int, $score: Float, $repeat: Int) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score, repeat: $repeat) {
      status
      progress
      repeat
      score
    }
  }
`;

/**
 * Variables de SaveMediaListEntry pour un alignement (pur, testable) : seuls les champs fournis sont
 * envoyés (une variable absente laisse le champ inchangé). Note convertie dans le format du profil.
 */
export function anilistEntryWriteVariables(mediaId: number, write: EntryWrite, format: AniListScoreFormat): Record<string, number | string> {
  const variables: Record<string, number | string> = { mediaId };
  if (write.status !== undefined) variables.status = write.status;
  if (write.progress !== undefined) variables.progress = write.progress;
  if (write.repeat !== undefined) variables.repeat = write.repeat;
  if (write.score !== undefined) variables.score = aniListScores(format).encode(write.score);
  return variables;
}

/** Écrit (ou crée) l'entrée de liste AniList avec les champs fournis, en une requête (+ format de note, en cache) ; `lane` : voir getMediaListInfo */
export async function saveListEntry(mediaId: number, write: EntryWrite, lane: RequestLane = 'interactive'): Promise<ListEntryState> {
  const format = write.score !== undefined ? await getScoreFormat(lane) : 'POINT_10_DECIMAL';
  return parseSaved(await anilistQuery(SAVE_ENTRY_MUTATION, isSaveProgressData, anilistEntryWriteVariables(mediaId, write, format), lane));
}

// ─── Commentaire et retrait de la liste ───────────────────────────────────

const SAVE_NOTES_MUTATION = /* GraphQL */ `
  mutation SaveNotes($mediaId: Int!, $notes: String) {
    SaveMediaListEntry(mediaId: $mediaId, notes: $notes) {
      status
      progress
      repeat
      notes
    }
  }
`;

/** Commentaire de l'entrée (texte déjà normalisé, "" l'efface) : seul champ écrit */
export async function saveListNotes(mediaId: number, notes: string): Promise<ListEntryState> {
  return parseSaved(await anilistQuery(SAVE_NOTES_MUTATION, isSaveProgressData, { mediaId, notes }));
}

const DELETE_ENTRY_MUTATION = /* GraphQL */ `
  mutation DeleteEntry($id: Int!) {
    DeleteMediaListEntry(id: $id) {
      deleted
    }
  }
`;

interface DeleteEntryData {
  DeleteMediaListEntry: { deleted?: unknown };
}

function isDeleteEntryData(data: unknown): data is DeleteEntryData {
  return isRecord(data) && isRecord(data.DeleteMediaListEntry);
}

/**
 * Retire l'anime de la liste AniList. DeleteMediaListEntry prend l'identifiant de l'ENTRÉE (MediaList.id), pas celui de
 * la fiche : relu juste avant. Anime déjà absent de la liste : rien à faire (succès).
 */
export async function deleteListEntry(mediaId: number): Promise<void> {
  const { entryId } = await getMediaListInfo(mediaId);
  if (entryId === null) return;
  const { DeleteMediaListEntry } = await anilistQuery(DELETE_ENTRY_MUTATION, isDeleteEntryData, { id: entryId });
  if (DeleteMediaListEntry.deleted !== true) throw new ApiError('INVALID_RESPONSE', t('api.invalidAfterUpdate.anilist'));
}
