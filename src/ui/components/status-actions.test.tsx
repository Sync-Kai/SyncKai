// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddListStatus } from '../../shared/sync.types';
import { AddToListButtons, StatusActions } from './status-actions';

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

const LABELS = { PLANNING: 'Ajouter à À regarder', CURRENT: 'Ajouter à En cours' };

describe('StatusActions', () => {
  it('statut en pastille, progression en pilule (− / « Ép. 6 / 28 » / +)', async () => {
    const onIncrement = vi.fn<() => void>();
    await show(
      <StatusActions
        statusLabel="En cours"
        stepper={{ text: 'Ép. 6 / 28', value: 6, max: 28, decrementLabel: 'Moins', incrementLabel: 'Plus', onDecrement: () => undefined, onIncrement, focusKey: 'page' }}
      />,
    );
    expect($('[data-list-status]')?.textContent).toBe('En cours');
    expect($('[data-stepper="pill"]')?.textContent).toBe('Ép. 6 / 28');
    await act(() => $<HTMLButtonElement>('[data-focus="page-plus"]')?.click());
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });
});

describe('AddToListButtons', () => {
  it('« À regarder » secondaire, « En cours » principal sans progression affichée ; clic → statut', async () => {
    const onAdd = vi.fn<(status: AddListStatus) => void>();
    await show(<AddToListButtons labels={LABELS} busy={null} primary onAdd={onAdd} focusKey="page" />);
    const planning = $<HTMLButtonElement>('[data-focus="page-add-PLANNING"]');
    const current = $<HTMLButtonElement>('[data-focus="page-add-CURRENT"]');
    expect(planning?.textContent).toBe(LABELS.PLANNING);
    expect(planning?.dataset.variant).toBe('secondary');
    expect(current?.dataset.variant).toBe('primary');
    await act(() => planning?.click());
    expect(onAdd).toHaveBeenCalledWith('PLANNING');
  });

  it('progression déjà là (autre service) : les deux secondaires ; ajout en cours : bouton occupé, l’autre désactivé', async () => {
    const onAdd = vi.fn<(status: AddListStatus) => void>();
    await show(<AddToListButtons labels={LABELS} busy="CURRENT" disabled primary={false} onAdd={onAdd} focusKey="page" />);
    const current = $<HTMLButtonElement>('[data-focus="page-add-CURRENT"]');
    expect(current?.dataset.variant).toBe('secondary');
    expect(current?.getAttribute('aria-busy')).toBe('true');
    expect(current?.disabled).toBe(false);
    expect($<HTMLButtonElement>('[data-focus="page-add-PLANNING"]')?.disabled).toBe(true);
    await act(() => current?.click());
    expect(onAdd).not.toHaveBeenCalled();
  });
});
