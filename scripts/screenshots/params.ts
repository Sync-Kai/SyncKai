import { isLocale, loadLocale, type Locale } from '../../src/i18n';

/** Langues des captures du Store et des légendes (captions.ts) : les autres langues de l'interface n'en ont pas */
export type StoreLocale = 'fr' | 'en' | 'de';
export const LOCALE_LIST: readonly StoreLocale[] = ['fr', 'en', 'de'];

const params = new URLSearchParams(location.search);

export function param(name: string): string | null {
  return params.get(name);
}

export function localeParam(): StoreLocale {
  const value = params.get('locale');
  return LOCALE_LIST.find((l) => l === value) ?? 'en';
}

/**
 * Langue de la page (paramètre `locale`) avec son catalogue chargé par le vrai chargeur (fichier servi par Vite) : les
 * données de démo, traduites avant le démarrage de la vue (cartes « À vérifier »…), le sont dans cette langue. Les
 * autres langues restent chargées à la demande, comme dans l'extension.
 */
export async function loadedLocaleParam(): Promise<StoreLocale> {
  const locale = localeParam();
  await loadLocale(locale);
  return locale;
}

/**
 * Même chose pour toutes les langues de l'interface (pages des tests de bout en bout, contrôle de mise en page
 * scripts/e2e/i18n-layout.e2e.ts) : langue absente ou inconnue → anglais
 */
export async function loadedUiLocaleParam(): Promise<Locale> {
  const value = params.get('locale');
  const locale = isLocale(value) ? value : 'en';
  await loadLocale(locale);
  return locale;
}

/** Signale à la page parente (ou au script de capture) que le rendu est stable */
export async function markReady(): Promise<void> {
  await document.fonts.ready;
  // Images affichées seulement : une image `loading="lazy"` d'un bloc replié (<details> fermé) ne se charge jamais
  const images = [...document.images].filter((img) => img.checkVisibility());
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  // Deux frames : dernières mises en page appliquées
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  document.documentElement.dataset.ready = '1';
}

export function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs = 8_000): Promise<T> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const value = probe();
      if (value) resolve(value);
      else if (performance.now() - start > timeoutMs) reject(new Error('Délai dépassé en attendant le rendu'));
      else setTimeout(tick, 30);
    };
    tick();
  });
}
