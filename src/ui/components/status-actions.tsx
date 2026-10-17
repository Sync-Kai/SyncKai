// Actions de liste d'une série (maquettes PopupPageEtats, PopupPageRetours) : dans la liste, le statut en pastille lavande
// (« En cours ») à gauche et la progression − / « Ép. 6 / 28 » / + en pilule à droite (Stepper `pill`) ; absente d'une
// liste, « Ajouter à À regarder » (secondaire) et « Ajouter à En cours » (principal, sauf si la progression est déjà là :
// son + reste l'action principale). Carte « Sur cette page » du popup, prévu pour le panneau.
import type { AddListStatus } from '../../shared/sync.types';
import { Button } from './button';
import { Icon } from './icon';
import { Stepper, type StepperProps } from './stepper';

export interface StatusActionsProps {
  /** Statut de la liste de référence (« En cours ») */
  statusLabel: string;
  /** Progression (variante `pill` imposée) */
  stepper: Omit<StepperProps, 'variant'>;
}

export function StatusActions({ statusLabel, stepper }: StatusActionsProps) {
  return (
    <div class="flex min-w-0 flex-wrap items-center gap-2" data-status-actions="">
      <span class="min-w-0 truncate rounded-pill bg-lavender/15 px-2 py-0.5 text-secondary font-extrabold text-lavender" title={statusLabel} data-list-status="">
        {statusLabel}
      </span>
      <span class="ms-auto flex">
        <Stepper {...stepper} variant="pill" />
      </span>
    </div>
  );
}

export interface AddToListButtonsProps {
  labels: Readonly<Record<AddListStatus, string>>;
  /** Ajout en cours (bouton en rotation) */
  busy: AddListStatus | null;
  /** Autre action en cours, fiche relue */
  disabled?: boolean;
  /** « Ajouter à En cours » en action principale (aucune progression affichée) */
  primary: boolean;
  onAdd: (status: AddListStatus) => void;
  /** Préfixe data-focus : `<clé>-add-PLANNING`, `<clé>-add-CURRENT` */
  focusKey: string;
}

export function AddToListButtons({ labels, busy, disabled = false, primary, onAdd, focusKey }: AddToListButtonsProps) {
  const button = (status: AddListStatus) => (
    <Button
      variant={status === 'CURRENT' && primary ? 'primary' : 'secondary'}
      busy={busy === status}
      disabled={disabled && busy !== status}
      focusKey={`${focusKey}-add-${status}`}
      title={labels[status]}
      class="w-full min-w-0"
      onClick={() => onAdd(status)}
    >
      {busy !== status && (status === 'CURRENT' ? <Icon name="play" class="size-3 fill-current" /> : <Icon name="plus" class="size-3.5" strokeWidth="2.6" />)}
      <span class="min-w-0 truncate">{labels[status]}</span>
    </Button>
  );
  return (
    <div class="flex flex-col gap-2" data-add-buttons="">
      {button('PLANNING')}
      {button('CURRENT')}
    </div>
  );
}
