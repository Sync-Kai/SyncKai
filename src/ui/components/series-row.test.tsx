// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesRow, type SeriesRowProps } from './series-row';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('ul');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('SeriesRow', () => {
  const onDecrement = vi.fn<() => void>();
  const onIncrement = vi.fn<() => void>();
  const props = (over: Partial<SeriesRowProps> = {}): SeriesRowProps => ({
    rowKey: '171018:57334',
    title: 'Dandadan',
    coverUrl: null,
    entry: { href: 'https://anilist.co/anime/171018', label: 'Ouvrir la fiche de Dandadan sur AniList' },
    progress: 4,
    total: 12,
    progressText: 'Ép. 4 / 12',
    progressLabel: '4 épisodes vus sur 12',
    status: { tone: 'ok', text: 'Ép. 5 disponible' },
    decrementLabel: 'Retirer un épisode vu : Dandadan',
    incrementLabel: 'Marquer l’épisode suivant comme vu : Dandadan',
    onDecrement,
    onIncrement,
    open: { platform: 'crunchyroll', href: 'https://www.crunchyroll.com/series/GG5H5XQ0D', label: 'Ouvrir Dandadan sur Crunchyroll', title: 'Ouvrir sur Crunchyroll' },
    actions: <button type="button" data-test-more="">⋯</button>,
    ...over,
  });

  beforeEach(() => {
    onDecrement.mockReset();
    onIncrement.mockReset();
  });

  it('ligne de 80 px : jaquette avec barre de progression, titre en lien vers la fiche (infobulle), statut, « Ép. 4 / 12 »', async () => {
    await show(<SeriesRow {...props()} />);
    const row = $('[data-series-row="171018:57334"]');
    expect(row?.className).toContain('h-series-row');
    expect($('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('4');
    expect($('[role="progressbar"]')?.getAttribute('aria-label')).toBe('4 épisodes vus sur 12');
    expect($('[data-series-title]')?.getAttribute('title')).toBe('Dandadan');
    const title = $<HTMLAnchorElement>('[data-series-title] a');
    expect(title?.href).toBe('https://anilist.co/anime/171018');
    expect(title?.target).toBe('_blank');
    expect(title?.dataset.focus).toBe('title-171018:57334');
    // Jaquette : même lien, hors tabulation et masquée aux lecteurs d'écran
    const cover = $<HTMLAnchorElement>('a[aria-hidden="true"]');
    expect(cover?.tabIndex).toBe(-1);
    expect($('[data-status-text]')?.textContent).toBe('Ép. 5 disponible');
    expect($('[data-status-text]')?.dataset.tone).toBe('ok');
    expect($('[data-stepper-text]')?.textContent).toBe('Ép. 4 / 12');
    expect($('[role="group"]')?.getAttribute('aria-label')).toBe('4 épisodes vus sur 12');
  });

  it('« Ouvrir » sur le lecteur (logo, nom accessible, infobulle), puis les actions de l’hôte', async () => {
    await show(<SeriesRow {...props()} />);
    const open = $<HTMLAnchorElement>('[data-focus="open-171018:57334"]');
    expect(open?.getAttribute('aria-label')).toBe('Ouvrir Dandadan sur Crunchyroll');
    expect(open?.getAttribute('title')).toBe('Ouvrir sur Crunchyroll');
    expect(open?.nextElementSibling?.hasAttribute('data-test-more')).toBe(true);
    await show(<SeriesRow {...props({ open: null })} />);
    expect($('[data-focus="open-171018:57334"]')).toBeNull();
  });

  it('− / + : actions, clés data-focus de la série ; envoi en cours : clics ignorés', async () => {
    await show(<SeriesRow {...props()} />);
    $<HTMLButtonElement>('[data-focus="171018:57334-plus"]')?.click();
    $<HTMLButtonElement>('[data-focus="171018:57334-minus"]')?.click();
    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
    await show(<SeriesRow {...props({ busy: true })} />);
    $<HTMLButtonElement>('[data-focus="171018:57334-plus"]')?.click();
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('total inconnu : pas de barre ; série exclue : pastille « Exclue » et pas de +', async () => {
    await show(<SeriesRow {...props({ total: null, progress: 1180, progressText: 'Ép. 1180', incrementHidden: true, tag: { text: 'Exclue', title: 'Série exclue de la synchronisation', icon: 'ban' } })} />);
    expect($('[role="progressbar"]')).toBeNull();
    expect($('[data-step="1"]')).toBeNull();
    expect($('[data-series-tag]')?.textContent).toBe('Exclue');
    expect($('[data-series-tag]')?.getAttribute('title')).toBe('Série exclue de la synchronisation');
  });

  it('sans fiche : titre et jaquette inertes ; retour d’action annoncé (role="status") ; séparateur', async () => {
    await show(<SeriesRow {...props({ entry: null, status: { tone: 'warn', text: 'Rien n’a été modifié', title: 'AniList : déjà à jour', live: true }, separated: true })} />);
    expect($('a[aria-hidden="true"]')).toBeNull();
    expect($('[data-series-title] a')).toBeNull();
    expect($('[data-series-title]')?.textContent).toBe('Dandadan');
    expect($('[data-series-status]')?.getAttribute('role')).toBe('status');
    expect($('[data-status-text]')?.getAttribute('title')).toBe('AniList : déjà à jour');
    expect($('[data-series-row] > span[aria-hidden="true"]')).not.toBeNull();
  });
});
