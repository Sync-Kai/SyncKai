// Textes du groupe « En sommeil » calculés hors du rendu (testés) : ancienneté de la dernière activité d'une série.
import { getLocale, type Locale } from '../i18n';

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
