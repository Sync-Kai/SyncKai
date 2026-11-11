// « Pour toi » du popup : puces de genre et choix du format (série / film) au-dessus de la vue Discover, partagée avec le
// panneau latéral. Le filtre vit dans le contrôleur (ui/reco-controller.ts) ; cet écran n'affiche les puces que lorsqu'un
// lot existe (fiche ou « aucune fiche pour ce filtre »), jamais pendant le chargement, l'erreur ou sans compte.
import { t } from '../../i18n';
import { genreKey } from '../../shared/genres';
import { ALL_RECO_FILTER, type RecoFilter, type RecoFormat } from '../../shared/recommendations';
import { Discover, type DiscoverProps } from '../../ui/components/discover';
import { Segmented, type SegmentedOption } from '../../ui/components/segmented';
import { useLocale, useStore } from '../../ui/preact/hooks';

/** Puces de genre affichées (le genre choisi s'y ajoute s'il est au-delà) */
export const MAX_GENRE_CHIPS = 8;

export type ForYouScreenProps = Omit<DiscoverProps, 'onClearFilter'> & { onFilter: (filter: RecoFilter) => void };

/** Genre traduit, sinon le nom AniList */
function genreLabel(name: string): string {
  const key = genreKey(name);
  return key ? t(key) : name;
}

interface FiltersProps {
  filter: RecoFilter;
  genres: readonly string[];
  onFilter: (filter: RecoFilter) => void;
}

function GenreChip({ label, on, focusKey, onPick }: { label: string; on: boolean; focusKey: string; onPick: () => void }) {
  return (
    <button
      type="button"
      class={`inline-flex h-7 max-w-full cursor-pointer items-center rounded-pill border px-3 text-secondary font-bold transition-colors ${
        on ? 'border-field bg-raised text-ink' : 'border-line bg-transparent text-muted hover:text-ink'
      }`}
      aria-pressed={on ? 'true' : 'false'}
      data-focus={focusKey}
      onClick={() => !on && onPick()}
    >
      <span class="truncate">{label}</span>
    </button>
  );
}

function Filters({ filter, genres, onFilter }: FiltersProps) {
  const shown = genres.slice(0, MAX_GENRE_CHIPS);
  if (filter.genre !== null && !shown.includes(filter.genre)) shown.push(filter.genre);
  const formats: readonly SegmentedOption<RecoFormat>[] = [
    { value: 'all', label: t('reco.filter.all') },
    { value: 'series', label: t('reco.filter.series') },
    { value: 'movies', label: t('reco.filter.movies') },
  ];
  return (
    <div class="flex flex-col gap-2 pt-1" data-reco-filters="">
      <div class="flex flex-wrap gap-1.5" role="group" aria-label={t('panel.nowPlaying.genres')}>
        <GenreChip label={t('reco.filter.all')} on={filter.genre === null} focusKey="reco-genre-all" onPick={() => onFilter({ ...filter, genre: null })} />
        {shown.map((genre) => (
          <GenreChip key={genre} label={genreLabel(genre)} on={filter.genre === genre} focusKey={`reco-genre-${genre}`} onPick={() => onFilter({ ...filter, genre })} />
        ))}
      </div>
      <Segmented options={formats} value={filter.format} onChange={(format) => onFilter({ ...filter, format })} label={t('reco.filter.format')} focusKey="reco-format" fill />
    </div>
  );
}

export function ForYouScreen({ onFilter, ...discover }: ForYouScreenProps) {
  useLocale();
  const view = useStore(discover.state);
  return (
    <div class="flex flex-col">
      {(view.status === 'ready' || view.status === 'filtered') && <Filters filter={view.filter} genres={view.genres} onFilter={onFilter} />}
      <Discover {...discover} onClearFilter={() => onFilter(ALL_RECO_FILTER)} />
    </div>
  );
}
