// Message d'erreur dans une carte (maquette ComptesConnexion) : bordure et texte `danger`, icône d'alerte, action
// facultative (« Réessayer ») en bouton secondaire à droite. Annoncé une seule fois par la région live de la page
// (`data-alert`, ui/live-region.ts), comme l'alerte vanilla (ui/alert.ts).
import { alertAttrs } from '../live-region';
import { Button } from './button';
import { Icon } from './icon';

export interface AlertProps {
  message: string;
  action?: { label: string; onClick: () => void; busy?: boolean };
  /** Classes de placement (marges) ; jamais de couleur */
  class?: string;
}

export function Alert({ message, action, class: extra }: AlertProps) {
  return (
    <div class={`flex items-center gap-2 rounded-panel border border-danger/40 bg-danger/10 px-3 py-2 text-secondary text-danger ${extra ?? ''}`} {...alertAttrs(message)}>
      <span class="flex shrink-0 self-start pt-0.5">
        <Icon name="alert" class="size-3.5" strokeWidth="2.2" />
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
