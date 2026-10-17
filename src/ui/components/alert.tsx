// Message d'erreur dans une carte (maquette ComptesConnexion) : bordure et texte `danger`, icône d'alerte, action
// facultative (« Réessayer ») en bouton secondaire à droite. Annoncé une seule fois par la région live de la page
// (`data-alert`, ui/live-region.ts), comme l'alerte vanilla (ui/alert.ts). Ton `warn` (fiche introuvable, maquette
// PopupPageEtats) : beurre, avec sa propre icône (loupe).
import type { IconName } from '../icons';
import { alertAttrs } from '../live-region';
import { Button } from './button';
import { Icon } from './icon';

export interface AlertProps {
  message: string;
  action?: { label: string; onClick: () => void; busy?: boolean };
  /** `error` (défaut) : danger ; `warn` : beurre (rien trouvé, à vérifier) */
  tone?: 'error' | 'warn';
  /** Icône de tête (défaut : alerte) */
  icon?: IconName;
  /** Classes de placement (marges) ; jamais de couleur */
  class?: string;
}

const TONES: Readonly<Record<NonNullable<AlertProps['tone']>, string>> = {
  error: 'border-danger/40 bg-danger/10 text-danger',
  warn: 'border-butter/40 bg-butter/10 text-butter',
};

export function Alert({ message, action, tone = 'error', icon = 'alert', class: extra }: AlertProps) {
  return (
    <div class={`flex items-center gap-2 rounded-panel border px-3 py-2 text-secondary ${TONES[tone]} ${extra ?? ''}`} data-tone={tone} {...alertAttrs(message)}>
      <span class="flex shrink-0 self-start pt-0.5">
        <Icon name={icon} class="size-3.5" strokeWidth="2.2" />
      </span>
      <p class="m-0 min-w-0 flex-1 font-bold break-words">{message}</p>
      {action && (
        <Button size="sm" busy={action.busy} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
