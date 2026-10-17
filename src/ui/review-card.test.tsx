// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { EpisodeInfo } from '../shared/episode.types';
import type { CandidateSummary, PendingReview } from '../shared/review.types';
import type { SyncOutcome } from '../shared/sync.types';
import { RESULT_VISIBLE_MS, ReviewCard, ReviewList, type ReviewActions } from './review-card';

setLocale('fr');

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const KEY = 'netflix:mushoku:s2';
const focus = (part: string): string => `[data-focus="review-${part}-${KEY}"]`;

/** Clic puis fin des promesses en attente (réponses simulées) */
async function click(selector: string): Promise<void> {
  const el = $(selector);
  if (!el) throw new Error(`Introuvable : ${selector}`);
  await act(async () => {
    el.click();
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function type(selector: string, value: string): Promise<void> {
  const input = $<HTMLInputElement>(selector);
  if (!input) throw new Error(`Introuvable : ${selector}`);
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const EPISODE: EpisodeInfo = {
  platform: 'netflix',
  episodeId: 'e30',
  seriesId: 'mushoku',
  seriesSlug: null,
  animeTitle: 'Mushoku Tensei',
  seasonNumber: 2,
  seasonTitle: null,
  seasonEpisodeNumber: 5,
  displayedEpisodeNumber: 30,
  episodeTitle: null,
  url: 'https://www.netflix.com/watch/1',
};
const II: CandidateSummary = { id: 146065, title: 'Mushoku Tensei II', format: 'TV', episodes: 12, year: 2023, coverUrl: null };
const PART2: CandidateSummary = { id: 166873, title: 'Mushoku Tensei II Part 2', format: 'TV', episodes: 12, year: 2024, coverUrl: null };
const EGG: CandidateSummary = { id: 12, title: 'Berserk: The Egg of the King', format: 'MOVIE', episodes: 1, year: 2012, coverUrl: null };

function review(patch: Partial<PendingReview> = {}): PendingReview {
  return { key: KEY, episode: EPISODE, reason: 'Trouvée par le titre seul', suggestion: { mediaId: II.id, progress: 5 }, candidates: [II, PART2], previous: null, createdAt: 1, ...patch };
}

const SYNCED: SyncOutcome = { status: 'synced', mediaTitle: 'Mushoku Tensei II', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 5, completed: false } }] };

function actions(patch: Partial<ReviewActions> = {}): ReviewActions {
  return {
    search: vi.fn(() => Promise.resolve({ ok: true as const, data: [PART2, EGG] })),
    confirm: vi.fn(() => Promise.resolve(SYNCED)),
    dismiss: vi.fn(() => Promise.resolve()),
    exclude: vi.fn(() => Promise.resolve()),
    ...patch,
  };
}

const pressed = (): string[] => [...container.querySelectorAll('[data-candidate][aria-pressed="true"]')].map((el) => el.getAttribute('data-candidate') ?? '');

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.useRealTimers();
});

describe('ReviewCard', () => {
  it('épisode, raison, fiches proposées (suggestion cochée), numéro proposé et total de la fiche', async () => {
    await show(<ReviewCard review={review()} actions={actions()} />);
    expect($('article p')?.textContent).toBe('Mushoku Tensei · S2 · E5 · (affiché E30) · Netflix');
    expect($('[data-review-reason]')?.textContent).toBe('Trouvée par le titre seul');
    expect($('[role="group"]')?.getAttribute('aria-label')).toBe('Fiche correspondante');
    expect(pressed()).toEqual([String(II.id)]);
    expect($(`[data-focus="cand-${KEY}-${PART2.id}"]`)?.textContent).toContain('TV · 12 ép. · 2024');
    expect($<HTMLInputElement>(focus('progress'))?.value).toBe('5');
    expect($('label')?.textContent).toBe('Épisode sur la fiche');
    expect(container.textContent).toContain('/ 12');
  });

  it('« Confirmer » : fiche et numéro choisis envoyés, « Synchronisation… » pendant l’envoi, résultat puis fermeture seule après 5 s', async () => {
    let resolve: (outcome: SyncOutcome) => void = () => undefined;
    const confirm = vi.fn(() => new Promise<SyncOutcome>((r) => (resolve = r)));
    const onClose = vi.fn();
    const onBusyChange = vi.fn();
    await show(<ReviewCard review={review()} actions={actions({ confirm })} onClose={onClose} onBusyChange={onBusyChange} />);
    await click(`[data-candidate="${PART2.id}"]`);
    expect(pressed()).toEqual([String(PART2.id)]);
    await type(focus('progress'), '7');
    await click(focus('confirm'));
    expect(confirm).toHaveBeenCalledWith(KEY, PART2.id, 7);
    expect($(focus('confirm'))?.textContent).toBe('Synchronisation…');
    expect($(focus('confirm'))?.getAttribute('aria-busy')).toBe('true');
    expect($<HTMLButtonElement>(focus('dismiss'))?.disabled).toBe(true);
    expect($<HTMLButtonElement>(focus('exclude'))?.disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ key: KEY }));

    vi.useFakeTimers();
    await act(async () => {
      resolve(SYNCED);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect($('[data-review-feedback]')?.getAttribute('data-review-feedback')).toBe('success');
    expect($('[data-review-feedback]')?.textContent).toContain('AniList : épisode 5 enregistré');
    expect($(focus('confirm'))).toBeNull();
    expect($(focus('close'))?.textContent).toBe('Fermer');
    expect(onClose).not.toHaveBeenCalled();
    await act(() => {
      vi.advanceTimersByTime(RESULT_VISIBLE_MS);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('numéro invalide : erreur dans la carte, rien n’est envoyé, la carte reste modifiable', async () => {
    const confirm = vi.fn(() => Promise.resolve(SYNCED));
    await show(<ReviewCard review={review()} actions={actions({ confirm })} />);
    await type(focus('progress'), '30');
    await click(focus('confirm'));
    expect(confirm).not.toHaveBeenCalled();
    expect($('[data-review-feedback]')?.textContent).toBe('Épisode invalideEntre 1 et 12 pour cette fiche.');
    expect($(focus('confirm'))?.textContent).toBe('Confirmer');
  });

  it('échec de la synchro (vérification disparue, session expirée) : message dans la carte, toujours modifiable', async () => {
    const confirm = vi.fn(() => Promise.resolve<SyncOutcome>({ status: 'error', message: 'Session expirée' }));
    await show(<ReviewCard review={review()} actions={actions({ confirm })} />);
    await click(focus('confirm'));
    expect($('[data-review-feedback]')?.getAttribute('data-review-feedback')).toBe('error');
    expect($('[data-review-feedback]')?.textContent).toContain('Session expirée');
    expect($(focus('confirm'))?.textContent).toBe('Confirmer');
  });

  it('échec partiel (un service en erreur) : la fiche est appliquée, résultat en erreur affiché avant la fermeture', async () => {
    const partial: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Mushoku Tensei II',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 5, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'MyAnimeList ne répond pas' } },
      ],
    };
    await show(<ReviewCard review={review()} actions={actions({ confirm: () => Promise.resolve(partial) })} />);
    await click(focus('confirm'));
    expect($('[data-review-feedback]')?.getAttribute('data-review-feedback')).toBe('error');
    expect($('[data-review-feedback]')?.textContent).toContain('MyAnimeList : échec');
    expect($(focus('close'))).not.toBeNull();
  });

  it('aucune fiche proposée : phrase d’aide, « Confirmer » désactivé ; recherche : résultats sans les fiches proposées, choisis puis envoyés', async () => {
    const search = vi.fn(() => Promise.resolve({ ok: true as const, data: [II, EGG] }));
    const confirm = vi.fn(() => Promise.resolve(SYNCED));
    await show(<ReviewCard review={review({ candidates: [PART2], suggestion: null })} actions={actions({ search, confirm })} />);
    expect(pressed()).toEqual([String(PART2.id)]);
    await show(<ReviewCard key="empty" review={review({ candidates: [], suggestion: null, createdAt: 2 })} actions={actions({ search, confirm })} />);
    expect(container.textContent).toContain('Aucune fiche proposée : utilise la recherche.');
    expect($<HTMLButtonElement>(focus('confirm'))?.disabled).toBe(true);

    await type(focus('search'), '  Berserk ');
    await act(async () => {
      $('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(search).toHaveBeenCalledWith('Berserk');
    expect(container.textContent).toContain('Résultats (2)');
    await click(`[data-candidate="${EGG.id}"]`);
    expect($<HTMLButtonElement>(focus('confirm'))?.disabled).toBe(false);
    expect(container.textContent).toContain('/ 1');
    await type(focus('progress'), '1');
    await click(focus('confirm'));
    expect(confirm).toHaveBeenCalledWith(KEY, EGG.id, 1);
  });

  it('recherche impossible : erreur dans la carte', async () => {
    const search = vi.fn(() => Promise.resolve({ ok: false as const, error: 'NETWORK', message: 'AniList est injoignable.' }));
    await show(<ReviewCard review={review()} actions={actions({ search: search as unknown as ReviewActions['search'] })} />);
    await type(focus('search'), 'Berserk');
    await act(async () => {
      $('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect($('[data-review-feedback]')?.textContent).toBe('Recherche impossibleAniList est injoignable.');
  });

  it('correction vers une autre fiche : épisode mis de côté, note à lire, pas de fermeture automatique', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onClose = vi.fn();
    const deferred = { episode: { ...EPISODE, displayedEpisodeNumber: 6 }, epochs: { anilist: 0 } };
    await show(<ReviewCard review={review({ previous: { mediaId: PART2.id, title: 'Mushoku Tensei II Part 2', progress: 5 }, deferred })} actions={actions()} onClose={onClose} />);
    expect(container.textContent).toContain('Épisode 6 en attente, appliqué après ta décision');
    await act(async () => {
      $(focus('confirm'))?.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect($('[data-review-feedback]')?.textContent).toContain('Pense à corriger « Mushoku Tensei II Part 2 »');
    await act(() => {
      vi.advanceTimersByTime(RESULT_VISIBLE_MS * 2);
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(() => $(focus('close'))?.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('« Ignorer » et « Ne plus synchroniser » : actions de l’hôte ; échec : « Action impossible » dans la carte', async () => {
    const dismiss = vi.fn(() => Promise.reject(new Error('stockage')));
    const exclude = vi.fn(() => Promise.resolve());
    await show(<ReviewCard review={review()} actions={actions({ dismiss, exclude })} />);
    expect($(focus('exclude'))?.getAttribute('title')).toContain('Séries exclues');
    expect($(focus('exclude'))?.getAttribute('aria-label')).toBe('Ne plus synchroniser Mushoku Tensei');
    await click(focus('exclude'));
    expect(exclude).toHaveBeenCalledWith(expect.objectContaining({ key: KEY }));
    await click(focus('dismiss'));
    expect(dismiss).toHaveBeenCalledWith(KEY);
    expect($('[data-review-feedback]')?.textContent).toBe('Action impossibleLa vérification n’a pas pu être ignorée. Réessaie.');
  });
});

describe('ReviewList', () => {
  const B = review({ key: 'crunchyroll:frieren:s2', createdAt: 5, episode: { ...EPISODE, animeTitle: 'Frieren', platform: 'crunchyroll' } });
  const keys = (): string[] => [...container.querySelectorAll('[data-review]')].map((el) => el.getAttribute('data-review') ?? '');

  it('aucune vérification : l’état vide ; nouvelles vérifications en tête', async () => {
    const list = (reviews: PendingReview[]) => <ReviewList title="À vérifier" reviews={reviews} actions={actions()} empty={<p data-empty="">vide</p>} />;
    await show(list([]));
    expect($('[data-empty]')).not.toBeNull();
    await show(list([review()]));
    await show(list([B, review()]));
    expect(keys()).toEqual([B.key, KEY]);
  });

  it('carte occupée gardée après le retrait de sa vérification, jusqu’à « Fermer »', async () => {
    const confirm = vi.fn(() => Promise.resolve(SYNCED));
    const acts = actions({ confirm });
    const list = (reviews: PendingReview[]) => <ReviewList title="À vérifier" reviews={reviews} actions={acts} empty={<p data-empty="">vide</p>} />;
    await show(list([B, review()]));
    await click(focus('confirm'));
    // Le service worker retire la vérification résolue
    await show(list([B]));
    expect(keys()).toEqual([B.key, KEY]);
    expect($(focus('close'))).not.toBeNull();
    expect($('h2')?.textContent).toBe('À vérifier · 1');
    $(focus('close'))?.focus();
    await click(focus('close'));
    expect(keys()).toEqual([B.key]);
    // Focus rendu au titre de la section (repli déclaré), jamais sur <body>
    expect(document.activeElement?.getAttribute('data-focus')).toBe('review-title');
  });

  it('nouvelle vérification de la même saison : carte remise à zéro (choix et saisie)', async () => {
    const list = (reviews: PendingReview[]) => <ReviewList title="À vérifier" reviews={reviews} actions={actions()} empty={null} />;
    await show(list([review()]));
    await type(focus('progress'), '9');
    // Même carte, épisode mis de côté entre-temps : saisie conservée
    await show(list([review({ deferred: { episode: { ...EPISODE, displayedEpisodeNumber: 7 }, epochs: { anilist: 0 } } })]));
    expect($<HTMLInputElement>(focus('progress'))?.value).toBe('9');
    expect(container.textContent).toContain('Épisode 7 en attente');
    await show(list([review({ createdAt: 9, suggestion: { mediaId: PART2.id, progress: 6 } })]));
    expect($<HTMLInputElement>(focus('progress'))?.value).toBe('6');
    expect(pressed()).toEqual([String(PART2.id)]);
  });
});
