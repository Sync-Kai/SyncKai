// Coquille Preact du panneau latéral (maquettes PanelOuverture, PanelLecture, PanelReglages, PanelReglages320,
// PanelFirefox) : en-tête (onglets « En lecture » / « Agenda » et engrenage ; à l'ouverture, Kai et « SyncKai » le temps
// de vérifier l'onglet ; Réglages ouverts : leur barre de retour à la place des onglets, engrenage enfoncé), zone qui
// défile (onglet affiché, ou vue des Réglages), barre d'état en pied. L'état et la logique (onglet suivi, bascule
// automatique, Réglages chargés à la première ouverture) restent dans sidepanel.ts, les données de l'Agenda dans son
// contrôleur ; la vue des Réglages est un élément persistant monté ici.
import { render, type RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import type { StreamingPlatform } from '../shared/episode.types';
import { Icon, MountedNode } from '../ui/components/icon';
import { Tabs } from '../ui/components/tabs';
import { kai } from '../ui/icons';
import { useFocusFallback, useLocale, useStore } from '../ui/preact/hooks';
import { ElementSlot } from '../ui/preact/vanilla-slot';
import type { SettingsView } from '../ui/settings/settings-view';
import type { ReadonlyStore } from '../ui/state';
import { Agenda, type AgendaProps } from './components/agenda';
import { NowPlaying, type NowPlayingProps } from './components/now-playing';
import { OffTargetNotice } from './components/off-target';
import type { PanelContext } from './presence';
import type { PanelTab } from './tabs';

export interface PanelShellState {
  /** Onglet suivi : vérification, page de streaming ou autre site */
  context: PanelContext;
  /** Onglet affiché */
  tab: PanelTab;
  /** Agenda choisi par le panneau lui-même (onglet suivi hors streaming) : « En lecture » revient sur une page de streaming */
  auto: boolean;
  /** Réglages demandés (affichés dès que leur vue est chargée) */
  settingsOpen: boolean;
}

export interface PanelAppProps {
  /** Conteneur #app (repli du focus) */
  root: HTMLElement;
  shell: ReadonlyStore<PanelShellState>;
  /** Vue des Réglages, null tant que son module n'est pas chargé */
  settingsView: ReadonlyStore<SettingsView | null>;
  /** Plateformes à accès optionnel accordées (notice hors page) */
  platformAccess: ReadonlyStore<readonly StreamingPlatform[] | undefined>;
  nowPlaying: NowPlayingProps;
  /** Onglet « Agenda » : instantané du contrôleur (créé à son premier affichage) et actions */
  agenda: Omit<AgendaProps, 'granted'>;
  /** Barre d'état montée dans son conteneur (une fois, son propre arbre Preact) */
  mountFooter: (container: HTMLElement) => void;
  onSelectTab: (tab: PanelTab) => void;
  onToggleSettings: () => void;
  /** « Activer {plateforme} » : demande d'accès envoyée dans le clic */
  onEnablePlatform: (platform: StreamingPlatform) => void;
  onOpenPlatformsSettings: () => void;
}

const GEAR =
  'inline-flex size-logo-button shrink-0 cursor-pointer items-center justify-center rounded-pill border border-line bg-surface p-0 text-muted transition-colors hover:border-muted hover:bg-raised hover:text-ink aria-pressed:border-field aria-pressed:bg-raised aria-pressed:text-sakura';

/** Id du panneau d'un onglet (tests et `aria-controls`) */
export const tabPanelId = (tab: PanelTab): string => `sk-tabpanel-${tab}`;

function GearButton({ pressed, onClick, gear }: { pressed: boolean; onClick: () => void; gear: RefObject<HTMLButtonElement | null> }) {
  return (
    <button ref={gear} type="button" class={GEAR} aria-label={t('nav.settings')} title={t('nav.settings')} aria-pressed={pressed ? 'true' : 'false'} data-focus="gear" onClick={onClick}>
      <Icon name="gear" class="size-4" />
    </button>
  );
}

export function PanelApp(props: PanelAppProps) {
  useLocale();
  const shell = useStore(props.shell);
  const settingsView = useStore(props.settingsView);
  const granted = useStore(props.platformAccess);
  const root = useRef<HTMLElement>(props.root);
  const gear = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  /** Défilement de chaque onglet, retrouvé au retour sur l'onglet */
  const scrolls = useRef<Partial<Record<PanelTab, number>>>({});

  const settings = shell.settingsOpen && settingsView !== null;
  const checking = !settings && shell.context.status === 'checking';
  /** Onglet visible (null : Réglages ou vérification de l'onglet) */
  const shown = settings || checking ? null : shell.tab;

  // Élément focalisé retiré par un rendu (barre des Réglages quittée, action disparue) : engrenage dans les Réglages,
  // sinon l'onglet affiché
  useFocusFallback(root, settings ? 'gear' : `tab-${shell.tab}`);

  useLayoutEffect(() => {
    if (footer.current) props.mountFooter(footer.current);
  }, []);

  // Onglet qui devient visible (autre onglet, retour des Réglages) : son défilement est retrouvé
  useLayoutEffect(() => {
    if (shown !== null && panel.current) panel.current.scrollTop = scrolls.current[shown] ?? 0;
  }, [shown]);

  // Réglages fermés : focus rendu à l'engrenage
  const wasSettings = useRef(settings);
  useLayoutEffect(() => {
    if (wasSettings.current && !settings) gear.current?.focus({ preventScroll: true });
    wasSettings.current = settings;
  }, [settings]);

  return (
    <>
      <header class={`flex min-h-13 shrink-0 items-center gap-2 ${settings ? 'pr-3 pl-1' : 'px-3'}`}>
        {settings ? (
          <div class="min-w-0 flex-1">
            <ElementSlot element={() => settingsView.bar} />
          </div>
        ) : checking ? (
          <>
            <MountedNode build={() => kai('h-6 w-6', { size: 'small', tile: true })} inputs={[]} />
            <span class="font-display text-stat">SyncKai</span>
            <span class="text-section font-bold tracking-normal text-muted" aria-hidden="true">
              シンカイ
            </span>
            <span class="flex-1" />
          </>
        ) : (
          <div class="min-w-0 flex-1">
            <Tabs
              label={t('panel.tabs')}
              idBase="sk"
              focusKeyBase="tab"
              controls={tabPanelId}
              selected={shell.tab}
              onSelect={props.onSelectTab}
              tabs={[
                { id: 'nowPlaying', label: t('panel.tab.nowPlaying'), icon: 'play' },
                { id: 'agenda', label: t('panel.tab.agenda'), icon: 'calendar' },
              ]}
            />
          </div>
        )}
        <GearButton pressed={settings} onClick={props.onToggleSettings} gear={gear} />
      </header>
      {shown !== null && (
        <section
          ref={panel}
          id={tabPanelId(shown)}
          class="sk-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3"
          role="tabpanel"
          aria-labelledby={`sk-tab-${shown}`}
          tabIndex={0}
          onScroll={(event) => {
            scrolls.current[shown] = event.currentTarget.scrollTop;
          }}
        >
          {shown === 'agenda' ? (
            <Agenda {...props.agenda} granted={granted} />
          ) : shell.context.status === 'off' ? (
            <OffTargetNotice granted={granted} onEnable={props.onEnablePlatform} onOpenPlatformsSettings={props.onOpenPlatformsSettings} />
          ) : (
            <NowPlaying {...props.nowPlaying} />
          )}
        </section>
      )}
      {checking && (
        // Première vérification de l'onglet (l'onglet affiché en dépend), maquette PanelOuverture
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted" role="status">
          <span class="flex text-lavender motion-safe:animate-spin">
            <Icon name="spinner" class="size-5.5" strokeWidth="2.4" />
          </span>
          <p class="m-0">{t('panel.checking')}</p>
        </div>
      )}
      {/* Réglages : zone gardée dans le DOM une fois chargée (défilement conservé), masquée hors des Réglages */}
      {settingsView !== null && (
        <main class="sk-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3" hidden={!settings}>
          <ElementSlot element={() => settingsView.element} />
        </main>
      )}
      {/* Barre d'état (même composant que le popup), dernier élément du panneau ; son arbre Preact est monté une fois */}
      <div ref={footer} class="contents" />
    </>
  );
}

/** Monte la coquille dans `#app` ; renvoie le démontage */
export function mountPanelApp(container: HTMLElement, props: Omit<PanelAppProps, 'root'>): () => void {
  render(<PanelApp {...props} root={container} />, container);
  return () => render(null, container);
}
