import type { StreamingAdapter } from './adapter';

// Saison choisie dans le menu d'une page de série (Crunchyroll, Netflix, Disney+ : l'URL ne change pas) : le panneau
// latéral relit la page à chaque changement. Rien ne tourne hors page de série, ni tant qu'aucun panneau n'est connecté.

/** Attente après le dernier changement du menu avant de prévenir le panneau (rendu du menu en plusieurs étapes) */
export const SEASON_DEBOUNCE_MS = 300;
/** Recherche de l'élément du menu (pas encore rendu, ou remplacé par le site) */
export const SEASON_RECHECK_MS = 1_000;

export interface SeasonWatch {
  /** Page affichée ou nombre de panneaux connectés changé : suivi démarré, gardé ou arrêté */
  update(url: URL, panels: number): void;
  /** Arrêt (instance orpheline) */
  stop(): void;
}

/** Saison retenue par l'adapter pour la page (numéro et titre), « - » si aucune : seule son évolution compte */
function seasonIdentity(adapter: StreamingAdapter, url: URL): string {
  const series = adapter.detectSeries(url);
  return series ? `${series.seasonNumber ?? '?'}|${series.seasonTitle ?? ''}` : '-';
}

/**
 * Suivi de la saison choisie : actif seulement sur une page de série (pas de lecture), avec au moins un panneau
 * connecté et un adapter qui sait surveiller son menu (`watchSeason`). Après une rafale de changements du menu
 * (`debounceMs`), `notify` n'est appelé que si la saison retenue par l'adapter (`detectSeries`) a changé : un texte qui
 * bouge sans changer de saison (liste chargée au défilement, menu déplié) ne fait jamais relire la page au panneau.
 */
export function createSeasonWatch(adapter: StreamingAdapter, notify: () => void, debounceMs: number = SEASON_DEBOUNCE_MS): SeasonWatch {
  let stopWatch: (() => void) | null = null;
  let href: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Saison retenue au démarrage du suivi, puis à chaque notification */
  let identity = '-';

  const stop = (): void => {
    clearTimeout(timer);
    stopWatch?.();
    stopWatch = null;
    href = null;
  };

  const changed = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (href === null) return;
      const next = seasonIdentity(adapter, new URL(href));
      if (next === identity) return;
      identity = next;
      notify();
    }, debounceMs);
  };

  return {
    update(url: URL, panels: number): void {
      const active = panels > 0 && adapter.watchSeason !== undefined && adapter.getEpisodeId(url) === null;
      if (active && stopWatch && href === url.href) return;
      stop();
      if (!active) return;
      identity = seasonIdentity(adapter, url);
      stopWatch = adapter.watchSeason?.(url, changed) ?? null;
      if (stopWatch) href = url.href;
    },
    stop,
  };
}

/**
 * Surveille le texte de l'élément `target` (sélecteur du bouton du menu des saisons, ou recherche propre à l'adapter) :
 * MutationObserver limité à cet élément (texte et enfants), et vérification toutes les `recheckMs` qu'il n'a pas été
 * remplacé ou qu'il est apparu. `onChange` à chaque texte différent du précédent (jamais à l'installation). Retourne l'arrêt.
 */
export function watchElementText(target: string | (() => Element | null), onChange: () => void, recheckMs: number = SEASON_RECHECK_MS): () => void {
  const find = typeof target === 'string' ? (): Element | null => document.querySelector(target) : target;
  let element: Element | null = null;
  let observer: MutationObserver | null = null;
  let last: string | null = null;

  const read = (): string | null => element?.textContent?.replace(/\s+/g, ' ').trim() || null;
  const check = (): void => {
    const text = read();
    if (text === last) return;
    last = text;
    onChange();
  };
  const attach = (): void => {
    const found = find();
    if (found === element) return;
    observer?.disconnect();
    observer = null;
    element = found;
    if (found) {
      observer = new MutationObserver(check);
      observer.observe(found, { characterData: true, childList: true, subtree: true });
    }
    check();
  };

  element = find();
  last = read();
  element = null;
  attach();
  const interval = setInterval(attach, recheckMs);
  return () => {
    clearInterval(interval);
    observer?.disconnect();
    observer = null;
  };
}
