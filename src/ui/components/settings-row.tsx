// Carte et ligne des Réglages (maquettes Main, Sync, PanelReglages320) : icône sur pastille teintée, titre, description,
// puis résumé + chevron (ligne de navigation) ou interrupteur. Sous 304 px de carte (panneau latéral sous ~340 px : 320 px,
// barre latérale Firefox de 300 px ; à 360 px la carte mesure 322 px, barre de défilement comprise), requête de conteneur :
// description et résumé masqués, la description reste l'infobulle et la description accessible (maquette PanelReglages320).
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
  /** Description d'avertissement (« En pause : aucun épisode n'est envoyé ») : butter, icône pause devant */
  descriptionTone?: 'warn';
  icon?: IconName;
  /** Teinte de la pastille de l'icône (défaut lavender) */
  tile?: TileColor;
  /** Visuel de 28 px à la place de la pastille d'icône (logo de plateforme), décoratif : le titre nomme la ligne */
  leading?: ComponentChildren;
  /** Ligne de navigation : toute la ligne est un bouton (ou un lien avec `href`), résumé et chevron à droite */
  onClick?: () => void;
  href?: string;
  /** Lien `href` vers un site : nouvel onglet (sans opener), flèche ↗ à la place du chevron */
  external?: boolean;
  summary?: string;
  /** Interrupteur à droite, nommé par le titre ; un clic sur la ligne le bascule */
  toggle?: SettingsToggle;
  /** Autre contenu de fin (ligne inerte) */
  trailing?: ComponentChildren;
  /** Séparateur au-dessus (lignes suivantes d'une carte), décalé après l'icône */
  divider?: boolean;
  focusKey?: string;
}

/** Masqué dans une carte étroite (voir l'en-tête) ; aussi pour les lignes propres à une page (même seuil partout) */
export const NARROW_HIDDEN = '@max-[304px]:hidden';

export function SettingsRow({ title, description, descriptionTone, icon, tile = 'lavender', leading, onClick, href, external = false, summary, toggle, trailing, divider = false, focusKey }: SettingsRowProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const navigates = toggle === undefined && (onClick !== undefined || href !== undefined);
  // Pastille d'icône ou visuel de tête : même hauteur de ligne, séparateur décalé après eux
  const media = icon !== undefined || leading !== undefined;
  const row = `relative flex w-full min-w-0 items-center gap-3 border-0 bg-transparent px-3 text-left text-ink no-underline ${media ? 'py-2.5' : 'py-3'} ${
    divider ? `before:absolute before:top-0 before:right-3 before:h-px before:bg-line ${media ? 'before:left-13' : 'before:left-3'}` : ''
  } ${navigates || toggle ? 'cursor-pointer' : ''}`;

  const body = (
    <>
      {icon && (
        <span class={`flex size-icon-button shrink-0 items-center justify-center rounded-control ${TILES[tile]}`} aria-hidden="true">
          <Icon name={icon} class="size-4" strokeWidth="2.2" />
        </span>
      )}
      {!icon && leading && (
        <span class="flex shrink-0" aria-hidden="true" data-row-leading="">
          {leading}
        </span>
      )}
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-body font-bold" id={titleId} data-row-title="">
          {title}
        </span>
        {description && (
          <span
            class={`text-secondary ${descriptionTone === 'warn' ? 'flex items-center gap-1 font-bold text-butter' : 'text-muted'} ${NARROW_HIDDEN}`}
            id={descriptionId}
            data-row-description=""
            data-tone={descriptionTone}
          >
            {descriptionTone === 'warn' && <Icon name="pause" class="size-3 shrink-0" strokeWidth="3" />}
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
      {navigates &&
        (external && href !== undefined ? (
          <span class="flex shrink-0 text-muted" data-row-external="">
            <Icon name="external" class="size-3.5" strokeWidth="2.2" />
          </span>
        ) : (
          <span class="flex shrink-0 text-muted" data-row-chevron="">
            <Icon name="chevronRight" class="size-3.5" strokeWidth="2.4" />
          </span>
        ))}
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
      <a {...shared} {...named} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
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
