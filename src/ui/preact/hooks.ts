// Hooks des pages Preact : abonnement aux sources extérieures à l'arbre (stores de ui/state.ts, langue active), repli
// du focus quand un rendu retire l'élément focalisé, fermeture par Échap et clic extérieur.
// Pas de `useSyncExternalStore` : il n'existe que dans preact/compat, qui modifie Preact globalement et pèse ~10 Ko ;
// useState + useEffect (abonnement et désabonnement) suffisent aux stores de l'extension.
import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getLocale, onLocaleChange, type Locale } from '../../i18n';
import { pickFocusKey } from '../dom';
import { createMenuDismiss, type MenuDismissHandlers } from '../menu';
import type { ReadonlyStore } from '../state';

/**
 * Valeur courante d'un store, nouveau rendu à chaque changement. `subscribe` de createStore rappelle aussitôt avec la
 * valeur du moment : un changement survenu entre le rendu et l'abonnement (effet différé) n'est donc jamais perdu,
 * et une valeur identique ne redessine rien (Preact ignore un setState sans changement).
 */
export function useStore<T>(store: ReadonlyStore<T>): T {
  const [value, setValue] = useState(store.get);
  // Forme fonction : une valeur de type fonction serait sinon prise pour une mise à jour
  useEffect(() => store.subscribe((next) => setValue(() => next)), [store]);
  return value;
}

/** Langue active : le composant est redessiné à chaque changement (t() lit la langue active au rendu) */
export function useLocale(): Locale {
  const [locale, setLocale] = useState(getLocale);
  useEffect(() => {
    const unsubscribe = onLocaleChange(setLocale);
    // Langue changée entre le rendu et l'abonnement
    setLocale(getLocale());
    return () => {
      unsubscribe();
    };
  }, []);
  return locale;
}

/**
 * Heure courante, relue toutes les `everyMs` tant que `active` (compte à rebours, « il y a 2 min ») ; inactive : aucune
 * minuterie, l'heure est relue à la réactivation. Minuterie retirée au démontage.
 */
export function useNow(everyMs: number, active = true): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs, active]);
  return now;
}

/** Repli du focus : un élément (ref) ou une clé `data-focus` du conteneur */
export type FocusFallback = RefObject<HTMLElement | null> | string;

/** Élément focalisable : connecté, dans le conteneur, ni désactivé ni dans une zone masquée */
function isFocusable(root: HTMLElement, el: HTMLElement): boolean {
  return el.isConnected && root.contains(el) && !el.matches(':disabled') && el.closest('[hidden], [inert]') === null;
}

/** Éléments focalisables par clé `data-focus`, le premier pour chaque clé (comme preserveFocus) */
function focusableByKey(root: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-focus]')) {
    const key = el.dataset.focus;
    if (key && !map.has(key) && isFocusable(root, el)) map.set(key, el);
  }
  return map;
}

/** Clés `data-focus` du conteneur, dans l'ordre du document */
function focusKeys(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-focus]')].flatMap((el) => el.dataset.focus ?? []);
}

interface FocusTrack {
  /** Dernier élément focalisé dans le conteneur ; null : focus sorti du conteneur */
  active: HTMLElement | null;
  /** Replis `data-focus-fallback` de cet élément jusqu'au conteneur inclus, du plus proche au plus lointain */
  declared: string[];
  /** Clés `data-focus` à la fin du rendu précédent (voisins de l'élément retiré) */
  order: string[];
}

/**
 * Élément focalisé retiré (ou désactivé, masqué) par un rendu : le focus passe, comme preserveFocus (ui/dom.ts ›
 * pickFocusKey), à l'élément recréé sous la même clé `data-focus`, sinon au repli `data-focus-fallback` déclaré par
 * l'élément ou un ancêtre, sinon à `fallback`, sinon au voisin suivant puis précédent dans l'ordre d'avant le rendu ;
 * jamais sur <body>. Le diff de Preact garde les nœuds : seuls les retraits sont à traiter. Focus parti hors du conteneur
 * avant le rendu : rien n'est déplacé.
 */
export function useFocusFallback(container: RefObject<HTMLElement | null>, fallback?: FocusFallback): void {
  const track = useRef<FocusTrack>({ active: null, declared: [], order: [] });

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const declared: string[] = [];
      for (let el: HTMLElement | null = target; el; el = el === root ? null : el.parentElement) {
        if (el.dataset.focusFallback) declared.push(el.dataset.focusFallback);
      }
      track.current.active = target;
      track.current.declared = declared;
    };
    const onFocusOut = (event: FocusEvent): void => {
      const target = event.target;
      // Focus parti ailleurs (Tab hors du conteneur, clic à l'extérieur) : oublié ; élément retiré : gardé pour le rendu,
      // relu après coup (la perte de focus due à un retrait peut précéder le retrait lui-même)
      queueMicrotask(() => {
        if (track.current.active !== target || !(target instanceof HTMLElement) || !target.isConnected) return;
        if (!root.contains(document.activeElement)) track.current.active = null;
      });
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [container]);

  // Après chaque rendu, avant que le navigateur ne peigne
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const { active, declared, order } = track.current;
    track.current.order = focusKeys(root);
    if (!active || isFocusable(root, active)) return;
    // Focus déjà placé ailleurs (par le rendu ou l'utilisateur) : laissé en place
    const current = document.activeElement;
    if (current instanceof HTMLElement && current !== document.body && current !== active) return;
    track.current.active = null;
    const focusable = focusableByKey(root);
    const available = (key: string): boolean => focusable.has(key);
    const key = active.dataset.focus ?? '';
    const ref = typeof fallback === 'object' ? fallback.current : null;
    let target: HTMLElement | null = null;
    if (ref !== null && isFocusable(root, ref)) {
      // Repli par ref (sans clé) : après l'élément recréé et les replis déclarés, avant les voisins
      const pick = pickFocusKey(key, [], declared, available);
      target = pick === null ? ref : (focusable.get(pick) ?? ref);
    } else {
      const pick = pickFocusKey(key, order, typeof fallback === 'string' ? [...declared, fallback] : declared, available);
      target = pick === null ? null : (focusable.get(pick) ?? null);
    }
    target?.focus({ preventScroll: true });
  });
}

export interface DismissOptions {
  /** Échap ferme (défaut : oui) */
  escape?: boolean;
  /** Pointeur enfoncé hors de l'élément ferme (défaut : oui) */
  outside?: boolean;
}

/**
 * Fermeture d'un menu ou d'une fenêtre montés : Échap (phase de capture, sans fermer le popup ni revenir en arrière
 * dans les Réglages) et pointeur enfoncé hors de `ref`, par createMenuDismiss (ui/menu.ts). Écouteurs du document posés
 * au montage, retirés au démontage ; le bouton qui ouvre doit être dans `ref`, sinon son clic rouvre aussitôt.
 * `onDismiss` est relu à chaque événement : un nouveau rendu ne repose pas les écouteurs.
 */
export function useDismiss(ref: RefObject<Element | null>, onDismiss: () => void, { escape = true, outside = true }: DismissOptions = {}): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    const handlers: MenuDismissHandlers = {};
    if (escape) handlers.onEscape = () => latest.current();
    if (outside) {
      handlers.onPointerDown = (target) => {
        const el = ref.current;
        if (el && !(target && el.contains(target))) latest.current();
      };
    }
    const dismiss = createMenuDismiss(handlers);
    dismiss.setOpen(true);
    return () => dismiss.setOpen(false);
  }, [ref, escape, outside]);
}
