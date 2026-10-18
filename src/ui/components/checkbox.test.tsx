// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from './checkbox';

let container: HTMLElement;

const input = (): HTMLInputElement | null => container.querySelector('input');
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('Checkbox', () => {
  it('case native cochée, nom accessible, repère de focus', async () => {
    await show(<Checkbox checked label="Frieren" focusKey="cr-item-1" onChange={() => undefined} />);
    expect(input()?.type).toBe('checkbox');
    expect(input()?.checked).toBe(true);
    expect(input()?.getAttribute('aria-label')).toBe('Frieren');
    expect(input()?.dataset.focus).toBe('cr-item-1');
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('un clic sur le libellé englobant coche la case', async () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    await show(
      <label>
        <Checkbox checked={false} onChange={onChange} />
        Frieren
      </label>,
    );
    await act(() => container.querySelector('label')?.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('désactivée ou déjà faite : figée', async () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    await show(<Checkbox checked done disabled onChange={onChange} />);
    expect(input()?.disabled).toBe(true);
    expect(input()?.hasAttribute('data-done')).toBe(true);
    await act(() => input()?.click());
    expect(onChange).not.toHaveBeenCalled();
  });
});
