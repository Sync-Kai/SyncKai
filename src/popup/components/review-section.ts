import { t } from '../../i18n';
import type { PendingReview } from '../../shared/review.types';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { createReviewCard, type ReviewActions, type ReviewCard } from './review-card';
import { CARD, kanaLabel } from '../../ui/kit';

export interface ReviewSection {
  readonly element: HTMLElement;
  update(reviews: PendingReview[]): void;
}

/**
 * Section "À vérifier" : réconcilie les cartes par clé de saison au lieu de tout redessiner,
 * pour conserver l'état local de chaque carte (saisie en cours, résultat affiché).
 */
export function createReviewSection(actions: ReviewActions): ReviewSection {
  const cards = new Map<string, ReviewCard>();
  const title = h('h2', { class: 'm-0 text-[13px] font-bold outline-none', attrs: { tabindex: '-1' } });
  const list = h('div', { class: 'flex flex-col gap-2' });
  const empty = h(
    'div',
    { class: `${CARD} flex items-center gap-2 p-3 text-[12px] text-muted` },
    icon('check', 'h-3.5 w-3.5 text-mint', '3'),
    t('review.empty'),
  );
  const element = h(
    'section',
    { class: 'flex flex-col gap-2' },
    h('div', { class: 'flex items-baseline gap-1.5' }, title, kanaLabel('カクニン', 'text-butter')),
    list,
    empty,
  );
  let pendingCount = 0;
  /** Dernière liste reçue : réappliquée quand une carte occupée se ferme (une vérification a pu arriver entre-temps) */
  let lastReviews: PendingReview[] = [];

  function refreshChrome(): void {
    title.textContent = t('review.title', { count: pendingCount });
    empty.hidden = cards.size > 0;
  }

  function update(reviews: PendingReview[]): void {
    lastReviews = reviews;
    const keys = new Set(reviews.map((r) => r.key));
    pendingCount = reviews.length;

    // Cartes disparues du stockage (ignorées, résolues ailleurs) — sauf celles qui affichent un résultat
    let focusLost = false;
    for (const [key, card] of cards) {
      if (!keys.has(key) && !card.isBusy()) {
        focusLost ||= card.element.contains(document.activeElement);
        card.element.remove();
        cards.delete(key);
      }
    }
    // Carte fermée au clavier (« Fermer ») : le focus passe au titre de la section plutôt que sur <body>
    if (focusLost) title.focus({ preventScroll: true });

    // Nouvelles cartes en tête (reviews est trié du plus récent au plus ancien)
    for (const review of [...reviews].reverse()) {
      const existing = cards.get(review.key);
      if (existing) {
        existing.update(review);
        continue;
      }
      const card = createReviewCard(review, actions, () => {
        cards.delete(review.key);
        update(lastReviews);
      });
      cards.set(review.key, card);
      list.prepend(card.element);
    }

    refreshChrome();
  }

  refreshChrome();
  return { element, update };
}
