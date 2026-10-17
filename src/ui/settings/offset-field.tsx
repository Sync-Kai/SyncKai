// Délai d'une plateforme (Réglages › Plateformes › Heure de sortie estimée, maquette Plateformes) : pilule « − +60 min + ».
// − / + par OFFSET_STEP (15 min, recalé sur le pas), et la valeur reste saisissable au clavier (décision du propriétaire,
// −1440…10080 min) : ↑ ↓ font comme − / +, Entrée ou la sortie du champ enregistrent la saisie, Échap l'annule. Saisie
// invalide (vide, décimale, hors bornes) : champ rouge et indication des bornes, rien n'est enregistré.
import { useId, useState } from 'preact/hooks';
import { getLocale, t } from '../../i18n';
import { formatOffsetDraft, OFFSET_RANGE, OFFSET_STEP, parseOffsetDraft } from '../../shared/settings';
import { Icon } from '../components/icon';
import { alertAttrs } from '../live-region';

export interface OffsetFieldProps {
  /** Nom de la plateforme (« Crunchyroll ») : titre de la ligne et noms accessibles */
  platform: string;
  /** Délai enregistré, en minutes */
  value: number;
  /** − (-1) ou + (1) : délai suivant calculé par la page sur la valeur enregistrée la plus récente */
  onStep: (direction: 1 | -1) => void;
  /** Saisie valide à enregistrer */
  onCommit: (value: number) => void;
  /** Aide commune sous la carte */
  describedBy?: string;
  /** Repère `data-focus` du champ ; boutons : `${focusKey}-minus` / `-plus` */
  focusKey: string;
  divider?: boolean;
}

/** Entier dans le format de la langue (« -1 440 », « 10 080 ») */
function formatInteger(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}

const STEP =
  'inline-flex size-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-ink transition-colors hover:bg-raised disabled:pointer-events-none disabled:opacity-40';

export function OffsetField({ platform, value, onStep, onCommit, describedBy, focusKey, divider = false }: OffsetFieldProps) {
  const id = useId();
  /** Texte en cours de saisie ; null : la valeur enregistrée est affichée */
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? formatOffsetDraft(value);
  // Base des boutons : la saisie si elle est valide, sinon la valeur enregistrée
  const base = (draft === null ? null : parseOffsetDraft(draft)) ?? value;
  const errorId = `${id}-error`;
  const hint = t('agenda.adjust.help', { min: formatInteger(OFFSET_RANGE.min), max: formatInteger(OFFSET_RANGE.max) });

  const reset = (): void => {
    setDraft(null);
    setInvalid(false);
  };

  /** Saisie enregistrée si elle est valide (et différente) ; sinon signalée, gardée telle quelle */
  const commit = (): void => {
    if (draft === null) return;
    const next = parseOffsetDraft(draft);
    if (next === null) {
      setInvalid(true);
      return;
    }
    reset();
    if (next !== value) onCommit(next);
  };

  const step = (direction: 1 | -1): void => {
    // Saisie valide pas encore enregistrée : enregistrée d'abord, le pas part d'elle ; saisie invalide : abandonnée
    const typed = draft === null ? null : parseOffsetDraft(draft);
    reset();
    if (typed !== null && typed !== value) onCommit(typed);
    onStep(direction);
  };

  return (
    <div class={`relative flex flex-col gap-1 px-3 py-2 ${divider ? 'before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-line' : ''}`} data-offset-row="">
      <div class="flex min-w-0 items-center gap-3">
        <span class="min-w-0 flex-1 truncate font-bold" aria-hidden="true" title={platform}>
          {platform}
        </span>
        <span class={`flex shrink-0 items-center rounded-pill border ${invalid ? 'border-danger' : 'border-field'}`} role="group" aria-label={platform}>
          <button
            type="button"
            class={STEP}
            aria-label={t('settings.offsets.earlier', { minutes: OFFSET_STEP })}
            title={t('settings.offsets.earlier', { minutes: OFFSET_STEP })}
            disabled={base <= OFFSET_RANGE.min}
            data-focus={`${focusKey}-minus`}
            onClick={() => step(-1)}
          >
            <Icon name="minus" class="size-3.5" strokeWidth="2.6" />
          </button>
          <label class="flex min-w-16 cursor-text items-baseline justify-center gap-1 font-bold tabular-nums">
            <input
              class="w-12 min-w-0 border-0 bg-transparent p-0 text-right font-bold text-ink tabular-nums outline-none focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellcheck={false}
              value={shown}
              aria-label={t('settings.offsets.aria', { platform })}
              aria-invalid={invalid ? 'true' : 'false'}
              aria-describedby={[invalid ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
              data-focus={focusKey}
              onInput={(event) => {
                setDraft(event.currentTarget.value);
                setInvalid(false);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commit();
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  step(event.key === 'ArrowUp' ? 1 : -1);
                } else if (event.key === 'Escape' && draft !== null) {
                  // Saisie annulée ; sans saisie, Échap remonte à la vue (retour à la page parente)
                  event.preventDefault();
                  event.stopPropagation();
                  reset();
                }
              }}
            />
            <span class="text-muted" aria-hidden="true">
              {t('settings.offsets.unit')}
            </span>
          </label>
          <button
            type="button"
            class={STEP}
            aria-label={t('settings.offsets.later', { minutes: OFFSET_STEP })}
            title={t('settings.offsets.later', { minutes: OFFSET_STEP })}
            disabled={base >= OFFSET_RANGE.max}
            data-focus={`${focusKey}-plus`}
            onClick={() => step(1)}
          >
            <Icon name="plus" class="size-3.5" strokeWidth="2.6" />
          </button>
        </span>
      </div>
      {invalid && (
        <p class="m-0 text-right text-secondary font-bold text-danger" id={errorId} {...alertAttrs(hint)} data-offset-error="">
          {hint}
        </p>
      )}
    </div>
  );
}
