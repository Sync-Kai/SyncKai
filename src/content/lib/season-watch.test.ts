import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamingAdapter } from './adapter';
import { createSeasonWatch, SEASON_DEBOUNCE_MS, SEASON_RECHECK_MS, watchElementText } from './season-watch';

// Saison choisie dans le menu d'une page de série : panneau prévenu une fois par rafale, rien sans panneau connecté,
// arrêt à la navigation. DOM simulé (Node) : document.querySelector et MutationObserver.

const SERIES = new URL('https://www.disneyplus.com/fr-fr/browse/entity-9a14d04d-01f2-40d0-be62-a6c8ffe24137');
const WATCH = new URL('https://www.disneyplus.com/fr-fr/play/539f8e74-65f6-4c6e-a689-c91d125b6c61');

/**
 * Adapter dont le suivi du menu est simulé : `fire` imite un changement de texte du bouton, `select` le choix d'une autre
 * saison (lue ensuite par detectSeries)
 */
function adapter(): { adapter: StreamingAdapter; watchSeason: ReturnType<typeof vi.fn>; stops: ReturnType<typeof vi.fn>[]; fire: () => void; select: (season: number) => void } {
  let onChange: (() => void) | null = null;
  let season = 1;
  const stops: ReturnType<typeof vi.fn>[] = [];
  const watchSeason = vi.fn((url: URL, callback: () => void) => {
    if (url.pathname.includes('/play/')) return null;
    onChange = callback;
    const stop = vi.fn();
    stops.push(stop);
    return stop;
  });
  return {
    adapter: {
      platform: 'disney',
      supportsHost: () => true,
      getEpisodeId: (url) => (url.pathname.includes('/play/') ? 'x' : null),
      extractEpisodeInfo: () => null,
      detectSeries: () => ({ seriesId: 'x', seriesSlug: null, seriesTitle: 'Undead Unluck', seasonNumber: season, seasonTitle: null }),
      findVideo: () => null,
      watchSeason,
    },
    watchSeason,
    stops,
    fire: () => onChange?.(),
    select: (next: number) => {
      season = next;
      onChange?.();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createSeasonWatch', () => {
  it('changement de saison : une seule notification au panneau après le délai, même pour une rafale', () => {
    const { adapter: a, fire, select } = adapter();
    const notify = vi.fn();
    const watch = createSeasonWatch(a, notify);
    watch.update(SERIES, 1);
    select(99);
    vi.advanceTimersByTime(100);
    fire();
    fire();
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS - 1);
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenCalledOnce();
  });

  it('texte du menu changé sans changement de saison (liste chargée au défilement, menu déplié) : rien', () => {
    const { adapter: a, fire, select } = adapter();
    const notify = vi.fn();
    const watch = createSeasonWatch(a, notify);
    watch.update(SERIES, 1);
    for (let i = 0; i < 10; i++) {
      fire();
      vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    }
    expect(notify).not.toHaveBeenCalled();
    // Aller-retour : 99 puis 1 → deux notifications, jamais plus
    select(99);
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    select(1);
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    fire();
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('« Season 1 » → « Special » (saison sans numéro, titre seul) : saison différente, panneau prévenu', () => {
    let series: { seasonNumber: number | null; seasonTitle: string | null } = { seasonNumber: 1, seasonTitle: null };
    let onChange: () => void = () => undefined;
    const notify = vi.fn();
    const watch = createSeasonWatch(
      {
        ...adapter().adapter,
        detectSeries: () => ({ seriesId: 'GEXH3W49E', seriesSlug: null, seriesTitle: 'I Got a Cheat Skill…', ...series }),
        watchSeason: (_url, callback) => {
          onChange = callback;
          return () => undefined;
        },
      },
      notify,
    );
    watch.update(new URL('https://www.crunchyroll.com/series/GEXH3W49E/i-got-a-cheat-skill'), 1);
    series = { seasonNumber: null, seasonTitle: 'Special' };
    onChange();
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    expect(notify).toHaveBeenCalledOnce();
  });

  it('aucun panneau connecté : aucun suivi posé ; premier panneau : posé ; dernier parti : retiré', () => {
    const { adapter: a, watchSeason, stops } = adapter();
    const watch = createSeasonWatch(a, vi.fn());
    watch.update(SERIES, 0);
    expect(watchSeason).not.toHaveBeenCalled();
    watch.update(SERIES, 1);
    watch.update(SERIES, 2);
    expect(watchSeason).toHaveBeenCalledOnce();
    watch.update(SERIES, 0);
    expect(stops[0]).toHaveBeenCalledOnce();
  });

  it('navigation (page de lecture, autre série) ou arrêt : suivi retiré, notification en attente annulée', () => {
    const { adapter: a, watchSeason, stops, select } = adapter();
    const notify = vi.fn();
    const watch = createSeasonWatch(a, notify);
    watch.update(SERIES, 1);
    select(2);
    watch.update(WATCH, 1);
    expect(stops[0]).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(SEASON_DEBOUNCE_MS);
    expect(notify).not.toHaveBeenCalled();
    expect(watchSeason).toHaveBeenCalledTimes(1);

    const other = new URL('https://www.disneyplus.com/fr-fr/browse/entity-00000000-0000-4000-8000-000000000000');
    watch.update(other, 1);
    expect(watchSeason).toHaveBeenCalledTimes(2);
    watch.stop();
    expect(stops[1]).toHaveBeenCalledOnce();
  });

  it('adapter sans suivi du menu : rien', () => {
    const { adapter: a } = adapter();
    const { watchSeason: _unused, ...plain } = a;
    const watch = createSeasonWatch(plain, vi.fn());
    expect(() => watch.update(SERIES, 1)).not.toThrow();
  });
});

// ─── watchElementText (DOM simulé) ────────────────────────────────────────

/** Faux élément : texte modifiable */
class FakeElement {
  textContent: string | null;
  constructor(text: string | null) {
    this.textContent = text;
  }
}

/** Faux MutationObserver : les mutations sont déclenchées à la main */
class FakeObserver {
  static instances: FakeObserver[] = [];
  target: FakeElement | null = null;
  disconnected = false;
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }
  observe(target: FakeElement): void {
    this.target = target;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  mutate(): void {
    if (!this.disconnected) this.callback();
  }
}

describe('watchElementText', () => {
  let current: FakeElement | null;

  beforeEach(() => {
    FakeObserver.instances = [];
    current = new FakeElement('Saison 1');
    vi.stubGlobal('document', { querySelector: () => current });
    vi.stubGlobal('MutationObserver', FakeObserver);
  });

  it('texte du bouton changé : notifié ; inchangé : rien ; jamais à l’installation', () => {
    const onChange = vi.fn();
    const stop = watchElementText('button', onChange);
    expect(onChange).not.toHaveBeenCalled();
    const [observer] = FakeObserver.instances;
    observer?.mutate();
    expect(onChange).not.toHaveBeenCalled();
    if (current) current.textContent = 'Undead Unluck: Winter Arc';
    observer?.mutate();
    expect(onChange).toHaveBeenCalledOnce();
    stop();
    expect(observer?.disconnected).toBe(true);
  });

  it('bouton remplacé par le site : nouvel élément observé, notifié seulement si son texte diffère', () => {
    const onChange = vi.fn();
    const stop = watchElementText('button', onChange);
    current = new FakeElement('Saison 1');
    vi.advanceTimersByTime(SEASON_RECHECK_MS);
    expect(FakeObserver.instances).toHaveLength(2);
    expect(FakeObserver.instances[0]?.disconnected).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    current = new FakeElement('Undead Unluck: Winter Arc');
    vi.advanceTimersByTime(SEASON_RECHECK_MS);
    expect(onChange).toHaveBeenCalledOnce();
    stop();
    // Arrêté : plus aucune recherche
    current = new FakeElement('Saison 2');
    vi.advanceTimersByTime(SEASON_RECHECK_MS * 3);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('menu pas encore rendu, puis affiché : notifié (saison désormais lisible)', () => {
    current = null;
    const onChange = vi.fn();
    watchElementText('button', onChange);
    current = new FakeElement('Saison 1');
    vi.advanceTimersByTime(SEASON_RECHECK_MS);
    expect(onChange).toHaveBeenCalledOnce();
  });
});
