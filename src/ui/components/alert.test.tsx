// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from './alert';

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

describe('Alert', () => {
  it('message repéré par data-alert (région live de la page), sans action', async () => {
    await show(<Alert message="Connexion annulée." />);
    const alert = container.querySelector<HTMLElement>('[data-alert]');
    expect(alert?.dataset.alert).toBe('Connexion annulée.');
    expect(alert?.textContent).toBe('Connexion annulée.');
    expect(container.querySelector('button')).toBeNull();
  });

  it('action facultative : bouton secondaire, en cours = occupé et clic ignoré', async () => {
    const onClick = vi.fn();
    await show(<Alert message="Profil illisible" action={{ label: 'Réessayer', onClick }} />);
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('Réessayer');
    await act(() => button?.click());
    expect(onClick).toHaveBeenCalledTimes(1);

    await show(<Alert message="Profil illisible" action={{ label: 'Réessayer', onClick, busy: true }} />);
    expect(container.querySelector('button')?.getAttribute('aria-busy')).toBe('true');
    await act(() => container.querySelector('button')?.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ton beurre (fiche introuvable) : couleurs beurre, danger par défaut', async () => {
    await show(<Alert message="Aucune fiche AniList trouvée." tone="warn" icon="search" />);
    const alert = container.querySelector<HTMLElement>('[data-alert]');
    expect(alert?.dataset.tone).toBe('warn');
    expect(alert?.className).toContain('text-butter');
    expect(alert?.className).not.toContain('text-danger');
    await show(<Alert message="Trop de requêtes." />);
    expect(container.querySelector<HTMLElement>('[data-alert]')?.className).toContain('text-danger');
  });
});
