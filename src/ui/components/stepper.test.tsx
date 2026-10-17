// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Stepper, type StepperProps } from './stepper';

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

describe('Stepper', () => {
  const onDecrement = vi.fn<() => void>();
  const onIncrement = vi.fn<() => void>();
  const props = (over: Partial<StepperProps> = {}): StepperProps => ({
    text: 'Ép. 4 / 12',
    value: 4,
    max: 12,
    decrementLabel: 'Moins un épisode',
    incrementLabel: 'Plus un épisode',
    groupLabel: 'Épisodes vus de Dandadan',
    onDecrement,
    onIncrement,
    ...over,
  });
  const minus = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-step="-1"]');
  const plus = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-step="1"]');

  beforeEach(() => {
    onDecrement.mockReset();
    onIncrement.mockReset();
  });

  it('texte en chiffres tabulaires, groupe nommé, boutons nommés (aria-label et title)', async () => {
    await show(<Stepper {...props()} />);
    expect($('[data-stepper-text]')?.textContent).toBe('Ép. 4 / 12');
    expect($('[data-stepper-text]')?.className).toContain('tabular-nums');
    expect($('[role="group"]')?.getAttribute('aria-label')).toBe('Épisodes vus de Dandadan');
    expect(minus()?.getAttribute('aria-label')).toBe('Moins un épisode');
    expect(minus()?.getAttribute('title')).toBe('Moins un épisode');
    expect(plus()?.getAttribute('aria-label')).toBe('Plus un épisode');
  });

  it('clics : −1 et +1', async () => {
    await show(<Stepper {...props()} />);
    minus()?.click();
    plus()?.click();
    expect(onDecrement).toHaveBeenCalledTimes(1);
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('borne basse atteinte : − désactivé seul', async () => {
    await show(<Stepper {...props({ value: 0 })} />);
    expect(minus()?.disabled).toBe(true);
    expect(plus()?.disabled).toBe(false);
    minus()?.click();
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it('borne haute atteinte : + désactivé seul ; total inconnu : + toujours actif', async () => {
    await show(<Stepper {...props({ value: 12 })} />);
    expect(plus()?.disabled).toBe(true);
    expect(minus()?.disabled).toBe(false);
    await show(<Stepper {...props({ value: 1180, max: null, text: 'Ép. 1180 / ?' })} />);
    expect(plus()?.disabled).toBe(false);
  });

  it('min personnalisé ; disabled : les deux boutons', async () => {
    await show(<Stepper {...props({ value: 1, min: 1 })} />);
    expect(minus()?.disabled).toBe(true);
    await show(<Stepper {...props({ disabled: true })} />);
    expect(minus()?.disabled).toBe(true);
    expect(plus()?.disabled).toBe(true);
  });
});
