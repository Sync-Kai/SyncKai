// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import { LOCALES } from '../../i18n/locale-codes';
import type { PageListState, PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { PageMediaContent } from '../../ui/page-media-controller';
import type { MediaActionsState } from '../../ui/media-actions';
import { splitAround } from '../../ui/page-media-view';
import { settingsPath } from '../../ui/settings/navigation';
import { hasPageMediaCard, PageMediaCard, type PageMediaCardProps } from './page-media-card';

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const key = <T extends HTMLElement = HTMLElement>(focus: string): T | null => $<T>(`[data-focus="${focus}"]`);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

const PAGE: PageMediaInfo = {
  platform: 'crunchyroll',
  kind: 'series',
  seriesId: 'GG5H5XQX4',
  seriesSlug: 'frieren',
  seriesTitle: 'Frieren',
  seasonNumber: 1,
  seasonTitle: null,
  episode: null,
};
const PAGE_EPISODE: PageMediaInfo = {
  ...PAGE,
  kind: 'episode',
  episode: {
    platform: 'crunchyroll',
    episodeId: 'E6',
    seriesId: 'GG5H5XQX4',
    seriesSlug: 'frieren',
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 6,
    displayedEpisodeNumber: 6,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/E6',
  },
};

const IN_LIST: PageListState = { service: 'anilist', state: 'in-list', status: 'CURRENT', progress: 6, score: 8, notes: 'Superbe', siteUrl: 'https://anilist.co/anime/154587' };
const MISSING: PageListState = { service: 'mal', state: 'not-in-list', siteUrl: 'https://myanimelist.net/anime/52991' };

function view(lists: PageListState[], over: Partial<PageMediaView> = {}): PageMediaView {
  return {
    media: { mediaId: 154587, idMal: 52991, title: 'Frieren', coverUrl: null, episodes: 28, format: 'TV', year: 2023, airingStatus: 'FINISHED', nextEpisode: null, siteUrl: 'https://anilist.co/anime/154587' },
    lists,
    confidence: 'certain',
    source: 'page',
    episodeProgress: null,
    seasons: [
      { id: 154587, title: 'Frieren', format: 'TV', episodes: 28, year: 2023, coverUrl: null, slot: { season: 1, part: 1, parts: 1 } },
      { id: 182255, title: 'Frieren 2', format: 'TV', episodes: 12, year: 2026, coverUrl: null, slot: { season: 2, part: 1, parts: 1 } },
    ],
    ...over,
  };
}

const NO_ACTIONS: MediaActionsState = { busy: null, confirm: null, feedback: null };
const handlers = {
  onRetry: vi.fn<() => void>(),
  onAdd: vi.fn(),
  onAdjust: vi.fn<(delta: 1 | -1) => void>(),
  onRetryAdjust: vi.fn(),
  onSetStatus: vi.fn(),
  onRate: vi.fn<(value: number) => void>(),
  onPickSeason: vi.fn<(id: number) => void>(),
  onSaveNotes: vi.fn<(notes: string) => Promise<boolean>>(),
  onExclude: vi.fn<() => void>(),
  onInclude: vi.fn<() => void>(),
  onRemove: vi.fn<() => void>(),
  onOpenPlatformsSettings: vi.fn<() => void>(),
};

function card(content: PageMediaContent<never>, over: Partial<PageMediaCardProps> = {}) {
  return (
    <PageMediaCard
      card={{ content, actions: NO_ACTIONS }}
      now={Date.UTC(2026, 9, 17)}
      entryLinks={{ connected: ['anilist', 'mal'], preferred: 'anilist' }}
      excluded={false}
      notice={null}
      {...handlers}
      {...over}
    />
  );
}

const ready = (v: PageMediaView, page: PageMediaInfo = PAGE): PageMediaContent<never> => ({ status: 'ready', page, view: v, details: null, detailsError: null, refreshing: false });

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  for (const fn of Object.values(handlers)) fn.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('carte « Sur cette page »', () => {
  it('rien hors page reconnue (carte « Reprendre » à la place)', async () => {
    for (const status of ['idle', 'detecting'] as const) {
      expect(hasPageMediaCard({ content: { status }, actions: NO_ACTIONS })).toBe(false);
      await show(card({ status }));
      expect(container.innerHTML).toBe('');
    }
    expect(hasPageMediaCard({ content: { status: 'no-page', unreachable: false }, actions: NO_ACTIONS })).toBe(false);
    expect(hasPageMediaCard({ content: { status: 'loading', page: PAGE }, actions: NO_ACTIONS })).toBe(true);
  });

  it('chargement : squelette nommé avec le titre de la page', async () => {
    await show(card({ status: 'loading', page: PAGE }));
    expect($('section')?.getAttribute('aria-busy')).toBe('true');
    expect($('section')?.getAttribute('aria-label')).toBe(t('page.loading', { title: 'Frieren' }));
  });

  it('introuvable : alerte beurre et « Réessayer » ; erreur réseau : alerte danger', async () => {
    await show(card({ status: 'not-found', page: PAGE, message: t('page.notFound', { title: 'Frieren' }), untracked: false }));
    expect($('[data-alert]')?.dataset.tone).toBe('warn');
    await act(() => $<HTMLButtonElement>('[data-alert] button')?.click());
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    await show(card({ status: 'error', page: PAGE, message: 'AniList est injoignable.' }));
    expect($('[data-alert]')?.dataset.tone).toBe('error');
  });

  it('pas un anime : mention neutre sans bouton ; plateforme désactivée : « Réglages › Plateformes » devient un lien', async () => {
    await show(card({ status: 'not-found', page: PAGE, message: t('page.notTracked', { platform: 'Netflix' }), untracked: true }));
    expect($('[role="status"]')?.textContent).toBe(t('page.notTracked', { platform: 'Netflix' }));
    expect($('button')).toBeNull();
    await show(card({ status: 'not-found', page: PAGE, message: t('page.platformOff', { platform: 'Netflix' }), untracked: true }));
    expect($('[role="status"]')?.textContent).toBe(t('page.platformOff', { platform: 'Netflix' }));
    const link = key<HTMLButtonElement>('page-platforms-settings');
    expect(link?.textContent).toBe(settingsPath('platforms'));
    await act(() => link?.click());
    expect(handlers.onOpenPlatformsSettings).toHaveBeenCalledTimes(1);
  });

  it('chaque langue : la phrase « plateforme désactivée » contient le chemin des Réglages (lien)', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(splitAround(t('page.platformOff', { platform: 'Netflix' }), settingsPath('platforms')), locale).not.toBeNull();
    }
  });

  it('dans la liste (un compte) : en-tête, statut et − / + ; pas de lignes par service ni d’ajout', async () => {
    await show(card(ready(view([IN_LIST]))));
    expect($('[data-media-meta]')?.textContent).toBe('Saison 1 · 2023 · 28 ép. · Terminée · Crunchyroll');
    expect($('[data-list-status]')?.textContent).toBe(t('page.status.CURRENT'));
    expect(key('page-plus')).not.toBeNull();
    expect($('[data-service-lines]')).toBeNull();
    expect(key('page-add-PLANNING')).toBeNull();
    await act(() => key<HTMLButtonElement>('page-plus')?.click());
    expect(handlers.onAdjust).toHaveBeenCalledWith(1);
  });

  it('absente d’un des deux comptes : lignes par service et boutons d’ajout (secondaires, le + reste principal)', async () => {
    await show(card(ready(view([IN_LIST, MISSING]))));
    expect($('[data-service-line="mal"]')?.textContent).toBe(t('page.notInList'));
    expect(key('page-add-CURRENT')?.dataset.variant).toBe('secondary');
    await show(card(ready(view([{ ...MISSING, service: 'anilist' }, MISSING]))));
    expect($('[data-service-lines]')).toBeNull();
    expect($('[data-media-meta]')?.textContent).toContain(t('page.notInList'));
    expect(key('page-add-CURRENT')?.dataset.variant).toBe('primary');
    expect(key('page-plus')).toBeNull();
  });

  it('menu « ⋯ » : statut actuel grisé ; hors liste, ni statuts ni retrait ; exclusion transmise', async () => {
    await show(card(ready(view([{ ...IN_LIST, status: 'PAUSED' }]))));
    await act(() => key<HTMLButtonElement>('more-page')?.click());
    expect(key<HTMLButtonElement>('PAUSED-page')?.disabled).toBe(true);
    expect(key('PAUSED-page')?.textContent).toContain(t('page.currentStatus'));
    expect(key('notes-page')).toBeNull();
    await act(() => key<HTMLButtonElement>('exclude-page')?.click());
    expect(handlers.onExclude).toHaveBeenCalledTimes(1);

    await show(card(ready(view([{ ...MISSING, service: 'anilist' }]))));
    await act(() => key<HTMLButtonElement>('more-page')?.click());
    expect(key('PAUSED-page')).toBeNull();
    expect(key('REMOVE-page')).toBeNull();
  });

  it('saison devinée : avertissement et sélecteur au-dessus, hors des détails', async () => {
    await show(card(ready(view([IN_LIST], { confidence: 'uncertain' }))));
    expect($('[data-season-picker] [role="note"]')?.textContent).toBe(t('page.uncertain'));
    await show(card(ready(view([IN_LIST], { confidence: 'uncertain', source: 'manual' }))));
    expect($('[data-season-picker] [role="note"]')?.textContent).toBe(t('page.manualNotSaved'));
  });

  it('détails dépliés : saison (aide sur une page de lecture), note, commentaire ; choix de saison transmis', async () => {
    await show(card(ready(view([IN_LIST]), PAGE_EPISODE)));
    expect(key('page-season')).toBeNull();
    await act(() => key<HTMLButtonElement>('page-details')?.click());
    expect(container.textContent).toContain(t('page.seasonOnAniList'));
    expect(container.textContent).toContain(t('page.seasonHelp'));
    expect($('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('8');
    expect(key<HTMLTextAreaElement>('page-notes-input')?.value).toBe('Superbe');
    const select = key<HTMLSelectElement>('page-season');
    await act(() => {
      if (!select) return;
      select.value = '182255';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(handlers.onPickSeason).toHaveBeenCalledWith(182255);
  });

  it('retour : celui du popup (exclusion) prime ; échec partiel avec « Réessayer »', async () => {
    const retry = { services: ['mal' as const], delta: 1 as const, progress: 7 };
    await show(card({ ...ready(view([IN_LIST])) }, { card: { content: ready(view([IN_LIST])), actions: { ...NO_ACTIONS, feedback: { tone: 'warning', text: 'Ép. 7 vu · échec MyAnimeList', detail: '', retry } } } }));
    await act(() => key<HTMLButtonElement>('page-retry')?.click());
    expect(handlers.onRetryAdjust).toHaveBeenCalledWith(retry);
    await show(card(ready(view([IN_LIST])), { notice: { tone: 'info', text: t('popup.syncDisabled'), detail: '' } }));
    expect($('[data-feedback]')?.textContent).toBe(t('popup.syncDisabled'));
  });
});
