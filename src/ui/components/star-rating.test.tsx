// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { StarRating } from './star-rating';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.restoreAllMocks();
  setLocale('en');
});

describe('StarRating', () => {
  const onChange = vi.fn<(value: number) => void>();
  const onConfirm = vi.fn<(value: number) => void>();
  const slider = (): HTMLElement | null => $('[role="slider"]');
  const stars = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[data-star]')];
  /** Moitiés visibles des étoiles : clip-path de l'étoile pleine */
  const fills = (): string[] => stars().map((star) => star.querySelector<SVGElement>('[data-fill]')?.style.clipPath ?? '');
  const press = async (key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(() => {
      slider()?.dispatchEvent(event);
    });
    return event;
  };
  /** Étoile `index` (1 à 10) de 20 px à partir de x = (index − 1) × 20 */
  const layout = (): void => {
    stars().forEach((star, i) => {
      vi.spyOn(star, 'getBoundingClientRect').mockReturnValue(new DOMRect(i * 20, 0, 20, 20));
    });
  };
  const pointer = async (type: 'pointermove' | 'click', star: number, half: 'left' | 'right'): Promise<void> => {
    const el = stars()[star - 1];
    const clientX = (star - 1) * 20 + (half === 'left' ? 5 : 15);
    await act(() => {
      el?.dispatchEvent(type === 'click' ? new MouseEvent('click', { bubbles: true, clientX }) : new PointerEvent('pointermove', { bubbles: true, clientX }));
    });
  };

  beforeEach(() => {
    onChange.mockReset();
    onConfirm.mockReset();
  });

  it('curseur : role="slider", nom, bornes 0,5 à 10, valeur et texte de valeur', async () => {
    await show(<StarRating label="Noter Frieren" value={8.5} onChange={onChange} />);
    expect(slider()?.getAttribute('aria-label')).toBe('Noter Frieren');
    expect(slider()?.getAttribute('aria-valuemin')).toBe('0.5');
    expect(slider()?.getAttribute('aria-valuemax')).toBe('10');
    expect(slider()?.getAttribute('aria-valuenow')).toBe('8.5');
    expect(slider()?.getAttribute('aria-valuetext')).toBe('8,5/10');
    expect(slider()?.tabIndex).toBe(0);
    expect(stars()).toHaveLength(10);
    expect($('[data-star-value]')?.textContent).toBe('8,5/10');
  });

  it('remplissage : étoiles pleines, demi-étoile, vides', async () => {
    await show(<StarRating label="Note" value={2.5} onChange={onChange} />);
    expect(fills().slice(0, 4)).toEqual(['none', 'none', 'inset(0 50% 0 0)', 'inset(0 100% 0 0)']);
  });

  it('sans note : ni aria-valuenow, texte « –/10 »', async () => {
    await show(<StarRating label="Note" value={0} onChange={onChange} />);
    expect(slider()?.hasAttribute('aria-valuenow')).toBe(false);
    expect(slider()?.getAttribute('aria-valuetext')).toBe('–/10');
  });

  it('clavier : ← → ±0,5, Début / Fin, bornes ; Entrée confirme', async () => {
    await show(<StarRating label="Note" value={8} onChange={onChange} onConfirm={onConfirm} />);
    expect((await press('ArrowRight')).defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(8.5);
    await press('ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith(7.5);
    await press('Home');
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    await press('End');
    expect(onChange).toHaveBeenLastCalledWith(10);
    await press('Enter');
    expect(onConfirm).toHaveBeenCalledWith(8);
    expect((await press('a')).defaultPrevented).toBe(false);

    await show(<StarRating label="Note" value={10} onChange={onChange} />);
    onChange.mockReset();
    await press('ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith(10);
    await show(<StarRating label="Note" value={0} onChange={onChange} />);
    await press('ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('clic sur la moitié gauche ou droite d’une étoile : x,5 ou x ; changement et confirmation', async () => {
    await show(<StarRating label="Note" value={0} onChange={onChange} onConfirm={onConfirm} />);
    layout();
    await pointer('click', 7, 'left');
    expect(onChange).toHaveBeenLastCalledWith(6.5);
    expect(onConfirm).toHaveBeenLastCalledWith(6.5);
    await pointer('click', 7, 'right');
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('survol : aperçu sans changer la valeur, retiré à la sortie du pointeur', async () => {
    await show(<StarRating label="Note" value={2} onChange={onChange} />);
    layout();
    await pointer('pointermove', 4, 'left');
    expect(fills().slice(0, 4)).toEqual(['none', 'none', 'none', 'inset(0 50% 0 0)']);
    expect($('[data-star-value]')?.textContent).toBe('3,5/10');
    expect(slider()?.getAttribute('aria-valuenow')).toBe('2');
    expect(onChange).not.toHaveBeenCalled();
    await act(() => {
      $('[data-star-row]')?.dispatchEvent(new PointerEvent('pointerleave'));
    });
    expect(fills().slice(0, 3)).toEqual(['none', 'none', 'inset(0 100% 0 0)']);
    expect($('[data-star-value]')?.textContent).toBe('2/10');
  });

  it('lecture seule : aria-readonly, ni clavier, ni clic, ni aperçu', async () => {
    await show(<StarRating label="Note" value={6} readonly onChange={onChange} onConfirm={onConfirm} />);
    layout();
    expect(slider()?.getAttribute('aria-readonly')).toBe('true');
    await press('ArrowRight');
    await pointer('click', 9, 'right');
    await pointer('pointermove', 9, 'right');
    expect(onChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect($('[data-star-value]')?.textContent).toBe('6/10');
  });

  it('désactivé : aria-disabled, rien ne change', async () => {
    await show(<StarRating label="Note" value={6} disabled onChange={onChange} />);
    expect(slider()?.getAttribute('aria-disabled')).toBe('true');
    await press('ArrowRight');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('écouteurs du pointeur sur la rangée, retirés au démontage ; aucun sur le document ni la fenêtre', async () => {
    const docAdd = vi.spyOn(document, 'addEventListener');
    const winAdd = vi.spyOn(window, 'addEventListener');
    await show(<StarRating label="Note" value={4} onChange={onChange} />);
    layout();
    await pointer('pointermove', 2, 'right');
    const row = $('[data-star-row]');
    if (!row) throw new Error('rangée absente');
    const remove = vi.spyOn(row, 'removeEventListener');
    await act(() => render(null, container));
    expect(docAdd).not.toHaveBeenCalled();
    expect(winAdd).not.toHaveBeenCalled();
    expect(remove.mock.calls.map(([type]) => type).sort()).toEqual(['click', 'pointerleave', 'pointermove']);
    // Élément détaché : un événement tardif ne rappelle plus rien
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30 }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
