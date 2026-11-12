// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale, t, tl } from '../../i18n';
import type { StreamingPlatform } from '../../platforms/registry';
import { ALL_RECO_FILTER, type RecoItem } from '../../shared/recommendations';
import { useFocusFallback } from '../preact/hooks';
import type { RecoView } from '../reco-controller';
import { RecoCard, type RecoCardProps } from './reco-card';

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

const item = (over: Partial<RecoItem['card']> = {}, matched: string[] = ['Action', 'Slice of Life', 'Weirdo']): RecoItem => ({
  card: { id: 7, idMal: 70, title: 'Dandadan', format: 'TV', year: 2024, episodes: 12, averageScore: 84, genres: ['Action'], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: 'https://anilist.co/anime/7', platforms: [], ...over },
  score: 10,
  reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 9, rated: true, matched },
});
type Ready = Extract<RecoView, { status: 'ready' }>;
const view = (current: RecoItem, over: Partial<Ready> = {}): Ready => ({ status: 'ready', current, previous: [], cold: false, malOnly: false, added: null, dismissedTitle: null, filter: ALL_RECO_FILTER, genres: [], ...over });

const handlers = { onAnother: vi.fn<() => void>(), onAdd: vi.fn<() => void>(), onDismiss: vi.fn<() => void>(), onUndo: vi.fn<() => void>(), onEnable: vi.fn<(platform: StreamingPlatform) => void>() };
const props = (current: RecoItem, over: Partial<Ready> = {}, extra: Partial<RecoCardProps> = {}): RecoCardProps => ({ item: current, view: view(current, over), granted: [], ...handlers, ...extra });

/** Hôte à repli du focus (panneau, popup) : l'onglet affiché */
function Host({ card }: { card: RecoCardProps }) {
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root, 'tab-discover');
  return (
    <div ref={root}>
      <button type="button" data-focus="tab-discover">
        Découvrir
      </button>
      <RecoCard {...card} />
    </div>
  );
}

describe('RecoCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le titre, la note et la case « pourquoi » avec des genres traduits (4 puces au plus)', async () => {
    const current = item({}, ['Action', 'Slice of Life', 'Comedy', 'Drama', 'Mystery']);
    await show(<RecoCard {...props(current)} />);
    expect(container.textContent).toContain('Dandadan');
    expect(container.textContent).toContain('8.4');
    const why = $('[data-reco-why]');
    expect(why?.textContent).toContain(t('reco.because', { title: 'Frieren', score: 9 }));
    const chips = [...container.querySelectorAll('[data-reco-chip]')].map((c) => c.textContent);
    expect(chips).toHaveLength(4);
    expect(chips[0]).toBe(t('genre.action'));
    expect(chips[1]).toBe(t('genre.sliceOfLife'));
  });

  it('un libellé inconnu garde le nom AniList', async () => {
    await show(<RecoCard {...props(item({}, ['Weirdo']))} />);
    expect($('[data-reco-chip]')?.textContent).toBe('Weirdo');
  });

  it('bannière : image d\'un hôte autorisé, couleur de repli sans bannière, aucune image d\'un hôte refusé', async () => {
    await show(<RecoCard {...props(item({ bannerUrl: 'https://s4.anilist.co/file/banner.jpg', color: '#ff8800' }))} />);
    expect($('[data-reco-banner] img')?.getAttribute('src')).toBe('https://s4.anilist.co/file/banner.jpg');
    await show(<RecoCard {...props(item({ bannerUrl: null, color: '#ff8800' }))} />);
    expect($('[data-reco-banner] img')).toBeNull();
    expect($<HTMLElement>('[data-reco-banner]')?.style.backgroundColor).not.toBe('');
    await show(<RecoCard {...props(item({ bannerUrl: 'https://evil.example/b.jpg', color: null }))} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('titre sur 2 lignes avec infobulle, lien « Ouvrir sur AniList »', async () => {
    await show(<RecoCard {...props(item())} />);
    const title = $('a.line-clamp-2');
    expect(title?.getAttribute('title')).toBe('Dandadan');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent?.includes(t('page.openOn', { service: 'AniList' })));
    expect(link?.getAttribute('href')).toBe('https://anilist.co/anime/7');
  });

  it('puces : genres lavande, étiquettes bordées', async () => {
    await show(<RecoCard {...props(item({ genres: ['Action'], tags: ['Time Loop'] }, ['Action', 'Time Loop']))} />);
    const kinds = [...container.querySelectorAll('[data-reco-chip]')].map((c) => c.getAttribute('data-reco-chip'));
    expect(kinds).toEqual(['genre', 'tag']);
    expect($('[data-reco-chip="genre"]')?.className).toContain('text-lavender');
    expect($('[data-reco-chip="tag"]')?.className).toContain('border-line');
    expect($('[data-reco-why]')?.className).toContain('bg-raised');
  });

  it('focus : « Annuler » après « Pas intéressé », « Autre » après l\'annulation', async () => {
    const current = item();
    await show(<RecoCard {...props(current)} />);
    $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.focus();
    await show(<RecoCard {...props(current, { dismissedTitle: 'Dandadan' })} />);
    expect(document.activeElement).toBe($('[data-focus="reco-undo"]'));
    await show(<RecoCard {...props(current)} />);
    expect(document.activeElement).toBe($('[data-focus="reco-another"]'));
  });

  it('focus dans un hôte à repli (panneau, popup) : « Annuler » puis « Autre », pas l’onglet', async () => {
    const current = item();
    await show(<Host card={props(current)} />);
    $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.focus();
    await show(<Host card={props(current, { dismissedTitle: 'Dandadan' })} />);
    expect(document.activeElement).toBe($('[data-focus="reco-undo"]'));
    await show(<Host card={props(current)} />);
    expect(document.activeElement).toBe($('[data-focus="reco-another"]'));
  });

  describe('tirage', () => {
    afterEach(() => vi.useRealTimers());

    it('l\'ancienne fiche reste pendant le tour du dé (360 ms), puis la nouvelle apparaît', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
      const first = item();
      const second = item({ id: 8, title: 'Nouvelle' });
      await show(<RecoCard {...props(first)} />);
      await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
      await show(<RecoCard {...props(second)} />);
      expect(container.textContent).toContain('Dandadan');
      expect(container.textContent).not.toContain('Nouvelle');
      await act(() => { vi.advanceTimersByTime(361); });
      expect(container.textContent).toContain('Nouvelle');
      expect(container.textContent).not.toContain('Dandadan');
      vi.unstubAllGlobals();
    });

    it('pendant le tour du dé, « + À regarder » et « Pas intéressé » sont ignorés (la fiche affichée n\'est plus la tirée)', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
      await show(<RecoCard {...props(item())} />);
      await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
      await show(<RecoCard {...props(item({ id: 8, title: 'Nouvelle' }))} />);
      await act(() => $<HTMLButtonElement>('[data-focus="reco-add"]')?.click());
      await act(() => $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.click());
      expect(handlers.onAdd).not.toHaveBeenCalled();
      expect(handlers.onDismiss).not.toHaveBeenCalled();
      await act(() => { vi.advanceTimersByTime(361); });
      await act(() => $<HTMLButtonElement>('[data-focus="reco-add"]')?.click());
      expect(handlers.onAdd).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it('mouvement réduit : la nouvelle fiche apparaît tout de suite', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
      await show(<RecoCard {...props(item())} />);
      await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
      await show(<RecoCard {...props(item({ id: 8, title: 'Nouvelle' }))} />);
      expect(container.textContent).toContain('Nouvelle');
      vi.unstubAllGlobals();
    });
  });

  it('les clics appellent Autre, Ajouter et Pas intéressé', async () => {
    await show(<RecoCard {...props(item())} />);
    await act(() => $<HTMLButtonElement>('[data-focus="reco-add"]')?.click());
    await act(() => $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.click());
    await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
    expect(handlers.onAnother).toHaveBeenCalledTimes(1);
    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('le bouton « Autre » garde le focus d\'une suggestion à l\'autre', async () => {
    await show(<RecoCard {...props(item())} />);
    const another = $<HTMLButtonElement>('[data-focus="reco-another"]');
    another?.focus();
    await show(<RecoCard {...props(item({ id: 8, title: 'Autre' }))} />);
    expect($('[data-focus="reco-another"]')).toBe(another);
    expect(document.activeElement).toBe(another);
  });

  it('ajoutée : « Dans À regarder » à la place du bouton d\'ajout', async () => {
    await show(<RecoCard {...props(item(), { added: { notOnMal: false, inList: false } })} />);
    expect($('[data-focus="reco-add"]')).toBeNull();
    expect(container.textContent).toContain(t('reco.inPlanning'));
  });

  it('ajoutée sur AniList seul : « pas encore sur MyAnimeList » ; rien d\'écrit, déjà listée : « Déjà dans ta liste »', async () => {
    await show(<RecoCard {...props(item(), { added: { notOnMal: true, inList: false } })} />);
    expect($('[data-reco-added]')?.textContent).toBe(t('sequel.notOnMal'));
    await show(<RecoCard {...props(item(), { added: { notOnMal: false, inList: true } })} />);
    expect($('[data-reco-added]')?.textContent).toBe(t('sequel.inList'));
  });

  it('français, TV_SHORT : format traduit et moyenne « 8,4 »', async () => {
    setLocale('fr');
    await show(<RecoCard {...props(item({ format: 'TV_SHORT', averageScore: 84 }))} />);
    expect(container.textContent).toContain(t('review.format.tvShort'));
    expect(container.textContent).not.toContain('TV_SHORT');
    expect(container.textContent).toContain('★ 8,4');
    setLocale('en');
  });

  // Libellé dans le nom (WCAG 2.5.3) : la commande vocale « Pas intéressé » ou « Autre » doit trouver le bouton
  it.each(LOCALES)('%s : les noms accessibles de « Pas intéressé » et « Autre » contiennent le libellé visible', (locale) => {
    const lower = (text: string): string => text.toLocaleLowerCase(locale);
    expect(lower(tl(locale, 'reco.dismissAria', { title: 'Dandadan' }))).toContain(lower(tl(locale, 'reco.dismiss')));
    expect(lower(tl(locale, 'reco.anotherAria'))).toContain(lower(tl(locale, 'reco.another')));
  });

  it('MyAnimeList seul et sans idMal : pas de bouton d\'ajout, mention « pas encore sur MyAnimeList »', async () => {
    await show(<RecoCard {...props(item({ idMal: null }), { malOnly: true })} />);
    expect($('[data-focus="reco-add"]')).toBeNull();
    expect(container.textContent).toContain(t('reco.notOnMal'));
    await show(<RecoCard {...props(item({ idMal: 5 }), { malOnly: true })} />);
    expect($('[data-focus="reco-add"]')).not.toBeNull();
  });

  it('plateforme optionnelle sans accès : puce grisée « Activer » ; avec accès ou du manifeste : lien', async () => {
    const current = item({
      platforms: [
        { platform: 'netflix', url: 'https://www.netflix.com/title/1' },
        { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/x' },
      ],
    });
    await show(<RecoCard {...props(current)} />);
    const off = $<HTMLButtonElement>('[data-platform="netflix"]');
    expect(off?.tagName).toBe('BUTTON');
    expect(off?.textContent).toContain(t('panel.enablePlatform', { platform: 'Netflix' }));
    expect($('[data-platform="crunchyroll"]')?.tagName).toBe('A');
    await act(() => off?.click());
    expect(handlers.onEnable).toHaveBeenCalledWith('netflix');
    await show(<RecoCard {...props(current, {}, { granted: ['netflix'] })} />);
    expect($('[data-platform="netflix"]')?.tagName).toBe('A');
  });

  it('région live polie avec reco.announce', async () => {
    await show(<RecoCard {...props(item())} />);
    const live = $('[aria-live="polite"]');
    expect(live?.textContent).toBe(t('reco.announce', { title: 'Dandadan', seed: 'Frieren' }));
  });

  it('graine non notée : « Parce que tu as vu » sans note inventée, annonce assortie', async () => {
    const unrated: RecoItem = { ...item(), reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 6, rated: false, matched: [] } };
    await show(<RecoCard {...props(unrated)} />);
    expect($('[data-reco-why]')?.textContent).toBe(t('reco.becauseWatched', { title: 'Frieren' }));
    expect($('[data-reco-why]')?.textContent).not.toContain('6');
    expect($('[aria-live="polite"]')?.textContent).toBe(t('reco.announceWatched', { title: 'Dandadan', seed: 'Frieren' }));
  });

  it('note décimale formatée selon la langue', async () => {
    const decimal: RecoItem = { ...item(), reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 8.5, rated: true, matched: [] } };
    setLocale('fr');
    await show(<RecoCard {...props(decimal)} />);
    expect($('[data-reco-why]')?.textContent).toContain('★ 8,5/10');
    setLocale('en');
  });

  it('démarrage à froid (aucune raison) : le titre seul est annoncé', async () => {
    await show(<RecoCard {...props({ ...item(), reason: null })} />);
    expect($('[aria-live="polite"]')?.textContent).toBe(t('reco.announceCold', { title: 'Dandadan' }));
  });

  it('écartée : texte et « Annuler » à la place des actions', async () => {
    await show(<RecoCard {...props(item(), { dismissedTitle: 'Dandadan' })} />);
    expect(container.textContent).toContain(t('reco.dismissed', { title: 'Dandadan' }));
    await act(() => $<HTMLButtonElement>('[data-focus="reco-undo"]')?.click());
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect($('[data-focus="reco-another"]')).not.toBeNull();
  });

  it('échec d\'ajout : message visible annoncé', async () => {
    await show(<RecoCard {...props(item(), { addError: 'Réseau' })} />);
    expect($('[data-alert]')?.getAttribute('data-alert')).toBe('Réseau');
  });

  it('« Déjà tirées » : liste hors mode compact', async () => {
    const earlier = item({ id: 3, title: 'Ancienne' });
    await show(<RecoCard {...props(item(), { previous: [earlier] })} />);
    expect(container.textContent).toContain(t('reco.previous'));
    expect(container.textContent).toContain('Ancienne');
    await show(<RecoCard {...props(item(), { previous: [earlier] }, { compact: true })} />);
    expect(container.textContent).not.toContain('Ancienne');
  });
});
