import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchUrl } from './url-watcher';

// Changements d'URL d'une SPA vus du monde isolé : Navigation API quand elle existe, relevé de location.href chaque
// seconde dans tous les cas (2-R7 : Firefox peut exposer `navigation` au script de contenu sans lui livrer les
// `pushState` de la page).

const page = { href: 'https://www.crunchyroll.com/watch/GA1/e1' };

beforeEach(() => {
  vi.useFakeTimers();
  page.href = 'https://www.crunchyroll.com/watch/GA1/e1';
  vi.stubGlobal('location', page);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('watchUrl', () => {
  it('Navigation API présente mais muette : changement vu par le relevé d’une seconde, une seule fois', () => {
    const navigation = new EventTarget();
    vi.stubGlobal('window', Object.assign(new EventTarget(), { navigation }));
    const onChange = vi.fn<(url: URL) => void>();
    const stop = watchUrl(onChange);
    page.href = 'https://www.crunchyroll.com/watch/GA2/e2';
    vi.advanceTimersByTime(1_000);
    expect(onChange.mock.calls.map(([url]) => url.href)).toEqual(['https://www.crunchyroll.com/watch/GA2/e2']);
    // Événement tardif de la Navigation API pour la même URL : pas de second appel
    navigation.dispatchEvent(new Event('currententrychange'));
    vi.advanceTimersByTime(3_000);
    expect(onChange).toHaveBeenCalledOnce();
    stop();
    page.href = 'https://www.crunchyroll.com/watch/GA3/e3';
    vi.advanceTimersByTime(2_000);
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('Navigation API : changement vu aussitôt, sans attendre le relevé', () => {
    const navigation = new EventTarget();
    vi.stubGlobal('window', Object.assign(new EventTarget(), { navigation }));
    const onChange = vi.fn<(url: URL) => void>();
    watchUrl(onChange);
    page.href = 'https://www.crunchyroll.com/watch/GA2/e2';
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('sans Navigation API : popstate et relevé', () => {
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    const onChange = vi.fn<(url: URL) => void>();
    const stop = watchUrl(onChange);
    page.href = 'https://www.crunchyroll.com/watch/GA2/e2';
    win.dispatchEvent(new Event('popstate'));
    page.href = 'https://www.crunchyroll.com/watch/GA3/e3';
    vi.advanceTimersByTime(1_000);
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });
});
