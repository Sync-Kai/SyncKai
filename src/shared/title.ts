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

/**
 * Titre sans accents pour la recherche AniList : sa recherche ignore les synonymes accentués
 * (« Moi, quand je me réincarne en Slime » : aucun résultat, « … reincarne … » : la fiche). null si rien à retirer.
 */
export function withoutDiacritics(title: string): string | null {
  const stripped = title.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  return stripped !== title.normalize('NFC') ? stripped : null;
}

/** Slug d'URL (« that-time-i-got-reincarnated-as-a-slime ») en texte de recherche, null s'il est vide */
export function slugSearchTitle(slug: string | null): string | null {
  if (!slug) return null;
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Slug mal encodé : utilisé tel quel
  }
  const text = decoded.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}
