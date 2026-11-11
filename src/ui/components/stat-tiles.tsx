// Tuiles des statistiques du profil (animes, épisodes, jours visionnés) : menu du compte et écran Stats du popup.
// Pendant la lecture, chaque valeur est remplacée par un pavé de même hauteur (aucun saut à l'arrivée des données).
import { getLocale, t, tp } from '../../i18n';
import type { AccountStats } from '../../shared/account-stats';
import { formatStatDays } from '../account-menu-model';

/** Texte remplacé par un pavé de même hauteur pendant la lecture (aucun saut à l'arrivée des données) */
export function Placeholder({ width }: { width: string }) {
  return (
    <span class={`inline-block ${width} rounded-control bg-line text-transparent motion-safe:animate-pulse`} aria-hidden="true" data-skeleton="">
      0
    </span>
  );
}

function StatTile({ value, label }: { value: string | null; label: string }) {
  return (
    <div class="flex min-w-0 flex-col items-center rounded-control bg-surface px-1 py-1.5" data-stat="">
      <span class="font-display text-stat whitespace-nowrap text-ink tabular-nums">{value ?? <Placeholder width="w-10" />}</span>
      <span class="max-w-full truncate text-section font-semibold tracking-normal text-muted" title={label}>
        {label}
      </span>
    </div>
  );
}

export function StatTiles({ stats }: { stats: AccountStats | 'loading' }) {
  const locale = getLocale();
  const count = new Intl.NumberFormat(locale);
  const ready = stats === 'loading' ? null : stats;
  const days = ready ? Math.round(ready.days) : 0;
  return (
    <div class="grid grid-cols-3 gap-1 px-1.5 py-1" aria-busy={ready ? undefined : 'true'} data-stats="">
      <StatTile value={ready ? count.format(ready.animeCount) : null} label={tp('accountMenu.stats.anime', ready?.animeCount ?? 0)} />
      <StatTile value={ready ? count.format(ready.episodes) : null} label={tp('accountMenu.stats.episodes', ready?.episodes ?? 0)} />
      <StatTile value={ready ? t('accountMenu.stats.daysValue', { days: formatStatDays(ready.days, locale) }) : null} label={tp('accountMenu.stats.days', days)} />
    </div>
  );
}
