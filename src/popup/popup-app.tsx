// Coquille Preact du popup (maquettes PopupSeries, PopupOnboarding, PopupAcces ; 2.5.0 : rail R56) : rail de
// navigation à gauche (Kai, « En cours » / « Activité », panneau latéral et Réglages en pied), puis la colonne de
// contenu : titre de l'écran (ou barre des Réglages), bandeau d'accès aux sites, zone centrale qui défile, barre d'état
// sous la colonne seulement. Les données
// et les actions restent dans popup.ts (contrôleurs sans rendu) ; les éléments créés hors de cet arbre y sont montés :
// vue des Réglages (barre et contenu, chargés à la première ouverture) et barre d'état (son propre arbre Preact,
// ui/status-bar-host.tsx).
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { t, tp } from '../i18n';
import type { TrackerId } from '../shared/tracker.types';
import type { SettingsView } from '../ui/settings/settings-view';
import type { AccountState, ReadonlyStore } from '../ui/state';
import { Icon } from '../ui/components/icon';
import { NavRail, type NavRailItem } from '../ui/components/nav-rail';
import { ScreenTitle } from '../ui/components/screen-title';
import { useFocusFallback, useLocale, useNow, useStore } from '../ui/preact/hooks';
import { ElementSlot } from '../ui/preact/vanilla-slot';
import { ActivityScreen, type ActivityScreenProps } from './components/activity-screen';
import type { PopupTab } from './components/header';
import { HostAccessBanner } from './components/host-access-banner';
import { Onboarding } from './components/onboarding';
import { WatchingScreen, type WatchingScreenProps } from './components/watching-screen';
import type { HostAccessState, UiState } from './state';

/** Les comptes à rebours et « il y a… » vieillissent tant que le popup reste ouvert */
const CLOCK_TICK_MS = 60_000;

/** Boutons du pied du rail : même gabarit que les sections (44 × 44), enfoncé = sélection neutre */
const RAIL_BUTTON =
  'flex size-rail-item cursor-pointer items-center justify-center rounded-panel border border-transparent bg-transparent p-0 text-muted transition-colors hover:text-ink aria-pressed:border-field aria-pressed:bg-raised aria-pressed:text-ink';

export interface PopupAppProps {
  ui: ReadonlyStore<UiState>;
  accounts: Readonly<Record<TrackerId, ReadonlyStore<AccountState<unknown>>>>;
  /** Pastille d'Activité : vérifications, synchros abandonnées, séries à noter */
  pending: ReadonlyStore<number>;
  hostAccess: ReadonlyStore<HostAccessState>;
  /** Bouton « Ouvrir le panneau » proposé (navigateur avec panneau latéral, onglet actif connu) */
  panelAvailable: ReadonlyStore<boolean>;
  /** Vue des Réglages, null tant que son module n'est pas chargé */
  settingsView: ReadonlyStore<SettingsView | null>;
  /** Écran Activité : stores et actions */
  activity: Omit<ActivityScreenProps, 'now'>;
  /** Conteneur de la barre d'état (mountStatusBar) */
  footer: HTMLElement;
  watching: Omit<WatchingScreenProps, 'now'>;
  onNavigate: (screen: PopupTab) => void;
  onSettings: () => void;
  onOpenPanel: () => void;
  onAllowHostAccess: () => void;
  onLogin: (service: TrackerId) => void;
  onOpenPlatformsSettings: () => void;
}

interface PopupRailProps {
  /** Section courante ; null pendant les Réglages et l'accueil */
  current: PopupTab | null;
  /** Accueil : pas de sections, Kai et Réglages seulement */
  onboarding: boolean;
  pending: number;
  settingsOpen: boolean;
  onNavigate: (screen: PopupTab) => void;
  onSettings: () => void;
  /** « Ouvrir le panneau » : null sans panneau latéral (navigateur) ou onglet actif inconnu */
  onOpenPanel: (() => void) | null;
}

/** Rail du popup : sections (pastille beurre = éléments à traiter), puis panneau latéral et Réglages */
function PopupRail({ current, onboarding, pending, settingsOpen, onNavigate, onSettings, onOpenPanel }: PopupRailProps) {
  const items: NavRailItem<PopupTab>[] = onboarding
    ? []
    : [
        { id: 'watching', icon: 'list', label: t('nav.watching') },
        pending > 0 ? { id: 'activity', icon: 'history', label: t('nav.activity'), badge: pending, ariaLabel: tp('nav.activityPending', pending) } : { id: 'activity', icon: 'history', label: t('nav.activity') },
      ];
  return (
    <NavRail
      label={t('nav.sections')}
      items={items}
      current={current}
      onSelect={onNavigate}
      footer={
        <>
          {onOpenPanel && (
            <button type="button" class={RAIL_BUTTON} aria-label={t('panel.open')} title={t('panel.open')} data-focus="panel" onClick={onOpenPanel}>
              <Icon name="panel" class="size-5" strokeWidth="2.2" />
            </button>
          )}
          <button type="button" class={RAIL_BUTTON} aria-label={t('nav.settings')} title={t('nav.settings')} aria-pressed={settingsOpen ? 'true' : 'false'} data-focus="gear" onClick={onSettings}>
            <Icon name="gear" class="size-5" strokeWidth="2.2" />
          </button>
        </>
      }
    />
  );
}

export function PopupApp(props: PopupAppProps) {
  useLocale();
  const root = useRef<HTMLDivElement>(null);
  const ui = useStore(props.ui);
  const anilist = useStore(props.accounts.anilist);
  const mal = useStore(props.accounts.mal);
  const pending = useStore(props.pending);
  const hostAccess = useStore(props.hostAccess);
  const panelAvailable = useStore(props.panelAvailable);
  const settingsView = useStore(props.settingsView);
  const now = useNow(CLOCK_TICK_MS);

  // Accueil : plus aucune lecture en cours et aucun compte connecté
  const onboarding = anilist.status === 'logged-out' && mal.status === 'logged-out';
  const isSettings = ui.screen === 'settings';
  const tab: PopupTab = ui.screen === 'activity' ? 'activity' : 'watching';
  // Élément focalisé retiré par un rendu (barre des Réglages quittée, ligne disparue) : engrenage dans les Réglages,
  // sinon la section affichée du rail
  useFocusFallback(root, isSettings ? 'gear' : `rail-${tab}`);

  return (
    // Rail au-dessus de la colonne (z-20) : sa bulle déborde à droite du rail, sur le contenu, sans être rognée
    <div ref={root} class="flex min-h-0 flex-1">
      <div class="relative z-20 flex shrink-0">
        <PopupRail
          current={isSettings || onboarding ? null : tab}
          onboarding={onboarding}
          pending={pending}
          settingsOpen={isSettings}
          onNavigate={props.onNavigate}
          onSettings={props.onSettings}
          onOpenPanel={panelAvailable && !onboarding ? props.onOpenPanel : null}
        />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        {isSettings ? settingsView && <ElementSlot element={() => settingsView.bar} /> : !onboarding && <ScreenTitle title={t(tab === 'activity' ? 'nav.activity' : 'nav.watching')} />}
        <HostAccessBanner state={hostAccess} onAllow={props.onAllowHostAccess} />
        {/* Ordre des écrans fixe (tests : En cours, Activité, Réglages, accueil) ; un seul visible */}
        <main class="sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3">
          <div class="min-h-full" data-screen="watching" hidden={isSettings || onboarding || tab !== 'watching'}>
            <WatchingScreen {...props.watching} now={now} />
          </div>
          <div data-screen="activity" hidden={isSettings || onboarding || tab !== 'activity'}>
            <ActivityScreen {...props.activity} now={now} />
          </div>
          <div hidden={!isSettings}>
            <ElementSlot element={() => settingsView?.element ?? null} />
          </div>
          <div class="min-h-full" hidden={isSettings || !onboarding}>
            {onboarding && <Onboarding accounts={{ anilist, mal }} onLogin={props.onLogin} onOpenPlatformsSettings={props.onOpenPlatformsSettings} />}
          </div>
        </main>
        <ElementSlot element={() => props.footer} />
      </div>
    </div>
  );
}

/** Monte la coquille dans `#app` ; renvoie le démontage */
export function mountPopupApp(container: HTMLElement, props: PopupAppProps): () => void {
  render(<PopupApp {...props} />, container);
  return () => render(null, container);
}
