// En-tête du popup (maquette PopupSeries) : Kai, « SyncKai シンカイ », bouton du panneau latéral (navigateur qui en a
// un, onglet actif connu) et engrenage des Réglages (enfoncé pendant les Réglages) ; puis les onglets « En cours » /
// « Activité » (pastille beurre = éléments à traiter).
import { t, tp } from '../../i18n';
import { kai } from '../../ui/icons';
import { Icon, MountedNode } from '../../ui/components/icon';
import { Tabs } from '../../ui/components/tabs';
import type { Screen } from '../state';

/** Onglets du popup : préfixe des id (onglets et panneaux, aria-controls) */
export const POPUP_TABS_ID = 'sk-nav';

export type PopupTab = Exclude<Screen, 'settings'>;

export interface PopupHeaderProps {
  settingsOpen: boolean;
  onSettings: () => void;
  /** « Ouvrir le panneau » : null sans panneau latéral (navigateur) ou onglet actif inconnu */
  onOpenPanel: (() => void) | null;
}

const HEADER_BUTTON =
  'inline-flex size-logo-button shrink-0 cursor-pointer items-center justify-center rounded-pill border border-line bg-surface p-0 text-muted transition-colors hover:border-muted hover:bg-raised hover:text-ink aria-pressed:border-field aria-pressed:bg-raised aria-pressed:text-ink';

export function PopupHeader({ settingsOpen, onSettings, onOpenPanel }: PopupHeaderProps) {
  return (
    <header class="flex h-13 shrink-0 items-center gap-2 px-4">
      <MountedNode build={() => kai('h-6 w-6', { size: 'small', tile: true })} inputs={[]} />
      <span class="font-display text-stat">SyncKai</span>
      <span class="text-section font-bold tracking-normal text-muted" aria-hidden="true">
        シンカイ
      </span>
      <span class="flex-1" />
      {onOpenPanel && (
        <button type="button" class={HEADER_BUTTON} aria-label={t('panel.open')} title={t('panel.open')} data-focus="panel" onClick={onOpenPanel}>
          <Icon name="panel" class="size-4" />
        </button>
      )}
      <button type="button" class={HEADER_BUTTON} aria-label={t('nav.settings')} title={t('nav.settings')} aria-pressed={settingsOpen ? 'true' : 'false'} data-focus="gear" onClick={onSettings}>
        <Icon name="gear" class="size-4" />
      </button>
    </header>
  );
}

export interface PopupNavProps {
  screen: PopupTab;
  /** Éléments à traiter : vérifications, synchros abandonnées, séries à noter */
  pending: number;
  onNavigate: (screen: PopupTab) => void;
}

/** Onglets « En cours » / « Activité » (sélection neutre, flèches, Début / Fin) */
export function PopupNav({ screen, pending, onNavigate }: PopupNavProps) {
  return (
    <nav class="shrink-0 px-4 pb-2" aria-label={t('nav.sections')}>
      <Tabs
        label={t('nav.sections')}
        idBase={POPUP_TABS_ID}
        focusKeyBase="nav"
        selected={screen}
        onSelect={onNavigate}
        tabs={[
          { id: 'watching', label: t('nav.watching') },
          pending > 0 ? { id: 'activity', label: t('nav.activity'), badge: pending, ariaLabel: tp('nav.activityPending', pending) } : { id: 'activity', label: t('nav.activity') },
        ]}
      />
    </nav>
  );
}
