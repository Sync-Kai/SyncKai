// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { RatingBlock } from './rating-block';

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const slider = (): HTMLElement | null => $('[role="slider"]');
const press = async (key: string): Promise<void> => {
  await act(() => {
    slider()?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
};

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('RatingBlock', () => {
  it('titre, curseur nommé à la note enregistrée ; → puis Entrée envoie la note sur 10, gardée pendant l’envoi', async () => {
    const onRate = vi.fn<(value: number) => void>();
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8} onRate={onRate} focusKey="page-rate" />);
    expect($('[data-rating-block]')?.getAttribute('aria-label')).toBe('Ta note');
    expect(slider()?.getAttribute('aria-label')).toBe('Noter Frieren');
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8');
    expect(slider()?.dataset.focus).toBe('page-rate');
    await press('ArrowRight');
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8.5');
    await press('Enter');
    expect(onRate).toHaveBeenCalledWith(8.5);
    // Envoi en cours : la note choisie reste affichée
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8} onRate={onRate} disabled />);
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8.5');
    // Note relue
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8.5} onRate={onRate} />);
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8.5');
  });

  it('envoi en échec (note relue inchangée) : la note enregistrée revient', async () => {
    const onRate = vi.fn<(value: number) => void>();
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8} onRate={onRate} />);
    await press('ArrowLeft');
    await press('Enter');
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8} onRate={onRate} disabled />);
    expect(slider()?.getAttribute('aria-valuenow')).toBe('7.5');
    await show(<RatingBlock label="Ta note" sliderLabel="Noter Frieren" value={8} onRate={onRate} />);
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8');
  });
});
