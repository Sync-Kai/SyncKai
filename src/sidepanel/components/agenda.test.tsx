// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import { weekRange, type AgendaSeries, type AiringSchedule } from '../../shared/agenda';
import { DEFAULT_SETTINGS, type SyncSettings } from '../../shared/settings';
import { createStore } from '../../ui/state';
import type { AgendaStatus } from '../agenda-controller';
import { Agenda, type AgendaSnapshot } from './agenda';

// Onglet « Agenda » (rendu Preact) : jours dans l'ordre, ligne « 18:00 Crunchyroll · Japon 17:00 », « ● Vu », menu « ⋯ »,
// éditeur de délai (bornes, échec, focus rendu au « ⋯ » à la fermeture : audit 4-A2), états sans programme

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);

/** Vendredi 16 octobre 2026, 12 h ; semaine du lundi 12 au dimanche 18 */
const NOW = new Date(2026, 9, 16, 12).getTime();
const RANGE = weekRange(NOW, 1);
const at = (day: number, hour: number, minute = 0): number => Math.floor(new Date(2026, 9, day, hour, minute).getTime() / 1000);

function series(mediaId: number, title: string, progress: number, platform: 'crunchyroll' | 'netflix' | null): AgendaSeries {
  const link = platform ? { platform, url: `https://example.com/${mediaId}` } : null;
  return { mediaId, malId: null, progress, title, coverUrl: null, platforms: link ? [link] : [], link };
}

const SCHEDULES: AiringSchedule[] = [
  { scheduleId: 71, mediaId: 1, episode: 7, airingAt: at(16, 17), title: 'Frieren', coverUrl: null },
  { scheduleId: 52, mediaId: 2, episode: 5, airingAt: at(16, 18, 30), title: 'Dandadan', coverUrl: null },
  { scheduleId: 98, mediaId: 3, episode: 98, airingAt: at(18, 11, 25), title: 'Pokémon Horizons', coverUrl: null },
];
const SERIES = new Map<number, AgendaSeries>([
  [1, series(1, 'Frieren', 7, 'crunchyroll')],
  [2, series(2, 'Dandadan', 4, 'netflix')],
  [3, series(3, 'Pokémon Horizons', 97, null)],
]);
const SETTINGS: SyncSettings = { ...DEFAULT_SETTINGS, seriesOffsets: { 2: { minutes: 75, at: 1 } } };

function snapshot(status: AgendaStatus): AgendaSnapshot {
  return { range: RANGE, firstDay: 1, status, settings: SETTINGS, player: 'crunchyroll', series: SERIES, connected: ['anilist'] };
}
const READY = { kind: 'ready', cache: { weekStart: RANGE.key, fetchedAt: NOW, mediaIds: [1, 2, 3], schedules: SCHEDULES }, refreshing: false, error: null as string | null } satisfies AgendaStatus;

const onSaveOffset = vi.fn<(mediaId: number, offset: number | null) => Promise<void>>();
const onRetry = vi.fn<() => void>();

async function show(status: AgendaStatus = READY): Promise<void> {
  const state = createStore<AgendaSnapshot | null>(snapshot(status));
  await act(() => render(<Agenda state={state} granted={[]} onStep={() => undefined} onChoose={() => undefined} onRetry={onRetry} onSaveOffset={onSaveOffset} />, container));
}

async function click(selector: string): Promise<void> {
  const el = $(selector);
  if (!el) throw new Error(`${selector} absent`);
  await act(() => el.click());
}

async function key(name: string): Promise<void> {
  await act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  });
}

async function type(value: string): Promise<void> {
  const input = $<HTMLInputElement>('[data-focus^="agenda-offset-"]');
  if (!input) throw new Error('champ absent');
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const focusKey = (): string | null => (document.activeElement instanceof HTMLElement ? (document.activeElement.dataset.focus ?? null) : null);
const text = (selector: string): string => ($(selector)?.textContent ?? '').replace(/\s/g, ' ');

async function openEditor(scheduleId: number): Promise<void> {
  await click(`[data-focus="agenda-menu-${scheduleId}"]`);
  await click(`[data-focus="agenda-adjust-${scheduleId}"]`);
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  onSaveOffset.mockReset();
  onRetry.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.useRealTimers();
});

describe('Agenda', () => {
  it('jours du lundi au dimanche, jour vide = « Aucun épisode » sans carte, aujourd’hui marqué, jours passés atténués', async () => {
    await show();
    const days = [...container.querySelectorAll<HTMLElement>('[data-agenda-day]')];
    expect(days.map((day) => day.dataset.agendaDay)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(days[0]?.textContent).toBe(`Lundi 12${t('agenda.day.none')}`);
    expect(days[0]?.querySelector('ul')).toBeNull();
    expect(days[0]?.querySelector('h3')?.className).toContain('text-muted');
    expect(days[4]?.querySelector('[data-agenda-today]')?.textContent).toContain(t('agenda.day.today'));
    expect(days[5]?.querySelector('h3')?.className).toContain('text-ink');
  });

  it('ligne : titre · Ép. N, heure de la plateforme en gras (lavande si réglée), plateforme, Japon ; vu : « ● Vu »', async () => {
    await show();
    expect(text('[data-agenda-row="71"] [data-agenda-times]')).toBe('Vu · 18:00 Crunchyroll · Japon 17:00');
    expect($('[data-agenda-row="71"] [data-agenda-watched]')).not.toBeNull();
    expect($('[data-agenda-row="71"] [data-cover]')?.parentElement?.className).toContain('opacity-55');
    expect(text('[data-agenda-row="52"] [data-agenda-times]')).toBe('19:45 Netflix · Japon 18:30');
    expect($('[data-agenda-row="52"] [data-agenda-estimate]')?.className).toContain('text-lavender');
    // Sans plateforme ni délai : l'heure japonaise seule, en gras
    expect(text('[data-agenda-row="98"] [data-agenda-times]')).toBe('Japon 11:25');
    expect($('[data-agenda-row="98"] [data-agenda-jp] strong')?.textContent).toBe('11:25');
    expect(text('[data-agenda-row="52"] .text-row-title')).toBe(`Dandadan · ${t('agenda.episode', { episode: 5 })}`);
    expect($('[data-focus="agenda-open-52"]')?.getAttribute('href')).toBe('https://example.com/2');
    expect($('[data-focus="agenda-entry-52"]')?.getAttribute('href')).toBe('https://anilist.co/anime/2');
  });

  it('menu « ⋯ » : « Ajuster l’heure » avec l’heure et l’origine du délai, « Ouvrir la fiche › », « Chercher sur… › » (plateformes sans lien)', async () => {
    await show();
    await click('[data-focus="agenda-menu-52"]');
    expect(text('[data-focus="agenda-adjust-52"] [data-menu-description]')).toBe(`19:45 Netflix · ${t('agenda.adjust.custom')}`);
    expect($('[data-focus="agenda-site-52"]')).not.toBeNull();
    expect($('[data-focus="agenda-search-52"]')).not.toBeNull();
    await key('Escape');
    await click('[data-focus="agenda-menu-71"]');
    expect(text('[data-focus="agenda-adjust-71"] [data-menu-description]')).toBe(`18:00 Crunchyroll · ${t('agenda.adjust.default')}`);
  });

  it('éditeur : focus dans le champ, aperçu et phrase du délai ; Échap puis Annuler rendent le focus au « ⋯ » de la série (4-A2)', async () => {
    await show();
    await openEditor(52);
    expect(focusKey()).toBe('agenda-offset-52');
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.value).toBe('75');
    expect(text('[data-agenda-preview]')).toBe('≈19:45');
    // ↑ ↓ : 5 minutes, aperçu suivi
    await key('ArrowUp');
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.value).toBe('80');
    expect(text('[data-agenda-preview]')).toBe('≈19:50');
    await key('ArrowDown');
    expect($('[data-agenda-editor]')?.textContent).toContain(t('agenda.estimate.custom', { offset: '+1 h 15 min' }).replace(/\s/g, ' ').slice(0, 20));
    await key('Escape');
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-52');

    await openEditor(71);
    // Délai de la plateforme : pas de « Par défaut », phrase de la plateforme
    expect($('[data-focus="agenda-reset-71"]')).toBeNull();
    expect($('[data-agenda-editor]')?.textContent).toContain('Crunchyroll');
    await click('[data-focus="agenda-cancel-71"]');
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-71');
  });

  it('valeur hors bornes ou vide : champ invalide, rien n’est envoyé', async () => {
    await show();
    await openEditor(52);
    await type('20000');
    expect($('[data-focus="agenda-offset-52"]')?.getAttribute('aria-invalid')).toBe('true');
    expect($('[data-agenda-preview]')).toBeNull();
    await click('[data-focus="agenda-save-52"]');
    await type('');
    await key('Enter');
    expect($('[data-focus="agenda-offset-52"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(onSaveOffset).not.toHaveBeenCalled();
  });

  it('enregistré : délai envoyé une fois, éditeur fermé, focus au « ⋯ » ; « Par défaut » envoie null', async () => {
    let finish = (): void => undefined;
    onSaveOffset.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await show();
    await openEditor(52);
    await type('90');
    await key('Enter');
    await key('Enter');
    expect(onSaveOffset.mock.calls).toEqual([[2, 90]]);
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.disabled).toBe(true);
    expect($('[data-focus="agenda-save-52"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => finish());
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-52');

    onSaveOffset.mockResolvedValue(undefined);
    await openEditor(52);
    await click('[data-focus="agenda-reset-52"]');
    expect(onSaveOffset).toHaveBeenLastCalledWith(2, null);
  });

  it('échec de l’enregistrement : « Non enregistré, réessaie », éditeur ouvert', async () => {
    onSaveOffset.mockRejectedValue(new Error('stockage'));
    await show();
    await openEditor(52);
    await click('[data-focus="agenda-save-52"]');
    await act(async () => undefined);
    expect($('[data-agenda-editor] [data-alert]')?.textContent).toBe(t('agenda.adjust.saveFailed'));
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.disabled).toBe(false);
  });

  it('états : chargement (squelette), aucun compte, erreur avec « Réessayer », programme enregistré affiché avec l’erreur', async () => {
    await show({ kind: 'loading' });
    expect($('[data-agenda-skeleton]')?.getAttribute('aria-busy')).toBe('true');
    await show({ kind: 'not-connected' });
    expect(text('[data-agenda-state]')).toBe(t('agenda.notConnected'));
    await show({ kind: 'error', message: 'AniList est injoignable.' });
    expect($('[data-agenda-state="error"]')?.textContent).toContain(t('agenda.error', { error: 'AniList est injoignable.' }));
    await click('[data-focus="agenda-retry"]');
    expect(onRetry).toHaveBeenCalledTimes(1);
    await show({ ...READY, error: 'AniList est injoignable.' });
    expect($('[data-alert]')?.textContent).toContain(t('agenda.stale', { error: 'AniList est injoignable.' }));
    expect($('[data-agenda-row="52"]')).not.toBeNull();
  });

  it('semaine en cours : pas de bouton « Aujourd’hui » ; actualisation : spinner dans le bouton de la semaine', async () => {
    await show({ ...READY, refreshing: true });
    expect($('[data-focus="agenda-today"]')).toBeNull();
    expect($('[data-week-busy]')).not.toBeNull();
  });
});
