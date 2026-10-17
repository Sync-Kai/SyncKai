// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonPicker } from './season-picker';

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

const OPTIONS = [
  { id: 146065, label: 'Saison 2 · partie 1 — Mushoku Tensei II (2023)' },
  { id: 166873, label: 'Saison 2 · partie 2 — Mushoku Tensei II Part 2 (2024)' },
];

describe('SeasonPicker', () => {
  it('liste nommée, saison affichée choisie et en infobulle ; une autre saison est transmise, la même non', async () => {
    const onPick = vi.fn<(id: number) => void>();
    await show(<SeasonPicker label="Saison sur AniList" ariaLabel="Choisir la saison affichée" options={OPTIONS} value={146065} onPick={onPick} help="Changer de saison corrige la correspondance." focusKey="page-season" />);
    const select = $<HTMLSelectElement>('select');
    expect(select?.getAttribute('aria-label')).toBe('Choisir la saison affichée');
    expect(select?.dataset.focus).toBe('page-season');
    expect(select?.value).toBe('146065');
    expect(select?.title).toBe(OPTIONS[0].label);
    expect($('label')?.textContent).toBe('Saison sur AniList');
    expect(container.textContent).toContain('Changer de saison corrige la correspondance.');
    expect($('[role="note"]')).toBeNull();
    await act(() => {
      if (!select) return;
      select.value = '166873';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledWith(166873);
  });

  it('saison devinée : avertissement beurre au-dessus, encadré ; désactivée pendant une action', async () => {
    await show(<SeasonPicker label="Saison" ariaLabel="Choisir" options={OPTIONS} value={166873} onPick={() => undefined} warning="Saison devinée : vérifie-la ci-dessous" disabled />);
    expect($('[role="note"]')?.textContent).toBe('Saison devinée : vérifie-la ci-dessous');
    expect($('[data-season-picker]')?.className).toContain('border-butter/40');
    expect($<HTMLSelectElement>('select')?.disabled).toBe(true);
  });

  it('sans encadré (carte « Saison » du panneau) : avertissement en bandeau au-dessus du titre, liste hors du bandeau', async () => {
    await show(<SeasonPicker label="Saison" ariaLabel="Choisir" options={OPTIONS} value={166873} onPick={() => undefined} warning="Saison devinée : vérifie-la ci-dessous" framed={false} />);
    expect($('[data-season-picker]')?.className).not.toContain('border-butter/40');
    const note = $('[role="note"]');
    expect(note?.className).toContain('border-butter/40');
    expect(note?.contains($('select'))).toBe(false);
  });
});
