// Confirmation en ligne hors d'un menu (groupe « En sommeil » : abandon d'une série, « Tout mettre en pause ») : même
// aspect que celle du menu « ⋯ » (MenuConfirm). Focus sur « Non » à l'apparition, Échap = « Non » ; l'hôte rend ensuite
// le focus au bouton qui l'a ouverte. Tous les textes arrivent traduits.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { CONFIRM_BTN, CONFIRM_NO, CONFIRM_YES } from './menu';

export interface InlineConfirmProps {
  /** « Abandonner ? », « Mettre 4 séries en pause ? » */
  question: string;
  /** Phrase sous la question ; présente : question, phrase et boutons empilés */
  detail?: string;
  yes: { label: string; ariaLabel: string; tone: 'ok' | 'danger' };
  no: { label: string; ariaLabel: string };
  /** Clés data-focus : `confirm-yes-<clé>`, `confirm-no-<clé>` */
  focusKey: string;
  onYes: () => void;
  /** « Non », Échap */
  onNo: () => void;
}

export function InlineConfirm({ question, detail, yes, no, focusKey, onYes, onNo }: InlineConfirmProps) {
  const noButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    noButton.current?.focus({ preventScroll: true });
    noButton.current?.closest('[data-inline-confirm]')?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const buttons = (
    <span class="flex shrink-0 items-center gap-1.5">
      <button type="button" class={`${CONFIRM_BTN} ${CONFIRM_YES[yes.tone]}`} aria-label={yes.ariaLabel} data-focus={`confirm-yes-${focusKey}`} onClick={onYes}>
        {yes.label}
      </button>
      <button ref={noButton} type="button" class={`${CONFIRM_BTN} ${CONFIRM_NO}`} aria-label={no.ariaLabel} data-focus={`confirm-no-${focusKey}`} onClick={onNo}>
        {no.label}
      </button>
    </span>
  );
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // Échap annule la confirmation sans fermer le popup ni remonter à un autre gestionnaire
    event.preventDefault();
    event.stopPropagation();
    onNo();
  };
  return detail === undefined ? (
    <div class="flex h-7 min-w-0 items-center gap-2" role="group" aria-label={question} data-inline-confirm="" onKeyDown={onKeyDown}>
      <span class="min-w-0 flex-1 truncate text-secondary font-extrabold text-ink" title={question}>
        {question}
      </span>
      {buttons}
    </div>
  ) : (
    <div class="flex min-w-0 flex-col gap-1.5 rounded-control bg-raised px-3 py-2" role="group" aria-label={question} data-inline-confirm="" onKeyDown={onKeyDown}>
      <span class="text-body font-extrabold text-ink">{question}</span>
      <span class="text-secondary text-muted">{detail}</span>
      <span class="flex justify-end">{buttons}</span>
    </div>
  );
}
