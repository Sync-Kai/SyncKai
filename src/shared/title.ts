// Normalisation de titre (module feuille) : rapprochement des titres AniList, de la plateforme et des exclusions.

/** "Shingeki no Kyojin: Season 2" → "shingeki no kyojin season 2" (accents et ponctuation retirés) */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GENERIC_SEASON_REGEX = /^(?:season|saison|staffel|part|partie|volume)\s+\d+$/i;

/** Nom de saison exploitable pour la correspondance AniList, null s'il est générique ("Saison 1") */
export function meaningfulSeasonTitle(name: string | null): string | null {
  return name && !GENERIC_SEASON_REGEX.test(name) ? name : null;
}
