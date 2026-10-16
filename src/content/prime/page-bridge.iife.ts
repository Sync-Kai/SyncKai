// Script Prime Video du monde principal (MAIN), enregistré à `document_start` : observateur PASSIF des réponses JSON que
// le site demande lui-même (fetch et XMLHttpRequest) : page de détail après une navigation SPA (`/detail/{id}`),
// `getDetailWidgets`, `playerChromeResources` (`catalogMetadataV2` seul) et `GetVodPlaybackResources` (début du générique
// de fin et durée seuls). Il n'émet aucune requête, ne lit aucun en-tête, cookie ni jeton, ne touche à aucune URL de flux
// ni licence : seules les formes réduites (bridge-protocol.ts, platforms/prime/metadata.ts) sont gardées et transmises.
// Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne fonctionne pas dans le monde MAIN. Relevé, canal
// et garde par version : content/bridge/kit.ts. Le monde MAIN appartient à la page : ce qui en sort est une donnée que
// la page aurait pu écrire, revalidée par le client isolé (voir le kit).
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet déjà ouvert à l'activation ou à une
// mise à jour, l'épisode en cours n'est pas identifié ; l'épisode suivant (lecture automatique) l'est.
//
// Indexation par identifiant de la requête, jamais « dernière réponse reçue » : la réponse de lecture de l'épisode
// SUIVANT arrive environ 1 s avant la bascule, pendant que l'épisode précédent est encore à l'écran.
import { reducePrimeDetail, reducePrimeDetailWidgets } from '../../platforms/prime/metadata';
import { keep } from '../../shared/lru';
import { installPassiveBridge } from '../bridge/kit';
import {
  decodePrimeHandshake,
  encodePrimePortOffer,
  encodePrimePush,
  observedPrimeRequest,
  PRIME_BRIDGE_VERSION,
  PRIME_HANDSHAKE_EVENT,
  PRIME_MAX_CATALOG,
  PRIME_MAX_PLAYBACK,
  PRIME_MAX_TITLES,
  PRIME_MAX_WIDGETS,
  PRIME_PORT_OFFER,
  primeBridgeFlag,
  primeObserverKey,
  reducePrimeCatalog,
  reducePrimePlayback,
  type PrimeBridgePush,
  type PrimeCatalogEntry,
  type PrimePlaybackEntry,
  type PrimeRequestKind,
  type PrimeTitleEntry,
  type PrimeWidgetsEntry,
} from './bridge-protocol';

/** Réponse texte au-delà de laquelle rien n'est lu (une page de détail fait quelques centaines de Ko) */
const MAX_RESPONSE_LENGTH = 4_000_000;

/** Vues par identifiant de la requête ; ordre d'insertion = ancienneté */
const catalog = new Map<string, PrimeCatalogEntry>();
const playback = new Map<string, PrimePlaybackEntry>();
const titles = new Map<string, PrimeTitleEntry>();
const widgets: PrimeWidgetsEntry[] = [];

type Delta = Omit<PrimeBridgePush, 'v'>;
const EMPTY: Delta = { catalog: [], playback: [], titles: [], widgets: [] };

/** Message des nouveautés, null s'il n'y en a aucune */
function push(delta: Partial<Delta>): string | null {
  const full = { ...EMPTY, ...delta };
  if (full.catalog.length + full.playback.length + full.titles.length + full.widgets.length === 0) return null;
  return encodePrimePush({
    v: PRIME_BRIDGE_VERSION,
    catalog: full.catalog.slice(-PRIME_MAX_CATALOG),
    playback: full.playback.slice(-PRIME_MAX_PLAYBACK),
    titles: full.titles.slice(-PRIME_MAX_TITLES),
    widgets: full.widgets.slice(-PRIME_MAX_WIDGETS),
  });
}

type Observed = { kind: PrimeRequestKind; id: string };

function onPayload({ kind, id }: Observed, raw: unknown): string | null {
  const seenAt = Date.now();
  switch (kind) {
    case 'catalog': {
      const entry = reducePrimeCatalog(raw, id, seenAt);
      if (!entry) return null;
      keep(catalog, entry.id, entry, PRIME_MAX_CATALOG);
      return push({ catalog: [entry] });
    }
    case 'playback': {
      const entry = reducePrimePlayback(raw, id, seenAt);
      if (!entry) return null;
      keep(playback, entry.id, entry, PRIME_MAX_PLAYBACK);
      return push({ playback: [entry] });
    }
    case 'detail': {
      const title = reducePrimeDetail(raw);
      if (!title) return null;
      const entry: PrimeTitleEntry = { requestId: id, seenAt, title };
      keep(titles, title.seasonGti, entry, PRIME_MAX_TITLES);
      return push({ titles: [entry] });
    }
    case 'widgets': {
      const reduced = reducePrimeDetailWidgets(raw);
      if (!reduced) return null;
      const entry: PrimeWidgetsEntry = { seenAt, widgets: reduced };
      widgets.push(entry);
      if (widgets.length > PRIME_MAX_WIDGETS) widgets.shift();
      return push({ widgets: [entry] });
    }
  }
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour : voir primeBridgeFlag)
installPassiveBridge<Observed>({
  flag: primeBridgeFlag(PRIME_BRIDGE_VERSION),
  observerKey: primeObserverKey,
  handshakeEvent: PRIME_HANDSHAKE_EVENT,
  decodeHandshake: (detail) => decodePrimeHandshake(detail)?.nonce ?? null,
  encodeOffer: (nonce) => encodePrimePortOffer({ v: PRIME_BRIDGE_VERSION, type: PRIME_PORT_OFFER, nonce }),
  observe: observedPrimeRequest,
  onPayload,
  snapshot: () => push({ catalog: [...catalog.values()], playback: [...playback.values()], titles: [...titles.values()], widgets: [...widgets] }),
  maxResponseLength: MAX_RESPONSE_LENGTH,
});
