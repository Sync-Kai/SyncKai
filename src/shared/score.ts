import type { Score10 } from './engagement.types';
import type { TrackerId } from './tracker.types';

/** Formats de note AniList (réglage du profil `mediaListOptions.scoreFormat`) */
export type AniListScoreFormat = 'POINT_100' | 'POINT_10_DECIMAL' | 'POINT_10' | 'POINT_5' | 'POINT_3';

const SCORE_FORMATS: readonly AniListScoreFormat[] = ['POINT_100', 'POINT_10_DECIMAL', 'POINT_10', 'POINT_5', 'POINT_3'];

export function isAniListScoreFormat(value: unknown): value is AniListScoreFormat {
  return SCORE_FORMATS.some((format) => format === value);
}

/**
 * Note SyncKai (sur 10, pas 0,5) → valeur `score` de SaveMediaListEntry, exprimée dans le format du profil.
 * Formats entiers (sur 10, sur 5, smileys) : convertis depuis la note entière écrite sur MAL (toMalScore,
 * arrondi inférieur), pour qu'une même note donne la même valeur sur les deux services (8,5 → 8 et 8).
 */
export function toAniListScore(score: Score10, format: AniListScoreFormat): number {
  switch (format) {
    case 'POINT_100':
      return Math.round(score * 10);
    case 'POINT_10_DECIMAL':
      return Math.round(score * 10) / 10;
    case 'POINT_10':
      return toMalScore(score);
    case 'POINT_5':
      return Math.max(1, Math.round(toMalScore(score) / 2));
    case 'POINT_3': {
      // 3 smileys : ≤ 4 mécontent, ≤ 7 neutre, sinon content
      const whole = toMalScore(score);
      return whole <= 4 ? 1 : whole <= 7 ? 2 : 3;
    }
  }
}

/**
 * Note sur 10 (note SyncKai, ou note AniList ramenée sur 10 pour un alignement) → note MAL : entier 1 à 10, arrondi à
 * l'inférieur (8,5 → 8, jamais au-dessus de la note donnée). Tolérance : 3 smileys AniList (10/3 × 3 = 9,999…) donne 10.
 */
export function toMalScore(score: number): number {
  return Math.min(10, Math.max(1, Math.floor(score + 1e-9)));
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

/**
 * Conversions de note d'un service (audit 6-P2), une par service et par format : les écritures (note, alignement), la
 * fiche affichée et la comparaison des listes passent toutes par elles. Même contrat pour AniList et MAL (score.test.ts).
 */
export interface ScoreCodec {
  /** Note sur 10 → valeur écrite sur le service */
  encode(score: number): number;
  /** Valeur lue → note SyncKai (demi-point, affichage) ; null si non notée */
  decode(raw: number): Score10 | null;
  /** Valeur lue → note sur 10 non arrondie (comparaison des listes) ; null si non notée */
  on10(raw: number): number | null;
}

/** Notes MAL : entiers de 1 à 10, 0 = non notée */
export const MAL_SCORES: ScoreCodec = {
  encode: toMalScore,
  decode: fromMalScore,
  on10: (raw) => (Number.isFinite(raw) && raw > 0 ? raw : null),
};

/** Notes AniList dans le format du profil */
export function aniListScores(format: AniListScoreFormat): ScoreCodec {
  return {
    encode: (score) => toAniListScore(score, format),
    decode: (raw) => fromAniListScore(raw, format),
    on10: (raw) => aniListScoreOn10(raw, format),
  };
}

/** Codec d'un service ; `format` : format de note du profil AniList (ignoré pour MAL) */
export function scoreCodec(service: TrackerId, format: AniListScoreFormat): ScoreCodec {
  return service === 'anilist' ? aniListScores(format) : MAL_SCORES;
}

/**
 * Note AniList brute → valeur sur 10 non arrondie (comparaison avec MAL) ; null si non notée.
 * Contrairement à fromAniListScore, pas d'arrondi au demi-point : 7,8 reste 7,8 (MAL 7, pas 8).
 */
export function aniListScoreOn10(score: number, format: AniListScoreFormat): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  switch (format) {
    case 'POINT_100':
      return score / 10;
    case 'POINT_10_DECIMAL':
    case 'POINT_10':
      return score;
    case 'POINT_5':
      return score * 2;
    case 'POINT_3':
      return (score / 3) * 10;
  }
}
