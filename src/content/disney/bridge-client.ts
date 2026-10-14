// Client du pont Disney+, côté script de contenu isolé : reçoit du script du monde MAIN (page-bridge.iife.ts) les
// fiches `playerExperience` observées sur un canal privé (MessageChannel, voir bridge-protocol.ts), revalidées une à
// une. `load` attend la fiche de la vidéo de l'URL (bornée dans le temps, annulable) : la requête du site peut arriver
// après le démarrage de la session (navigation SPA, lecture automatique de l'épisode suivant).
//
// L'URL (/play/{id}) porte l'identifiant de l'épisode, que la fiche contient en général (décodé de `infoBlock`). À
// défaut de correspondance après `matchWaitMs`, la seule fiche reçue depuis le changement d'URL est retenue ; plusieurs
// fiches (ambiguïté) ou aucune : vidéo non suivie.
//
// Pages de série : `loadPage` attend la page de l'entité de l'URL (/browse/entity-{uuid}), sans délai propre (borné par
// l'appelant au moyen de `signal`) ; les réponses `season/{id}` observées ensuite la mettent à jour.
//
// Générique de fin : `loadEditorial` attend la fiche, puis (borné par `waitMs`) ses repères éditoriaux, joints
// par le pont quand la réponse de lecture du lecteur arrive (en général juste après `playerExperience`).
import {
  decodeDisneyPortOffer,
  decodeDisneyPush,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_ID_REGEX,
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_IDS,
  DISNEY_MAX_PAGES,
  encodeDisneyHandshake,
  hasDisneyId,
  type DisneyEditorial,
  type DisneyPlayerExperience,
  type DisneySeriesPage,
} from './bridge-protocol';

export interface DisneyBridgeClientOptions {
  /** Cible de la demande d'ouverture du canal (document en production, faux document dans les tests) */
  target: EventTarget;
  /** Réception de l'offre de port par `postMessage` (window en production) */
  messages: EventTarget;
  /** Origine attendue de l'offre (location.origin) */
  origin: string;
  /** Attente de l'offre de port : pont absent (accès accordé après le chargement de l'onglet…) au-delà */
  connectTimeoutMs?: number;
  /** Attente d'une fiche portant l'identifiant de l'URL avant le repli sur la seule fiche reçue depuis le changement d'URL */
  matchWaitMs?: number;
  /** Attente maximale d'une fiche une fois le canal ouvert, puis de ses repères éditoriaux (`loadEditorial`) */
  waitMs?: number;
  cacheSize?: number;
  /** Nonces d'ouverture */
  newId?: () => string;
  /**
   * Événement émis par le navigateur (vrai postMessage) et non par `dispatchEvent` d'un script de la page.
   * Défaut : `event.isTrusted` ; remplacé dans les tests (Node : toujours faux).
   */
  isTrusted?: (event: Event) => boolean;
  /**
   * Journal de diagnostic (debug, build de développement) : appels retirés du script publié (`__SYNCKAI_DEBUG__`, budget
   * de taille), messages construits seulement en développement
   */
  log?: (message: string) => void;
}

export interface DisneyBridgeClient {
  /**
   * Fiche de la vidéo dont l'URL porte `urlId` : celle qui contient cet identifiant ; à défaut, après `matchWaitMs`, la
   * seule fiche reçue depuis `since` (ms, changement d'URL), retenue ensuite pour cet identifiant. Null si le pont est
   * absent, si aucune fiche ne convient avant `waitMs`, si plusieurs fiches sont candidates, ou si `signal` est annulé.
   */
  load(urlId: string, signal: AbortSignal, since: number): Promise<DisneyPlayerExperience | null>;
  /** Lecture synchrone du cache, sans attente */
  peek(urlId: string): DisneyPlayerExperience | null;
  /**
   * Repères éditoriaux (générique de fin) de la vidéo `urlId` : fiche attendue comme `load`, puis ses repères jusqu'à
   * `waitMs`. Null sans fiche, sans réponse de lecture dans le délai, ou si `signal` est annulé.
   */
  loadEditorial(urlId: string, signal: AbortSignal, since: number): Promise<DisneyEditorial | null>;
  /** Page de série de l'entité `entityId` : en cache, sinon attendue jusqu'à son arrivée ; null si pont absent ou `signal` annulé */
  loadPage(entityId: string, signal: AbortSignal): Promise<DisneySeriesPage | null>;
  /** Page de série en cache, sans attente */
  peekPage(entityId: string): DisneySeriesPage | null;
  /** Pages de série en cache (les plus récentes en dernier) : signaux de la série d'une page de lecture */
  pages(): readonly DisneySeriesPage[];
}

const DEFAULTS = { connectTimeoutMs: 3_000, matchWaitMs: 5_000, waitMs: 20_000, cacheSize: DISNEY_MAX_ENTRIES } as const;

export function createDisneyBridgeClient(options: DisneyBridgeClientOptions): DisneyBridgeClient {
  const { target, messages, origin } = options;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULTS.connectTimeoutMs;
  const matchWaitMs = options.matchWaitMs ?? DEFAULTS.matchWaitMs;
  const waitMs = options.waitMs ?? DEFAULTS.waitMs;
  const cacheSize = options.cacheSize ?? DEFAULTS.cacheSize;
  const newId = options.newId ?? ((): string => crypto.randomUUID());
  const isTrusted = options.isTrusted ?? ((event: Event): boolean => event.isTrusted);
  const log = options.log ?? ((): void => undefined);

  /** Fiches reçues, une par vidéo, de la plus ancienne à la plus récente */
  let entries: DisneyPlayerExperience[] = [];
  /** Pages de série reçues, une par entité (la plus récente remplace la précédente) */
  let pages: DisneySeriesPage[] = [];
  /** Attentes en cours : relues à chaque fiche reçue */
  const listeners = new Set<() => void>();
  let port: MessagePort | null = null;
  let opening: Promise<MessagePort | null> | null = null;

  /** Garde la fiche (remplace celle de la même vidéo : identifiants en commun, réunis) */
  function remember(entry: DisneyPlayerExperience): void {
    const same = entries.filter((known) => known.ids.some((id) => entry.ids.includes(id)));
    const ids = [...new Set([...entry.ids, ...same.flatMap((known) => known.ids)])].slice(0, DISNEY_MAX_IDS);
    entries = [...entries.filter((known) => !same.includes(known)), { ...entry, ids }].slice(-cacheSize);
  }

  function peek(urlId: string): DisneyPlayerExperience | null {
    return entries.findLast((entry) => hasDisneyId(entry, urlId)) ?? null;
  }

  function peekPage(entityId: string): DisneySeriesPage | null {
    const id = entityId.toLowerCase();
    return pages.find((page) => page.entityId === id) ?? null;
  }

  // Le port transféré est aussi visible des écouteurs `message` de la page : un MessageEvent synthétique qu'elle
  // déclencherait sur ce port (dispatchEvent) n'est pas « trusted » et reste ignoré
  function onPortMessage(event: Event): void {
    if (!(event instanceof MessageEvent) || !isTrusted(event)) return;
    const push = decodeDisneyPush(event.data);
    const received = push?.entries ?? [];
    const receivedPages = push?.pages ?? [];
    if (received.length === 0 && receivedPages.length === 0) return;
    for (const entry of received) remember(entry);
    for (const page of receivedPages) pages = [...pages.filter((known) => known.entityId !== page.entityId), page].slice(-DISNEY_MAX_PAGES);
    if (__SYNCKAI_DEBUG__ && received.length > 0) log(`Fiches reçues du pont : ${received.map((entry) => `[${entry.ids.join(', ')}]`).join(' ')}`);
    if (__SYNCKAI_DEBUG__ && receivedPages.length > 0) log(`Pages de série reçues du pont : ${receivedPages.map((page) => page.entityId).join(', ')}`);
    notify();
  }

  /** Relit les attentes en cours */
  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /**
   * Ouvre le canal : demande d'ouverture avec un nonce neuf, puis PREMIER port offert pour ce nonce (les offres
   * suivantes ne sont plus écoutées). Pont absent : null après `connectTimeoutMs`, nouvel essai au prochain `load`.
   */
  function openChannel(): Promise<MessagePort | null> {
    const nonce = newId();
    return new Promise((resolve) => {
      const done = (offered: MessagePort | null): void => {
        clearTimeout(timer);
        messages.removeEventListener('message', onOffer);
        resolve(offered);
      };
      const onOffer = (event: Event): void => {
        // Offre synthétique (dispatchEvent) : elle passerait avant le vrai postMessage du pont → refusée
        if (!(event instanceof MessageEvent) || !isTrusted(event) || event.origin !== origin) return;
        if (decodeDisneyPortOffer(event.data)?.nonce !== nonce) return;
        const [offered] = event.ports;
        if (offered instanceof MessagePort) done(offered);
      };
      const timer = setTimeout(() => done(null), connectTimeoutMs);
      messages.addEventListener('message', onOffer);
      target.dispatchEvent(new CustomEvent(DISNEY_HANDSHAKE_EVENT, { detail: encodeDisneyHandshake({ v: DISNEY_BRIDGE_VERSION, nonce }) }));
    });
  }

  /** Canal ouvert, ou ouverture en cours partagée entre les demandes simultanées */
  function connect(): Promise<MessagePort | null> {
    if (port) return Promise.resolve(port);
    opening ??= openChannel().then((offered) => {
      opening = null;
      if (offered) {
        port = offered;
        offered.addEventListener('message', onPortMessage);
        offered.start(); // Obligatoire avec addEventListener (onmessage le ferait implicitement)
        if (__SYNCKAI_DEBUG__) log('Pont Disney+ connecté');
      } else {
        if (__SYNCKAI_DEBUG__) log('Pont Disney+ absent (onglet ouvert avant l’activation ou la mise à jour ?)');
      }
      return offered;
    });
    return opening;
  }

  /** Fiche portant `id`, sinon (délai de correspondance écoulé) la seule fiche reçue depuis `since` ; undefined : attendre */
  function decide(id: string, since: number, matchExpired: boolean): DisneyPlayerExperience | null | undefined {
    const match = peek(id);
    if (match) {
      if (__SYNCKAI_DEBUG__) log(`Fiche trouvée pour l’URL ${id}`);
      return match;
    }
    if (!matchExpired) return undefined;
    const fresh = entries.filter((entry) => entry.seenAt >= since);
    if (fresh.length > 1) {
      if (__SYNCKAI_DEBUG__) log(`Aucune fiche ne porte l’identifiant ${id}, ${fresh.length} fiches reçues depuis le changement d’URL : vidéo non suivie`);
      return null;
    }
    const [only] = fresh;
    if (!only) return undefined;
    if (__SYNCKAI_DEBUG__) log(`Aucune fiche ne porte l’identifiant ${id} : seule fiche reçue depuis le changement d’URL retenue [${only.ids.join(', ')}]`);
    // Retenue pour cet identifiant : les relectures (popup, fin de l'épisode) la retrouvent directement
    remember({ ...only, ids: [...only.ids.slice(0, DISNEY_MAX_IDS - 1), id] });
    return peek(id);
  }

  async function load(urlId: string, signal: AbortSignal, since: number): Promise<DisneyPlayerExperience | null> {
    if (!DISNEY_ID_REGEX.test(urlId) || signal.aborted) return null;
    const id = urlId.toLowerCase();
    const cached = peek(id);
    if (cached) return cached;
    const channel = await connect();
    if (!channel || signal.aborted) return peek(id);
    let matchExpired = false;
    const matchTimer = setTimeout(() => {
      matchExpired = true;
      notify();
    }, matchWaitMs);
    const entry = await until(() => decide(id, since, matchExpired), signal, waitMs);
    clearTimeout(matchTimer);
    if (__SYNCKAI_DEBUG__ && entry === null && !signal.aborted && !peek(id)) log(`Aucune fiche retenue pour l’URL ${id} : vidéo non suivie`);
    return entry;
  }

  /**
   * Valeur de `get` dès qu'elle est définie (relue à chaque message du pont, et à chaque `notify`) : null (vidéo non
   * suivie) compris ; null aussi si `signal` est annulé ou après `timeoutMs`
   */
  function until<T>(get: () => T | null | undefined, signal: AbortSignal, timeoutMs?: number): Promise<T | null> {
    return new Promise((resolve) => {
      const finish = (value: T | null): void => {
        clearTimeout(timer);
        listeners.delete(check);
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const check = (): void => {
        const value = get();
        if (value !== undefined) finish(value);
      };
      const onAbort = (): void => finish(null);
      const timer = timeoutMs === undefined ? undefined : setTimeout(onAbort, timeoutMs);
      signal.addEventListener('abort', onAbort, { once: true });
      listeners.add(check);
      check();
    });
  }

  async function loadEditorial(urlId: string, signal: AbortSignal, since: number): Promise<DisneyEditorial | null> {
    const entry = await load(urlId, signal, since);
    if (!entry || signal.aborted) return null;
    return entry.editorial ?? until(() => peek(urlId)?.editorial ?? undefined, signal, waitMs);
  }

  async function loadPage(entityId: string, signal: AbortSignal): Promise<DisneySeriesPage | null> {
    if (!DISNEY_ID_REGEX.test(entityId) || signal.aborted) return null;
    const cached = peekPage(entityId);
    if (cached) return cached;
    const channel = await connect();
    if (!channel || signal.aborted) return peekPage(entityId);
    return until(() => peekPage(entityId) ?? undefined, signal);
  }

  return { load, peek, loadEditorial, loadPage, peekPage, pages: () => pages };
}
