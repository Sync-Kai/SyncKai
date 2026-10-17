import { t } from '../i18n';
import { createLogger } from '../browser/logger';
import { excludeSeries, includeSeries } from '../browser/storage/exclusions-store';
import { matchesExclusion, type ExcludedSeries } from '../shared/exclusions';
import type { PageMediaInfo } from '../shared/page-media.types';
import { pageExclusionKey } from '../platforms/series-identity';
import { errorFeedback } from './feedback';
import type { ExclusionsState, InlineFeedback } from './state';

// « Ne plus synchroniser cette série » / « Réactiver la synchro » depuis la fiche de la page de l'onglet : carte « Sur cette
// page » du popup et « En lecture » du panneau latéral. Clé de la page (la même que la lecture de chaque épisode) et
// fiche AniList affichée, comme l'exclusion depuis une carte « À vérifier ». Le retour est affiché par l'écran.

const log = createLogger('page-media');

/** Fiche de la page : page lue et fiche AniList affichée */
export interface PageSeries {
  page: PageMediaInfo;
  mediaId: number;
}

/** Série exclue de la synchro : clé de la page ou fiche AniList ; séries exclues pas encore lues (ou illisibles) : non */
export function isPageSeriesExcluded(series: PageSeries | null, exclusions: ExclusionsState): boolean {
  if (series === null || exclusions.status !== 'ready') return false;
  const query = { platformKey: pageExclusionKey(series.page), mediaId: series.mediaId };
  return exclusions.items.some((entry) => matchesExclusion(entry, query));
}

export async function excludePageSeries({ page, mediaId }: PageSeries): Promise<InlineFeedback> {
  try {
    await excludeSeries({ platformKey: pageExclusionKey(page), mediaId, label: page.seriesTitle });
    return { tone: 'info', text: t('popup.syncDisabled'), detail: t('popup.syncDisabledDetail') };
  } catch (error: unknown) {
    log.error('Exclusion de la série impossible :', error);
    return errorFeedback(t('popup.excludeFailed'));
  }
}

/** Toutes les exclusions qui couvrent la série de la page sont retirées */
export async function includePageSeries({ page, mediaId }: PageSeries, items: readonly ExcludedSeries[]): Promise<InlineFeedback> {
  const query = { platformKey: pageExclusionKey(page), mediaId };
  try {
    for (const match of items.filter((entry) => matchesExclusion(entry, query))) await includeSeries(match.id);
    return { tone: 'success', text: t('popup.syncEnabled'), detail: t('popup.syncEnabledDetail') };
  } catch (error: unknown) {
    log.error('Réactivation de la série impossible :', error);
    return errorFeedback(t('popup.includeFailed'));
  }
}
