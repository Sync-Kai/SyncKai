// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavRailItem } from './nav-rail';
import { NavRail } from './nav-rail';

let container: HTMLElement;

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

const ITEMS: readonly NavRailItem<View>[] = [
  { id: 'watching', icon: 'play', label: 'En cours' },
  { id: 'activity', icon: 'bell', label: 'Activité', badge: 3, ariaLabel: 'Activité, 3 éléments à traiter' },
  { id: 'agenda', icon: 'calendar', label: 'Agenda' },
];

describe('NavRail', () => {
  const onSelect = vi.fn<(id: View) => void>();
  const items = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('nav ul button')];
  const tooltip = (): HTMLElement | null => container.querySelector<HTMLElement>('[data-rail-tooltip]');
  const press = async (key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(() => {
      (document.activeElement ?? document.body).dispatchEvent(event);
    });
    return event;
  };

  function Host({ current = 'watching' }: { current?: View | null }) {
    const [selected, setSelected] = useState<View | null>(current);
    return (
      <NavRail
        label="Sections"
        items={ITEMS}
        current={selected}
        onSelect={(id) => {
          onSelect(id);
          setSelected(id);
        }}
        footer={<button type="button">Réglages</button>}
      />
    );
  }

  beforeEach(() => {
    onSelect.mockReset();
  });

  it('marks the current item with aria-current="page" and no other', async () => {
    await show(<Host current="activity" />);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Sections');
    expect(items().map((item) => item.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    await show(<NavRail label="Sections" items={ITEMS} current={null} onSelect={onSelect} footer={null} />);
    expect(items().every((item) => !item.hasAttribute('aria-current'))).toBe(true);
  });

  it('names an item with a badge by its ariaLabel', async () => {
    await show(<Host />);
    expect(items()[1]?.getAttribute('aria-label')).toBe('Activité, 3 éléments à traiter');
    expect(items()[0]?.getAttribute('aria-label')).toBe('En cours');
    expect(items()[1]?.querySelector('[data-rail-badge]')?.textContent).toBe('3');
    expect(items()[1]?.querySelector('[data-rail-badge]')?.getAttribute('aria-hidden')).toBe('true');
    expect(items()[0]?.querySelector('[data-rail-badge]')).toBeNull();
  });

  it('ArrowDown / ArrowUp move focus between items, wrapping; Home / End jump', async () => {
    await show(<Host />);
    items()[0]?.focus();
    expect((await press('ArrowDown')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items()[1]);
    await press('ArrowDown');
    await press('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await press('ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    await press('Home');
    expect(document.activeElement).toBe(items()[0]);
    await press('End');
    expect(document.activeElement).toBe(items()[2]);
    expect(onSelect).not.toHaveBeenCalled();
    expect((await press('a')).defaultPrevented).toBe(false);
  });

  it('shows the tooltip on focus and on hover, aria-hidden="true", hidden on blur', async () => {
    await show(<Host />);
    expect(tooltip()?.hidden).toBe(true);
    await act(() => items()[2]?.focus());
    expect(tooltip()?.hidden).toBe(false);
    expect(tooltip()?.textContent).toBe('Agenda');
    expect(tooltip()?.getAttribute('aria-hidden')).toBe('true');
    await act(() => items()[2]?.blur());
    expect(tooltip()?.hidden).toBe(true);
    await act(() => {
      items()[0]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(tooltip()?.hidden).toBe(false);
    expect(tooltip()?.textContent).toBe('En cours');
    await act(() => {
      items()[0]?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    expect(tooltip()?.hidden).toBe(true);
  });

  it('clicking an item calls onSelect with its id', async () => {
    await show(<Host />);
    await act(() => items()[2]?.click());
    expect(onSelect).toHaveBeenCalledWith('agenda');
  });
});
