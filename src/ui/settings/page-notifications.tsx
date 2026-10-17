// Réglages › Notifications (maquettes Notifications, NotificationsAlertes) : style des notifications sur la page de
// lecture (cartes illustrées Discrètes / Détaillées / Alertes seulement), proposition de note en fin de série, puis
// alertes de sortie : interrupteur, délai en plus (grisé alertes coupées), ligne d'état de la dernière vérification et
// « Vérifier maintenant » (en cours : roue et « Vérification en cours… »). L'alarme horaire suit chaque changement de
// réglage (ctx.update → updateSettings → ensureAiringAlarm).
import { useId } from 'preact/hooks';
import { t, tp } from '../../i18n';
import { formatAiringStatus, type AiringCheckResult } from '../../shared/airing.types';
import { AIRING_DELAYS, type AiringDelayHours } from '../../shared/engagement.types';
import { createLogger } from '../../browser/logger';
import { sendMessage } from '../../protocol/messages';
import type { NotificationLevel } from '../../shared/settings';
import { Button } from '../components/button';
import { ChoiceCards, type ChoiceCardOption } from '../components/choice-cards';
import { Section } from '../components/section';
import { Segmented } from '../components/segmented';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { useLocale, useNow, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage } from './context';
import { SettingsPlaceholder } from './placeholder';
import { preactPage } from './preact-page';

const log = createLogger('settings');

/** « Dernière vérification il y a… » vieillit tant que la page reste ouverte */
const CLOCK_TICK_MS = 60_000;

type NotifArtKind = 'pill' | 'bubble' | 'alert';

/**
 * Vignette d'une vidéo (dégradé, barre de progression sakura, bouton lecture) avec la notification de chaque style :
 * pastille « synchronisé » dans le coin, bulle détaillée (épisode, lignes AniList / MyAnimeList), alerte jaune seule.
 * Couleurs par jetons (classes fill-* / stroke-*) ; décorative.
 */
function NotifArt({ kind }: { kind: NotifArtKind }) {
  const gradient = useId();
  return (
    <svg class="block h-8.75 w-14 shrink-0" viewBox="0 0 64 40" aria-hidden="true" data-notif-art={kind}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" class="[stop-color:var(--color-line)]" />
          <stop offset="1" class="[stop-color:var(--color-ground)]" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="63" height="39" rx="6" stroke-width="1.2" fill={`url(#${gradient})`} class="stroke-field" />
      <path d="M0.5 30 Q16 22 30 27 T63.5 24 V33 H0.5Z" class="fill-ground" opacity="0.4" />
      <rect x="5" y="34" width="54" height="2" rx="1" class="fill-ink" opacity="0.25" />
      <rect x="5" y="34" width="36" height="2" rx="1" class="fill-sakura" />
      <path d="M6 27.5 L6 31.5 L9.5 29.5Z" class="fill-ink" opacity="0.8" />
      {kind === 'pill' && (
        <>
          <rect x="34" y="22" width="25" height="8" rx="4" stroke-width="0.6" class="fill-surface stroke-field" />
          <path d="M37.5 26 l1.5 1.5 3-3" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="stroke-mint" />
          <rect x="44" y="25.2" width="12" height="1.6" rx="0.8" class="fill-ink" opacity="0.85" />
        </>
      )}
      {kind === 'bubble' && (
        <>
          <rect x="26" y="5" width="33" height="25" rx="4" stroke-width="0.6" class="fill-surface stroke-field" />
          <circle cx="31.5" cy="11" r="3" class="fill-sakura" />
          <rect x="36.5" y="9" width="18" height="1.8" rx="0.9" class="fill-ink" />
          <rect x="36.5" y="12.4" width="11" height="1.4" rx="0.7" class="fill-muted" />
          <circle cx="31" cy="19" r="1.6" class="fill-anilist" />
          <rect x="34" y="18.3" width="15" height="1.4" rx="0.7" class="fill-muted" />
          <path d="M51.5 19 l1 1 2-2" fill="none" stroke-width="1" stroke-linecap="round" class="stroke-mint" />
          <circle cx="31" cy="24" r="1.6" class="fill-mal" />
          <rect x="34" y="23.3" width="15" height="1.4" rx="0.7" class="fill-muted" />
          <path d="M51.5 24 l1 1 2-2" fill="none" stroke-width="1" stroke-linecap="round" class="stroke-mint" />
        </>
      )}
      {kind === 'alert' && (
        <>
          <rect x="26" y="9" width="33" height="17" rx="4" stroke-width="0.8" class="fill-surface stroke-butter" />
          <path d="M32.5 13 L36.5 20 H28.5Z" class="fill-butter" />
          <rect x="32" y="15.3" width="1" height="2.6" rx="0.5" class="fill-on-fill" />
          <circle cx="32.5" cy="19" r="0.55" class="fill-on-fill" />
          <rect x="39" y="14" width="16" height="1.8" rx="0.9" class="fill-ink" />
          <rect x="39" y="18" width="11" height="1.4" rx="0.7" class="fill-muted" />
        </>
      )}
    </svg>
  );
}

/** Styles de notification (textes traduits à chaque rendu) */
function levelOptions(): ChoiceCardOption<NotificationLevel>[] {
  return [
    { value: 'discreet', label: t('settings.notif.discreet.title'), description: t('settings.notif.discreet.desc'), badge: t('settings.recommended'), media: <NotifArt kind="pill" /> },
    { value: 'detailed', label: t('settings.notif.detailed.title'), description: t('settings.notif.detailed.desc'), media: <NotifArt kind="bubble" /> },
    { value: 'alerts-only', label: t('settings.notif.alertsOnly.title'), description: t('settings.notif.alertsOnly.desc'), media: <NotifArt kind="alert" /> },
  ];
}

type DelayKey = `${AiringDelayHours}`;

function delayOptions(): { value: DelayKey; label: string; aria: string }[] {
  return AIRING_DELAYS.map((hours) => ({ value: `${hours}`, label: t('settings.delay.label', { hours }), aria: tp('settings.delay.aria', hours) }));
}

function delayFromKey(key: DelayKey): AiringDelayHours {
  return AIRING_DELAYS.find((hours) => `${hours}` === key) ?? AIRING_DELAYS[0];
}

/**
 * Résumé affiché : le plus récent du stockage (alarme horaire, vérification d'une autre vue) et de la dernière
 * vérification lancée ici (dont l'échec de secours, jamais écrit dans le stockage)
 */
export function latestAiring(stored: AiringCheckResult | null, local: AiringCheckResult | null): AiringCheckResult | null {
  if (!stored || !local) return stored ?? local;
  return local.checkedAt > stored.checkedAt ? local : stored;
}

interface AiringCheck {
  pending: boolean;
  /** Résultat de la dernière vérification lancée depuis les Réglages */
  result: AiringCheckResult | null;
}

interface NotificationsPageProps {
  ctx: SettingsContext;
  check: Store<AiringCheck>;
}

export function NotificationsPage({ ctx, check }: NotificationsPageProps) {
  useLocale();
  const data = useStore(ctx.state);
  const checking = useStore(check);
  const now = useNow(CLOCK_TICK_MS);
  const delayLabel = useId();
  const s = data.settings;
  if (!s) return <SettingsPlaceholder error={data.settingsError} />;

  const enabled = s.airingAlerts;
  const line = formatAiringStatus(latestAiring(data.airing, checking.result), now);

  async function checkNow(): Promise<void> {
    if (check.get().pending) return;
    check.set({ ...check.get(), pending: true });
    let result: AiringCheckResult;
    try {
      const answer = await sendMessage('CHECK_AIRING', null);
      // Réponse de secours du service worker : horodatage absent
      result = { ...answer, checkedAt: answer.checkedAt || Date.now() };
    } catch (error: unknown) {
      log.error('Vérification des sorties impossible :', error);
      result = { checkedAt: Date.now(), notified: 0, skipped: null, error: t('settings.airing.unavailable') };
    }
    check.set({ pending: false, result });
  }

  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.section.notifications')}>
        <SettingsCard>
          <div class="p-1">
            <ChoiceCards
              legend={t('settings.notif.legend')}
              legendHidden
              flush
              options={levelOptions()}
              value={s.notificationLevel}
              onChange={(value) => void ctx.update({ notificationLevel: value })}
              focusKey="notif"
            />
          </div>
          <SettingsRow
            title={t('settings.ratingPrompt.label')}
            description={t('settings.ratingPrompt.help')}
            toggle={{ checked: s.ratingPrompt, onChange: (checked) => void ctx.update({ ratingPrompt: checked }) }}
            focusKey="sk-rating"
            divider
          />
        </SettingsCard>
        <p class="m-0 mx-1 text-secondary text-muted">{t('settings.notif.alertsAlways')}</p>
      </Section>
      <Section title={t('settings.section.airing')}>
        <SettingsCard>
          <SettingsRow
            title={t('settings.quick.airing.label')}
            description={t('settings.quick.airing.help')}
            toggle={{ checked: enabled, onChange: (checked) => void ctx.update({ airingAlerts: checked }) }}
            focusKey="sk-airing"
          />
          <div class={`relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-line ${enabled ? '' : 'opacity-50'}`}>
            <span class="min-w-0 font-bold" id={delayLabel}>
              {t('settings.delay.title')}
            </span>
            <Segmented options={delayOptions()} value={`${s.airingDelayHours}`} onChange={(value) => void ctx.update({ airingDelayHours: delayFromKey(value) })} labelledBy={delayLabel} disabled={!enabled} focusKey="delay" />
          </div>
          <div class="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-line">
            <span class="flex min-w-0 flex-1 basis-40 flex-col gap-0.5 text-secondary">
              <span class={line.tone === 'danger' && !checking.pending ? 'font-bold text-danger' : 'text-muted'} role="status" aria-live="polite" data-airing-status={line.tone}>
                {checking.pending ? t('settings.airing.checking') : line.text}
              </span>
              {!enabled && <span class="text-muted">{t('settings.airing.enableFirst')}</span>}
            </span>
            <Button size="sm" busy={checking.pending} disabled={!enabled} title={enabled ? t('settings.airing.checkTitle') : undefined} focusKey="airing-check" onClick={() => void checkNow()}>
              {t('settings.airing.checkNow')}
            </Button>
          </div>
        </SettingsCard>
      </Section>
    </div>
  );
}

export function createNotificationsPage(ctx: SettingsContext): SettingsMountedPage {
  // Vérification en cours et dernier résultat gardés entre deux visites (la réponse peut arriver page quittée)
  const check = createStore<AiringCheck>({ pending: false, result: null });
  return preactPage(() => <NotificationsPage ctx={ctx} check={check} />);
}
