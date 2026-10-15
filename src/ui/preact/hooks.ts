// Hooks des pages Preact (pilote) : abonnement aux sources extérieures à l'arbre (stores de ui/state.ts, langue active).
// Pas de `useSyncExternalStore` : il n'existe que dans preact/compat, qui modifie Preact globalement et pèse ~10 Ko ;
// useState + useEffect (abonnement et désabonnement) suffisent aux stores de l'extension.
import { useEffect, useState } from 'preact/hooks';
import { getLocale, onLocaleChange, type Locale } from '../../i18n';
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
