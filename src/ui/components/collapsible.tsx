// Bloc repliable : bouton d'en-tête (aria-expanded, aria-controls), chevron et compte facultatif ; contenu masqué
// (`hidden`) quand il est replié. Non contrôlé (`defaultOpen`) ou contrôlé (`open` + `onToggle`).
import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';
import { Icon } from './icon';

export interface CollapsibleProps {
  title: string;
  /** Nombre affiché après le titre (décisions du diagnostic, événements de la trace) */
  count?: number | string;
  /** Contrôlé : l'état suit cette valeur, le clic appelle seulement onToggle */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: ComponentChildren;
  focusKey?: string;
}

export function Collapsible({ title, count, open, defaultOpen = false, onToggle, children, focusKey }: CollapsibleProps) {
  const id = useId();
  const [own, setOwn] = useState(defaultOpen);
  const expanded = open ?? own;
  const toggle = (): void => {
    if (open === undefined) setOwn(!expanded);
    onToggle?.(!expanded);
  };
  return (
    <div class="flex flex-col gap-2">
      <button
        type="button"
        class="inline-flex h-6 cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-secondary font-bold text-muted transition-colors hover:text-ink aria-expanded:text-ink"
        aria-expanded={expanded ? 'true' : 'false'}
        aria-controls={id}
        data-focus={focusKey}
        onClick={toggle}
      >
        <span>{title}</span>
        {count !== undefined && (
          <span class="rounded-pill bg-raised px-1.5 text-muted tabular-nums" data-collapsible-count="">
            {count}
          </span>
        )}
        <span class={`flex transition-transform duration-(--motion-enter) motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" class="size-3" strokeWidth="2.4" />
        </span>
      </button>
      <div id={id} hidden={!expanded} data-collapsible-body="">
        {children}
      </div>
    </div>
  );
}
