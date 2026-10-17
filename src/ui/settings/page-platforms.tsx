// Réglages › Plateformes (maquettes Plateformes, PlateformesLecteur, PlateformesAcces) : où SyncKai suit les épisodes
// (Crunchyroll et ADN inclus, Netflix / Disney+ / Prime Video par un interrupteur qui demande l'accès au site), accès
// aux sites Crunchyroll / ADN retiré (Firefox), lecteur préféré (liste ; Netflix et Prime Video grisés tant qu'ils ne sont
// pas activés, jamais Disney+) et heure de sortie estimée par plateforme (− / + par 15 min, valeur saisissable).
import { useEffect, useId, useState } from 'preact/hooks';
import { joinSentences, t, type MessageKey } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { hasHostAccess, requestHostAccess, requiredOrigins } from '../../browser/host-access';
import { removePlatformAccess } from '../../browser/platform-access';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS, type StreamingPlatform } from '../../platforms/registry';
import { DEFAULT_SETTINGS, effectivePlayer, isPreferredPlayerOption, stepOffset, type SyncSettings } from '../../shared/settings';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { Select, type SelectOption } from '../components/select';
import { ServiceLogo } from '../components/service-logo';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { alertAttrs } from '../live-region';
import { requestPlatformAccessFromClick } from '../platform-access-store';
import { useLocale, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage } from './context';
import { OffsetField } from './offset-field';
import { SettingsPlaceholder } from './placeholder';
import { preactPage } from './preact-page';

const log = createLogger('settings');

/** Plateformes activées par un interrupteur (permission d'hôte optionnelle) */
type ToggledPlatform = 'netflix' | 'disney' | 'prime';

const isToggled = (platform: StreamingPlatform): platform is ToggledPlatform => isOptionalPlatform(platform);

type AccessText = 'helpOff' | 'helpOn' | 'denied' | 'disabled' | 'error';

/** Textes de l'interrupteur de chaque plateforme */
const ACCESS_TEXTS: Readonly<Record<ToggledPlatform, Readonly<Record<AccessText, MessageKey>>>> = {
  netflix: {
    helpOff: 'settings.netflix.helpOff',
    helpOn: 'settings.netflix.helpOn',
    denied: 'settings.netflix.denied',
    disabled: 'settings.netflix.disabled',
    error: 'settings.netflix.error',
  },
  disney: {
    helpOff: 'settings.disney.helpOff',
    helpOn: 'settings.disney.helpOn',
    denied: 'settings.disney.denied',
    disabled: 'settings.disney.disabled',
    error: 'settings.disney.error',
  },
  prime: {
    helpOff: 'settings.prime.helpOff',
    helpOn: 'settings.prime.helpOn',
    denied: 'settings.prime.denied',
    disabled: 'settings.prime.disabled',
    error: 'settings.prime.error',
  },
};

/**
 * Retour de la dernière demande d'accès, affiché sous l'interrupteur jusqu'au prochain changement (gardé entre deux
 * visites de la page). `disabled` : accès retiré, le script déjà exécuté dans un onglet ouvert tourne jusqu'à son rechargement.
 */
type AccessNotice = 'denied' | 'error' | 'disabled' | null;
type Notices = Readonly<Record<ToggledPlatform, AccessNotice>>;

/** Accès aux sites Crunchyroll / ADN (permissions d'hôte du manifeste, retirables sous Firefox) */
type HostAccess = { status: 'unknown' | 'granted' } | { status: 'missing'; denied: boolean };

const HOST_ORIGINS = (): string[] => requiredOrigins(chrome.runtime.getManifest());

/**
 * Bandeau « SyncKai n'a pas accès à Crunchyroll / ADN » (maquette PlateformesAcces) : la demande part directement du clic
 * (geste utilisateur exigé par Firefox, aucun await avant)
 */
function HostAccessBanner({ state, onAllow }: { state: Extract<HostAccess, { status: 'missing' }>; onAllow: () => void }) {
  const message = state.denied ? joinSentences([t('popup.hostAccessMissing'), t('popup.hostAccessDenied')]) : t('popup.hostAccessMissing');
  return (
    <div class="flex flex-col gap-2 rounded-card border border-butter/40 bg-butter/10 p-3 text-secondary" {...alertAttrs(message)} data-host-access="">
      <div class="flex items-start gap-2">
        <span class="flex shrink-0 pt-0.5 text-butter">
          <Icon name="alert" class="size-3.5" strokeWidth="2.2" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="m-0 font-bold break-words text-butter">{t('popup.hostAccessMissing')}</p>
          {state.denied && <p class="m-0 break-words text-muted">{t('popup.hostAccessDenied')}</p>}
        </div>
      </div>
      <Button variant="primary" size="sm" class="self-end" focusKey="settings-host-access" onClick={onAllow}>
        {t('popup.hostAccessAllow')}
      </Button>
    </div>
  );
}

/** État de l'accès aux sites : lu à l'ouverture, relu à chaque événement de permission (store des accès de l'hôte) */
function useHostAccess(ctx: SettingsContext): [HostAccess, () => void] {
  const [state, setState] = useState<HostAccess>({ status: 'unknown' });
  useEffect(() => {
    let alive = true;
    const check = (): void => {
      void hasHostAccess(HOST_ORIGINS()).then((granted) => {
        if (!alive) return;
        setState((current) => (granted ? { status: 'granted' } : { status: 'missing', denied: current.status === 'missing' && current.denied }));
      });
    };
    check();
    const unsubscribe = ctx.host.platformAccess.onPermissionsChange(check);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [ctx]);
  const allow = (): void => {
    requestHostAccess(HOST_ORIGINS()).then(
      (granted) => {
        if (!granted) setState({ status: 'missing', denied: true });
      },
      (error: unknown) => {
        log.warn('Demande d’accès aux sites impossible :', error);
        setState({ status: 'missing', denied: true });
      },
    );
  };
  return [state, allow];
}

interface PlatformsPageProps {
  ctx: SettingsContext;
  notices: Store<Notices>;
}

export function PlatformsPage({ ctx, notices }: PlatformsPageProps) {
  useLocale();
  const data = useStore(ctx.state);
  const notice = useStore(notices);
  const [host, allowHost] = useHostAccess(ctx);
  const playerHelp = useId();
  const offsetsHelp = useId();
  const s = data.settings;
  if (!s) return <SettingsPlaceholder error={data.settingsError} />;
  const granted = data.platformAccess;

  const setNotice = (platform: ToggledPlatform, next: AccessNotice): void => notices.set({ ...notices.get(), [platform]: next });

  /**
   * Interrupteur d'une plateforme. Activation : permissions.request appelé directement dans le gestionnaire (geste
   * utilisateur exigé, aucun await avant), puis accès relus par le store de l'hôte. Retrait de Netflix ou de Prime Video
   * alors lecteur préféré : le lecteur repasse sur le lecteur par défaut.
   */
  const onToggle = (platform: ToggledPlatform, checked: boolean): void => {
    const { label } = PLATFORMS[platform];
    const access = ctx.host.platformAccess;
    if (checked) {
      requestPlatformAccessFromClick(platform, access).then(
        (ok) => setNotice(platform, ok ? null : 'denied'),
        (error: unknown) => {
          log.warn(`Demande d’accès à ${label} impossible :`, error);
          setNotice(platform, 'error');
          void access.refresh();
        },
      );
      return;
    }
    removePlatformAccess(platform).then(
      (removed) => {
        if (removed && ctx.data.settings?.preferredPlayer === platform) void ctx.update({ preferredPlayer: DEFAULT_SETTINGS.preferredPlayer });
        setNotice(platform, removed ? 'disabled' : 'error');
        void access.refresh();
      },
      (error: unknown) => {
        log.warn(`Retrait de l’accès à ${label} impossible :`, error);
        setNotice(platform, 'error');
        void access.refresh();
      },
    );
  };

  const missing = host.status === 'missing';

  const platformRow = (platform: StreamingPlatform, index: number) => {
    const leading = <ServiceLogo id={platform} size="tile" />;
    const divider = index > 0;
    if (!isToggled(platform)) {
      return (
        <SettingsRow
          key={platform}
          title={PLATFORMS[platform].label}
          description={t('settings.platforms.allAnime')}
          leading={leading}
          divider={divider}
          trailing={
            <span class={`shrink-0 text-secondary font-bold ${missing ? 'text-butter' : 'text-mint'}`} data-platform-state={missing ? 'missing' : 'included'}>
              {t(missing ? 'settings.platforms.accessMissing' : 'settings.platforms.included')}
            </span>
          }
        />
      );
    }
    const texts = ACCESS_TEXTS[platform];
    const on = granted?.includes(platform) === true;
    const state = notice[platform];
    const errorText = state === 'denied' ? t(texts.denied) : state === 'error' ? t(texts.error) : null;
    return (
      <div key={platform} class="flex flex-col" data-platform={platform}>
        <SettingsRow
          title={PLATFORMS[platform].label}
          description={t(on ? texts.helpOn : texts.helpOff)}
          leading={leading}
          divider={divider}
          toggle={{ checked: on, disabled: granted === undefined, onChange: (checked) => onToggle(platform, checked) }}
          focusKey={`sk-${platform}`}
        />
        {state === 'disabled' && !on && (
          <p class="m-0 -mt-1.5 pr-3 pb-2.5 pl-13 text-secondary font-bold text-muted" role="status" data-platform-notice="disabled">
            {t(texts.disabled)}
          </p>
        )}
        {errorText !== null && (
          <p class="m-0 -mt-1.5 pr-3 pb-2.5 pl-13 text-secondary font-bold text-danger" {...alertAttrs(errorText)} data-platform-notice={state ?? ''}>
            {errorText}
          </p>
        )}
      </div>
    );
  };

  const players: SelectOption<StreamingPlatform>[] = STREAMING_PLATFORMS.filter(isPreferredPlayerOption).map((platform) => {
    // Netflix, Prime Video : proposés seulement avec leur accès ; sinon visibles, grisés, « Activer d'abord »
    const available = !isOptionalPlatform(platform) || granted?.includes(platform) === true;
    return { value: platform, label: PLATFORMS[platform].label, leading: <ServiceLogo id={platform} />, disabled: !available, hint: t('settings.player.enableFirst') };
  });

  /** Délai enregistré le plus récent (deux clics rapides : le second part du premier) */
  const offsetOf = (platform: StreamingPlatform): number => (ctx.data.settings ?? s).platformOffsets[platform];
  const saveOffset = (platform: StreamingPlatform, value: number): void => {
    const current: SyncSettings = ctx.data.settings ?? s;
    void ctx.update({ platformOffsets: { ...current.platformOffsets, [platform]: value } });
  };

  return (
    <div class="flex flex-col gap-4">
      {host.status === 'missing' && !ctx.host.hostAccessBanner && <HostAccessBanner state={host} onAllow={allowHost} />}
      <Section title={t('settings.platforms.where')}>
        <SettingsCard>{STREAMING_PLATFORMS.map(platformRow)}</SettingsCard>
        <p class="m-0 mx-1 text-secondary text-muted">{t('settings.platforms.note')}</p>
      </Section>
      <Section title={t('settings.player.label')}>
        <SettingsCard>
          <Select
            label={t('settings.player.openOn')}
            options={players}
            value={effectivePlayer(s.preferredPlayer, granted)}
            onChange={(value) => void ctx.update({ preferredPlayer: value })}
            describedBy={playerHelp}
            focusKey="player"
          />
        </SettingsCard>
        <p class="m-0 mx-1 text-secondary text-muted" id={playerHelp}>
          {t('settings.player.help')}
        </p>
      </Section>
      <Section title={t('settings.offsets.title')}>
        <SettingsCard>
          {STREAMING_PLATFORMS.map((platform, index) => (
            <OffsetField
              key={platform}
              platform={PLATFORMS[platform].label}
              value={s.platformOffsets[platform]}
              onStep={(direction) => saveOffset(platform, stepOffset(offsetOf(platform), direction))}
              onCommit={(value) => saveOffset(platform, value)}
              describedBy={offsetsHelp}
              focusKey={`offset-${platform}`}
              divider={index > 0}
            />
          ))}
        </SettingsCard>
        <p class="m-0 mx-1 text-secondary text-muted" id={offsetsHelp}>
          {t('settings.offsets.help')}
        </p>
      </Section>
    </div>
  );
}

export function createPlatformsPage(ctx: SettingsContext): SettingsMountedPage {
  const notices = createStore<Notices>({ netflix: null, disney: null, prime: null });
  return preactPage(() => <PlatformsPage ctx={ctx} notices={notices} />);
}
