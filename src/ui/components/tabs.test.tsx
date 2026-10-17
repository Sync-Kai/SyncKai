// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { panelId, tabId, Tabs } from './tabs';

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

type View = 'watching' | 'activity' | 'agenda';

const TABS = [
  { id: 'watching', label: 'En cours' },
  { id: 'activity', label: 'Activité', badge: 2 },
  { id: 'agenda', label: 'Agenda' },
] as const satisfies readonly { id: View; label: string; badge?: number }[];

describe('Tabs', () => {
  const onSelect = vi.fn<(id: View) => void>();
  const tabs = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[role="tab"]')];
  const press = async (key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(() => {
      (document.activeElement ?? document.body).dispatchEvent(event);
    });
    return event;
  };

  /** Hôte contrôlé : la sélection suit onSelect */
  function Host({ initial = 'watching' }: { initial?: View }) {
    const [selected, setSelected] = useState<View>(initial);
    return (
      <Tabs
        label="Vues"
        idBase="view"
        tabs={TABS}
        selected={selected}
        onSelect={(id) => {
          onSelect(id);
          setSelected(id);
        }}
      />
    );
  }

  beforeEach(() => {
    onSelect.mockReset();
  });

  it('tablist nommé, onglets aria-selected / aria-controls, tabindex itinérant', async () => {
    await show(<Host />);
    expect($('[role="tablist"]')?.getAttribute('aria-label')).toBe('Vues');
    const [first, second] = tabs();
    expect(first?.getAttribute('aria-selected')).toBe('true');
    expect(second?.getAttribute('aria-selected')).toBe('false');
    expect(first?.tabIndex).toBe(0);
    expect(second?.tabIndex).toBe(-1);
    expect(first?.id).toBe(tabId('view', 'watching'));
    expect(first?.getAttribute('aria-controls')).toBe(panelId('view', 'watching'));
    expect($('[data-tab-badge]')?.textContent).toBe('2');
  });

  it('clic : sélection', async () => {
    await show(<Host />);
    await act(() => tabs()[2]?.click());
    expect(onSelect).toHaveBeenCalledWith('agenda');
  });

  it('flèches (en boucle), Début et Fin : focus et sélection', async () => {
    await show(<Host />);
    tabs()[0]?.focus();
    expect((await press('ArrowRight')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tabs()[1]);
    expect(onSelect).toHaveBeenLastCalledWith('activity');
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(document.activeElement).toBe(tabs()[2]);
    expect(onSelect).toHaveBeenLastCalledWith('agenda');
    await press('Home');
    expect(document.activeElement).toBe(tabs()[0]);
    await press('End');
    expect(document.activeElement).toBe(tabs()[2]);
    await press('ArrowRight');
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('autre touche : rien', async () => {
    await show(<Host />);
    tabs()[0]?.focus();
    expect((await press('a')).defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('nom accessible d’un onglet (pastille comprise) et clés data-focus', async () => {
    const items = [
      { id: 'watching', label: 'En cours' },
      { id: 'activity', label: 'Activité', badge: 2, ariaLabel: 'Activité, 2 éléments à traiter' },
    ] as const satisfies readonly { id: View; label: string; badge?: number; ariaLabel?: string }[];
    await show(<Tabs label="Vues" idBase="view" tabs={items} selected="watching" onSelect={onSelect} focusKeyBase="nav" />);
    expect(tabs()[1]?.getAttribute('aria-label')).toBe('Activité, 2 éléments à traiter');
    expect(tabs()[0]?.hasAttribute('aria-label')).toBe(false);
    expect(tabs().map((tab) => tab.dataset.focus)).toEqual(['nav-watching', 'nav-activity']);
    expect($('[data-tab-badge]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('nouvelle sélection : tabindex déplacé', async () => {
    await show(<Host initial="activity" />);
    expect(tabs()[1]?.tabIndex).toBe(0);
    expect(tabs()[0]?.tabIndex).toBe(-1);
  });
});
