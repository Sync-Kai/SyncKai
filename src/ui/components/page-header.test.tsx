// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('PageHeader', () => {
  it('Kai, « SyncKai » et le kana (masqué aux lecteurs d’écran) dans la colonne de la page', async () => {
    await act(() => render(<PageHeader column="mx-auto max-w-152" />, container));
    const header = container.querySelector('header');
    expect(header?.textContent).toContain('SyncKai');
    expect(header?.querySelector('span[aria-hidden="true"]')?.textContent?.trim()).toBe('シンカイ');
    expect(header?.querySelector('div')?.className).toContain('max-w-152');
    expect(header?.querySelector('svg')).not.toBeNull();
  });
});
