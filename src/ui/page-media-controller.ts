import { t } from '../i18n';
import { createLogger } from '../shared/logger';
import { sendMessage } from '../shared/messages';
import {
  isCachedPageMedia,
  isPartialEpisodePage,
  matchCachedPageMedia,
  pageKey,
  pageMediaCacheKey,
  readCachedPageMedia,
  storeCachedPageMedia,
} from '../shared/page-media-cache';
import type { PageMediaInfo, PageMediaResult, PageMediaView } from '../shared/page-media.types';
import type { ListStatusChange } from '../shared/sync.types';
import { errorFeedback } from './feedback';
import { mediaActionKey, runMediaAction, type MediaActionRequest } from './media-action-requests';
import type { MediaActionsState } from './media-actions';
import { PAGE_MEDIA_RETRY_DELAYS_MS, requestPageMedia } from './page-media-request';
import type { InlineFeedback } from './state';

// « Fiche de la page » (ARCH-05) : machine d'état sans rendu, commune à la carte « Sur cette page » du popup et à
// l'onglet « En lecture » du panneau. Lecture de la page de l'onglet, cache de l'onglet, RESOLVE_PAGE_MEDIA, actions
// (une à la fois), choix de la saison, minuteries et anti-écho. Chaque écran ne garde que son rendu et ses extras
// (panneau : détails AniList, progression en direct ; popup : relecture de « En cours » après une action).

const log = createLogger('page-media');

export type PageMediaContent<D> =
  /** Aucun onglet suivi (hors Crunchyroll / ADN / Netflix) */
  | { status: 'idle' }
  /** Interrogation du script de contenu (relecture demandée ou premier affichage) */
  | { status: 'detecting' }
  /** Page de la plateforme sans série (accueil, catalogue…) ; `unreachable` : script de contenu muet (orphelin) */
  | { status: 'no-page'; unreachable: boolean }
  | { status: 'loading'; page: PageMediaInfo }
  /**
   * Aucune fiche AniList (`NOT_FOUND`) ; `untracked` : série ignorée ou Netflix désactivé (`NOT_TRACKED`), rien à
   * suivre ni à vérifier. Même message dans les deux écrans (celui du service worker).
   */
  | { status: 'not-found'; page: PageMediaInfo; message: string; untracked: boolean }
  | { status: 'error'; page: PageMediaInfo; message: string }
  /**
   * `details` : données propres à l'écran (panneau : fiche AniList complète), null tant qu'elles ne sont pas chargées
   * (`detailsError` renseigné en cas d'échec) ; toujours null sans chargeur (popup). `refreshing` : relecture en cours, fiche affichée.
   */
  | { status: 'ready'; page: PageMediaInfo; view: PageMediaView; details: D | null; detailsError: string | null; refreshing: boolean };

export type DetailsResult<D> = { ok: true; data: D } | { ok: false; message: string };

export interface PageMediaControllerOptions<D> {
  /** État changé (fiche ou actions) : l'écran redessine */
  onChange: () => void;
  /** Fiche changée (appelé avant `onChange`) : panneau, progression en direct de l'épisode affiché */
  onContent?: (content: PageMediaContent<D>) => void;
  /** Nouvel épisode ou nouvelle page : état d'affichage propre à l'écran remis à zéro (synopsis replié) */
  onPageChange?: () => void;
  /** Détails chargés après la fiche (panneau : GET_PANEL_MEDIA), gardés tant que la fiche ne change pas */
  loadDetails?: (mediaId: number) => Promise<DetailsResult<D>>;
  /** Action terminée (popup : relecture de « En cours ») */
  onActionDone?: () => void;
}

export interface PageMediaController<D> {
  readonly content: PageMediaContent<D>;
  readonly actions: MediaActionsState;
  /** Onglet suivi, page relue (null : aucun) ; rappelé à chaque navigation de l'onglet (panneau) */
  setTab(tabId: number | null): void;
  /** Onglet dont la page est déjà lue (popup : lecture faite à l'ouverture) : fiche résolue sans nouvelle lecture */
  open(tabId: number, page: PageMediaInfo): void;
  /** Relit la page de l'onglet ; `force` : relecture demandée (bouton Actualiser), squelette compris */
  refresh(force: boolean): Promise<void>;
  /**
   * Relit la page sans repasser par le squelette ; recalcule la fiche si la page a changé, ou toujours avec
   * `reresolve` (synchro terminée : la correspondance mémorisée prime sur la saison devinée).
   */
  redetect(reresolve: boolean): Promise<void>;
  /** Recharge la fiche de la page affichée sans cache (« Réessayer ») */
  retry(): void;
  runAction(request: MediaActionRequest): Promise<void>;
  /** Ouvre / ferme la confirmation Abandonner / Terminé ; false si rien n'a changé */
  setConfirm(status: ListStatusChange | null): boolean;
  /** Saison choisie dans le sélecteur : enregistrée comme correspondance par le service worker (ARCH-20) */
  pickSeason(mediaId: number): void;
}

/** Retour d'action affiché (un échec reste deux fois plus longtemps : texte à lire) */
export const PAGE_FEEDBACK_MS = 4_000;
/** Page de lecture lue sans ses données structurées : nouvelles lectures en arrière-plan */
const PARTIAL_RECHECK_MS: readonly number[] = [2_500, 5_000, 10_000];
/** Relecture demandée pendant un chargement ou une action : réessayée après ce délai */
const FOLLOW_UP_RETRY_MS = 1_000;

const NO_ACTIONS: MediaActionsState = { busy: null, confirm: null, feedback: null };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DetectOptions {
  /** Faux : détection abandonnée (autre onglet, relecture plus récente) */
  isCurrent?: () => boolean;
  /** Premier signe de vie du script de contenu (popup : bouton « Ouvrir le panneau » sans attendre la fin) */
  onReached?: () => void;
}

/**
 * Série / épisode de l'onglet, en quelques essais (la page peut être en cours de rendu). Une page de lecture lue
 * sans ses données structurées (JSON-LD pas encore là) n'est gardée qu'en dernier recours. null : script joignable
 * mais page sans série (accueil, catalogue) ou détection abandonnée ; `unreachable` : script muet à chaque essai.
 */
export async function detectPageMedia(tabId: number, { isCurrent = () => true, onReached }: DetectOptions = {}): Promise<PageMediaInfo | null | 'unreachable'> {
  let reached = false;
  let partial: PageMediaInfo | null = null;
  for (const wait of PAGE_MEDIA_RETRY_DELAYS_MS) {
    if (wait > 0) await delay(wait);
    if (!isCurrent()) return null;
    const response = await requestPageMedia(tabId);
    if (response === 'unreachable') continue;
    if (!reached) {
      reached = true;
      onReached?.();
    }
    if (response === null) continue;
    if (!isPartialEpisodePage(response)) return response;
    partial = response;
  }
  return partial ?? (reached ? null : 'unreachable');
}

const pageOf = <D>(content: PageMediaContent<D>): PageMediaInfo | null => ('page' in content ? content.page : null);

export function createPageMediaController<D = never>(options: PageMediaControllerOptions<D>): PageMediaController<D> {
  const { onChange, onContent, onPageChange, loadDetails, onActionDone } = options;
  let tabId: number | null = null;
  let content: PageMediaContent<D> = { status: 'idle' };
  let actions: MediaActionsState = NO_ACTIONS;
  /** Saison choisie dans le sélecteur pour la page affichée (renvoyée à chaque résolution de cette page) */
  let manualId: number | null = null;
  let run = 0;
  /** `run` de la détection de page en cours (refresh / redetect), null sinon */
  let detectingRun: number | null = null;
  /** Mode (`fresh`) de la dernière résolution lancée : repris si elle est relancée après avoir été annulée */
  let lastFresh = false;
  /**
   * Rechargement de la fiche dû même si la page relue n'a pas changé : `fresh` (action terminée pendant une
   * détection, cache ignoré) ou `cache` (fiche réécrite ailleurs). Consommé par la prochaine résolution.
   */
  let pendingReload: 'fresh' | 'cache' | null = null;
  /** Incrémenté à chaque remise à zéro des actions (autre onglet, autre page) : le retour d'une action plus ancienne est ignoré */
  let actionEpoch = 0;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  /** Relectures d'une page partielle : épisode concerné et nombre d'essais déjà faits */
  let recheck: { episodeId: string | null; count: number } = { episodeId: null, count: 0 };
  let recheckTimer: ReturnType<typeof setTimeout> | undefined;
  let followUpTimer: ReturnType<typeof setTimeout> | undefined;
  /** Horodatage de la dernière fiche écrite par cet écran dans le cache de l'onglet (son propre écho est ignoré) */
  let lastWrittenAt: number | null = null;

  // Fiche de l'onglet réécrite ailleurs (synchro par le service worker, action dans l'autre écran) : appliquée tout de suite
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || tabId === null) return;
    const entry: unknown = changes[pageMediaCacheKey(tabId)]?.newValue;
    if (!isCachedPageMedia(entry) || entry.resolvedAt === lastWrittenAt) return;
    void redetect(true);
  });

  const set = (next: PageMediaContent<D>): void => {
    content = next;
    onContent?.(content);
    onChange();
  };
  const patchActions = (patch: Partial<MediaActionsState>): void => {
    actions = { ...actions, ...patch };
    onChange();
  };
  /** Autre onglet ou autre page : actions, confirmation et retour oubliés ; une action encore en vol ne touchera plus à rien */
  const resetActions = (): void => {
    actionEpoch++;
    clearTimeout(feedbackTimer);
    actions = NO_ACTIONS;
  };
  /** Nouvelle page (ou nouvel épisode) affichée : saison choisie, actions et état d'affichage oubliés */
  const leavePage = (): void => {
    manualId = null;
    resetActions();
    onPageChange?.();
  };

  function showFeedback(feedback: InlineFeedback): void {
    clearTimeout(feedbackTimer);
    patchActions({ feedback });
    feedbackTimer = setTimeout(() => patchActions({ feedback: null }), feedback.tone === 'success' ? PAGE_FEEDBACK_MS : PAGE_FEEDBACK_MS * 2);
  }

  // ─── Lecture de la page ───────────────────────────────────────────────

  /**
   * Détection suivie : `detectingRun` reste posé jusqu'à la reprise de l'appelant, qui décide aussitôt
   * (sans attente) de la résolution à lancer ; une action qui se termine entre-temps ne peut pas s'intercaler.
   */
  async function detectTracked(current: number, id: number): Promise<PageMediaInfo | null | 'unreachable'> {
    detectingRun = current;
    const page = await detectPageMedia(id, { isCurrent: () => current === run });
    if (detectingRun === current) detectingRun = null;
    return page;
  }

  /** Page partielle : relue plus tard (essais limités par épisode) jusqu'à obtenir l'épisode complet */
  function scheduleRecheck(page: PageMediaInfo): void {
    clearTimeout(recheckTimer);
    const episodeId = page.episode?.episodeId ?? null;
    if (recheck.episodeId !== episodeId) recheck = { episodeId, count: 0 };
    if (!isPartialEpisodePage(page)) return;
    const wait = PARTIAL_RECHECK_MS[recheck.count];
    if (wait === undefined) return;
    recheck.count++;
    recheckTimer = setTimeout(() => void redetect(false), wait);
  }

  /**
   * Fiche stable : ni chargement de la fiche ni de ses détails en cours. Une résolution annulée par une
   * relecture laisse la fiche instable (squelette, « Actualisation » ou détails en attente) : elle doit être relancée.
   */
  const contentSettled = (): boolean =>
    content.status === 'not-found' ||
    content.status === 'error' ||
    (content.status === 'ready' && !content.refreshing && (!loadDetails || content.details !== null || content.detailsError !== null));

  /** Fiche stable et aucune action en cours : une relecture peut la remplacer */
  const settled = (): boolean => actions.busy === null && contentSettled();

  async function redetect(reresolve: boolean): Promise<void> {
    clearTimeout(followUpTimer);
    const id = tabId;
    if (id === null) return;
    if (!settled()) {
      // Chargement ou action en cours : la relecture est reportée, jamais perdue
      if (content.status !== 'idle' && content.status !== 'no-page') followUpTimer = setTimeout(() => void redetect(reresolve), FOLLOW_UP_RETRY_MS);
      return;
    }
    const current = ++run;
    // Rechargement dû même si cette relecture est annulée par une autre (refresh) : celle-ci le reprendra
    if (reresolve) pendingReload ??= 'cache';
    const page = await detectTracked(current, id);
    if (current !== run || !page || page === 'unreachable') return;
    const known = pageOf(content);
    scheduleRecheck(page);
    const samePage = known !== null && pageKey(known) === pageKey(page);
    if (pendingReload === null && samePage) return;
    if (known?.episode?.episodeId !== page.episode?.episodeId) leavePage();
    await resolve(page, true, samePage && pendingReload === 'fresh');
  }

  /** Lit la page de l'onglet et recharge la fiche si elle a changé (`force` : relecture demandée) */
  async function refresh(force: boolean): Promise<void> {
    const id = tabId;
    if (id === null) return;
    // Annule toute résolution en cours : relancée plus bas si la page n'a pas changé
    const current = ++run;
    const known = pageOf(content);
    if (!known || force) set({ status: 'detecting' });
    const page = await detectTracked(current, id);
    if (current !== run) return;
    if (!page || page === 'unreachable') {
      set({ status: 'no-page', unreachable: page === 'unreachable' });
      return;
    }
    scheduleRecheck(page);
    const samePage = known !== null && pageKey(known) === pageKey(page);
    const stable = contentSettled() && content.status !== 'error' && pendingReload === null;
    // Même page déjà affichée et stable (fin de chargement, retour d'onglet) : rien à recharger
    if (!force && samePage && stable) return;
    if (!samePage) {
      leavePage();
      await resolve(page, false, force);
      return;
    }
    // Même page dont la résolution vient d'être annulée (ou rendue caduque par une action) : relancée, fiche gardée
    const fresh = force || pendingReload === 'fresh' || (!contentSettled() && lastFresh);
    await resolve(page, !force && content.status === 'ready', fresh);
  }

  // ─── Fiche ────────────────────────────────────────────────────────────

  /** Fiche prête, puis ses détails (gardés si la fiche affichée est la même) */
  async function showReady(current: number, page: PageMediaInfo, view: PageMediaView): Promise<void> {
    const previous = content.status === 'ready' && content.view.media.mediaId === view.media.mediaId ? content.details : null;
    set({ status: 'ready', page, view, details: previous, detailsError: null, refreshing: false });
    if (!loadDetails || previous) return;
    let details: D | null = null;
    let detailsError: string | null = null;
    try {
      const result = await loadDetails(view.media.mediaId);
      if (result.ok) details = result.data;
      else detailsError = result.message;
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      detailsError = t('popup.swUnreachable');
    }
    if (current !== run) return;
    set({ status: 'ready', page, view, details, detailsError: details ? null : detailsError, refreshing: false });
  }

  /** Fiche de l'onglet en cache (popup, synchro, panneau) valable pour cette page */
  async function cachedView(id: number, page: PageMediaInfo): Promise<PageMediaView | null> {
    try {
      return matchCachedPageMedia(await readCachedPageMedia(id), page, Date.now())?.view ?? null;
    } catch (error: unknown) {
      log.debug('Cache de la fiche illisible :', error);
      return null;
    }
  }

  async function requestView(page: PageMediaInfo, mediaId: number | null): Promise<PageMediaResult> {
    try {
      return await sendMessage('RESOLVE_PAGE_MEDIA', { page, mediaId });
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      return { ok: false, code: 'NETWORK', message: t('popup.swUnreachable') };
    }
  }

  /**
   * Résout la fiche de la page : cache de l'onglet d'abord (même fiche que l'autre écran et la synchro), sinon
   * RESOLVE_PAGE_MEDIA. `silent` : la fiche reste affichée ; `fresh` : cache ignoré (après une action, « Actualiser »).
   * `onFailure` : relecture silencieuse en échec (la fiche précédente reste affichée).
   */
  async function resolve(page: PageMediaInfo, silent: boolean, fresh = false, onFailure?: () => void): Promise<void> {
    const current = ++run;
    const id = tabId;
    lastFresh = fresh;
    pendingReload = null;
    const shown = content.status === 'ready' && pageKey(content.page) === pageKey(page) ? content : null;
    if (silent && content.status === 'ready') set({ ...content, refreshing: true });
    else set({ status: 'loading', page });
    if (!fresh && manualId === null && id !== null) {
      const view = await cachedView(id, page);
      if (current !== run) return;
      if (view) {
        // Saison choisie dans l'autre écran (page de série, ou épisode hors de la saison) : reprise pour les relectures
        if (view.source === 'manual') manualId = view.media.mediaId;
        await showReady(current, page, view);
        return;
      }
    }
    const result = await requestView(page, manualId);
    if (current !== run) return;
    if (result.ok) {
      if (id !== null) {
        storeCachedPageMedia(id, page, result.data, 'resolve')
          .then((entry) => {
            if (entry) lastWrittenAt = entry.resolvedAt;
          })
          .catch((error: unknown) => log.debug('Fiche non mise en cache :', error));
      }
      await showReady(current, page, result.data);
    } else if (result.code === 'NOT_FOUND' || result.code === 'NOT_TRACKED') {
      set({ status: 'not-found', page, message: result.message, untracked: result.code === 'NOT_TRACKED' });
    } else if (silent && shown) {
      // Relecture en échec : la fiche précédente reste affichée, l'erreur passe en retour d'action
      set({ ...shown, refreshing: false });
      onFailure?.();
      showFeedback(errorFeedback(result.message));
    } else {
      set({ status: 'error', page, message: result.message });
    }
  }

  // ─── Actions (mêmes messages dans les deux écrans) ────────────────────

  async function runAction(request: MediaActionRequest): Promise<void> {
    if (actions.busy !== null || content.status !== 'ready') return;
    const { page, view } = content;
    const epoch = actionEpoch;
    patchActions({ busy: mediaActionKey(request), confirm: null });
    const feedback = await runMediaAction(request, view, (error) => log.warn('Service worker injoignable :', error));
    onActionDone?.();
    // Onglet ou page changés pendant l'envoi : la fiche affichée n'est plus celle de l'action, son retour est ignoré
    if (epoch !== actionEpoch) return;
    patchActions({ busy: null });
    showFeedback(feedback);
    // Relecture de la page en cours (navigation dans l'onglet) : c'est elle qui rechargera la fiche, sans cache.
    // Une résolution de l'ancienne page l'annulerait et afficherait la fiche quittée.
    if (detectingRun === run) {
      pendingReload = 'fresh';
      return;
    }
    // Même onglet et même épisode (sinon `actionEpoch` aurait changé) : page affichée, éventuellement relue entre-temps
    await resolve(pageOf(content) ?? page, true, true);
  }

  return {
    get content() {
      return content;
    },
    get actions() {
      return actions;
    },
    setTab(next: number | null): void {
      const changed = next !== tabId;
      tabId = next;
      if (changed || next === null) {
        clearTimeout(recheckTimer);
        clearTimeout(followUpTimer);
      }
      // Autre onglet : l'action en cours sur l'onglet quitté ne doit rien afficher ici
      if (changed) resetActions();
      if (next === null) {
        run++;
        content = { status: 'idle' };
        onContent?.(content);
        return;
      }
      void refresh(changed);
    },
    open(next: number, page: PageMediaInfo): void {
      tabId = next;
      clearTimeout(recheckTimer);
      clearTimeout(followUpTimer);
      leavePage();
      scheduleRecheck(page);
      void resolve(page, false);
    },
    refresh,
    redetect,
    retry(): void {
      const page = pageOf(content);
      if (!page) return;
      void resolve(page, content.status === 'ready', true);
    },
    runAction,
    setConfirm(status: ListStatusChange | null): boolean {
      if (actions.busy !== null || actions.confirm === status) return false;
      patchActions({ confirm: status });
      return true;
    },
    pickSeason(mediaId: number): void {
      if (actions.busy !== null || content.status !== 'ready') return;
      const previous = manualId;
      manualId = mediaId;
      actions = { ...actions, confirm: null, feedback: null };
      // Échec (réseau) : la saison affichée reste la précédente, le choix n'est pas gardé pour les relectures suivantes
      void resolve(content.page, true, false, () => {
        if (manualId === mediaId) manualId = previous;
      });
    },
  };
}
