// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftWeek, weekRange, type WeekRange } from '../../shared/agenda';
import { calendarWeeks, weekLabel, WeekPicker, type WeekPickerLabels } from './week-picker';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const $$ = (selector: string): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)];

const LABELS: WeekPickerLabels = {
  prev: 'Semaine précédente',
  next: 'Semaine suivante',
  nav: 'Semaine',
  dialog: 'Choisir une semaine',
  prevMonth: 'Mois précédent',
  nextMonth: 'Mois suivant',
  thisWeek: 'Cette semaine',
  hint: '↑ ↓ pour changer de semaine, Entrée pour l’afficher.',
};

/** Vendredi 16 octobre 2026, midi ; semaine du lundi 12 au dimanche 18 */
const NOW = new Date(2026, 9, 16, 12).getTime();
const THIS_WEEK = weekRange(NOW, 1);

const onStep = vi.fn<(delta: number) => void>();
const onSelect = vi.fn<(week: WeekRange) => void>();

async function show(week: WeekRange = THIS_WEEK): Promise<void> {
  await act(() => render(<WeekPicker week={week} firstDay={1} locale="fr" labels={LABELS} now={NOW} onStep={onStep} onSelect={onSelect} focusKey="agenda" />, container));
}

async function press(key: string): Promise<void> {
  await act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

async function click(el: HTMLElement | null): Promise<void> {
  if (!el) throw new Error('élément absent');
  await act(() => el.click());
}

const trigger = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-focus="agenda-week"]');
const rows = (): HTMLElement[] => $$('[role="option"]');
const activeKey = (): string | undefined => $('[role="listbox"]')?.getAttribute('aria-activedescendant')?.split('-').slice(-3).join('-');
const month = (): string | null => $('[data-calendar-month]')?.textContent ?? null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  onStep.mockReset();
  onSelect.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('calendarWeeks / weekLabel', () => {
  it('six semaines fixes, de celle qui contient le 1er du mois', () => {
    const weeks = calendarWeeks(new Date(2026, 9, 1, 12), 1);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.key).toBe('2026-09-28');
    expect(weeks[5]?.key).toBe('2026-11-02');
    // Février 2027 commence un lundi : 6 lignes quand même (hauteur fixe)
    expect(calendarWeeks(new Date(2027, 1, 1, 12), 1).map((w) => w.key)).toEqual(['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22', '2027-03-01', '2027-03-08']);
  });

  it('dates du bouton : mois long, mois abrégés à cheval sur deux mois', () => {
    expect(weekLabel(THIS_WEEK, 'fr')).toBe('12–18 octobre');
    expect(weekLabel(weekRange(new Date(2026, 9, 1).getTime(), 1), 'fr').replace(/\s/g, ' ')).toBe('28 sept. – 4 oct.');
  });
});

describe('WeekPicker', () => {
  it('‹ › : semaine précédente / suivante, sans ouvrir le calendrier', async () => {
    await show();
    await click($('[data-focus="agenda-prev"]'));
    await click($('[data-focus="agenda-next"]'));
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
    expect($('[role="dialog"]')).toBeNull();
    expect(trigger()?.textContent).toContain('12–18 octobre');
    expect(trigger()?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('calendrier : 6 lignes de semaine, semaine affichée sélectionnée, aujourd’hui marqué, focus sur la liste', async () => {
    await show();
    await click(trigger());
    expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    expect(month()).toBe('octobre 2026');
    expect(rows()).toHaveLength(6);
    expect(rows().filter((row) => row.getAttribute('aria-selected') === 'true').map((row) => row.dataset.week)).toEqual(['2026-10-12']);
    expect($$('[data-today]').map((el) => el.textContent)).toEqual(['16']);
    expect(document.activeElement?.getAttribute('role')).toBe('listbox');
    expect(activeKey()).toBe('2026-10-12');
    // Jours des autres mois atténués, en-tête des jours dans la langue
    expect(rows()[0]?.textContent).toBe('2829301234');
    expect($$('[aria-hidden="true"].grid span').map((el) => el.textContent).join('')).toBe('LMMJVSD');
  });

  it('↑ ↓ : semaine active, le mois suit en sortant de ses lignes ; PgUp / PgDn et ‹ › du mois : aucun choix', async () => {
    await show();
    await click(trigger());
    await press('ArrowUp');
    expect(activeKey()).toBe('2026-10-05');
    for (let i = 0; i < 3; i++) await press('ArrowDown');
    expect(activeKey()).toBe('2026-10-26');
    await press('ArrowDown');
    expect(activeKey()).toBe('2026-11-02');
    // 2 novembre : encore une ligne du calendrier d'octobre ; 9 novembre : novembre affiché
    expect(month()).toBe('octobre 2026');
    await press('ArrowDown');
    expect(activeKey()).toBe('2026-11-09');
    expect(month()).toBe('novembre 2026');
    await press('PageDown');
    expect(month()).toBe('décembre 2026');
    expect(activeKey()).toBe('2026-12-07');
    await press('PageUp');
    await press('PageUp');
    expect(month()).toBe('octobre 2026');
    await click($('[data-focus="calendar-next-month"]'));
    await click($('[data-focus="calendar-next-month"]'));
    expect(month()).toBe('décembre 2026');
    await click($('[data-focus="calendar-prev-month"]'));
    expect(month()).toBe('novembre 2026');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
    expect($('[role="dialog"]')).not.toBeNull();
  });

  it('molette sur le calendrier : mois suivant / précédent, un mois par geste, défilement de la page empêché, aucun choix', async () => {
    vi.useFakeTimers();
    try {
      await show();
      await click(trigger());
      const dialog = $('[role="dialog"]');
      if (!dialog) throw new Error('calendrier absent');
      const wheel = async (deltaY: number): Promise<WheelEvent> => {
        const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
        await act(() => {
          dialog.dispatchEvent(event);
        });
        return event;
      };
      const down = await wheel(100);
      expect(down.defaultPrevented).toBe(true);
      expect(month()).toBe('novembre 2026');
      // Suite du même geste (pavé tactile) : ignorée
      await wheel(40);
      await wheel(40);
      expect(month()).toBe('novembre 2026');
      await act(() => {
        vi.advanceTimersByTime(400);
      });
      await wheel(-100);
      expect(month()).toBe('octobre 2026');
      await act(() => {
        vi.advanceTimersByTime(400);
      });
      // Petits déplacements cumulés sous le seuil : rien
      await wheel(5);
      expect(month()).toBe('octobre 2026');
      expect(onSelect).not.toHaveBeenCalled();
      expect(onStep).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Entrée : semaine active choisie (un seul appel), calendrier fermé, focus rendu au bouton', async () => {
    await show();
    await click(trigger());
    await press('ArrowDown');
    await press('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0].key).toBe(shiftWeek(THIS_WEEK, 1).key);
    expect($('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('clic sur une ligne entière : cette semaine choisie', async () => {
    await show();
    await click(trigger());
    await click(rows()[1] ?? null);
    expect(onSelect.mock.calls.map(([week]) => week.key)).toEqual(['2026-10-05']);
  });

  it('semaine déjà affichée choisie : calendrier fermé sans appel', async () => {
    await show();
    await click(trigger());
    await press('Enter');
    expect(onSelect).not.toHaveBeenCalled();
    expect($('[role="dialog"]')).toBeNull();
  });

  it('Début : cette semaine active ; « Cette semaine » la choisit (désactivé quand elle est affichée)', async () => {
    await show(shiftWeek(THIS_WEEK, -10));
    await click(trigger());
    expect(month()).toBe('août 2026');
    await press('Home');
    expect(activeKey()).toBe('2026-10-12');
    expect(month()).toBe('octobre 2026');
    await click($('[data-focus="calendar-this-week"]'));
    expect(onSelect.mock.calls.map(([week]) => week.key)).toEqual(['2026-10-12']);

    await show();
    await click(trigger());
    expect($<HTMLButtonElement>('[data-focus="calendar-this-week"]')?.disabled).toBe(true);
  });

  it('Échap : fermé sans choix, focus rendu au bouton ; ‹ › ferment aussi le calendrier', async () => {
    await show();
    await click(trigger());
    await press('Escape');
    expect($('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await click(trigger());
    await click($('[data-focus="agenda-next"]'));
    expect($('[role="dialog"]')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pointeur enfoncé hors du calendrier : fermé', async () => {
    await show();
    await click(trigger());
    await act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect($('[role="dialog"]')).toBeNull();
  });
});
