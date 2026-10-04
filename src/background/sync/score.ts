import type { Score10 } from '../../shared/engagement.types';

/** Formats de note AniList (réglage du profil `mediaListOptions.scoreFormat`) */
export type AniListScoreFormat = 'POINT_100' | 'POINT_10_DECIMAL' | 'POINT_10' | 'POINT_5' | 'POINT_3';

const SCORE_FORMATS: readonly AniListScoreFormat[] = ['POINT_100', 'POINT_10_DECIMAL', 'POINT_10', 'POINT_5', 'POINT_3'];

export function isAniListScoreFormat(value: unknown): value is AniListScoreFormat {
  return SCORE_FORMATS.some((format) => format === value);
}

/** Note SyncKai (sur 10, pas 0,5) → valeur `score` de SaveMediaListEntry, exprimée dans le format du profil. */
export function toAniListScore(score: Score10, format: AniListScoreFormat): number {
  switch (format) {
    case 'POINT_100':
      return Math.round(score * 10);
    case 'POINT_10_DECIMAL':
      return Math.round(score * 10) / 10;
    case 'POINT_10':
      return Math.max(1, Math.round(score));
    case 'POINT_5':
      return Math.max(1, Math.round(score / 2));
    case 'POINT_3':
      // 3 smileys : ≤ 4 mécontent, ≤ 7 neutre, sinon content
      return score <= 4 ? 1 : score <= 7 ? 2 : 3;
  }
}

/** Note SyncKai → note MAL (entier 1 à 10, arrondi à l'inférieur : 8,5 → 8, jamais au-dessus de la note donnée) */
export function toMalScore(score: Score10): number {
  return Math.min(10, Math.max(1, Math.floor(score)));
}

/** Arrondi au demi-point le plus proche, borné à l'échelle SyncKai (0,5 à 10) */
function toScore10(value: number): Score10 | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(10, Math.max(0.5, Math.round(value * 2) / 2));
}

/** Note AniList brute (format du profil) → note SyncKai sur 10 (affichage) ; null si non notée */
export function fromAniListScore(score: number, format: AniListScoreFormat): Score10 | null {
  switch (format) {
    case 'POINT_100':
      return toScore10(score / 10);
    case 'POINT_10_DECIMAL':
    case 'POINT_10':
      return toScore10(score);
    case 'POINT_5':
      return toScore10(score * 2);
    case 'POINT_3':
      return toScore10((score / 3) * 10);
  }
}

/** Note MAL (entier 1 à 10) → note SyncKai ; null si non notée */
export function fromMalScore(score: number): Score10 | null {
  return toScore10(score);
}
