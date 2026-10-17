// Détails repliables d'une série (maquette PopupSeriesDeplie) : bouton « Détails : saison, note, commentaire » avec son
// chevron (aria-expanded / aria-controls), puis, dépliée, une section sous un trait (saison, note, commentaire fournis par
// l'hôte). Carte « Sur cette page » du popup, prévu pour le panneau.
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { Icon } from './icon';

export interface MediaDetailsProps {
  /** Libellé du bouton */
  label: string;
  open: boolean;
  onToggle: () => void;
  /** data-focus du bouton */
  focusKey?: string;
  children: ComponentChildren;
}

export function MediaDetails({ label, open, onToggle, focusKey, children }: MediaDetailsProps) {
  const id = useId();
  return (
    <div class="flex min-w-0 flex-col gap-2.5" data-media-details="">
      <button
        type="button"
        class={`flex min-h-6 cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-left text-secondary font-bold transition-colors hover:text-ink ${open ? 'text-ink' : 'text-muted'}`}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={id}
        data-focus={focusKey}
        onClick={onToggle}
      >
        {label}
        <span class={`flex shrink-0 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" class="size-3" strokeWidth="2.4" />
        </span>
      </button>
      <div id={id} class="flex min-w-0 flex-col gap-3 border-t border-line pt-2.5" hidden={!open}>
        {open && children}
      </div>
    </div>
  );
}
