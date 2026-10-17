import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { PageMediaInfo } from '../shared/page-media.types';
import { installFakeChrome } from '../test/fake-chrome';

// « Ne plus synchroniser » / « Réactiver la synchro » de la fiche de la page (popup et panneau) : clé de la page et fiche
// AniList, retour prêt à afficher.

const fake = installFakeChrome();
const { excludePageSeries, includePageSeries, isPageSeriesExcluded } = await import('./page-exclusion');
const { getExcludedSeries } = await import('../shared/exclusions');

const page: PageMediaInfo = {
  platform: 'crunchyroll',
  kind: 'episode',
  seriesId: 'GG5H5XQX4',
  seriesSlug: 'frieren',
  seriesTitle: 'Frieren',
  seasonNumber: 1,
  seasonTitle: null,
  episode: null,
};

describe('exclusion de la série de la page', () => {
  beforeEach(() => {
    fake.reset();
    setLocale('fr');
  });

  it('exclue : par la clé de la page ou par la fiche AniList ; séries exclues pas encore lues : non', async () => {
    expect(isPageSeriesExcluded({ page, mediaId: 154587 }, { status: 'loading' })).toBe(false);
    expect(isPageSeriesExcluded(null, { status: 'ready', items: [] })).toBe(false);

    expect(await excludePageSeries({ page, mediaId: 154587 })).toMatchObject({ tone: 'info', text: 'Synchro désactivée' });
    const items = await getExcludedSeries();
    expect(items).toHaveLength(1);
    expect(isPageSeriesExcluded({ page, mediaId: 154587 }, { status: 'ready', items })).toBe(true);
    // Même fiche AniList lue depuis une autre plateforme
    expect(isPageSeriesExcluded({ page: { ...page, platform: 'adn', seriesId: '1311' }, mediaId: 154587 }, { status: 'ready', items })).toBe(true);
    expect(isPageSeriesExcluded({ page: { ...page, seriesId: 'AUTRE' }, mediaId: 1 }, { status: 'ready', items })).toBe(false);
  });

  it('réactivation : toutes les exclusions qui couvrent la série sont retirées', async () => {
    await excludePageSeries({ page, mediaId: 154587 });
    await excludePageSeries({ page: { ...page, platform: 'adn', seriesId: '1311' }, mediaId: 154587 });
    const before = await getExcludedSeries();
    expect(before.length).toBeGreaterThan(0);

    expect(await includePageSeries({ page, mediaId: 154587 }, before)).toMatchObject({ tone: 'success', text: 'Synchro réactivée' });
    expect(isPageSeriesExcluded({ page, mediaId: 154587 }, { status: 'ready', items: await getExcludedSeries() })).toBe(false);
  });
});
