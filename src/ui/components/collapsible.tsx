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
  /**
   * `inline` (défaut) : petit en-tête de texte ; `section` : en-tête de section (titre en capitales `text-section` dans
   * un <h2>, compte en pastille, chevron à droite, toute la largeur), pour une section entière repliable
   */
  variant?: 'inline' | 'section';
}

const HEADERS = {
  inline:
    'inline-flex h-6 cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-secondary font-bold text-muted transition-colors hover:text-ink aria-expanded:text-ink',
  section: 'flex min-h-8 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-1 py-0 text-left text-section uppercase text-muted transition-colors hover:text-ink',
} as const;

export function Collapsible({ title, count, open, defaultOpen = false, onToggle, children, focusKey, variant = 'inline' }: CollapsibleProps) {
  const id = useId();
  const [own, setOwn] = useState(defaultOpen);
  const expanded = open ?? own;
  const toggle = (): void => {
    if (open === undefined) setOwn(!expanded);
    onToggle?.(!expanded);
  };
  const section = variant === 'section';
  const header = (
    <button type="button" class={HEADERS[variant]} aria-expanded={expanded ? 'true' : 'false'} aria-controls={id} data-focus={focusKey} onClick={toggle}>
      <span class={section ? 'min-w-0 truncate' : undefined}>{title}</span>
      {count !== undefined && (
        <span class={`rounded-pill bg-raised px-1.5 tabular-nums ${section ? 'shrink-0 text-ink normal-case' : 'text-muted'}`} data-collapsible-count="">
          {count}
        </span>
      )}
      <span class={`flex transition-transform duration-(--motion-enter) motion-reduce:transition-none ${section ? 'ml-auto shrink-0' : ''} ${expanded ? 'rotate-180' : ''}`}>
        <Icon name="chevronDown" class="size-3" strokeWidth="2.4" />
      </span>
    </button>
  );
  return (
    <div class="flex flex-col gap-2">
      {section ? <h2 class="m-0">{header}</h2> : header}
      <div id={id} hidden={!expanded} data-collapsible-body="">
        {children}
      </div>
    </div>
  );
}
