// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToastHandle } from './toast';

// Bulle réelle montée dans la page (happy-dom) : remplacement sur place, bulle à bouton jamais chassée par une info,
// position haute (56 px sous 600 px), délai en pause sous le pointeur ou le focus, rôles, aucune prise de focus.

const attachShadow = Element.prototype.attachShadow;

/** Racine fantôme fermée en production : ouverte ici pour lire la bulle */
function hostShadow(): ShadowRoot | null {
  const hosts = [...document.body.children].filter((el) => el.shadowRoot !== null);
  return hosts.at(-1)?.shadowRoot ?? null;
}

function toastEl(): HTMLElement | null {
  return hostShadow()?.querySelector<HTMLElement>('.toast') ?? null;
}

function titleText(): string | null {
  return hostShadow()?.querySelector('.title')?.textContent ?? null;
}

let showToast: typeof import('./toast').showToast;

beforeEach(async () => {
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    return attachShadow.call(this, { ...init, mode: 'open' });
  };
  vi.useFakeTimers();
  document.body.replaceChildren();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  vi.resetModules();
  ({ showToast } = await import('./toast'));
});

afterEach(() => {
  Element.prototype.attachShadow = attachShadow;
  vi.useRealTimers();
});

const retry = (onClick = (): void => undefined): { label: string; onClick: () => void } => ({ label: 'Réessayer', onClick });

describe('showToast', () => {
  it('une seule bulle : la suivante remplace son contenu sur place, la précédente est prévenue', () => {
    const onDismiss = vi.fn();
    showToast({ tone: 'info', title: 'Synchronisation…' }, { onDismiss });
    const host = hostShadow();
    showToast({ tone: 'success', title: 'Épisode 6 enregistré' }, { autoHideMs: 5_000 });
    expect([...document.body.children].filter((el) => el.shadowRoot !== null)).toHaveLength(1);
    expect(hostShadow()).toBe(host);
    expect(titleText()).toBe('Épisode 6 enregistré');
    expect(onDismiss).toHaveBeenCalledWith('replaced');
  });

  it('une bulle qui attend un clic n’est pas chassée par une simple information ; une alerte la remplace', () => {
    const first = showToast({ tone: 'error', title: 'Échec sur MyAnimeList', action: retry() }, { autoHideMs: 15_000 });
    const info: ToastHandle = showToast({ tone: 'success', title: 'Ép. 7 enregistré', message: 'Frieren' }, { variant: 'pill', autoHideMs: 3_000 });
    expect(titleText()).toBe('Échec sur MyAnimeList');
    // Bulle refusée : une mise à jour en information n'apparaît pas non plus, une alerte si
    info.update({ tone: 'success', title: 'Épisode 7 enregistré' }, { autoHideMs: 5_000 });
    expect(titleText()).toBe('Échec sur MyAnimeList');
    info.update({ tone: 'warning', title: 'À vérifier dans SyncKai' }, { autoHideMs: 9_000 });
    expect(titleText()).toBe('À vérifier dans SyncKai');
    // La première, remplacée, ne revient pas
    first.update({ tone: 'success', title: 'Épisode 6 enregistré' }, { autoHideMs: 5_000 });
    expect(titleText()).toBe('À vérifier dans SyncKai');
  });

  it('bouton cliqué : la bulle n’attend plus, la progression qui suit la remplace (« Réessayer »)', () => {
    showToast({ tone: 'error', title: 'Revisionnage non enregistré', action: retry(() => showToast({ tone: 'info', badge: 'sync', title: 'Revisionnage…' })) }, { autoHideMs: 15_000 });
    hostShadow()?.querySelector<HTMLButtonElement>('.action')?.click();
    expect(titleText()).toBe('Revisionnage…');
  });

  it('en haut à droite : 72 px du haut, 56 px dans une fenêtre de moins de 600 px, suivi au redimensionnement', () => {
    showToast({ tone: 'info', title: 'Synchronisation…' });
    expect(toastEl()?.style.top).toBe('72px');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 560 });
    window.dispatchEvent(new Event('resize'));
    expect(toastEl()?.style.top).toBe('56px');
  });

  it('dans une fenêtre basse dès l’affichage', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 540 });
    showToast({ tone: 'info', title: 'Synchronisation…' });
    expect(toastEl()?.style.top).toBe('56px');
  });

  it('délai en pause sous le pointeur, repris quand il sort', () => {
    const onDismiss = vi.fn();
    showToast({ tone: 'success', title: 'Épisode 6 enregistré' }, { autoHideMs: 5_000, onDismiss });
    vi.advanceTimersByTime(4_000);
    toastEl()?.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
    toastEl()?.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledWith('timeout');
  });

  it('délai en pause tant que le focus est dans la bulle', () => {
    const onDismiss = vi.fn();
    showToast({ tone: 'error', title: 'Échec de la synchronisation', action: retry() }, { autoHideMs: 15_000, onDismiss });
    const button = hostShadow()?.querySelector('.action');
    button?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
    button?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    vi.advanceTimersByTime(15_000);
    expect(onDismiss).toHaveBeenCalledWith('timeout');
  });

  it('rôles : status, alert pour une erreur ; aucun focus pris ; barre de délai seulement avec un bouton', () => {
    const before = document.activeElement;
    showToast({ tone: 'success', title: 'Épisode 6 enregistré' }, { autoHideMs: 5_000 });
    expect(toastEl()?.getAttribute('role')).toBe('status');
    expect(hostShadow()?.querySelector('.timer')).toBeNull();
    showToast({ tone: 'error', title: 'Échec de la synchronisation', action: retry() }, { autoHideMs: 15_000 });
    expect(toastEl()?.getAttribute('role')).toBe('alert');
    expect(hostShadow()?.querySelector('.timer')).not.toBeNull();
    expect(document.activeElement).toBe(before);
    expect(hostShadow()?.activeElement ?? null).toBeNull();
  });

  it('lignes par service : un logo par service, deux logos sur une ligne fusionnée', () => {
    showToast({
      tone: 'success',
      title: 'Série terminée !',
      lines: [{ services: ['anilist', 'mal'], label: 'AniList et MyAnimeList', text: 'statut Terminé', tone: 'ok' }],
    });
    const lines = hostShadow()?.querySelectorAll('.line');
    expect(lines).toHaveLength(1);
    expect(lines?.[0]?.querySelectorAll('.logo')).toHaveLength(2);
    expect(lines?.[0]?.querySelector('.line-text')?.textContent).toBe('AniList et MyAnimeList · statut Terminé');
  });
});
