// Galerie des bulles de la page (développement seulement, jamais dans le paquet) : chaque état monté par le VRAI module
// (src/content/ui), sur une image vidéo sombre ou claire. Paramètres : state, locale, bg (dark | light). Voir toasts.ts.
import { setLocale, t, tp } from '../../src/i18n';
import { showEngagementPrompt } from '../../src/content/ui/engagement-prompt';
import { ALERT_TOAST_MS, NOTICE_TOAST_MS, RETRY_TOAST_MS, bubbleForOutcome, episodeSubtitle, toastForOutcome } from '../../src/content/ui/sync-toast';
import { showToast } from '../../src/content/ui/toast';
import type { SyncOutcome } from '../../src/shared/sync.types';
import { installChromeMock } from './mock-chrome';
import { loadedUiLocaleParam, markReady, param, waitFor } from './params';

// Racine fantôme fermée en production : ouverte ici pour simuler le survol et lire la bulle
const attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
  return attachShadow.call(this, { ...init, mode: 'open' });
};

const locale = await loadedUiLocaleParam();
setLocale(locale);
document.documentElement.dataset.bg = param('bg') === 'light' ? 'light' : 'dark';

/** Réponses du service worker simulé pour la note et le revisionnage, selon l'état montré */
let rateResponse: () => Promise<SyncOutcome> = () => new Promise(() => undefined);
let rewatchResponse: () => Promise<SyncOutcome> = () => new Promise(() => undefined);
installChromeMock({
  locale,
  version: '0.0.0',
  storage: {},
  handlers: {
    DEFER_RATING: () => ({ ok: true, data: null }),
    DECLINE_REWATCH: () => ({ ok: true, data: null }),
    RATE_MEDIA: () => rateResponse(),
    START_REWATCH: () => rewatchResponse(),
  },
});

const page = { series: 'Frieren', episode: 6 };
const media = { mediaId: 154587, malId: 52991, title: 'Frieren' };
const retry = { label: t('common.retry'), onClick: () => undefined };
const network = t('api.network', { service: 'MyAnimeList' });

function synced(results: Extract<SyncOutcome, { status: 'synced' }>['results'], mediaTitle = 'Frieren', queued = false): SyncOutcome {
  return { status: 'synced', mediaTitle, results, ...(queued ? { queued } : {}) };
}

const updated = (progress: number, completed = false) => ({ status: 'updated', progress, completed }) as const;
const upToDate = (progress: number) => ({ status: 'up-to-date', progress }) as const;
const skipped = (reason: string) => ({ status: 'skipped', reason }) as const;

/** Résultat de synchro tel que watch-session l'affiche (niveau de notification, épisode de la page) */
function outcome(result: SyncOutcome, level: 'discreet' | 'detailed' | 'alerts-only' = 'detailed', withRetry = false): void {
  if (withRetry) {
    showToast({ ...bubbleForOutcome(result, page), action: retry }, { variant: 'bubble', autoHideMs: RETRY_TOAST_MS });
    return;
  }
  const toast = toastForOutcome(result, level, false, page);
  if (toast) showToast(toast.content, { variant: toast.variant, autoHideMs: toast.autoHideMs });
}

const shadow = (): ShadowRoot | null => [...document.body.children].find((el) => el.shadowRoot !== null)?.shadowRoot ?? null;

async function clickIn(selector: string): Promise<void> {
  const button = await waitFor(() => shadow()?.querySelector<HTMLElement>(selector));
  button.click();
}

/** Survol de la 9e étoile, moitié gauche (8,5/10) */
async function hoverStar(): Promise<void> {
  const stars = await waitFor(() => shadow()?.querySelectorAll('.stars-row > .star-box'));
  stars[8]?.querySelectorAll('button')[0]?.dispatchEvent(new MouseEvent('mouseenter'));
  shadow()?.querySelector('.toast')?.dispatchEvent(new MouseEvent('mouseenter'));
}

const STATES: Record<string, () => void | Promise<void>> = {
  'sync-progress': () => {
    showToast({ tone: 'info', badge: 'sync', title: t('common.syncing'), subtitle: episodeSubtitle(page.series, page.episode) });
  },
  'pill-saved': () => outcome(synced([{ service: 'anilist', outcome: updated(6) }, { service: 'mal', outcome: updated(6) }]), 'discreet'),
  'pill-up-to-date': () => outcome(synced([{ service: 'anilist', outcome: upToDate(6) }]), 'discreet'),
  'pill-up-to-date-no-number': () => outcome(synced([]), 'discreet'),
  'bubble-saved': () => outcome(synced([{ service: 'anilist', outcome: updated(6) }, { service: 'mal', outcome: upToDate(6) }])),
  'bubble-up-to-date': () => outcome(synced([{ service: 'anilist', outcome: upToDate(6) }, { service: 'mal', outcome: upToDate(6) }])),
  'bubble-completed': () => outcome(synced([{ service: 'anilist', outcome: updated(28, true) }, { service: 'mal', outcome: updated(28, true) }])),
  excluded: () => outcome({ status: 'excluded', mediaTitle: 'Dandadan' }),
  review: () => outcome({ status: 'needs-review', reason: t('match.titleOnly') }, 'alerts-only'),
  'not-connected': () => outcome({ status: 'not-connected' }, 'alerts-only'),
  'partial-skipped': () => outcome(synced([{ service: 'anilist', outcome: updated(6) }, { service: 'mal', outcome: skipped(t('sync.alreadyCompleted')) }]), 'alerts-only'),
  'partial-no-equivalent': () => outcome(synced([{ service: 'anilist', outcome: updated(7) }, { service: 'mal', outcome: skipped(t('sync.noEquivalent')) }]), 'alerts-only'),
  'beyond-entry': () =>
    outcome(synced([{ service: 'anilist', outcome: skipped(tp('sync.beyondEntry', 12, { progress: 13 })) }, { service: 'mal', outcome: skipped(tp('sync.beyondEntry', 12, { progress: 13 })) }], 'Dandadan'), 'alerts-only'),
  'finale-jump': () =>
    outcome(synced([{ service: 'anilist', outcome: skipped(t('sync.review.finaleJump', { progress: 12, from: 0 })) }, { service: 'mal', outcome: updated(12, true) }], 'Berserk (2016)'), 'alerts-only'),
  'failed-one-service': () => outcome(synced([{ service: 'anilist', outcome: updated(6) }, { service: 'mal', outcome: { status: 'error', message: network } }]), 'alerts-only', true),
  'failed-one-service-hover': async () => {
    outcome(synced([{ service: 'anilist', outcome: updated(6) }, { service: 'mal', outcome: { status: 'error', message: network } }]), 'alerts-only', true);
    // Délai écoulé en partie, puis pointeur sur la bulle : barre arrêtée et pâlie
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    shadow()?.querySelector('.toast')?.dispatchEvent(new MouseEvent('mouseenter'));
  },
  'failed-global': () => outcome({ status: 'error', message: t('api.timeout', { service: 'AniList' }), queued: true }, 'alerts-only', true),
  unreachable: () => {
    showToast({ tone: 'error', title: t('content.unreachable.title'), subtitle: episodeSubtitle(page.series, page.episode), message: t('content.unreachable.message'), action: retry }, { variant: 'bubble', autoHideMs: RETRY_TOAST_MS });
  },
  unidentified: () => {
    showToast({ tone: 'error', title: t('content.unidentified.title'), message: t('content.unidentified.message') }, { autoHideMs: ALERT_TOAST_MS });
  },
  orphan: () => {
    showToast({ tone: 'warning', title: t('content.updated.title'), subtitle: episodeSubtitle(page.series, page.episode), message: t('content.updated.message') }, { autoHideMs: ALERT_TOAST_MS });
  },
  'shortcut-no-playback': () => {
    showToast({ tone: 'info', title: t('content.shortcut.noPlayback.title'), message: t('content.shortcut.noPlayback.message') }, { autoHideMs: NOTICE_TOAST_MS });
  },
  'shortcut-paused': () => {
    showToast({ tone: 'info', title: t('content.shortcut.paused.title'), message: t('content.shortcut.paused.message') }, { variant: 'bubble', autoHideMs: NOTICE_TOAST_MS });
  },
  'shortcut-excluded': () => {
    showToast({ tone: 'info', badge: 'off', title: t('common.excludedTitle'), subtitle: 'Dandadan', message: t('popup.syncDisabledDetail') }, { variant: 'bubble', autoHideMs: NOTICE_TOAST_MS });
  },
  'rating-prompt': () => showEngagementPrompt({ kind: 'rate', media }),
  'rating-hover': async () => {
    showEngagementPrompt({ kind: 'rate', media });
    await hoverStar();
  },
  'rating-saving': async () => {
    showEngagementPrompt({ kind: 'rate', media });
    const stars = await waitFor(() => shadow()?.querySelectorAll('.stars-row > .star-box'));
    stars[8]?.querySelectorAll('button')[0]?.click();
  },
  'rating-saved': async () => {
    rateResponse = () => Promise.resolve(synced([{ service: 'anilist', outcome: updated(28, true) }, { service: 'mal', outcome: updated(28, true) }]));
    showEngagementPrompt({ kind: 'rate', media });
    const stars = await waitFor(() => shadow()?.querySelectorAll('.stars-row > .star-box'));
    stars[8]?.querySelectorAll('button')[0]?.click();
  },
  'rating-partial': async () => {
    rateResponse = () => Promise.resolve(synced([{ service: 'anilist', outcome: updated(28, true) }, { service: 'mal', outcome: { status: 'error', message: t('api.rateLimited', { service: 'MyAnimeList' }) } }]));
    showEngagementPrompt({ kind: 'rate', media });
    const stars = await waitFor(() => shadow()?.querySelectorAll('.stars-row > .star-box'));
    stars[8]?.querySelectorAll('button')[0]?.click();
  },
  'rewatch-prompt': () => showEngagementPrompt({ kind: 'rewatch', media, progress: 1 }),
  'rewatch-saving': async () => {
    showEngagementPrompt({ kind: 'rewatch', media, progress: 1 });
    await clickIn('.action.primary');
  },
  'rewatch-saved': async () => {
    rewatchResponse = () => Promise.resolve(synced([{ service: 'anilist', outcome: updated(1) }, { service: 'mal', outcome: updated(1) }]));
    showEngagementPrompt({ kind: 'rewatch', media, progress: 1 });
    await clickIn('.action.primary');
  },
  'rewatch-failed': async () => {
    rewatchResponse = () => Promise.resolve({ status: 'error', message: t('error.unexpectedRewatch') });
    showEngagementPrompt({ kind: 'rewatch', media, progress: 1 });
    await clickIn('.action.primary');
  },
};

const name = param('state') ?? 'bubble-saved';
const label = document.querySelector('#state');
if (label) label.textContent = name;
await STATES[name]?.();
// Bulle affichée et entrée jouée ; résultats asynchrones (note, revisionnage) arrivés
await waitFor(() => shadow()?.querySelector('.toast.visible'));
await new Promise((resolve) => setTimeout(resolve, name === 'rating-saving' || name === 'rewatch-saving' ? 150 : 400));
document.documentElement.dataset.toastTitle = shadow()?.querySelector('.title')?.textContent ?? '';
await markReady();
