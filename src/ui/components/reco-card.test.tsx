// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import type { RecoItem } from '../../shared/recommendations';
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
  reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 9, matched },
});
type Ready = Extract<RecoView, { status: 'ready' }>;
const view = (current: RecoItem, over: Partial<Ready> = {}): Ready => ({ status: 'ready', current, previous: [], cold: false, malOnly: false, added: false, dismissedTitle: null, ...over });

const handlers = { onAnother: vi.fn<() => void>(), onAdd: vi.fn<() => void>(), onDismiss: vi.fn<() => void>(), onUndo: vi.fn<() => void>(), onEnable: vi.fn<(platform: string) => void>() };
const props = (current: RecoItem, over: Partial<Ready> = {}, extra: Partial<RecoCardProps> = {}): RecoCardProps => ({ item: current, view: view(current, over), granted: [], ...handlers, ...extra });

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

  it('les clics appellent Autre, Ajouter et Pas intéressé', async () => {
    await show(<RecoCard {...props(item())} />);
    await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
    await act(() => $<HTMLButtonElement>('[data-focus="reco-add"]')?.click());
    await act(() => $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.click());
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
    await show(<RecoCard {...props(item(), { added: true })} />);
    expect($('[data-focus="reco-add"]')).toBeNull();
    expect(container.textContent).toContain(t('reco.inPlanning'));
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
