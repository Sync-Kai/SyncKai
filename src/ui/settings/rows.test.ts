import { describe, expect, it, vi } from 'vitest';
import { createDisclosure, disclosureAttrs } from './rows';

describe('Section repliable (Réglages › Aide, builds de dev)', () => {
  it('fermée par défaut ; la bascule l’ouvre puis la referme et redessine la page', () => {
    const redraw = vi.fn<() => void>();
    const disclosure = createDisclosure(redraw);
    expect(disclosure.expanded).toBe(false);
    disclosure.toggle();
    expect(disclosure.expanded).toBe(true);
    expect(redraw).toHaveBeenCalledTimes(1);
    disclosure.toggle();
    expect(disclosure.expanded).toBe(false);
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it('deux sections indépendantes : ouvrir l’une ne ferme pas l’autre', () => {
    const first = createDisclosure(() => undefined);
    const second = createDisclosure(() => undefined);
    first.toggle();
    second.toggle();
    expect([first.expanded, second.expanded]).toEqual([true, true]);
  });

  it('bouton d’en-tête : aria-expanded suit l’état, aria-controls vise le contenu, repère de focus stable', () => {
    expect(disclosureAttrs(false, 'sk-match-diag', 'match-diag-toggle')).toEqual({
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'sk-match-diag',
      'data-focus': 'match-diag-toggle',
    });
    expect(disclosureAttrs(true, 'sk-match-diag', 'match-diag-toggle')['aria-expanded']).toBe('true');
  });
});
