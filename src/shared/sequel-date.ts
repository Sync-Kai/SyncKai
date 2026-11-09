import { t, type MessageKey } from '../i18n';
import type { SequelSnapshot } from './sequels';

/** Date de sortie d'une suite, à la précision connue : jour, mois, saison, année ; « déjà en diffusion » prime. */
export function formatSequelDate(snapshot: SequelSnapshot, locale: string): string {
  const { year, month, day, season, seasonYear } = snapshot;
  if (snapshot.status === 'RELEASING') return t('sequel.airing');
  // Midi UTC : le jour affiché ne dépend pas du fuseau
  if (year !== null && month !== null && day !== null) return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, day, 12));
  if (year !== null && month !== null) return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, 1, 12));
  if (season !== null && seasonYear !== null) return t(`panel.nowPlaying.season.${season}` satisfies MessageKey, { year: seasonYear });
  if (year !== null) return String(year);
  return t('sequel.dateUnknown');
}
