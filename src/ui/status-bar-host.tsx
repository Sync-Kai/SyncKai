// Barre d'état montée en pied du popup et du panneau latéral (même composant, maquettes BarreEtat) : état choisi par
// ui/status-bar-model.ts sur les comptes de la page et les données lues par ui/status-bar-source.ts, présentation par
// components/status-bar.tsx. La page fournit la navigation : Activité (popup : son écran ; panneau : le popup ouvert sur
// Activité, ou rien), page d'import. Un logo de compte ouvre le menu du compte (ui/account-menu.tsx) au-dessus de la barre.
import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, tp } from '../i18n';
import { PLATFORMS } from '../platforms/registry';
import type { ImportPlatform } from '../shared/cr-import';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import type { AccountsController } from './accounts';
import { AccountMenu, type AccountMenuData } from './account-menu';
import { Button } from './components/button';
import { IconButton } from './components/icon-button';
import { StatusBar, type StatusBarAccount, type StatusBarMessage } from './components/status-bar';
import { useFocusFallback, useLocale, useStore } from './preact/hooks';
import { accountLogos, statusBarState, type StatusBarState } from './status-bar-model';
import { createStatusBarSource, type SeenKind, type StatusBarSource } from './status-bar-source';

/** Nouveau rendu périodique : « il y a… », fin des 24 h, « Synchro… » périmé */
const CLOCK_TICK_MS = 30_000;

export interface StatusBarHostDeps {
  accounts: Pick<AccountsController, 'store' | 'login' | 'logout' | 'refresh'>;
  /** Données de la barre ; absente : créée et lue au montage. Libérée au démontage dans les deux cas */
  source?: StatusBarSource;
  /** Activité ; null : messages qui y mènent affichés en texte (panneau sans popup ouvrable) */
  openActivity: (() => void) | null;
  /** Page d'import de l'historique de la plateforme */
  openImport: (platform: ImportPlatform) => void;
  /** Lectures du menu du compte (tests) ; défaut : le stockage */
  menuData?: AccountMenuData;
  now?: () => number;
}

interface View {
  message: StatusBarMessage | null;
  trailing?: ComponentChildren;
  progress?: number | null;
}

interface Actions {
  deps: StatusBarHostDeps;
  now: number;
  seen: (kind: SeenKind) => void;
}

/** Message qui mène à Activité : bouton nommé « … — voir l'activité », texte seul sans Activité */
function toActivity(text: string, actions: Actions, focusKey: string): Pick<StatusBarMessage, 'onClick' | 'label' | 'focusKey' | 'title'> {
  const open = actions.deps.openActivity;
  return open ? { onClick: open, label: t('footer.seeActivity', { label: text }), focusKey, title: text } : { title: text };
}

/** « J'ai vu, masquer » */
function dismiss(kind: SeenKind, actions: Actions) {
  return <IconButton icon="close" label={t('footer.dismiss')} outlined iconClass="size-3" focusKey="footer-dismiss" onClick={() => actions.seen(kind)} />;
}

const progressOf = (done: number, total: number): number | null => (total > 0 ? done / total : null);

function viewOf(state: StatusBarState, actions: Actions): View {
  const { deps } = actions;
  switch (state.kind) {
    case 'loading':
      return { message: null };
    case 'queue-failed': {
      const text = tp('footer.queueFailed', state.count);
      return { message: { text, tone: 'error', icon: 'alert', ...toActivity(text, actions, 'footer-queue') } };
    }
    case 'review': {
      const reviews = tp('footer.toReview', state.count);
      const text = state.pending > 0 ? `${reviews} · ${tp('footer.queuePending', state.pending)}` : reviews;
      return { message: { text, tone: 'warn', icon: 'alert', ...toActivity(text, actions, 'footer-pending') } };
    }
    case 'queue-pending': {
      const text = tp('footer.queuePending', state.count);
      return { message: { text, tone: 'info', icon: 'clock', ...toActivity(text, actions, 'footer-queue') } };
    }
    case 'expired': {
      const service = TRACKER_LABELS[state.service];
      return {
        message: { text: t('common.sessionExpired'), tone: 'error', icon: 'xCircle' },
        trailing: (
          <Button size="sm" ariaLabel={t('common.reconnectService', { service })} focusKey="footer-reconnect" onClick={() => void deps.accounts.login(state.service)}>
            {t('common.reconnect')}
          </Button>
        ),
      };
    }
    case 'none':
      return { message: { text: t('feedback.notConnected.title'), tone: 'muted', icon: null } };
    case 'job': {
      const progress = progressOf(state.done, state.total);
      if (state.job === 'align') {
        const text = t('compare.bulk.running', { done: state.done, total: state.total });
        return { message: { text, tone: 'info', icon: 'sync', ...toActivity(text, actions, 'footer-job') }, progress };
      }
      const platform = state.platform ?? 'crunchyroll';
      const text = t('footer.importProgress', { platform: PLATFORMS[platform].label, done: state.done, total: state.total });
      return { message: { text, title: text, tone: 'info', icon: 'download', focusKey: 'footer-job', onClick: () => deps.openImport(platform) }, progress };
    }
    case 'import-ready': {
      const text = tp('footer.importReady', state.count);
      return { message: { text, title: text, tone: 'info', icon: 'checkSquare', focusKey: 'footer-job', onClick: () => deps.openImport(state.platform) } };
    }
    case 'synced': {
      const text = state.count === 1 ? t('footer.syncedEpisode', { episode: state.episode }) : tp('footer.syncedEpisodes', state.count);
      const open = deps.openActivity;
      return {
        message: {
          series: state.series,
          text,
          title: `${state.series} · ${text}`,
          tone: 'ok',
          icon: 'check',
          focusKey: 'footer-synced',
          // Clic : vue, puis Activité (dernières synchros)
          onClick: open
            ? () => {
                actions.seen('syncs');
                open();
              }
            : undefined,
        },
        trailing: dismiss('syncs', actions),
      };
    }
    case 'import-done': {
      const text = tp('footer.importDone', state.count);
      return {
        message: {
          text,
          title: text,
          tone: 'ok',
          icon: 'check',
          focusKey: 'footer-job',
          onClick: () => {
            actions.seen('import');
            deps.openImport(state.platform);
          },
        },
        trailing: dismiss('import', actions),
      };
    }
    case 'to-rate': {
      const text = tp('footer.toRate', state.count);
      return { message: { text, tone: 'info', icon: 'star', ...toActivity(text, actions, 'footer-rate') } };
    }
    case 'syncing':
      return { message: { text: t('common.syncing'), tone: 'info', icon: 'sync' } };
    case 'ok': {
      const allSynced = t('footer.allSynced');
      if (state.lastSyncAt === null) return { message: { text: allSynced, title: allSynced, tone: 'ok', icon: 'check' } };
      const relative = formatRelativeTime(state.lastSyncAt, actions.now);
      return { message: { text: relative, title: allSynced, label: `${allSynced} · ${relative}`, tone: 'ok', icon: 'check' } };
    }
  }
}

function StatusBarHost({ deps, source }: { deps: StatusBarHostDeps; source: StatusBarSource }) {
  useLocale();
  const anilist = useStore(deps.accounts.store('anilist'));
  const mal = useStore(deps.accounts.store('mal'));
  const data = useStore(source.store);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  // Bouton retiré par un changement d'état (×, Reconnecter) : focus rendu à un voisin, jamais à <body>
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root);
  // Menu du compte : un seul à la fois, basculé par son logo
  const [menuFor, setMenuFor] = useState<TrackerId | null>(null);
  const accountsArea = useRef<HTMLSpanElement>(null);

  const now = (deps.now ?? Date.now)();
  const accounts = { anilist, mal };
  const state = statusBarState({ accounts, ...data, now });
  const actions: Actions = { deps, now, seen: (kind) => void source.markSeen(kind, now) };
  const states = accountLogos(accounts);
  // Logo retiré (déconnexion depuis le menu ou ailleurs) : menu fermé avec lui
  const openMenu = states.some(({ service, state: logo }) => service === menuFor && logo !== 'none') ? menuFor : null;
  const logos = states.map(
    ({ service, state: logo }): StatusBarAccount => ({
      service,
      state: logo,
      label: t(logo === 'expired' ? 'accountMenu.labelExpired' : 'accountMenu.label', { service: TRACKER_LABELS[service] }),
      onClick: () => setMenuFor(openMenu === service ? null : service),
      expanded: openMenu === service,
      focusKey: `chip-${service}`,
    }),
  );
  const closeMenu = (restore: boolean): void => {
    const service = openMenu;
    setMenuFor(null);
    if (restore && service) accountsArea.current?.querySelector<HTMLElement>(`[data-focus="chip-${service}"]`)?.focus();
  };
  const menu = openMenu && <AccountMenu key={openMenu} service={openMenu} accounts={deps.accounts} root={accountsArea} onClose={closeMenu} data={deps.menuData} now={deps.now} />;
  const view = viewOf(state, actions);
  return (
    <div ref={root} class="contents" data-status-bar="">
      <StatusBar accounts={logos} message={view.message} trailing={view.trailing} progress={view.progress ?? null} menu={menu} accountsRef={accountsArea} />
    </div>
  );
}

/** Monte la barre dans `container` ; `dispose` la démonte et libère sa source (écouteur du stockage) */
export function mountStatusBar(container: HTMLElement, deps: StatusBarHostDeps): { dispose(): void } {
  const source = deps.source ?? createStatusBarSource();
  if (!deps.source) void source.load();
  render(<StatusBarHost deps={deps} source={source} />, container);
  return {
    dispose: () => {
      render(null, container);
      source.dispose();
    },
  };
}
