// Textes du groupe « En sommeil » calculés hors du rendu (testés) : ancienneté de la dernière activité d'une série,
// progression d'un lot sur le bouton qui l'a lancé.
import { getLocale, type Locale } from '../i18n';

/**
 * Bouton qui a lancé un lot de plusieurs séries (« Tout mettre en pause », « Annuler », « Réessayer ») : « 3 / 20 » en
 * chiffres à la place du libellé, nom accessible = son nom (`name`, sinon le libellé) suivi de la progression
 */
export function progressLabel(progress: { done: number; total: number } | null | undefined, label: string, name?: string): { label: string; ariaLabel: string | undefined } {
  if (!progress || progress.total < 2) return { label, ariaLabel: name };
  const digits = `${progress.done} / ${progress.total}`;
  return { label: digits, ariaLabel: `${name ?? label} ${digits}` };
}

const DAY_MS = 86_400_000;
/** Sous ce nombre de jours, l'ancienneté est dite en semaines ; au-delà, en mois */
const WEEKS_UNTIL_DAYS = 60;

/**
 * « il y a 6 semaines » sous 60 jours, « il y a 2 mois » au-delà (Intl.RelativeTimeFormat de la langue) ; toujours dans
 * le passé et au moins une unité (horloge en retard, activité très récente)
 */
export function formatInactivity(at: number, now: number, locale: Locale = getLocale()): string {
  const days = Math.max(0, Math.floor((now - at) / DAY_MS));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  return days < WEEKS_UNTIL_DAYS ? format.format(-Math.max(1, Math.floor(days / 7)), 'week') : format.format(-Math.floor(days / 30), 'month');
}
