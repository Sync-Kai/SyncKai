// Client du pont Prime Video, côté script de contenu isolé : reçoit du script du monde MAIN (page-bridge.iife.ts), sur un
// canal privé (MessageChannel, voir bridge-protocol.ts), les métadonnées du lecteur, les repères de lecture, les pages de
// détail et les widgets observés, revalidés un à un. Contrairement à Disney+, le canal est ouvert dès le démarrage
// (`start`) : l'URL ne change jamais pendant la lecture (lecteur intégré à la page de détail, lecture automatique
// comprise), seule l'arrivée des métadonnées du lecteur signale l'épisode en cours (`subscribe`).
//
// Tout est indexé par identifiant (entityId, titleId, GTI de saison), jamais « dernière réponse reçue » : la réponse de
// lecture de l'épisode suivant arrive avant la bascule.
import { primeId, type PrimeTitle } from '../../platforms/prime/metadata';
import { keep } from '../../shared/lru';
import { createBridgeConnection, createWaiters, type ChannelEndpoints } from '../bridge/client-kit';
import {
  decodePrimePortOffer,
  decodePrimePush,
  encodePrimeHandshake,
  PRIME_BRIDGE_VERSION,
  PRIME_HANDSHAKE_EVENT,
  PRIME_MAX_CATALOG,
  PRIME_MAX_PLAYBACK,
  PRIME_MAX_TITLES,
  PRIME_MAX_WIDGETS,
  type PrimeCatalogEntry,
  type PrimePlaybackEntry,
  type PrimeWidgetsEntry,
} from './bridge-protocol';

export interface PrimeBridgeClientOptions extends ChannelEndpoints {
  /** Attente de l'offre de port : pont absent au-delà (onglet ouvert avant l'activation ou la mise à jour) */
  connectTimeoutMs?: number;
  /** Attente maximale d'une donnée une fois le canal ouvert */
  waitMs?: number;
  /** Chemin de la page au moment de la réception (location.pathname en production) */
  currentPath?: () => string;
  newId?: () => string;
  /** Journal de diagnostic (appels entourés de `__SYNCKAI_DEBUG__` : retirés du script publié) */
  log?: (message: string) => void;
}

/** Métadonnées du lecteur, avec le chemin de la page à leur réception (la lecture appartient à cette page) */
export interface ReceivedCatalog extends PrimeCatalogEntry {
  path: string;
}

export interface PrimeBridgeClient {
  /** Ouvre le canal (sans attendre) ; sans effet s'il est ouvert ou en cours d'ouverture */
  start(): void;
  /** Appelé à chaque nouveauté reçue du pont ; retourne le désabonnement */
  subscribe(listener: () => void): () => void;
  /** Métadonnées du lecteur pour l'identifiant `id` */
  peekCatalog(id: string): ReceivedCatalog | null;
  /** Dernières métadonnées d'épisode ou de film reçues (vidéo en lecture), null si aucune */
  latestCatalog(): ReceivedCatalog | null;
  /** Repères de lecture de l'identifiant `id` (jamais ceux d'un autre) */
  peekPlayback(id: string): PrimePlaybackEntry | null;
  /** Repères de `id` en cache, sinon attendus jusqu'à `waitMs` ; null si pont absent, délai écoulé ou `signal` annulé */
  loadPlayback(id: string, signal: AbortSignal): Promise<PrimePlaybackEntry | null>;
  /** Pages de détail reçues (réponses `/detail/`), de la plus ancienne à la plus récente */
  titles(): readonly PrimeTitle[];
  /** Page de détail désignée par `id` (identifiant du chemin de la requête, GTI de saison ou GTI compact) */
  peekTitle(id: string): PrimeTitle | null;
  /** Page `id` en cache, sinon attendue jusqu'à `waitMs` (en pratique bornée plus tôt par l'appelant au moyen de `signal`) */
  loadTitle(id: string, signal: AbortSignal): Promise<PrimeTitle | null>;
  /** Widgets reçus, du plus ancien au plus récent */
  widgets(): readonly PrimeWidgetsEntry[];
}

const DEFAULTS = { connectTimeoutMs: 3_000, waitMs: 20_000 } as const;

export function createPrimeBridgeClient(options: PrimeBridgeClientOptions): PrimeBridgeClient {
  const waitMs = options.waitMs ?? DEFAULTS.waitMs;
  const currentPath = options.currentPath ?? ((): string => location.pathname);
  const log = options.log ?? ((): void => undefined);

  const catalog = new Map<string, ReceivedCatalog>();
  const playback = new Map<string, PrimePlaybackEntry>();
  /** Pages par GTI de saison, avec les identifiants de chemin qui y ont mené */
  const titleEntries = new Map<string, { title: PrimeTitle; requestIds: Set<string> }>();
  let widgetEntries: PrimeWidgetsEntry[] = [];
  /** Attentes et abonnés : relus à chaque nouveauté */
  const { notify, subscribe, until } = createWaiters();

  function onPortMessage(data: unknown): void {
    const push = decodePrimePush(data);
    if (!push) return;
    const path = currentPath();
    for (const entry of push.catalog) {
      // Instantané : ancienneté conservée ; une fiche déjà connue garde le chemin de sa première réception
      keep(catalog, entry.id, { ...entry, path: catalog.get(entry.id)?.path ?? path }, PRIME_MAX_CATALOG);
    }
    for (const entry of push.playback) keep(playback, entry.id, entry, PRIME_MAX_PLAYBACK);
    for (const { requestId, title } of push.titles) {
      const requestIds = new Set([...(titleEntries.get(title.seasonGti)?.requestIds ?? []), requestId]);
      keep(titleEntries, title.seasonGti, { title, requestIds }, PRIME_MAX_TITLES);
    }
    widgetEntries = [...widgetEntries, ...push.widgets].slice(-PRIME_MAX_WIDGETS);
    if (__SYNCKAI_DEBUG__) {
      const parts = [
        ...push.catalog.map((entry) => `lecteur ${entry.id} (${entry.type} S${entry.seasonNumber ?? '?'}E${entry.episodeNumber ?? '?'})`),
        ...push.playback.map((entry) => `repères ${entry.id} (générique ${entry.creditsStartMs ?? 'absent'})`),
        ...push.titles.map((entry) => `page ${entry.title.compactGTI ?? entry.title.seasonGti}`),
        ...push.widgets.map((entry) => `widgets (en lecture ${entry.widgets.bestSelf?.gti ?? '?'})`),
      ];
      if (parts.length > 0) log(`Reçu du pont : ${parts.join(', ')}`);
    }
    notify();
  }

  /** Canal privé (content/bridge/client-kit.ts) ; pont absent : null après `connectTimeoutMs`, nouvel essai à la demande suivante */
  const connect = createBridgeConnection({
    endpoints: options,
    event: PRIME_HANDSHAKE_EVENT,
    handshake: (nonce) => encodePrimeHandshake({ v: PRIME_BRIDGE_VERSION, nonce }),
    isOffer: (data, nonce) => decodePrimePortOffer(data)?.nonce === nonce,
    timeoutMs: options.connectTimeoutMs ?? DEFAULTS.connectTimeoutMs,
    newId: options.newId,
    onMessage: onPortMessage,
    onOpen: (port) => {
      if (__SYNCKAI_DEBUG__) log(port ? 'Pont Prime Video connecté' : 'Pont Prime Video absent (onglet ouvert avant l’activation ou la mise à jour ?)');
    },
  });

  const canonical = (id: string): string | null => primeId(id);

  function peekCatalog(id: string): ReceivedCatalog | null {
    const key = canonical(id);
    return key ? (catalog.get(key) ?? null) : null;
  }

  function latestCatalog(): ReceivedCatalog | null {
    let latest: ReceivedCatalog | null = null;
    for (const entry of catalog.values()) if ((entry.type === 'episode' || entry.type === 'movie') && (!latest || entry.seenAt >= latest.seenAt)) latest = entry;
    return latest;
  }

  function peekPlayback(id: string): PrimePlaybackEntry | null {
    const key = canonical(id);
    return key ? (playback.get(key) ?? null) : null;
  }

  async function loadPlayback(id: string, signal: AbortSignal): Promise<PrimePlaybackEntry | null> {
    if (!canonical(id) || signal.aborted) return null;
    const cached = peekPlayback(id);
    if (cached) return cached;
    if (!(await connect()) || signal.aborted) return peekPlayback(id);
    return until(() => peekPlayback(id) ?? undefined, signal, waitMs);
  }

  function peekTitle(id: string): PrimeTitle | null {
    const key = canonical(id);
    if (!key) return null;
    for (const { title, requestIds } of [...titleEntries.values()].reverse()) {
      if (title.seasonGti === key || title.compactGTI === key || requestIds.has(key)) return title;
    }
    return null;
  }

  async function loadTitle(id: string, signal: AbortSignal): Promise<PrimeTitle | null> {
    if (!canonical(id) || signal.aborted) return null;
    const cached = peekTitle(id);
    if (cached) return cached;
    if (!(await connect()) || signal.aborted) return peekTitle(id);
    return until(() => peekTitle(id) ?? undefined, signal, waitMs);
  }

  return {
    start: () => void connect(),
    subscribe,
    peekCatalog,
    latestCatalog,
    peekPlayback,
    loadPlayback,
    titles: () => [...titleEntries.values()].map((entry) => entry.title),
    peekTitle,
    loadTitle,
    widgets: () => widgetEntries,
  };
}
