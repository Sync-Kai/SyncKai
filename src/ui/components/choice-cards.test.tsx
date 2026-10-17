// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoiceCards } from './choice-cards';

let container: HTMLElement;

const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const radios = (): HTMLInputElement[] => [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

type Trigger = 'credits' | 'percentage';
const OPTIONS = [
  { value: 'credits', label: 'Au début du générique', description: 'Recommandé : le moment exact donné par la plateforme', badge: 'Recommandé' },
  { value: 'percentage', label: 'À un pourcentage fixe' },
] as const;

describe('ChoiceCards', () => {
  const onChange = vi.fn<(value: Trigger) => void>();

  function Host({ disabled = false }: { disabled?: boolean }) {
    const [value, setValue] = useState<Trigger>('credits');
    return (
      <ChoiceCards
        legend="Épisode compté comme vu"
        options={OPTIONS}
        value={value}
        disabled={disabled}
        focusKey="trigger"
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  beforeEach(() => onChange.mockReset());

  it('groupe nommé par sa légende, un bouton radio natif par option, même nom, description reliée', async () => {
    await show(<Host />);
    expect(container.querySelector('legend')?.textContent).toBe('Épisode compté comme vu');
    const [credits, percentage] = radios();
    expect(credits?.name).toBe(percentage?.name);
    expect(credits?.checked).toBe(true);
    expect(credits?.dataset.focus).toBe('trigger-credits');
    const described = container.querySelector(`#${CSS.escape(credits?.getAttribute('aria-describedby') ?? '')}`);
    expect(described?.textContent).toBe(OPTIONS[0].description);
    expect(percentage?.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('[data-choice="credits"]')?.textContent).toContain('Recommandé');
  });

  it('choisir une carte : onChange, carte choisie en lavender, l’autre bordée `line`', async () => {
    await show(<Host />);
    await act(() => {
      container.querySelector<HTMLElement>('[data-choice="percentage"]')?.click();
    });
    expect(onChange).toHaveBeenCalledWith('percentage');
    expect(radios()[1]?.checked).toBe(true);
    expect(container.querySelector('[data-choice="percentage"]')?.className).toContain('border-lavender');
    expect(container.querySelector('[data-choice="credits"]')?.className).toContain('border-line');
  });

  it('variante flush, légende masquée : cartes sans bordure, choisie sur fond raised, légende lue seulement', async () => {
    await show(<ChoiceCards legend="Style des notifications" options={OPTIONS} value="credits" onChange={onChange} flush legendHidden />);
    expect(container.querySelector('legend')?.className).toBe('sr-only');
    expect(container.querySelector('legend')?.textContent).toBe('Style des notifications');
    const chosen = container.querySelector('[data-choice="credits"]')?.className ?? '';
    const other = container.querySelector('[data-choice="percentage"]')?.className ?? '';
    expect(chosen).toContain('bg-raised');
    expect(chosen).not.toContain('border');
    expect(other).not.toContain('border');
  });

  it('désactivé : fieldset désactivé, aucun choix', async () => {
    await show(<Host disabled />);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    await act(() => {
      container.querySelector<HTMLElement>('[data-choice="percentage"]')?.click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
