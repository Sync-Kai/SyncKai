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
