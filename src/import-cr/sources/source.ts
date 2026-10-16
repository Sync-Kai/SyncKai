import { t, type MessageKey } from '../../i18n';
import type { CrHistoryErrorCode, CrHistoryResult } from '../../platforms/crunchyroll/history';
import { PLATFORMS } from '../../platforms/registry';
import type { ImportPlatform } from '../../shared/cr-import';
import { createLogger } from '../../browser/logger';

// Source d'un historique de visionnage (audit 6-P1) : où le lire (onglet, accès), et comment (port vers les lecteurs
// injectés pour Crunchyroll et ADN, onglet piloté d'ici pour Netflix). La page d'import (import-cr.ts) ne connaît que
// cette interface : une nouvelle plateforme est un fichier de plus dans sources/.

const log = createLogger('import-cr');

/** Progression affichée pendant la lecture */
export type ReadProgress =
  /** Crunchyroll / ADN : pages lues, puis saisons dont la numérotation est vérifiée */
  | { kind: 'reading'; pages: number; items: number; lookups: number; lookupsTotal: number }
  /** Netflix : lignes chargées (« Voir plus »), puis titres filtrés sur AniList, puis séries lues sur Netflix */
  | { kind: 'netflix'; phase: 'rows' | 'titles' | 'shows'; done: number; total: number };

/** Fin de la lecture : historique réduit par saison, retour à l'écran de connexion (message, onglet à recharger), ou arrêt */
export type ReadOutcome =
  | { kind: 'done'; history: CrHistoryResult }
  | { kind: 'failed'; error: string | null; reloadTabId: number | null; notice?: string }
  | { kind: 'stopped' };

export interface ReadContext {
  /** « Arrêter », autre lecture ou page fermée : la lecture s'arrête à la prochaine étape (port fermé) */
  signal: AbortSignal;
  progress(progress: ReadProgress): void;
}

export interface HistorySource {
  readonly id: ImportPlatform;
  /** Onglets où l'historique peut être lu (jeton ou session du site) */
  readonly tabPatterns: readonly string[];
  readonly home: string;
  /** Site à ouvrir, cité dans les messages */
  readonly site: string;
  /** Progression affichée au début de la lecture */
  readonly initialProgress: ReadProgress;
  hasAccess(): Promise<boolean>;
  /** À appeler directement dans le clic (Firefox : geste utilisateur sans await préalable) */
  requestAccess(): Promise<boolean>;
  read(tabId: number, ctx: ReadContext): Promise<ReadOutcome>;
}

/** Paramètres des messages qui citent la plateforme et son site */
export function sourceParams(source: Pick<HistorySource, 'id' | 'site'>): { platform: string; site: string } {
  return { platform: PLATFORMS[source.id].label, site: source.site };
}

/** Onglet de la plateforme (chargé de préférence), null s'il n'y en a pas */
export async function findSourceTab(source: Pick<HistorySource, 'tabPatterns'>): Promise<chrome.tabs.Tab | null> {
  try {
    const tabs = await chrome.tabs.query({ url: [...source.tabPatterns] });
    return tabs.find((tab) => tab.id !== undefined && tab.status === 'complete') ?? tabs.find((tab) => tab.id !== undefined) ?? null;
  } catch (error: unknown) {
    log.warn('Recherche de l’onglet de la plateforme impossible :', error);
    return null;
  }
}

const READ_ERRORS: Record<CrHistoryErrorCode, MessageKey> = {
  'logged-out': 'crImport.read.error.logged-out',
  unavailable: 'crImport.read.error.unavailable',
  blocked: 'crImport.read.error.blocked',
  network: 'crImport.read.error.network',
  'wrong-page': 'crImport.read.error.wrong-page',
};

/** Message d'échec de lecture ; ADN : jeton absent ou expiré → se connecter puis recharger la page du site */
export function readErrorText(source: Pick<HistorySource, 'id' | 'site'>, code: CrHistoryErrorCode): string {
  if (source.id === 'adn' && code === 'logged-out') return t('crImport.read.error.adnLoggedOut');
  if (source.id === 'netflix' && code === 'logged-out') return t('crImport.read.error.netflixLoggedOut');
  return t(READ_ERRORS[code], sourceParams(source));
}

/** Attente interrompue par l'arrêt de la lecture */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}
