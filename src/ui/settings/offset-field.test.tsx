// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFSET_RANGE, stepOffset } from '../../shared/settings';
import { OffsetField } from './offset-field';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const input = (): HTMLInputElement | null => $<HTMLInputElement>('[data-focus="offset-netflix"]');
const key = (name: string): Promise<void> =>
  act(() => {
    input()?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  });
const type = (text: string): Promise<void> =>
  act(() => {
    const field = input();
    if (!field) return;
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('OffsetField', () => {
  const saved = vi.fn<(value: number) => void>();

  /** Page simulée : enregistre comme ctx.update (valeur relue au clic) */
  function Host({ initial = 60 }: { initial?: number }) {
    const [value, setValue] = useState(initial);
    const save = (next: number): void => {
      saved(next);
      setValue(next);
    };
    return (
      <OffsetField
        platform="Netflix"
        value={value}
        focusKey="offset-netflix"
        onCommit={save}
        onStep={(direction) => save(stepOffset(value, direction))}
      />
    );
  }

  beforeEach(() => saved.mockReset());

  it('affiche le délai signé, champ nommé par la plateforme, boutons − / + dans un groupe nommé', async () => {
    await show(<Host />);
    expect(input()?.value).toBe('+60');
    expect(input()?.getAttribute('aria-label')).toContain('Netflix');
    expect($('[role="group"]')?.getAttribute('aria-label')).toBe('Netflix');
    expect($('[data-focus="offset-netflix-minus"]')?.getAttribute('aria-label')).toContain('15');
  });

  it('− / + : pas de 15 min enregistré aussitôt ; borne atteinte : bouton désactivé', async () => {
    await show(<Host />);
    await act(() => $('[data-focus="offset-netflix-plus"]')?.click());
    expect(saved).toHaveBeenLastCalledWith(75);
    expect(input()?.value).toBe('+75');
    await act(() => $('[data-focus="offset-netflix-minus"]')?.click());
    expect(saved).toHaveBeenLastCalledWith(60);

    await show(null);
    await show(<Host initial={OFFSET_RANGE.max} />);
    expect($<HTMLButtonElement>('[data-focus="offset-netflix-plus"]')?.disabled).toBe(true);
    expect($<HTMLButtonElement>('[data-focus="offset-netflix-minus"]')?.disabled).toBe(false);
  });

  it('clavier : saisie enregistrée à Entrée ou à la sortie du champ ; ↑ ↓ font comme + / −', async () => {
    await show(<Host />);
    await type('90');
    expect(saved).not.toHaveBeenCalled();
    await key('Enter');
    expect(saved).toHaveBeenLastCalledWith(90);
    expect(input()?.value).toBe('+90');

    await type('-20');
    await act(() => {
      input()?.dispatchEvent(new FocusEvent('blur'));
    });
    expect(saved).toHaveBeenLastCalledWith(-20);
    expect(input()?.value).toBe('−20');

    await key('ArrowUp');
    expect(saved).toHaveBeenLastCalledWith(-15);
    await key('ArrowDown');
    expect(saved).toHaveBeenLastCalledWith(-30);
  });

  it('saisie invalide : champ signalé avec les bornes, rien d’enregistré ; Échap rend la valeur enregistrée', async () => {
    await show(<Host />);
    for (const text of ['', '12.5', String(OFFSET_RANGE.max + 1)]) {
      await type(text);
      await key('Enter');
      expect(input()?.getAttribute('aria-invalid')).toBe('true');
      const error = $('[data-offset-error]');
      expect(error).not.toBeNull();
      expect(input()?.getAttribute('aria-describedby')).toContain(error?.id ?? '-');
    }
    expect(saved).not.toHaveBeenCalled();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const parent = vi.fn<() => void>();
    container.addEventListener('keydown', parent);
    await act(() => {
      input()?.dispatchEvent(escape);
    });
    // Échap consommé par le champ : la vue ne remonte pas à la page parente
    expect(parent).not.toHaveBeenCalled();
    expect(input()?.value).toBe('+60');
    expect(input()?.getAttribute('aria-invalid')).toBe('false');
    expect($('[data-offset-error]')).toBeNull();
  });
});
