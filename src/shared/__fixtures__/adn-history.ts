// Historique de visionnage ADN : réponse de GET gw.api.animationdigitalnetwork.com/viewing/history?offset=0&limit=…
// Structure relevée par le propriétaire sur le site réel le 2026-10-12 (Chrome, session connectée), réduite : un seul
// échantillon réel (Even the Student Council Has Its Holes!, série 1428 : E1 terminé 1299/1421 s, E2 commencé 16 s).
// Les autres entrées, identifiants d'épisode, dates et l'identifiant du compte sont fictifs. Aucun jeton ici.

const ORIGIN = 'https://animationdigitalnetwork.com';

interface VideoFixture {
  id: number;
  show: { id: number; slug: string; title: string; originalTitle: string; genres: string[]; episodeCount: number };
  shortNumber: string;
  season?: string;
  type?: string;
  duration?: number;
  stoptime: number;
  fully: boolean;
  watchDate: string;
}

/** Élément complet, au format de l'API (champs inutiles à l'import compris) */
export function adnVideo(v: VideoFixture): Record<string, unknown> {
  const showPath = `/video/${v.show.id}-${v.show.slug}`;
  const urlPath = `${showPath}/${v.id}-episode-${v.shortNumber.toLowerCase()}`;
  return {
    id: v.id,
    title: `${v.show.title} - Épisode ${v.shortNumber}`,
    name: `Épisode ${v.shortNumber}`,
    number: `Épisode ${v.shortNumber}`,
    shortNumber: v.shortNumber,
    season: v.season ?? '1',
    reference: `${v.show.slug}-${v.shortNumber}`,
    type: v.type ?? 'EPS',
    order: Number(v.shortNumber) || 0,
    duration: v.duration ?? 1421,
    releaseDate: '2026-07-10T15:00:00Z',
    user: { id: 4242, stoptime: v.stoptime, watchDate: v.watchDate, isFullyWatched: v.fully },
    url: `${ORIGIN}${urlPath}`,
    urlPath,
    show: {
      id: v.show.id,
      title: v.show.title,
      originalTitle: v.show.originalTitle,
      shortTitle: v.show.title,
      reference: v.show.slug,
      type: 'EPS',
      genres: v.show.genres,
      urlPath: showPath,
      episodeCount: v.show.episodeCount,
      distributions: ['fr'],
      basedOn: 'Manga',
    },
  };
}

export const STUDENT_COUNCIL = {
  id: 1428,
  slug: 'even-the-student-council-has-its-holes',
  title: 'Even the Student Council Has Its Holes!',
  originalTitle: 'Seitokai ni mo Ana wa Aru!',
  genres: ['Animation japonaise', 'Comédie', 'Romance'],
  episodeCount: 12,
};
export const HERO_WITHOUT_A_CLASS = {
  id: 1331,
  slug: 'hero-without-a-class-who-even-needs-skills',
  title: 'Hero Without a Class: Who Even Needs Skills?!',
  originalTitle: 'Muzokusei Yuusha no Isekai Seikatsu',
  genres: ['Animation japonaise', 'Fantasy'],
  episodeCount: 12,
};
/** Adaptation de manhwa (pas « Animation japonaise ») : jamais filtrée, la correspondance AniList décide */
export const GIRL_DOWNSTAIRS = {
  id: 1290,
  slug: 'the-girl-downstairs',
  title: 'The Girl Downstairs',
  originalTitle: 'Arae-cheung Geunyeo',
  genres: ['Animation coréenne', 'Romance'],
  episodeCount: 10,
};

/** Première page : le plus récent d'abord, comme l'API */
export const ADN_HISTORY_VIDEOS: Record<string, unknown>[] = [
  // Réel : E2 commencé seulement (16 s sur 1421) → jamais importé
  adnVideo({ id: 30016, show: STUDENT_COUNCIL, shortNumber: '2', stoptime: 16, fully: false, watchDate: '2026-10-12T19:40:00.000Z' }),
  // Réel : E1 terminé
  adnVideo({ id: 30015, show: STUDENT_COUNCIL, shortNumber: '1', stoptime: 1299, fully: true, watchDate: '2026-10-12T19:15:00.000Z' }),
  adnVideo({ id: 29933, show: HERO_WITHOUT_A_CLASS, shortNumber: '2', stoptime: 1200, fully: false, watchDate: '2026-10-11T20:00:00.000Z' }),
  adnVideo({ id: 29932, show: HERO_WITHOUT_A_CLASS, shortNumber: '1', stoptime: 1400, fully: true, watchDate: '2026-10-10T20:00:00.000Z' }),
  // Non marqué terminé, mais 1300 / 1400 s (93 %) ≥ seuil de fin par défaut (85 %)
  adnVideo({ id: 27003, show: GIRL_DOWNSTAIRS, shortNumber: '3', duration: 1400, stoptime: 1300, fully: false, watchDate: '2026-10-09T20:00:00.000Z' }),
  // Spécial non numéroté : ignoré
  adnVideo({ id: 27099, show: GIRL_DOWNSTAIRS, shortNumber: 'OAV', stoptime: 1400, fully: true, watchDate: '2026-10-09T21:00:00.000Z' }),
];
