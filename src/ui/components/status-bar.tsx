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
  /** Ouvre le menu du compte ; absent : logo seul */
  onClick?: () => void;
  /** Menu du compte ouvert */
  expanded?: boolean;
}

export interface StatusBarMessage {
  /** Statut (« il y a 5 min », « Ép. 6 synchronisé ») */
  text: string;
  /** Titre de la série nommée par le message : deux lignes */
  series?: string;
  tone: Tone;
  icon: IconName;
  /** Infobulle (texte complet) */
  title?: string;
  /** Message cliquable (ouvre Activité, l'import…) : bouton avec chevron de fin */
  onClick?: () => void;
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
      aria-haspopup="menu"
      aria-expanded={account.expanded ? 'true' : 'false'}
      data-account={account.service}
      data-state={account.state}
      onClick={account.onClick}
    >
      {logo}
    </button>
  );
}

const MESSAGE = 'flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-right text-secondary text-muted no-underline';

function Message({ message }: { message: StatusBarMessage }) {
  const toned = TONE_TEXT[message.tone];
  const content = message.series ? (
    <span class="flex min-w-0 flex-col items-end">
      <span class="max-w-full truncate text-ink" title={message.series} data-status-series="">
        {message.series}
      </span>
      <span class="flex items-center gap-1 whitespace-nowrap" data-status-line="">
        <span class={`flex shrink-0 ${toned}`} data-status-icon="">
          <Icon name={message.icon} class="size-3" strokeWidth="2.6" />
        </span>
        {message.text}
      </span>
    </span>
  ) : (
    <>
      <span class={`flex shrink-0 ${toned}`} data-status-icon="">
        <Icon name={message.icon} class="size-3.5" strokeWidth="2.6" />
      </span>
      <span class="truncate">{message.text}</span>
    </>
  );
  if (!message.onClick) {
    return (
      <span class={MESSAGE} title={message.title} data-status-message="">
        {content}
      </span>
    );
  }
  return (
    <button type="button" class={`${MESSAGE} cursor-pointer rounded-control transition-colors hover:text-ink`} title={message.title} data-status-message="" onClick={message.onClick}>
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
      {/* Région vivante : un changement d'état est annoncé sans prendre le focus */}
      <div class="ml-auto flex min-w-0 items-center" role="status">
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
