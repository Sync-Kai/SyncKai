import { getLocale, t } from '../i18n/core';

// Notation 10 étoiles avec demi-étoiles : 20 valeurs (0,5 → 10), envoyées telles quelles comme Score10

export const STAR_COUNT = 10;
export const STAR_STEP = 0.5;
/** Valeurs proposées, de 0,5 à 10 */
export const STAR_VALUES: readonly number[] = Array.from({ length: STAR_COUNT / STAR_STEP }, (_, i) => (i + 1) * STAR_STEP);

export type StarFill = 'full' | 'half' | 'empty';

export function isStarValue(value: number): boolean {
  return value >= STAR_STEP && value <= STAR_COUNT && Number.isInteger(value / STAR_STEP);
}

/** "8,5" en français et en allemand, "8.5" en anglais (séparateur décimal de la langue active) */
export function formatStarValue(value: number): string {
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value);
}

/** Libellé visible de la valeur survolée / choisie : "8,5/10" ("–/10" sans valeur) */
export function formatScoreLabel(value: number): string {
  return `${value > 0 ? formatStarValue(value) : '–'}/${STAR_COUNT}`;
}

/** Libellé du bouton d'une valeur : "Noter 8,5 sur 10" */
export function rateAriaLabel(value: number): string {
  return t('rating.rateAria', { value: formatStarValue(value), max: STAR_COUNT });
}

/** Remplissage de l'étoile `index` (1 à 10) pour une valeur affichée (0 = aucune) */
export function starFill(index: number, value: number): StarFill {
  if (value >= index) return 'full';
  if (value >= index - STAR_STEP) return 'half';
  return 'empty';
}

/** Valeur portée par la moitié gauche ou droite de l'étoile `index` */
export function halfValue(index: number, side: 'left' | 'right'): number {
  return side === 'left' ? index - STAR_STEP : index;
}

/**
 * Nouvelle valeur après une touche du clavier (flèches : ±0,5, Début/Fin : bornes), ou null si la
 * touche ne concerne pas la notation. `current` = 0 quand rien n'est encore choisi.
 */
export function stepStarValue(current: number, key: string): number | null {
  const min = STAR_STEP;
  const clamp = (v: number): number => Math.min(STAR_COUNT, Math.max(min, v));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(current + STAR_STEP);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(current - STAR_STEP);
    case 'Home':
      return min;
    case 'End':
      return STAR_COUNT;
    default:
      return null;
  }
}
