// Coquille Preact du popup (maquettes PopupSeries, PopupOnboarding, PopupAcces) : en-tête, onglets « En cours » /
// « Activité » (ou barre des Réglages), bandeau d'accès aux sites, zone centrale qui défile, barre d'état. Les données
// et les actions restent dans popup.ts (contrôleurs sans rendu) ; les parties encore vanilla y sont créées et montées
// ici : Activité (élément persistant), vue des Réglages (barre et contenu, chargés à la première ouverture), barre
// d'état (son propre arbre Preact, ui/status-bar-host.tsx).
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import type { TrackerId } from '../shared/tracker.types';
import type { SettingsView } from '../ui/settings/settings-view';
import type { AccountState, ReadonlyStore } from '../ui/state';
import { panelId, tabId } from '../ui/components/tabs';
import { useFocusFallback, useLocale, useNow, useStore } from '../ui/preact/hooks';
import { ElementSlot } from '../ui/preact/vanilla-slot';
import { POPUP_TABS_ID, PopupHeader, PopupNav, type PopupTab } from './components/header';
import { HostAccessBanner } from './components/host-access-banner';
import { Onboarding } from './components/onboarding';
import { WatchingScreen, type WatchingScreenProps } from './components/watching-screen';
import type { HostAccessState, UiState } from './state';

/** Les comptes à rebours et « il y a… » vieillissent tant que le popup reste ouvert */
const CLOCK_TICK_MS = 60_000;

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
  /** Écran Activité (vanilla, redessiné par popup.ts) */
  activity: HTMLElement;
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
  // sinon l'onglet affiché
  useFocusFallback(root, isSettings ? 'gear' : `nav-${tab}`);

  return (
    <div ref={root} class="contents">
      <PopupHeader settingsOpen={isSettings} onSettings={props.onSettings} onOpenPanel={panelAvailable && !onboarding ? props.onOpenPanel : null} />
      {isSettings && settingsView ? <ElementSlot element={() => settingsView.bar} /> : !onboarding && <PopupNav screen={tab} pending={pending} onNavigate={props.onNavigate} />}
      <HostAccessBanner state={hostAccess} onAllow={props.onAllowHostAccess} />
      {/* Ordre des écrans fixe (tests : En cours, Activité, Réglages, accueil) ; un seul visible */}
      <main class="sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3">
        <div class="min-h-full" role="tabpanel" id={panelId(POPUP_TABS_ID, 'watching')} aria-labelledby={tabId(POPUP_TABS_ID, 'watching')} hidden={isSettings || onboarding || tab !== 'watching'}>
          <WatchingScreen {...props.watching} now={now} />
        </div>
        <div role="tabpanel" id={panelId(POPUP_TABS_ID, 'activity')} aria-labelledby={tabId(POPUP_TABS_ID, 'activity')} hidden={isSettings || onboarding || tab !== 'activity'}>
          <ElementSlot element={() => props.activity} />
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
  );
}

/** Monte la coquille dans `#app` ; renvoie le démontage */
export function mountPopupApp(container: HTMLElement, props: PopupAppProps): () => void {
  render(<PopupApp {...props} />, container);
  return () => render(null, container);
}
