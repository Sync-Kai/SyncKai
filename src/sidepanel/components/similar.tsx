// Section « Dans le même esprit » de la carte de détails : jusqu'à 5 séries voisines de la fiche (recommandations AniList déjà
// filtrées par le contrôleur : hors listes, écartées, préquel non vu). Une ligne par série : jaquette, titre (fiche), « N fans de … »,
// « Regarder » (page de plateforme connue) et « + À regarder ».
import { useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { entryLink, type EntryLinkContext } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { PanelRecommendation } from '../../shared/panel-media.types';
import type { SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { choosePlatformLink } from '../../shared/watching';
import { Button } from '../../ui/components/button';
import { Collapsible } from '../../ui/components/collapsible';
import { ServiceLogo } from '../../ui/components/service-logo';
import { addToPlanning, markRecommendationAdded, noMalEntry, sequelAddResult, sequelEndedKey } from '../../ui/sequel-actions';
import { newTabLabel } from './now-playing-hero';

export interface SimilarProps {
  items: readonly PanelRecommendation[];
  /** Titre de la fiche affichée (« N fans de … ») */
  title: string;
  links: EntryLinkContext;
  preferred: StreamingPlatform;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** La section est dessinée : au moins une série à proposer (même règle pour la carte, qui y met un séparateur) */
export const showsSimilar = (items: readonly PanelRecommendation[]): boolean => items.length > 0;

function Row({ item, title, links, preferred }: { item: PanelRecommendation; title: string; links: EntryLinkContext; preferred: StreamingPlatform }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const result = outcome ? sequelAddResult(outcome, t('error.unexpectedAdd')) : null;
  const ended = result?.kind === 'ended';
  // Fiche AniList toujours connue : repli sur sa page si MyAnimeList est préférée sans équivalent
  const site = entryLink({ mediaId: item.mediaId, malId: item.idMal }, links) ?? { service: 'anilist' as const, url: item.siteUrl };
  const watch = choosePlatformLink(item, preferred);
  const unaddable = noMalEntry(links.connected, item.idMal);
  const meta = [item.format, item.startYear].filter((part) => part !== null && part !== '').join(' · ');
  const add = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const done = await addToPlanning({ mediaId: item.mediaId, malId: item.idMal });
    // Un service a écrit (ou déjà en liste) : le lot de Découvrir ne doit plus la proposer
    if (sequelAddResult(done, '').kind === 'ended') await markRecommendationAdded(item.mediaId);
    setOutcome(done);
    setBusy(false);
  };
  return (
    <li class="flex min-w-0 gap-2.5" data-similar-row={item.mediaId}>
      {item.coverUrl ? (
        <img class="h-14 w-10 shrink-0 rounded-control bg-raised object-cover" src={item.coverUrl} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />
      ) : (
        <span class="h-14 w-10 shrink-0 rounded-control bg-raised" aria-hidden="true" />
      )}
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <a
          class="group/link min-w-0 rounded-control text-ink no-underline"
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={newTabLabel(t('entry.openAria', { title: item.title, service: TRACKER_LABELS[site.service] }))}
          data-focus={`similar-entry-${item.mediaId}`}
        >
          <span class="line-clamp-2 text-secondary font-extrabold break-words underline-offset-2 group-hover/link:underline" title={item.title}>
            {item.title}
          </span>
        </a>
        {meta !== '' && <span class="truncate text-overline text-muted uppercase">{meta}</span>}
        {item.rating >= 1 && <span class="text-secondary text-muted">{tp('panel.similar.fans', item.rating, { count: item.rating, title })}</span>}
        <div class="flex min-w-0 flex-wrap items-center gap-1.5">
          {watch && (
            <a
              class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill border border-line px-2.5 text-secondary font-extrabold text-ink no-underline transition-colors hover:border-field hover:bg-raised"
              href={watch.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('panel.nowPlaying.watchOn', { platform: PLATFORMS[watch.platform].label })}
              aria-label={t('panel.nowPlaying.watchAria', { title: item.title, platform: PLATFORMS[watch.platform].label })}
              data-focus={`similar-watch-${item.mediaId}`}
            >
              <ServiceLogo id={watch.platform} size="sm" />
              {t('panel.nowPlaying.watch')}
            </a>
          )}
          {!ended && !unaddable && links.connected.length > 0 && (
            <Button size="sm" busy={busy} ariaLabel={t('sequel.addLabel', { title: item.title })} focusKey={`similar-add-${item.mediaId}`} onClick={() => void add()}>
              {result?.kind === 'failed' ? t('common.retry') : t('sequel.add')}
            </Button>
          )}
        </div>
        {ended && <span class="text-secondary font-bold text-lavender">{t(sequelEndedKey(result))}</span>}
        {!ended && unaddable && <span class="text-secondary font-bold text-lavender">{t('sequel.notOnMal')}</span>}
        {result?.kind === 'failed' && <span class="line-clamp-2 text-secondary font-bold text-danger" title={result.message}>{result.message}</span>}
      </div>
    </li>
  );
}

export function Similar({ items, title, links, preferred, open, onToggle }: SimilarProps) {
  if (!showsSimilar(items)) return null;
  return (
    <Collapsible variant="row" title={t('panel.similar.title')} open={open} onToggle={onToggle} focusKey="panel-section-similar">
      <ul class="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <Row key={item.mediaId} item={item} title={title} links={links} preferred={preferred} />
        ))}
      </ul>
    </Collapsible>
  );
}
