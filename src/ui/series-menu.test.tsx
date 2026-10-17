// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import type { ListStatusChange } from '../shared/sync.types';
import { SeriesMenu, type SeriesMenuProps } from './series-menu';

let container: HTMLElement;
const KEY = '171018:57334';

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const key = (focus: string): HTMLElement | null => $(`[data-focus="${focus}"]`);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const press = async (name: string, target: Element | null = document.activeElement): Promise<void> => {
  await act(() => {
    (target ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  });
};
const click = async (focus: string): Promise<void> => {
  await act(() => key(focus)?.click());
};

const onStatus = vi.fn<(status: ListStatusChange) => void>();
const onNotes = vi.fn<() => void>();
const onExclude = vi.fn<() => void>();
const onInclude = vi.fn<() => void>();
const onRemove = vi.fn<() => void>();

function menu(props: Partial<SeriesMenuProps> = {}) {
  return (
    <SeriesMenu
      title="Dandadan"
      focusKey={KEY}
      onStatus={onStatus}
      onNotes={onNotes}
      entryLinks={[
        { service: 'anilist', url: 'https://anilist.co/anime/171018' },
        { service: 'mal', url: 'https://myanimelist.net/anime/57334' },
      ]}
      searches={[{ platform: 'adn', url: 'https://animationdigitalnetwork.com/video?search=Dandadan' }]}
      sync={{ excluded: false, canExclude: true, onExclude, onInclude }}
      onRemove={onRemove}
      {...props}
    />
  );
}

const open = async (props: Partial<SeriesMenuProps> = {}): Promise<void> => {
  await show(menu(props));
  await click(`more-${KEY}`);
};

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  for (const fn of [onStatus, onNotes, onExclude, onInclude, onRemove]) fn.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('SeriesMenu', () => {
  it('bouton « ⋯ » nommé ; ouvert : statuts, commentaire, deux sous-menus, exclusion, retrait ; focus sur « Mettre en pause »', async () => {
    await show(menu());
    expect(key(`more-${KEY}`)?.getAttribute('aria-label')).toBe(t('watching.moreActions', { title: 'Dandadan' }));
    expect($('[role="menu"]')).toBeNull();
    await click(`more-${KEY}`);
    expect($('[role="menu"]')?.getAttribute('aria-label')).toBe(t('watching.menuAria', { title: 'Dandadan' }));
    const labels = [...container.querySelectorAll<HTMLElement>('[role="menu"] > [role="menuitem"], [role="menu"] > [data-submenu] > [role="menuitem"]')].map((el) => el.textContent);
    expect(labels).toEqual([
      t('watching.status.PAUSED'),
      t('watching.status.DROPPED'),
      t('watching.status.COMPLETED'),
      t('notes.menu'),
      t('watching.menu.openEntry'),
      t('watching.menu.searchOn'),
      t('common.stopSyncSeries'),
      t('list.remove'),
    ]);
    // Le −1 a quitté le menu : la ligne a son propre −
    expect(container.textContent).not.toContain(t('watching.minusOne'));
    expect(document.activeElement).toBe(key(`PAUSED-${KEY}`));
  });

  it('« Mettre en pause » : action directe, menu fermé, focus rendu au bouton', async () => {
    await open();
    await click(`PAUSED-${KEY}`);
    expect(onStatus).toHaveBeenCalledWith('PAUSED');
    expect($('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(key(`more-${KEY}`));
  });

  it('« Abandonner » : confirmation dans le menu, focus sur « Non » ; Échap l’annule (menu ouvert, focus sur l’option) ; « Oui » envoie', async () => {
    await open();
    await click(`DROPPED-${KEY}`);
    const group = $('[role="menu"] [role="group"]');
    expect(group?.getAttribute('aria-label')).toBe(t('watching.confirm.DROPPED'));
    expect(document.activeElement).toBe(key(`confirm-no-${KEY}`));
    expect(key(`confirm-yes-${KEY}`)?.getAttribute('aria-label')).toBe(t('watching.confirm.yesAria', { action: t('watching.status.DROPPED') }));
    expect(onStatus).not.toHaveBeenCalled();

    await press('Escape');
    expect($('[role="menu"]')).not.toBeNull();
    expect($('[role="group"]')).toBeNull();
    expect(document.activeElement).toBe(key(`DROPPED-${KEY}`));

    await click(`DROPPED-${KEY}`);
    await click(`confirm-yes-${KEY}`);
    expect(onStatus).toHaveBeenCalledWith('DROPPED');
    expect($('[role="menu"]')).toBeNull();
  });

  it('« Terminé ? » : « Non » revient à l’option ; « Oui » et « Non » restent des options du menu (flèches)', async () => {
    await open();
    await click(`COMPLETED-${KEY}`);
    expect($('[role="group"]')?.textContent).toContain(t('watching.confirm.COMPLETED'));
    await press('ArrowUp');
    expect(document.activeElement).toBe(key(`confirm-yes-${KEY}`));
    await click(`confirm-no-${KEY}`);
    expect(document.activeElement).toBe(key(`COMPLETED-${KEY}`));
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('« Retirer de la liste » : question, phrase d’explication, « Retirer » / « Annuler » (focus) ; « Retirer » envoie', async () => {
    await open();
    await click(`REMOVE-${KEY}`);
    const group = $('[role="group"]');
    expect(group?.textContent).toContain(t('list.remove.confirm'));
    expect(group?.textContent).toContain(t('list.remove.detail'));
    expect(document.activeElement).toBe(key(`confirm-no-${KEY}`));
    expect(key(`confirm-no-${KEY}`)?.textContent).toBe(t('common.cancel'));
    await click(`confirm-no-${KEY}`);
    expect(document.activeElement).toBe(key(`REMOVE-${KEY}`));
    await click(`REMOVE-${KEY}`);
    await click(`confirm-yes-${KEY}`);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('confirmation oubliée à la fermeture : rouvert, l’option est revenue', async () => {
    await open();
    await click(`DROPPED-${KEY}`);
    await act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect($('[role="menu"]')).toBeNull();
    await click(`more-${KEY}`);
    expect($('[role="group"]')).toBeNull();
    expect(key(`DROPPED-${KEY}`)).not.toBeNull();
  });

  it('« Ouvrir la fiche › » : AniList et MyAnimeList (nouvel onglet, nom du service) ; « Chercher sur… › » : plateformes', async () => {
    await open();
    await click(`site-${KEY}`);
    const anilist = key(`site-anilist-${KEY}`);
    expect(anilist?.getAttribute('href')).toBe('https://anilist.co/anime/171018');
    expect(anilist?.getAttribute('target')).toBe('_blank');
    expect(anilist?.getAttribute('aria-label')).toBe(t('page.openOn', { service: 'AniList' }));
    expect(key(`site-mal-${KEY}`)?.textContent).toBe('MyAnimeList');
    await click(`search-${KEY}`);
    const adn = key(`search-adn-${KEY}`);
    expect(adn?.getAttribute('href')).toBe('https://animationdigitalnetwork.com/video?search=Dandadan');
    expect(adn?.getAttribute('aria-label')).toBe(t('watching.searchOnAria', { title: 'Dandadan', platform: 'ADN' }));
    expect(adn?.textContent).toBe('ADN');
  });

  it('aucune recherche possible : pas de « Chercher sur… »', async () => {
    await open({ searches: [] });
    expect(key(`search-${KEY}`)).toBeNull();
    expect(key(`site-${KEY}`)).not.toBeNull();
  });

  it('envoi en cours : statuts, commentaire et retrait grisés ; liens et exclusion actifs ; pas de confirmation', async () => {
    await open({ busy: true });
    for (const focus of ['PAUSED', 'DROPPED', 'COMPLETED', 'notes', 'REMOVE']) expect(key(`${focus}-${KEY}`)?.matches(':disabled')).toBe(true);
    expect(key(`site-${KEY}`)?.matches(':disabled')).toBe(false);
    expect(key(`exclude-${KEY}`)?.matches(':disabled')).toBe(false);
    // Premier élément actif focalisé : l'entrée « Ouvrir la fiche »
    expect(document.activeElement).toBe(key(`site-${KEY}`));
  });

  it('exclusion : « Ne plus synchroniser » (grisé sans fiche AniList) ; série exclue : « Réactiver la synchro » en mint', async () => {
    await open({ sync: { excluded: false, canExclude: false, onExclude, onInclude } });
    expect(key(`exclude-${KEY}`)?.matches(':disabled')).toBe(true);
    await act(() => render(null, container));
    await open({ sync: { excluded: true, canExclude: true, onExclude, onInclude } });
    expect(key(`exclude-${KEY}`)).toBeNull();
    const include = key(`include-${KEY}`);
    expect(include?.textContent).toBe(t('watching.resumeSync'));
    expect(include?.className).toContain('text-mint');
    await click(`include-${KEY}`);
    expect(onInclude).toHaveBeenCalledTimes(1);
  });

  it('« Commentaire… » : action, menu fermé', async () => {
    await open();
    await click(`notes-${KEY}`);
    expect(onNotes).toHaveBeenCalledTimes(1);
    expect($('[role="menu"]')).toBeNull();
  });

  it('flèche vers le bas sur le bouton fermé : ouverture', async () => {
    await show(menu());
    await press('ArrowDown', key(`more-${KEY}`));
    expect($('[role="menu"]')).not.toBeNull();
  });
});
