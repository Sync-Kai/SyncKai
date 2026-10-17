// Accueil des Réglages (maquettes Main, ReglagesEtats, PanelReglages320) : carte Comptes (logos, résumé avec point
// d'état, toujours visible à 320 px), interrupteurs rapides, catégories (Synchronisation, Plateformes, Notifications,
// Affichage) puis Mes données et Aide. Composant sans état : la vue le redessine à chaque changement de ses données.
import { t } from '../../i18n';
import type { SyncSettings } from '../../shared/settings';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { serviceIcon } from '../brand-icons';
import { Alert } from '../components/alert';
import { Icon, MountedNode } from '../components/icon';
import { SettingsCard, SettingsRow, type TileColor } from '../components/settings-row';
import { TONE_BG } from '../components/tone';
import type { IconName } from '../icons';
import type { SettingsData } from './context';
import { SETTINGS_PAGE_TITLES, settingsRowFocus, type SettingsCategory } from './navigation';
import { accountsSummary, helpSummary, notificationsSummary, platformsSummary, syncSummary, type AccountLink } from './summary';

/** Icône et teinte de chaque catégorie (maquette Main) ; Comptes a sa propre carte */
const CATEGORY_LOOK: Readonly<Record<Exclude<SettingsCategory, 'accounts'>, { icon: IconName; tile: TileColor }>> = {
  sync: { icon: 'sync', tile: 'lavender' },
  platforms: { icon: 'monitor', tile: 'mint' },
  notifications: { icon: 'bell', tile: 'butter' },
  display: { icon: 'window', tile: 'sakura' },
  data: { icon: 'folder', tile: 'muted' },
  help: { icon: 'help', tile: 'muted' },
};

export interface SettingsHomeProps {
  data: SettingsData;
  accounts: Readonly<Record<TrackerId, AccountLink>>;
  version: string;
  onOpen: (category: SettingsCategory) => void;
  onUpdate: (patch: Partial<SyncSettings>) => void;
}

/** Logos ronds superposés des deux services, grisés quand le compte n'est pas connecté */
function AccountLogos({ accounts }: { accounts: Readonly<Record<TrackerId, AccountLink>> }) {
  return (
    <span class="flex shrink-0" aria-hidden="true">
      {TRACKER_IDS.map((id, index) => {
        const dim = accounts[id] !== 'connected';
        const classes = `block size-8 rounded-pill ${index > 0 ? '-ml-2 box-content border-2 border-surface' : ''} ${dim ? 'opacity-45 grayscale' : ''}`;
        return <MountedNode key={id} build={() => serviceIcon(id, classes, { decorative: true })} inputs={[id, classes]} />;
      })}
    </span>
  );
}

/** Carte Comptes : résumé gardé dans le panneau étroit (seule exception à la règle des 320 px) */
function AccountsCard({ accounts, onOpen }: { accounts: Readonly<Record<TrackerId, AccountLink>>; onOpen: () => void }) {
  const summary = accountsSummary(accounts);
  const loading = TRACKER_IDS.some((id) => accounts[id] === 'loading');
  return (
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface p-3 text-left text-ink transition-colors hover:bg-raised"
      data-focus={settingsRowFocus('accounts')}
      onClick={onOpen}
    >
      <AccountLogos accounts={accounts} />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-body font-extrabold">{t(SETTINGS_PAGE_TITLES.accounts)}</span>
        <span class={`flex items-start gap-1.5 text-secondary ${summary.tone === 'danger' ? 'font-bold text-danger' : 'text-muted'}`} data-account-summary={loading ? 'loading' : summary.tone}>
          <span class={`mt-[5px] size-1.5 shrink-0 rounded-pill ${TONE_BG[summary.tone === 'danger' ? 'error' : summary.tone]}`} />
          <span class="min-w-0">{summary.text}</span>
        </span>
      </span>
      <span class="flex shrink-0 text-muted">
        <Icon name="chevronRight" class="size-3.5" strokeWidth="2.4" />
      </span>
    </button>
  );
}

/** Interrupteurs rapides ; réglages en lecture : squelette ; illisibles : alerte */
function QuickSettings({ data, onUpdate }: Pick<SettingsHomeProps, 'data' | 'onUpdate'>) {
  const s = data.settings;
  if (!s) {
    if (data.settingsError) return <Alert message={t('settings.loadError')} />;
    return (
      <div class="flex h-[118px] flex-col justify-center gap-6 rounded-card border border-line bg-surface p-3" aria-busy="true" aria-label={t('settings.loading')} data-settings-skeleton="">
        {[0, 1].map((row) => (
          <span key={row} class="flex items-center gap-3 motion-safe:animate-pulse" aria-hidden="true">
            <span class="flex flex-1 flex-col gap-1.5">
              <span class="h-2.5 w-2/5 rounded-control bg-raised" />
              <span class="h-2 w-3/5 rounded-control bg-raised" />
            </span>
            <span class="h-6 w-10 rounded-pill bg-raised" />
          </span>
        ))}
      </div>
    );
  }
  return (
    <SettingsCard label={t('settings.group.quick')}>
      <SettingsRow
        title={t('settings.autoSync.label')}
        description={t(s.autoSync ? 'settings.autoSync.helpOn' : 'settings.autoSync.helpOff')}
        toggle={{ checked: s.autoSync, onChange: (checked) => onUpdate({ autoSync: checked }) }}
        focusKey="sk-quick-auto"
      />
      <SettingsRow
        title={t('settings.quick.airing.label')}
        description={t('settings.quick.airing.help')}
        toggle={{ checked: s.airingAlerts, onChange: (checked) => onUpdate({ airingAlerts: checked }) }}
        focusKey="sk-quick-airing"
        divider
      />
    </SettingsCard>
  );
}

export function SettingsHome({ data, accounts, version, onOpen, onUpdate }: SettingsHomeProps) {
  const s = data.settings;
  // Résumés qui dépendent des réglages : « Chargement… » pendant la lecture, rien s'ils sont illisibles (alerte au-dessus)
  const settingsSummary = (summary: (settings: SyncSettings) => string): string | undefined => (s ? summary(s) : data.settingsError ? undefined : t('settings.summary.loading'));
  const summaries: Readonly<Record<Exclude<SettingsCategory, 'accounts'>, string | undefined>> = {
    sync: settingsSummary(syncSummary),
    platforms: settingsSummary((settings) => platformsSummary(settings, data.platformAccess)),
    notifications: settingsSummary(notificationsSummary),
    display: t('settings.summary.display'),
    data: t('settings.summary.data'),
    help: helpSummary(version, data.journalCount),
  };
  const row = (category: Exclude<SettingsCategory, 'accounts'>, divider: boolean) => (
    <SettingsRow
      key={category}
      icon={CATEGORY_LOOK[category].icon}
      tile={CATEGORY_LOOK[category].tile}
      title={t(SETTINGS_PAGE_TITLES[category])}
      description={summaries[category]}
      onClick={() => onOpen(category)}
      focusKey={settingsRowFocus(category)}
      divider={divider}
    />
  );
  return (
    <>
      <AccountsCard accounts={accounts} onOpen={() => onOpen('accounts')} />
      <QuickSettings data={data} onUpdate={onUpdate} />
      <SettingsCard label={t('settings.group.categories')}>
        {row('sync', false)}
        {row('platforms', true)}
        {row('notifications', true)}
        {row('display', true)}
      </SettingsCard>
      <SettingsCard label={t('settings.group.more')}>
        {row('data', false)}
        {row('help', true)}
      </SettingsCard>
    </>
  );
}
