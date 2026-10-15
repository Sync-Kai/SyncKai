import { createLogger } from '../../browser/logger';
import { sendMessage } from '../../protocol/messages';
import { effectivePreferredPlayer } from '../../shared/preferred-player';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../../shared/settings';
import { getSettings } from '../../browser/storage/settings-access';
import type { TrackerId } from '../../shared/tracker.types';
import { createPageMediaController, type PageMediaContent, type PageMediaController } from '../../ui/page-media-controller';
import { liveEventRead } from '../now-playing-view';
import { createLiveProgress, type LiveProgress, type LiveTarget } from './live-progress';

const log = createLogger('sidepanel');

// Onglet « En lecture » : fiche de l'onglet suivi par le contrôleur commun (ui/page-media-controller.ts), complétée
// des extras du panneau : détails AniList (GET_PANEL_MEDIA), progression en direct, lecteur préféré, fiche ouverte par
// défaut, synopsis.

export type NowPlayingContent = PageMediaContent<PanelMedia>;

export interface NowPlayingController extends Omit<PageMediaController<PanelMedia>, 'open' | 'redetect' | 'navigated'> {
  /** Lecteur préféré (réglages) : plateforme du bouton « Regarder » des relations */
  readonly preferred: StreamingPlatform;
  /** Réglage « Fiche ouverte par défaut » (avec les deux comptes connectés) : lien du titre, de la jaquette et des relations */
  readonly entryService: TrackerId;
  /** Réglage « Afficher la progression en direct » */
  readonly liveEnabled: boolean;
  readonly live: LiveProgress;
  /** Synopsis déplié (remis à zéro à chaque nouvel épisode) */
  expanded: boolean;
}

/** Contrôleur de l'onglet : `onChange` redessine le panneau */
export function createNowPlayingController(onChange: () => void): NowPlayingController {
  let tabId: number | null = null;
  let expanded = false;
  let preferred: StreamingPlatform = DEFAULT_SETTINGS.preferredPlayer;
  let entryService: TrackerId = DEFAULT_SETTINGS.entryService;
  /** Désactivé, aucun port n'est ouvert vers l'onglet (faux jusqu'à la lecture du réglage) */
  let liveEnabled = false;

  const ctl = createPageMediaController<PanelMedia>({
    onChange,
    onContent: () => live.follow(liveTarget()),
    onPageChange: () => {
      expanded = false;
    },
    loadDetails: (mediaId) => sendMessage('GET_PANEL_MEDIA', { mediaId }),
  });

  // Progression en direct : nouvel épisode annoncé, synchro terminée ou saison choisie dans la page → page relue
  const live = createLiveProgress((event) => {
    const { content } = ctl;
    const read = liveEventRead('page' in content ? content.page : null, event);
    if (read === 'navigate') ctl.navigated();
    else if (read === 'redetect') void ctl.redetect(false);
  });

  /**
   * Port vers la page : épisode de la fiche à suivre en direct (page de lecture, réglage actif), ou page de série (saison
   * choisie dans le menu de la page, quel que soit le réglage : aucune progression n'y est affichée)
   */
  const liveTarget = (): LiveTarget | null => {
    const { content } = ctl;
    const page = 'page' in content ? content.page : null;
    if (tabId === null || !page) return null;
    if (page.kind === 'series') return { tabId, episodeId: null };
    return liveEnabled && page.episode ? { tabId, episodeId: page.episode.episodeId } : null;
  };

  const loadSettings = (): void => {
    getSettings()
      .then(async (settings) => {
        // Lecteur « Netflix » sans l'accès accordé : lecteur par défaut
        const player = await effectivePreferredPlayer(settings.preferredPlayer);
        const playerChanged = player !== preferred;
        const liveChanged = settings.panelLiveProgress !== liveEnabled;
        const entryChanged = settings.entryService !== entryService;
        preferred = player;
        entryService = settings.entryService;
        liveEnabled = settings.panelLiveProgress;
        if (liveChanged) live.follow(liveTarget());
        const { content } = ctl;
        const ready = content.status === 'ready';
        if (liveChanged || (entryChanged && ready) || (playerChanged && ready && content.details?.relations.some((r) => r.platforms.length > 1))) onChange();
      })
      .catch((error: unknown) => {
        log.debug('Réglages illisibles :', error);
        // Réglages illisibles : comportement par défaut (progression en direct affichée)
        if (liveEnabled === DEFAULT_SETTINGS.panelLiveProgress) return;
        liveEnabled = DEFAULT_SETTINGS.panelLiveProgress;
        live.follow(liveTarget());
        onChange();
      });
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SETTINGS_STORAGE_KEY in changes) loadSettings();
  });
  loadSettings();

  return {
    get content() {
      return ctl.content;
    },
    get actions() {
      return ctl.actions;
    },
    get preferred() {
      return preferred;
    },
    get entryService() {
      return entryService;
    },
    get liveEnabled() {
      return liveEnabled;
    },
    live,
    get expanded() {
      return expanded;
    },
    set expanded(value: boolean) {
      expanded = value;
    },
    setTab(next: number | null): void {
      tabId = next;
      ctl.setTab(next);
    },
    refresh: (force) => ctl.refresh(force),
    retry: () => ctl.retry(),
    runAction: (request) => ctl.runAction(request),
    setConfirm: (status) => ctl.setConfirm(status),
    pickSeason: (mediaId) => ctl.pickSeason(mediaId),
  };
}
