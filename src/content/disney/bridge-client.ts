// Client du pont Disney+, côté script de contenu isolé : reçoit du script du monde MAIN (page-bridge.iife.ts) les
// fiches `playerExperience` observées sur un canal privé (MessageChannel, voir bridge-protocol.ts), revalidées une à
// une. `load` attend la fiche de la vidéo de l'URL (bornée dans le temps, annulable) : la requête du site peut arriver
// après le démarrage de la session (navigation SPA, lecture automatique de l'épisode suivant).
//
// L'URL (/play/{id}) porte l'identifiant de l'épisode, que la fiche contient en général (décodé de `infoBlock`). À
// défaut de correspondance après `matchWaitMs`, la seule fiche reçue depuis le changement d'URL est retenue ; plusieurs
// fiches (ambiguïté) ou aucune : vidéo non suivie.
import {
  decodeDisneyPortOffer,
  decodeDisneyPush,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_ID_REGEX,
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_IDS,
  encodeDisneyHandshake,
  hasDisneyId,
  type DisneyPlayerExperience,
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
  /** Attente maximale d'une fiche, une fois le canal ouvert */
  waitMs?: number;
  cacheSize?: number;
  /** Nonces d'ouverture */
  newId?: () => string;
  /**
   * Événement émis par le navigateur (vrai postMessage) et non par `dispatchEvent` d'un script de la page.
   * Défaut : `event.isTrusted` ; remplacé dans les tests (Node : toujours faux).
   */
  isTrusted?: (event: Event) => boolean;
  /** Journal de diagnostic (debug, build de développement) */
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

  // Le port transféré est aussi visible des écouteurs `message` de la page : un MessageEvent synthétique qu'elle
  // déclencherait sur ce port (dispatchEvent) n'est pas « trusted » et reste ignoré
  function onPortMessage(event: Event): void {
    if (!(event instanceof MessageEvent) || !isTrusted(event)) return;
    const received = decodeDisneyPush(event.data)?.entries ?? [];
    if (received.length === 0) return;
    for (const entry of received) remember(entry);
    log(`Fiches reçues du pont : ${received.map((entry) => `[${entry.ids.join(', ')}]`).join(' ')}`);
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
        log('Pont Disney+ connecté');
      } else {
        log('Pont Disney+ absent (onglet ouvert avant l’activation ou la mise à jour ?)');
      }
      return offered;
    });
    return opening;
  }

  /** Fiche portant `id`, sinon (délai de correspondance écoulé) la seule fiche reçue depuis `since` ; undefined : attendre */
  function decide(id: string, since: number, matchExpired: boolean): DisneyPlayerExperience | null | undefined {
    const match = peek(id);
    if (match) {
      log(`Fiche trouvée pour l’URL ${id}`);
      return match;
    }
    if (!matchExpired) return undefined;
    const fresh = entries.filter((entry) => entry.seenAt >= since);
    if (fresh.length > 1) {
      log(`Aucune fiche ne porte l’identifiant ${id}, ${fresh.length} fiches reçues depuis le changement d’URL : vidéo non suivie`);
      return null;
    }
    const [only] = fresh;
    if (!only) return undefined;
    log(`Aucune fiche ne porte l’identifiant ${id} : seule fiche reçue depuis le changement d’URL retenue [${only.ids.join(', ')}]`);
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
    return new Promise((resolve) => {
      let matchExpired = false;
      const finish = (entry: DisneyPlayerExperience | null): void => {
        clearTimeout(matchTimer);
        clearTimeout(timer);
        listeners.delete(check);
        signal.removeEventListener('abort', onAbort);
        resolve(entry);
      };
      const check = (): void => {
        const entry = decide(id, since, matchExpired);
        if (entry !== undefined) finish(entry);
      };
      const onAbort = (): void => finish(null);
      const matchTimer = setTimeout(() => {
        matchExpired = true;
        check();
      }, matchWaitMs);
      const timer = setTimeout(() => {
        log(`Aucune fiche reçue pour l’URL ${id} : vidéo non suivie`);
        finish(null);
      }, waitMs);
      signal.addEventListener('abort', onAbort, { once: true });
      listeners.add(check);
      check();
    });
  }

  return { load, peek };
}
