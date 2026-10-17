// Onglets (popup : « En cours » / « Activité ») : tablist en pilule, sélection neutre (bordure `field`, fond `raised`,
// jamais sakura), tabindex itinérant, flèches en boucle, Début / Fin ; la flèche sélectionne (activation automatique).
// Les panneaux restent à l'hôte : `panelId(idBase, id)` pour leur id, `tabId(idBase, id)` pour leur aria-labelledby.
import { useRef } from 'preact/hooks';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Pastille de compte (« 2 » à vérifier) */
  badge?: string | number;
  /** Nom accessible quand la pastille ne se lit pas seule (« Activité, 2 éléments à traiter ») ; pastille alors masquée */
  ariaLabel?: string;
}

export interface TabsProps<T extends string> {
  /** Nom du groupe d'onglets */
  label: string;
  /** Préfixe des id des onglets et des panneaux */
  idBase: string;
  tabs: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Préfixe des clés data-focus des onglets (`<préfixe>-<id>`) */
  focusKeyBase?: string;
}

export const tabId = (base: string, id: string): string => `${base}-tab-${id}`;
export const panelId = (base: string, id: string): string => `${base}-panel-${id}`;

export function Tabs<T extends string>({ label, idBase, tabs, selected, onSelect, focusKeyBase }: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent): void => {
    const buttons = [...(list.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    // Depuis l'onglet focalisé (la sélection de l'hôte peut arriver après le rendu), sinon l'onglet sélectionné
    const focused = buttons.findIndex((button) => button === event.target);
    const index = focused >= 0 ? focused : tabs.findIndex((tab) => tab.id === selected);
    const last = tabs.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowRight' ? (index >= last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index <= 0 ? last : index - 1) : null;
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    if (tab.id !== selected) onSelect(tab.id);
    buttons[next]?.focus();
  };

  return (
    <div
      ref={list}
      class="grid gap-0 rounded-pill border border-line bg-surface p-0.75"
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      // Colonnes égales, une par onglet (CSSOM : pas de classe générée par nombre d'onglets)
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const on = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idBase, tab.id)}
            class={`flex h-8 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-pill border px-2 text-body font-extrabold transition-colors ${
              on ? 'border-field bg-raised text-ink' : 'border-transparent bg-transparent text-muted hover:text-ink'
            }`}
            aria-selected={on ? 'true' : 'false'}
            aria-controls={panelId(idBase, tab.id)}
            tabIndex={on ? 0 : -1}
            aria-label={tab.ariaLabel}
            data-focus={focusKeyBase && `${focusKeyBase}-${tab.id}`}
            onClick={() => {
              if (!on) onSelect(tab.id);
            }}
          >
            <span class="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span class="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-pill bg-butter px-1.25 text-section tracking-normal text-on-fill tabular-nums" aria-hidden={tab.ariaLabel ? 'true' : undefined} data-tab-badge="">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
