// Lecture du DOM commune aux adapters sans pont de données (Crunchyroll, ADN) : stratégies essayées dans l'ordre
// (JSON-LD, puis DOM ou lecteur) et chaîne de repli du titre de la série d'une page de série.
import { cleanPageTitle, cleanText, labelKey, readMetaContent, slugToTitle, type LabelGuard } from './parsing';

/** Source des champs d'un épisode (`run` : null si elle ne lit rien de sûr sur la page) */
export interface DomStrategy<F> {
  name: string;
  run(episodeId: string): F | null;
}

/**
 * Champs de la première stratégie qui lit l'épisode ; son libellé (numéro + titre) est retenu par le garde-fou des
 * rendus SPA en retard (voir createLabelGuard). `onRead` : journal de diagnostic (build de développement).
 */
export function runStrategies<F extends { displayedEpisodeNumber: number | null; episodeTitle: string | null }>(
  strategies: readonly DomStrategy<F>[],
  episodeId: string,
  labels: LabelGuard,
  onRead?: (name: string) => void,
): F | null {
  for (const strategy of strategies) {
    const fields = strategy.run(episodeId);
    if (fields) {
      labels.remember(episodeId, labelKey(fields.displayedEpisodeNumber, fields.episodeTitle));
      onRead?.(strategy.name);
      return fields;
    }
  }
  return null;
}

/** Premier élément (sélecteurs dans l'ordre, puis ordre du document) dont le texte nettoyé est accepté */
export function firstElement(selectors: readonly string[], accept: (text: string) => boolean): { element: Element; text: string } | null {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const text = cleanText(element.textContent);
      if (text && accept(text)) return { element, text };
    }
  }
  return null;
}

/** Titre d'une page de série : JSON-LD → titre affiché (`selectors`, 200 caractères au plus) → og:title (sans la plateforme) → slug */
export function seriesTitleChain(jsonLd: string | null, selectors: readonly string[], platform: RegExp, slug: string | null): string | null {
  return jsonLd ?? firstElement(selectors, (text) => text.length <= 200)?.text ?? cleanPageTitle(readMetaContent('og:title'), platform) ?? slugToTitle(slug);
}
