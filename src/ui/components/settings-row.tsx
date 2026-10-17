// Carte et ligne des Réglages (maquettes Main, Sync, PanelReglages320) : icône sur pastille teintée, titre, description,
// puis résumé + chevron (ligne de navigation) ou interrupteur. Sous 340 px de carte (panneau latéral étroit), requête de
// conteneur : description et résumé masqués, la description reste l'infobulle et la description accessible.
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import type { IconName } from '../icons';
import { Icon } from './icon';
import { Switch } from './switch';

/** Teinte de la pastille de l'icône (catégories des Réglages) */
export type TileColor = 'lavender' | 'mint' | 'butter' | 'sakura' | 'muted';

const TILES: Readonly<Record<TileColor, string>> = {
  lavender: 'bg-lavender/16 text-lavender',
  mint: 'bg-mint/16 text-mint',
  butter: 'bg-butter/16 text-butter',
  sakura: 'bg-sakura/16 text-sakura',
  muted: 'bg-muted/16 text-muted',
};

interface SettingsCardProps {
  children: ComponentChildren;
  /** Nom de la carte (« Accès rapide ») */
  label?: string;
}

/** Carte des lignes : conteneur des requêtes de largeur des lignes (@container) */
export function SettingsCard({ children, label }: SettingsCardProps) {
  return (
    <div class="@container flex flex-col rounded-card border border-line bg-surface" role={label ? 'group' : undefined} aria-label={label} data-settings-card="">
      {children}
    </div>
  );
}

export interface SettingsToggle {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export interface SettingsRowProps {
  title: string;
  description?: string;
  icon?: IconName;
  /** Teinte de la pastille de l'icône (défaut lavender) */
  tile?: TileColor;
  /** Ligne de navigation : toute la ligne est un bouton (ou un lien avec `href`), résumé et chevron à droite */
  onClick?: () => void;
  href?: string;
  summary?: string;
  /** Interrupteur à droite, nommé par le titre ; un clic sur la ligne le bascule */
  toggle?: SettingsToggle;
  /** Autre contenu de fin (ligne inerte) */
  trailing?: ComponentChildren;
  /** Séparateur au-dessus (lignes suivantes d'une carte), décalé après l'icône */
  divider?: boolean;
  focusKey?: string;
}

const NARROW_HIDDEN = '@max-[340px]:hidden';

export function SettingsRow({ title, description, icon, tile = 'lavender', onClick, href, summary, toggle, trailing, divider = false, focusKey }: SettingsRowProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const navigates = toggle === undefined && (onClick !== undefined || href !== undefined);
  const row = `relative flex w-full min-w-0 items-center gap-3 border-0 bg-transparent px-3 text-left text-ink no-underline ${icon ? 'py-2.5' : 'py-3'} ${
    divider ? `before:absolute before:top-0 before:right-3 before:h-px before:bg-line ${icon ? 'before:left-13' : 'before:left-3'}` : ''
  } ${navigates || toggle ? 'cursor-pointer' : ''}`;

  const body = (
    <>
      {icon && (
        <span class={`flex size-icon-button shrink-0 items-center justify-center rounded-control ${TILES[tile]}`} aria-hidden="true">
          <Icon name={icon} class="size-4" strokeWidth="2.2" />
        </span>
      )}
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-body font-bold" id={titleId} data-row-title="">
          {title}
        </span>
        {description && (
          <span class={`text-secondary text-muted ${NARROW_HIDDEN}`} id={descriptionId} data-row-description="">
            {description}
          </span>
        )}
      </span>
      {summary && (
        <span class={`shrink-0 text-secondary font-bold text-muted ${NARROW_HIDDEN}`} data-row-summary="">
          {summary}
        </span>
      )}
      {trailing}
      {toggle && <Switch checked={toggle.checked} onChange={toggle.onChange} disabled={toggle.disabled} labelledBy={titleId} describedBy={descriptionId} focusKey={focusKey} />}
      {navigates && (
        <span class="flex shrink-0 text-muted" data-row-chevron="">
          <Icon name="chevronRight" class="size-3.5" strokeWidth="2.4" />
        </span>
      )}
    </>
  );

  const shared = { class: row, title: description, 'data-settings-row': '', 'data-divider': divider ? '' : undefined };
  const named = { 'aria-labelledby': titleId, 'aria-describedby': descriptionId, 'data-focus': focusKey };
  if (toggle) {
    // Clic sur le texte : bascule par l'interrupteur (le clic sur l'interrupteur lui-même lui revient)
    return (
      <div
        {...shared}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('[role="switch"]')) return;
          if (!toggle.disabled) toggle.onChange(!toggle.checked);
        }}
      >
        {body}
      </div>
    );
  }
  if (href !== undefined) {
    return (
      <a {...shared} {...named} href={href}>
        {body}
      </a>
    );
  }
  if (onClick !== undefined) {
    return (
      <button {...shared} {...named} type="button" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div {...shared}>{body}</div>;
}
