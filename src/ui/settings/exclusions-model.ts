// Réglages › Synchronisation › Séries exclues (maquettes SyncExclues, SyncExcluesEtats) : modèle sans DOM des lignes.
// Plus récente d'abord ; sous le titre, plateforme (préfixe de la clé de série), année de début d'une série désignée par
// son titre (« série de 1997 », platforms/series-identity.ts › exclusionKeyYear) et date d'exclusion.
import { getLocale, t } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { exclusionKeyYear } from '../../platforms/series-identity';
import { isStreamingPlatform, type StreamingPlatform } from '../../shared/episode.types';
import type { ExcludedSeries } from '../../shared/exclusions';

export interface ExclusionRowModel {
  id: string;
  label: string;
  /** Plateforme de la clé ; null : exclusion par fiche AniList seule */
  platform: StreamingPlatform | null;
  /** « Prime Video · série de 1997 · exclue le 3 oct. » ; vide si rien n'est connu */
  meta: string;
}

/** « 3 oct. » cette année, « 24 déc. 2025 » sinon */
function formatDay(at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(at);
}

export function exclusionRows(items: readonly ExcludedSeries[], now: number): ExclusionRowModel[] {
  return [...items]
    .sort((a, b) => b.excludedAt - a.excludedAt)
    .map((item) => {
      const prefix = item.platformKey?.split(':', 1)[0];
      const platform = isStreamingPlatform(prefix) ? prefix : null;
      const year = item.platformKey !== null ? exclusionKeyYear(item.platformKey) : null;
      const parts = [
        platform !== null ? PLATFORMS[platform].label : null,
        year !== null ? t('settings.exclusions.seriesYear', { year }) : null,
        Number.isFinite(item.excludedAt) && item.excludedAt > 0 ? t('settings.exclusions.excludedOn', { date: formatDay(item.excludedAt, now) }) : null,
      ];
      return { id: item.id, label: item.label, platform, meta: parts.filter((part) => part !== null).join(' · ') };
    });
}
