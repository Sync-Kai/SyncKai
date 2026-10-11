// Comptes AniList / MyAnimeList : état de connexion, connexion, déconnexion et suivi du stockage.
// Partagé par le popup (écran principal + Réglages) et le panneau latéral (Réglages) : chacun crée
// son contrôleur, le stockage (storage.onChanged) garde les deux vues alignées.
import { t } from '../i18n';
import { isAniListViewer, type ViewerErrorCode, type ViewerResult } from '../shared/anilist.types';
import type { AuthResult } from '../shared/auth.types';
import { createLogger } from '../shared/logger';
import { isMalViewer, type MalViewerResult } from '../shared/mal.types';
import { sendMessage } from '../shared/messages';
import { endSession } from '../shared/session-end';
import { getCachedMalViewer, getCachedViewer, getMalToken, getValidToken, hasAniListToken, isSessionExpired, STORAGE_KEYS } from '../shared/storage';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { createStore, LOGGED_OUT, type AccountState, type AniListState, type MalState, type Store } from '../popup/state';

const log = createLogger('accounts');

/** Erreurs qui invalident la session : « Session expirée » + reconnexion */
export const AUTH_ERRORS: ReadonlySet<ViewerErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID']);

const swUnreachable = (): string => t('popup.swUnreachable');

export interface AccountsController {
  readonly anilist: Store<AniListState>;
  readonly mal: Store<MalState>;
  /** Store du service (les deux ne diffèrent que par le type du profil) */
  store(service: TrackerId): Store<AccountState<unknown>>;
  /** Lit les sessions des deux services (cache du profil puis revalidation) */
  bootstrapAll(): Promise<void>;
  login(service: TrackerId): Promise<void>;
  logout(service: TrackerId): Promise<void>;
  /** Rafraîchit le profil depuis l'API (le cache reste affiché) */
  refresh(service: TrackerId): Promise<void>;
  /** Session invalidée (token refusé) : « Session expirée » + reconnexion */
  markExpired(service: TrackerId): void;
}

export function createAccountsController(): AccountsController {
  const anilist = createStore<AniListState>({ status: 'loading' });
  const mal = createStore<MalState>({ status: 'loading' });

  function store(service: TrackerId): Store<AccountState<unknown>> {
    // Les transitions génériques manipulent les deux stores de la même façon
    return (service === 'anilist' ? anilist : mal) as Store<AccountState<unknown>>;
  }

  async function refresh(service: TrackerId): Promise<void> {
    let result: ViewerResult | MalViewerResult;
    try {
      result = service === 'anilist' ? await sendMessage('GET_VIEWER', null) : await sendMessage('GET_MAL_VIEWER', null);
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      result = { ok: false, code: 'NETWORK', message: swUnreachable() };
    }

    if (!result.ok && AUTH_ERRORS.has(result.code)) {
      markExpired(service);
      return;
    }

    if (service === 'anilist') {
      const current = anilist.get();
      if (current.status !== 'logged-in') return; // Déconnecté entre-temps
      anilist.set(result.ok && isAniListViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
    } else {
      const current = mal.get();
      if (current.status !== 'logged-in') return;
      mal.set(result.ok && isMalViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
    }
  }

  function markExpired(service: TrackerId): void {
    store(service).set({ ...LOGGED_OUT, expired: true });
  }

  async function loadCachedViewer(service: TrackerId): Promise<void> {
    if (service === 'anilist') anilist.set({ status: 'logged-in', viewer: await getCachedViewer(), error: null });
    else mal.set({ status: 'logged-in', viewer: await getCachedMalViewer(), error: null });
  }

  async function login(service: TrackerId): Promise<void> {
    const target = store(service);
    const before = target.get();
    const expired = before.status === 'logged-out' && before.expired;
    target.set({ status: 'logged-out', pending: true, error: null, expired });

    let result: AuthResult;
    try {
      result = await sendMessage(service === 'anilist' ? 'LOGIN_ANILIST' : 'LOGIN_MAL', null);
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      result = { ok: false, code: 'UNKNOWN', message: swUnreachable() };
    }

    if (!result.ok) {
      log.warn(`Échec de connexion ${TRACKER_LABELS[service]} :`, result.code, result.message);
      target.set({ status: 'logged-out', pending: false, error: result.message, expired });
      return;
    }

    // Le service worker a déjà préchargé le profil après l'OAuth
    await loadCachedViewer(service);
    const state = target.get();
    if (state.status === 'logged-in' && !state.viewer) await refresh(service);
  }

  async function logout(service: TrackerId): Promise<void> {
    const target = store(service);
    try {
      // Plus aucun service connecté (un token AniList seulement expiré compte encore) : données de l'utilisateur effacées
      await endSession(service);
      target.set(LOGGED_OUT);
    } catch (error: unknown) {
      log.error(`Échec de la déconnexion ${TRACKER_LABELS[service]} :`, error);
      const current = target.get();
      if (current.status === 'logged-in') target.set({ ...current, error: t('popup.logoutFailed') });
    }
  }

  async function bootstrap(service: TrackerId): Promise<void> {
    const target = store(service);
    try {
      // MAL : token présent, même expiré (le service worker le renouvellera)
      const token = service === 'anilist' ? await getValidToken() : await getMalToken();
      if (!token) {
        // Token AniList présent mais expiré, ou session invalidée en arrière-plan (AUTH-03) : « Reconnecter » plutôt que l'accueil
        const expired = (service === 'anilist' && (await hasAniListToken())) || (await isSessionExpired(service));
        target.set({ ...LOGGED_OUT, expired });
        return;
      }
      await loadCachedViewer(service);
      await refresh(service);
    } catch (error: unknown) {
      log.error('Lecture du stockage impossible :', error);
      target.set({ ...LOGGED_OUT, error: t('popup.sessionReadFailed') });
    }
  }

  function onTokenChange(service: TrackerId, change: chrome.storage.StorageChange | undefined): void {
    if (!change) return;
    const target = store(service);
    const state = target.get();
    const hasToken = change.newValue !== undefined;
    if (!hasToken && state.status === 'logged-in') {
      target.set(LOGGED_OUT);
      void showExpiredIfInvalidated(service);
    } else if (hasToken && state.status === 'logged-out' && !state.pending) void bootstrap(service);
  }

  /**
   * Token supprimé par le service worker (refusé, renouvellement impossible) : l'indicateur, écrit avant la
   * suppression, donne « Session expirée » au lieu de « Non connecté » (AUTH-03). Absent après une déconnexion volontaire.
   */
  async function showExpiredIfInvalidated(service: TrackerId): Promise<void> {
    try {
      if (!(await isSessionExpired(service))) return;
    } catch (error: unknown) {
      log.error('Lecture du stockage impossible :', error);
      return;
    }
    const target = store(service);
    const state = target.get();
    if (state.status === 'logged-out' && !state.pending && !state.expired) target.set({ ...state, expired: true });
  }

  // La vue se ferme souvent pendant l'OAuth, et le service worker peut invalider une session : on suit le stockage
  chrome.storage.onChanged.addListener((changes, areaName): void => {
    if (areaName !== 'local') return;
    onTokenChange('anilist', changes[STORAGE_KEYS.anilistToken]);
    onTokenChange('mal', changes[STORAGE_KEYS.malToken]);

    const viewerChange = changes[STORAGE_KEYS.anilistViewer];
    const anilistState = anilist.get();
    if (viewerChange && anilistState.status === 'logged-in' && isAniListViewer(viewerChange.newValue)) {
      anilist.set({ ...anilistState, viewer: viewerChange.newValue });
    }
    const malViewerChange = changes[STORAGE_KEYS.malViewer];
    const malState = mal.get();
    if (malViewerChange && malState.status === 'logged-in' && isMalViewer(malViewerChange.newValue)) {
      mal.set({ ...malState, viewer: malViewerChange.newValue });
    }
  });

  return {
    anilist,
    mal,
    store,
    bootstrapAll: async () => {
      await Promise.all(TRACKER_IDS.map(bootstrap));
    },
    login,
    logout,
    refresh,
    markExpired,
  };
}
