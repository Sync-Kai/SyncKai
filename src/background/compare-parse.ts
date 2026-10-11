import type { AniListListEntry, MalListEntry } from '../shared/compare';
import { isListStatus } from '../shared/compare';
import { isRecord } from '../shared/guards';
import { toSafeImageUrl } from '../shared/url';
import { fromMalStatus } from './api/mal';

// Lecture défensive des listes complètes (réponses externes) : une entrée illisible est ignorée.

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Entier ≥ 0 (progression, compteur), 0 par défaut */
const count = (v: unknown): number => {
  const n = num(v);
  return n !== null && n > 0 ? Math.floor(n) : 0;
};
/** Note > 0, sinon null (0 = pas de note, sur AniList comme sur MAL) */
const score = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
};

/** `MediaListCollection.lists[].entries[]` → entrées normalisées (doublons gardés : dédoublonnés par compareLists) */
export function parseAniListCollection(collection: unknown): AniListListEntry[] {
  if (!isRecord(collection)) return [];
  return arr(collection.lists).flatMap((list) =>
    arr(isRecord(list) ? list.entries : null).flatMap((raw): AniListListEntry[] => {
      if (!isRecord(raw) || !isRecord(raw.media) || !isListStatus(raw.status)) return [];
      const media = raw.media;
      const mediaId = num(media.id);
      if (mediaId === null) return [];
      const title = isRecord(media.title) ? (str(media.title.userPreferred) ?? str(media.title.romaji) ?? str(media.title.english)) : null;
      const cover = isRecord(media.coverImage) ? str(media.coverImage.medium) : null;
      return [
        {
          mediaId,
          malId: num(media.idMal),
          title: title ?? `#${mediaId}`,
          coverUrl: toSafeImageUrl(cover),
          status: raw.status,
          progress: count(raw.progress),
          score: score(raw.score),
          repeat: count(raw.repeat),
        },
      ];
    }),
  );
}

/** Une page de GET /users/@me/animelist → entrées normalisées (fiche AniList à compléter, `mediaId` null) */
export function parseMalListPage(data: readonly unknown[]): MalListEntry[] {
  return data.flatMap((item): MalListEntry[] => {
    if (!isRecord(item) || !isRecord(item.node) || !isRecord(item.list_status)) return [];
    const malId = num(item.node.id);
    const ls = item.list_status;
    const status = fromMalStatus(ls.status, ls.is_rewatching);
    if (malId === null || status === null) return [];
    const picture = isRecord(item.node.main_picture) ? str(item.node.main_picture.medium) : null;
    return [
      {
        malId,
        mediaId: null,
        title: str(item.node.title) ?? `#${malId}`,
        coverUrl: toSafeImageUrl(picture),
        status,
        progress: count(ls.num_episodes_watched),
        score: score(ls.score),
        repeat: count(ls.num_times_rewatched),
      },
    ];
  });
}
