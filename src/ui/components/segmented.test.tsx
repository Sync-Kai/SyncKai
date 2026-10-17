// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './segmented';

let container: HTMLElement;

const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const radios = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[role="radio"]')];
const press = async (key: string): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  await act(() => {
    (document.activeElement ?? document.body).dispatchEvent(event);
  });
  return event;
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

type Tab = 'last' | 'nowPlaying' | 'agenda';
const OPTIONS = [
  { value: 'last', label: 'Dernier ouvert' },
  { value: 'nowPlaying', label: 'En lecture' },
  { value: 'agenda', label: 'Agenda', aria: 'Agenda de la semaine' },
] as const;

describe('Segmented', () => {
  const onChange = vi.fn<(value: Tab) => void>();

  function Host({ initial = 'last', disabled = false }: { initial?: Tab; disabled?: boolean }) {
    const [value, setValue] = useState<Tab>(initial);
    return (
      <Segmented
        options={OPTIONS}
        value={value}
        label="Onglet à l’ouverture"
        focusKey="panel-tab"
        fill
        disabled={disabled}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  beforeEach(() => onChange.mockReset());

  it('groupe radio nommé, option choisie cochée et seule tabulable, nom accessible abrégé, repères de focus', async () => {
    await show(<Host initial="nowPlaying" />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Onglet à l’ouverture');
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    expect(radios()[2]?.getAttribute('aria-label')).toBe('Agenda de la semaine');
    expect(radios().map((radio) => radio.dataset.focus)).toEqual(['panel-tab-last', 'panel-tab-nowPlaying', 'panel-tab-agenda']);
    // Largeur égale : une colonne par option (CSSOM)
    expect((group as HTMLElement).style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('clic : choisit une autre option ; l’option déjà choisie ne rappelle rien', async () => {
    await show(<Host />);
    await act(() => radios()[0]?.click());
    expect(onChange).not.toHaveBeenCalled();
    await act(() => radios()[2]?.click());
    expect(onChange).toHaveBeenCalledWith('agenda');
    expect(radios()[2]?.getAttribute('aria-checked')).toBe('true');
  });

  it('flèches en boucle, Début / Fin : la flèche choisit et déplace le focus', async () => {
    await show(<Host />);
    radios()[0]?.focus();
    expect((await press('ArrowLeft')).defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith('agenda');
    expect(document.activeElement).toBe(radios()[2]);
    await press('ArrowDown');
    expect(onChange).toHaveBeenLastCalledWith('last');
    await press('End');
    expect(onChange).toHaveBeenLastCalledWith('agenda');
    await press('Home');
    expect(document.activeElement).toBe(radios()[0]);
    expect((await press('a')).defaultPrevented).toBe(false);
  });

  it('désactivé : options désactivées, ni clic ni flèche', async () => {
    await show(<Host disabled />);
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(radios().every((radio) => radio.hasAttribute('disabled'))).toBe(true);
    await act(() => radios()[1]?.click());
    container.querySelector<HTMLElement>('[role="radiogroup"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
