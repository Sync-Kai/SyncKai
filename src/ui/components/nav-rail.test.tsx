// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavRailFooterItem, NavRailItem } from './nav-rail';
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
  const onPanel = vi.fn<() => void>();
  const onGear = vi.fn<() => void>();
  const items = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('nav [data-rail-section]')];
  const footer = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('nav [data-rail-footer]')];
  const footerItems = (pressed = false): readonly NavRailFooterItem[] => [
    { id: 'panel', icon: 'panel', label: 'Ouvrir le panneau', onClick: onPanel },
    { id: 'gear', icon: 'gear', label: 'Réglages', pressed, onClick: onGear },
  ];
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
        footerItems={footerItems()}
      />
    );
  }

  beforeEach(() => {
    onSelect.mockReset();
    onPanel.mockReset();
    onGear.mockReset();
  });

  it('marks the current item with aria-current="page" and no other', async () => {
    await show(<Host current="activity" />);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Sections');
    expect(items().map((item) => item.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    await show(<NavRail label="Sections" items={ITEMS} current={null} onSelect={onSelect} footerItems={[]} />);
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

  it('ArrowDown / ArrowUp move focus through sections then footer buttons (one group), wrapping; Home / End jump', async () => {
    await show(<Host />);
    items()[0]?.focus();
    expect((await press('ArrowDown')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items()[1]);
    await press('ArrowDown');
    await press('ArrowDown');
    // ↓ depuis la dernière section : boutons du pied (panneau, Réglages)
    expect(document.activeElement).toBe(footer()[0]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(footer()[1]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await press('ArrowUp');
    expect(document.activeElement).toBe(footer()[1]);
    await press('Home');
    expect(document.activeElement).toBe(items()[0]);
    await press('End');
    expect(document.activeElement).toBe(footer()[1]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onGear).not.toHaveBeenCalled();
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
      items()[0]?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    });
    expect(tooltip()?.hidden).toBe(false);
    expect(tooltip()?.textContent).toBe('En cours');
    await act(() => {
      items()[0]?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    });
    expect(tooltip()?.hidden).toBe(true);
  });

  it('shows no tooltip for a touch pointer or for a focus coming from a pointer', async () => {
    await show(<Host />);
    await act(() => {
      items()[0]?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    });
    expect(tooltip()?.hidden).toBe(true);
    await act(() => {
      items()[0]?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    });
    expect(tooltip()?.hidden).toBe(false);
    await act(() => {
      items()[0]?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    });
    await act(() => {
      items()[2]?.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
      items()[2]?.focus();
    });
    expect(tooltip()?.hidden).toBe(true);
  });

  it('keeps the badge count in the accessible name and renders no badge for 0', async () => {
    const items2: readonly NavRailItem<View>[] = [
      { id: 'watching', icon: 'play', label: 'En cours', badge: 0 },
      { id: 'activity', icon: 'bell', label: 'Activité', badge: 4 },
    ];
    await show(<NavRail label="Sections" items={items2} current={null} onSelect={onSelect} footerItems={[]} />);
    expect(items()[0]?.getAttribute('aria-label')).toBe('En cours');
    expect(items()[0]?.querySelector('[data-rail-badge]')).toBeNull();
    expect(items()[1]?.getAttribute('aria-label')).toBe('Activité, 4');
    expect(items()[1]?.querySelector('[data-rail-badge]')?.textContent).toBe('4');
  });

  it('one tab stop for the whole rail: the current section, else the first section, else the first footer button', async () => {
    const stops = (): string[] => [...container.querySelectorAll<HTMLButtonElement>('nav button')].filter((b) => b.tabIndex === 0).map((b) => b.getAttribute('data-focus') ?? '');
    await show(<Host current="activity" />);
    expect(stops()).toEqual(['rail-activity']);
    expect(footer().every((b) => b.tabIndex === -1)).toBe(true);
    await show(<NavRail label="Sections" items={ITEMS} current={null} onSelect={onSelect} footerItems={footerItems(true)} />);
    expect(stops()).toEqual(['rail-watching']);
    // Accueil : pas de sections, le pied porte l'arrêt
    await show(<NavRail label="Sections" items={[]} current={null} onSelect={onSelect} footerItems={footerItems()} />);
    expect(stops()).toEqual(['panel']);
  });

  it('footer buttons: name, data-focus = id, aria-pressed only when given, click calls onClick, under the divider', async () => {
    await show(<NavRail label="Sections" items={ITEMS} current={null} onSelect={onSelect} footerItems={footerItems(true)} />);
    expect(footer().map((b) => [b.getAttribute('aria-label'), b.getAttribute('data-focus'), b.getAttribute('aria-pressed')])).toEqual([
      ['Ouvrir le panneau', 'panel', null],
      ['Réglages', 'gear', 'true'],
    ]);
    expect(footer()[0]?.closest('.border-t')).not.toBeNull();
    await act(() => footer()[1]?.click());
    expect(onGear).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    await show(<NavRail label="Sections" items={ITEMS} current={null} onSelect={onSelect} footerItems={footerItems(false)} />);
    expect(footer()[1]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('footer buttons show the tooltip on keyboard focus and mouse hover, never on touch', async () => {
    await show(<Host />);
    await act(() => footer()[1]?.focus());
    expect(tooltip()?.hidden).toBe(false);
    expect(tooltip()?.textContent).toBe('Réglages');
    await act(() => footer()[1]?.blur());
    expect(tooltip()?.hidden).toBe(true);
    await act(() => {
      footer()[0]?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    });
    expect(tooltip()?.textContent).toBe('Ouvrir le panneau');
    await act(() => {
      footer()[0]?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      footer()[0]?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    });
    expect(tooltip()?.hidden).toBe(true);
  });

  it('clicking an item calls onSelect with its id', async () => {
    await show(<Host />);
    await act(() => items()[2]?.click());
    expect(onSelect).toHaveBeenCalledWith('agenda');
  });
});
