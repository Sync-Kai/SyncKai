// Barre d'état de 48 px en pied du popup et du panneau latéral (maquettes BarreEtat, MenuCompte), présentation seule :
// l'hôte choisit l'état (une priorité à la fois) et le passe en props. À gauche, les logos des comptes (jamais connecté :
// aucun logo ; session expirée : logo grisé, point rouge) ; à droite, le message en 12 px / 600 `muted`, jamais
// souligné, le ton porté par son icône. Message qui nomme une série : titre en `ink` sur la première ligne.
import type { ComponentChildren } from 'preact';
import type { TrackerId } from '../../shared/tracker.types';
import type { IconName } from '../icons';
import { Icon } from './icon';
import { ServiceLogo } from './service-logo';
import { TONE_TEXT, type Tone } from './tone';

export interface StatusBarAccount {
  service: TrackerId;
  /** none : jamais connecté (aucun logo) */
  state: 'none' | 'connected' | 'expired';
  /** Nom du bouton (« Compte AniList », « Compte MyAnimeList, session expirée ») */
  label: string;
  /** Ouvre le menu du compte (ou les Réglages) ; absent : logo seul */
  onClick?: () => void;
  /** Menu du compte ouvert ; absent : le bouton n'ouvre pas de menu (ni aria-haspopup ni aria-expanded) */
  expanded?: boolean;
  /** Clé data-focus (focus retrouvé après un rendu) */
  focusKey?: string;
}

export interface StatusBarMessage {
  /** Statut (« il y a 5 min », « Ép. 6 synchronisé ») */
  text: string;
  /** Titre de la série nommée par le message : deux lignes */
  series?: string;
  tone: Tone;
  /** null : point `muted` à la place de l'icône (« Aucun compte connecté ») */
  icon: IconName | null;
  /** Infobulle (texte complet) */
  title?: string;
  /** Nom accessible quand le texte visible ne suffit pas (« Tout est synchronisé · il y a 5 min ») */
  label?: string;
  /** Message cliquable (ouvre Activité, l'import…) : bouton avec chevron de fin */
  onClick?: () => void;
  /** Clé data-focus du bouton */
  focusKey?: string;
}

export interface StatusBarProps {
  accounts: readonly StatusBarAccount[];
  message: StatusBarMessage | null;
  /** Contenu de fin : « J'ai vu, masquer », « Reconnecter » */
  trailing?: ComponentChildren;
  /** Avancement d'un import (0 à 1) : filet décoratif en bas de la barre */
  progress?: number | null;
}

function AccountLogo({ account }: { account: StatusBarAccount }) {
  const logo = <ServiceLogo id={account.service} size="lg" badge={account.state === 'expired' ? 'expired' : undefined} label={account.onClick ? undefined : account.label} />;
  if (!account.onClick) {
    return (
      <span class="flex p-0.5" data-account={account.service} data-state={account.state}>
        {logo}
      </span>
    );
  }
  return (
    <button
      type="button"
      class="flex cursor-pointer rounded-control border border-transparent bg-transparent p-0.5 transition-colors hover:border-muted hover:bg-raised aria-expanded:border-field aria-expanded:bg-raised"
      aria-label={account.label}
      title={account.label}
      aria-haspopup={account.expanded === undefined ? undefined : 'menu'}
      aria-expanded={account.expanded === undefined ? undefined : account.expanded ? 'true' : 'false'}
      data-account={account.service}
      data-focus={account.focusKey}
      data-state={account.state}
      onClick={account.onClick}
    >
      {logo}
    </button>
  );
}

const MESSAGE = 'flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-right text-secondary text-muted no-underline';

/** Icône du ton, ou point `muted` (sans icône) */
function StatusIcon({ message, size }: { message: StatusBarMessage; size: string }) {
  if (message.icon === null) return <span class="mr-0.5 size-2 shrink-0 rounded-pill bg-muted opacity-60" aria-hidden="true" data-status-dot="" />;
  return (
    <span class={`flex shrink-0 ${TONE_TEXT[message.tone]}`} data-status-icon="">
      <Icon name={message.icon} class={size} strokeWidth="2.6" />
    </span>
  );
}

function Message({ message }: { message: StatusBarMessage }) {
  // Nom accessible donné : texte visible masqué au lecteur d'écran (bouton : aria-label ; texte : copie hors écran)
  const hidden = message.label !== undefined && !message.onClick ? 'true' : undefined;
  const content = message.series ? (
    <span class="flex min-w-0 flex-col items-end" aria-hidden={hidden}>
      <span class="max-w-full truncate text-ink" title={message.series} data-status-series="">
        {message.series}
      </span>
      <span class="flex items-center gap-1 whitespace-nowrap" data-status-line="">
        <StatusIcon message={message} size="size-3" />
        {message.text}
      </span>
    </span>
  ) : (
    <>
      <StatusIcon message={message} size="size-3.5" />
      <span class="truncate" aria-hidden={hidden}>
        {message.text}
      </span>
    </>
  );
  if (!message.onClick) {
    return (
      <span class={MESSAGE} title={message.title} data-status-message="">
        {hidden && <span class="sr-only">{message.label}</span>}
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      class={`${MESSAGE} cursor-pointer rounded-control transition-colors hover:text-ink`}
      title={message.title}
      aria-label={message.label}
      data-status-message=""
      data-focus={message.focusKey}
      onClick={message.onClick}
    >
      {content}
      <span class="-ml-0.5 flex shrink-0 text-muted" data-chevron="">
        <Icon name="chevronRight" class="size-3" strokeWidth="2.6" />
      </span>
    </button>
  );
}

export function StatusBar({ accounts, message, trailing, progress = null }: StatusBarProps) {
  const shown = accounts.filter((account) => account.state !== 'none');
  return (
    <footer class="relative flex h-status-bar shrink-0 items-center gap-2 border-t border-line bg-surface px-4">
      {shown.length > 0 && (
        <span class="flex shrink-0 items-center gap-1">
          {shown.map((account) => (
            <AccountLogo key={account.service} account={account} />
          ))}
        </span>
      )}
      {/* Région vivante : un changement d'état est annoncé sans prendre le focus. Sans logo : message à gauche */}
      <div class={`flex min-w-0 items-center ${shown.length > 0 ? 'ml-auto' : ''}`} role="status">
        {message && <Message message={message} />}
      </div>
      {trailing}
      {progress !== null && (
        <span class="absolute right-0 -bottom-px left-0 h-0.5 bg-line" aria-hidden="true" data-status-progress="">
          <span class="block h-full bg-lavender" style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }} />
        </span>
      )}
    </footer>
  );
}
