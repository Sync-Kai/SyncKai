// Réglages › Comptes (maquettes Comptes, ComptesConnexion) : une carte par service (connecté, session expirée, non
// connecté, connexion en cours, chargement, profil illisible, erreurs sous l'en-tête), « Fiche ouverte par défaut »
// (désactivée tant que les deux comptes ne sont pas connectés) et la note sur le mot de passe.
import { useEffect, useId, useState } from 'preact/hooks';
import { joinSentences, t } from '../../i18n';
import { getCachedMalViewer, getCachedViewer } from '../../browser/storage/viewer-cache';
import { isAniListViewer, type AniListViewer } from '../../shared/anilist.types';
import { isMalViewer, type MalViewer } from '../../shared/mal.types';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { toImageSrc } from '../../shared/url';
import { profileUrl } from '../account-menu-model';
import type { AccountsController } from '../accounts';
import { AccountAvatar } from '../components/account-avatar';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { Segmented } from '../components/segmented';
import { TONE_BG } from '../components/tone';
import { useLocale, useStore } from '../preact/hooks';
import type { AccountState } from '../state';
import type { SettingsContext, SettingsMountedPage } from './context';
import { preactPage } from './preact-page';

type Viewer = AniListViewer | MalViewer;

/** Affichage d'une carte de compte ; `profile-error` : connecté, profil jamais chargé et lecture en échec (UI-04) */
export type AccountRowKind = 'skeleton' | 'logged-out' | 'profile' | 'profile-error';

export function accountRowKind(state: AccountState<unknown>): AccountRowKind {
  if (state.status === 'loading') return 'skeleton';
  if (state.status === 'logged-out') return 'logged-out';
  if (state.viewer) return 'profile';
  // Squelette seulement pendant le chargement : une erreur sans profil en cache doit rester visible
  return state.error === null ? 'skeleton' : 'profile-error';
}

/** Profil validé (le store générique des comptes porte un profil `unknown`) */
function viewerOf(state: AccountState<unknown>): Viewer | null {
  if (state.status !== 'logged-in') return null;
  return isAniListViewer(state.viewer) || isMalViewer(state.viewer) ? state.viewer : null;
}

const avatarUrl = (viewer: Viewer | null): string | null => toImageSrc(viewer === null ? null : 'avatarUrl' in viewer ? viewer.avatarUrl : viewer.pictureUrl);

/** Ligne d'état sous le nom du service : point coloré et texte */
function StatusLine({ tone, text }: { tone: 'ok' | 'muted' | 'error'; text: string }) {
  return (
    <span class={`flex items-center gap-1.5 text-secondary ${tone === 'error' ? 'font-bold text-danger' : 'text-muted'}`} data-account-status={tone}>
      <span class={`size-1.5 shrink-0 rounded-pill ${TONE_BG[tone]}`} aria-hidden="true" />
      <span class="min-w-0 truncate" title={text}>
        {text}
      </span>
    </span>
  );
}

const DIVIDER = <div class="mx-3 h-px bg-line" aria-hidden="true" />;

interface AccountCardProps {
  service: TrackerId;
  state: AccountState<unknown>;
  /** L'autre service est connecté : « AniList continue d'être mis à jour » sous une session expirée */
  otherConnected: boolean;
  accounts: Pick<AccountsController, 'login' | 'logout' | 'refresh'>;
}

function AccountCard({ service, state, otherConnected, accounts }: AccountCardProps) {
  const label = TRACKER_LABELS[service];
  const kind = accountRowKind(state);
  const expired = state.status === 'logged-out' && state.expired;
  // Session expirée : « Voir mon profil » si le profil est encore en cache
  const [cached, setCached] = useState<Viewer | null>(null);
  useEffect(() => {
    if (!expired) return;
    let live = true;
    (service === 'anilist' ? getCachedViewer() : getCachedMalViewer()).then(
      (viewer) => live && setCached(viewer),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [service, expired]);

  const card = `flex flex-col rounded-card border bg-surface ${expired ? 'border-danger/30' : 'border-line'}`;
  const sectionLabel = expired ? t('accountMenu.labelExpired', { service: label }) : t('accountMenu.label', { service: label });

  if (kind === 'skeleton') {
    return (
      <section class={card} aria-label={sectionLabel} data-account-card={service}>
        <div class="flex items-center gap-3 p-3 motion-safe:animate-pulse" aria-busy="true" aria-label={t('settings.account.loading', { service: label })}>
          <span class="size-11 shrink-0 rounded-pill bg-raised" />
          <span class="flex flex-1 flex-col gap-1.5">
            <span class="h-3 w-24 rounded-control bg-raised" />
            <span class="h-2.5 w-36 rounded-control bg-raised" />
          </span>
        </div>
        {DIVIDER}
        <div class="flex justify-between p-2 px-3 motion-safe:animate-pulse" aria-hidden="true">
          <span class="h-8 w-32 rounded-pill bg-raised" />
          <span class="h-8 w-28 rounded-pill bg-raised" />
        </div>
      </section>
    );
  }

  const viewer = kind === 'profile' ? viewerOf(state) : expired ? cached : null;
  // Action destructive discrète : texte rouge sans bordure (maquette Comptes), à droite de « Voir mon profil »
  const logout = (
    <button
      type="button"
      class="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-transparent px-2.5 text-secondary font-bold text-danger transition-colors hover:bg-danger/10"
      aria-label={t('settings.account.logoutAria', { service: label })}
      data-focus={`logout-${service}`}
      onClick={() => void accounts.logout(service)}
    >
      <Icon name="logout" class="size-3.5" strokeWidth="2.2" />
      {t('settings.account.logout')}
    </button>
  );
  const profile = viewer && (
    <a
      class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-field bg-raised px-3 text-body font-bold text-ink no-underline transition-colors hover:bg-line"
      href={profileUrl(viewer)}
      target="_blank"
      rel="noopener noreferrer"
      title={t('settings.account.openProfile', { service: label })}
      data-focus={`profile-${service}`}
    >
      {t('accountMenu.profile')}
      <Icon name="external" class="size-3" strokeWidth="2.4" />
    </a>
  );

  let status;
  let action = null;
  if (state.status === 'logged-out') {
    status = expired ? <StatusLine tone="error" text={t('common.sessionExpired')} /> : <StatusLine tone="muted" text={t('settings.account.notConnected')} />;
    action = (
      <Button
        variant="primary"
        icon={expired ? 'retry' : undefined}
        busy={state.pending}
        ariaLabel={t(expired ? 'common.reconnectService' : 'common.connectService', { service: label })}
        focusKey={`login-${service}`}
        onClick={() => void accounts.login(service)}
      >
        {state.pending ? t('common.connecting') : expired ? t('common.reconnect') : t('common.connect')}
      </Button>
    );
  } else {
    status = <StatusLine tone="ok" text={viewer ? t('accountMenu.connectedAs', { name: viewer.name }) : t('settings.account.connected', { service: label })} />;
  }

  const error = state.status === 'loading' ? null : state.error;
  // Connecté : « Réessayer » relit le profil ; déconnecté (connexion échouée, session illisible) : message seul
  const alert = error && <Alert class="mx-3 mb-3" message={error} action={state.status === 'logged-in' ? { label: t('common.retry'), onClick: () => void accounts.refresh(service) } : undefined} />;
  const connected = state.status === 'logged-in';
  const footer = connected || expired;

  return (
    <section class={card} aria-label={sectionLabel} data-account-card={service}>
      <div class="flex items-center gap-3 p-3">
        <AccountAvatar service={service} url={avatarUrl(viewer)} state={connected ? 'connected' : expired ? 'expired' : 'disconnected'} size="md" ring="surface" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-extrabold">{label}</span>
          {status}
        </span>
        {action}
      </div>
      {expired && (
        <p class="m-0 mx-3 mb-2.5 text-secondary text-muted">
          {joinSentences([t('settings.account.expiredHelp', { service: label }), otherConnected ? t('settings.account.otherStillSynced', { service: TRACKER_LABELS[service === 'anilist' ? 'mal' : 'anilist'] }) : ''])}
        </p>
      )}
      {alert}
      {footer && DIVIDER}
      {footer && (
        <div class={`flex flex-wrap items-center gap-2 px-3 py-2 ${profile ? 'justify-between' : 'justify-end'}`}>
          {profile}
          {logout}
        </div>
      )}
    </section>
  );
}

const ENTRY_OPTIONS = [
  { value: 'anilist', label: 'AniList' },
  { value: 'mal', label: 'MAL', aria: 'MyAnimeList' },
] as const satisfies readonly { value: TrackerId; label: string; aria?: string }[];

/** « Fiche ouverte par défaut » (clic sur un titre ou une affiche) : choix actif seulement avec les deux comptes connectés */
function EntryService({ ctx, both }: { ctx: SettingsContext; both: boolean }) {
  const data = useStore(ctx.state);
  const labelId = useId();
  const noteId = useId();
  const s = data.settings;
  if (!s) return null;
  return (
    <Section title={t('settings.accounts.both')}>
      <div class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span class="flex min-w-40 flex-1 flex-col" id={labelId}>
            <span class={`font-bold ${both ? '' : 'text-muted'}`}>{t('settings.entry.label')}</span>
            <span class="text-secondary text-muted">{t('settings.entry.help')}</span>
          </span>
          <Segmented
            options={ENTRY_OPTIONS}
            value={s.entryService}
            onChange={(value) => void ctx.update({ entryService: value })}
            labelledBy={labelId}
            describedBy={both ? undefined : noteId}
            disabled={!both}
            focusKey="entry-service"
          />
        </div>
        {!both && (
          <span class="flex items-start gap-1.5 text-secondary text-muted" id={noteId} data-entry-unavailable="">
            <span class="flex shrink-0 pt-0.5 text-lavender">
              <Icon name="info" class="size-3.5" strokeWidth="2.4" />
            </span>
            {t('settings.entry.unavailable')}
          </span>
        )}
      </div>
    </Section>
  );
}

export function AccountsPage({ ctx }: { ctx: SettingsContext }) {
  useLocale();
  const { accounts } = ctx.host;
  const states: Readonly<Record<TrackerId, AccountState<unknown>>> = { anilist: useStore(accounts.anilist), mal: useStore(accounts.mal) };
  const both = TRACKER_IDS.every((id) => states[id].status === 'logged-in');
  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.accounts.lists')}>
        {TRACKER_IDS.map((service) => (
          <AccountCard key={service} service={service} state={states[service]} otherConnected={states[service === 'anilist' ? 'mal' : 'anilist'].status === 'logged-in'} accounts={accounts} />
        ))}
      </Section>
      <EntryService ctx={ctx} both={both} />
      <p class="m-0 mx-1 text-secondary text-muted">{t('settings.accounts.privacy')}</p>
    </div>
  );
}

export function createAccountsPage(ctx: SettingsContext): SettingsMountedPage {
  return preactPage(() => <AccountsPage ctx={ctx} />);
}
