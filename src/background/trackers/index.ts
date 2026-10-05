import { getMalToken, getValidToken } from '../../shared/storage';
import type { TrackerId } from '../../shared/tracker.types';
import { getMediaListInfo, getScoreFormat, saveListEntry, saveListStatus, saveProgress, saveScore } from '../api/list';
import { getMalAnime, saveMalEntry, saveMalListStatus, saveMalProgress, saveMalScore } from '../api/mal';
import { toAniListScore, toMalScore } from '../sync/score';
import type { TrackerService } from './tracker';

export const anilistTracker: TrackerService = {
  id: 'anilist',
  isConnected: async () => (await getValidToken()) !== null,
  resolveId: (media) => media.mediaId,
  async getEntry(id) {
    const { title, episodes, entry } = await getMediaListInfo(id);
    return { title, episodes, entry };
  },
  saveProgress: (id, progress, status, repeat) => saveProgress(id, progress, status, repeat),
  // Le score d'AniList s'exprime dans le format choisi par l'utilisateur (sur 100, 10, 5, 3…)
  saveScore: async (id, score) => saveScore(id, toAniListScore(score, await getScoreFormat())),
  startRewatch: (id, progress) => saveProgress(id, progress, 'REPEATING'),
  saveStatus: (id, status, progress, repeat) => saveListStatus(id, status, progress, repeat),
  saveEntry: (id, write) => saveListEntry(id, write),
};

export const malTracker: TrackerService = {
  id: 'mal',
  // Token présent (même expiré) : il sera renouvelé à la première requête
  isConnected: async () => (await getMalToken()) !== null,
  resolveId: (media) => media.idMal,
  getEntry: (id) => getMalAnime(id),
  saveProgress: (id, progress, status, repeat) => saveMalProgress(id, progress, status, repeat),
  saveScore: (id, score) => saveMalScore(id, toMalScore(score)),
  startRewatch: (id, progress) => saveMalProgress(id, progress, 'REPEATING'),
  saveStatus: (id, status, progress, repeat) => saveMalListStatus(id, status, progress, repeat),
  saveEntry: (id, write) => saveMalEntry(id, write),
};

const TRACKERS: readonly TrackerService[] = [anilistTracker, malTracker];

/** Services connectés, éventuellement restreints à `only` (nouvelle tentative ciblée). */
export async function getConnectedTrackers(only: readonly TrackerId[] | null = null): Promise<TrackerService[]> {
  const candidates = only ? TRACKERS.filter((t) => only.includes(t.id)) : TRACKERS;
  const connected = await Promise.all(candidates.map((t) => t.isConnected()));
  return candidates.filter((_, i) => connected[i]);
}
