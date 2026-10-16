// Script Disney+ du monde principal (MAIN), enregistré à `document_start` : observateur PASSIF des réponses
// `playerExperience`, `page/entity-{uuid}`, `season/{id}` et de lecture (`…/playback/…`) que le site demande lui-même
// (XMLHttpRequest ; fetch couvert par précaution). Il n'émet aucune requête, ne lit aucun en-tête ni jeton, ne touche à
// aucune URL de flux : seules les formes réduites (`reduceDisneyPlayerExperience` des 20 dernières fiches, avec les
// repères de `reduceDisneyPlayback`, `reduceDisneySeriesPage` des 10 dernières pages de série) sont gardées et
// transmises au script isolé.
// Aucun chrome.*. Format IIFE (suffixe .iife.ts) : un chargeur ESM ne fonctionne pas dans le monde MAIN. Relevé, canal
// et garde par version : content/bridge/kit.ts.
//
// Le relevé ne voit que les requêtes émises APRÈS son installation : dans un onglet déjà ouvert à l'activation ou à
// une mise à jour (script exécuté après coup), l'épisode en cours n'est pas identifié ; la navigation suivante l'est.
//
// Canal privé (voir bridge-protocol.ts) : à chaque demande d'ouverture, un MessageChannel dont port1 reste dans cette
// fermeture ; les fiches ne partent que sur ces ports. Le monde MAIN appartient à la page (JSON, XHR… redéfinissables) :
// ce qui en sort est une donnée que la page aurait pu écrire, que le client isolé revalide toujours (voir le kit).
//
// Générique de fin : la réponse de lecture du lecteur (`…bamgrid.com/…/playback/…`) est réduite ICI à ses identifiants
// et repères éditoriaux (`reduceDisneyPlayback`) ; URL signées et jetons de droits ne quittent jamais ce relevé. Les
// repères rejoignent la fiche de la même vidéo, qu'elle soit arrivée avant (fiche repoussée) ou après (en attente).
import {
  decodeDisneyHandshake,
  DISNEY_BRIDGE_VERSION,
  DISNEY_HANDSHAKE_EVENT,
  DISNEY_PORT_OFFER,
  disneyBridgeFlag,
  disneyObserverKey,
  encodeDisneyPortOffer,
  encodeDisneyPush,
} from './bridge-protocol';
import {
  applyDisneySeason,
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_PAGES,
  observedRequest,
  reduceDisneyPlayback,
  reduceDisneyPlayerExperience,
  reduceDisneySeriesPage,
  withDisneyPlayback,
  type DisneyPlayback,
  type DisneyPlayerExperience,
  type DisneyRequestKind,
  type DisneySeriesPage,
} from '../../platforms/disney/metadata';
import { keep, trim } from '../../shared/lru';
import { installPassiveBridge } from '../bridge/kit';

/** Réponse texte au-delà de laquelle rien n'est lu (une fiche fait quelques dizaines de Ko) */
const MAX_RESPONSE_LENGTH = 2_000_000;
/** Réponses de lecture réduites gardées */
const MAX_PLAYBACKS = 10;

/** Fiches vues, par identifiant du chemin de la requête ; ordre d'insertion = ancienneté */
const entries = new Map<string, DisneyPlayerExperience>();
/** Pages de série vues, par uuid de l'entité ; ordre d'insertion = ancienneté */
const pages = new Map<string, DisneySeriesPage>();
/** Réponses de lecture réduites, de la plus ancienne à la plus récente */
const playbacks: DisneyPlayback[] = [];

/** Message des fiches et pages, null s'il n'y en a aucune */
function push(list: DisneyPlayerExperience[], pageList: DisneySeriesPage[] = []): string | null {
  if (list.length === 0 && pageList.length === 0) return null;
  return encodeDisneyPush({ v: DISNEY_BRIDGE_VERSION, entries: list.slice(-DISNEY_MAX_ENTRIES), pages: pageList.slice(-DISNEY_MAX_PAGES) });
}

/** Garde la page (la plus récente en dernier, 10 au plus) ; message pour les clients */
function keepPage(page: DisneySeriesPage): string | null {
  keep(pages, page.entityId, page, DISNEY_MAX_PAGES);
  return push([], [page]);
}

type Observed = { kind: DisneyRequestKind; id: string };

/**
 * Réponse reçue pour une requête observée : page de série (réduite), saison (appliquée à la page qui la contient) ou
 * fiche de vidéo (voir onPlayerExperience)
 */
function onPayload({ kind, id }: Observed, raw: unknown): string | null {
  if (kind === 'playback') return onPlayback(raw);
  if (kind === 'player') return onPlayerExperience(id, raw);
  if (kind === 'page') {
    const page = reduceDisneySeriesPage(raw, id, Date.now());
    return page ? keepPage(page) : null;
  }
  for (const page of [...pages.values()].reverse()) {
    const updated = applyDisneySeason(page, id, raw);
    if (updated) return keepPage(updated);
  }
  return null;
}

/** Fiche de vidéo reçue pour la requête `requestId` : réduite, gardée (remplace une fiche de la même vidéo) et poussée aux clients */
function onPlayerExperience(requestId: string, raw: unknown): string | null {
  const reduced = reduceDisneyPlayerExperience(raw, requestId, Date.now());
  if (!reduced) return null;
  // Réponse de lecture déjà reçue (en attente) : repères joints dès maintenant
  const entry = withDisneyPlayback(reduced, playbacks);
  for (const [key, known] of entries) if (known.ids.some((id) => entry.ids.includes(id))) entries.delete(key);
  entries.set(requestId, entry);
  trim(entries, DISNEY_MAX_ENTRIES);
  return push([entry]);
}

/** Réponse de lecture : réduite, gardée, puis jointe aux fiches de la même vidéo déjà vues (fiches repoussées ensemble) */
function onPlayback(raw: unknown): string | null {
  const playback = reduceDisneyPlayback(raw);
  if (!playback) return null;
  playbacks.push(playback);
  if (playbacks.length > MAX_PLAYBACKS) playbacks.shift();
  const updated: DisneyPlayerExperience[] = [];
  for (const [key, known] of entries) {
    const entry = withDisneyPlayback(known, [playback]);
    if (entry === known) continue;
    entries.set(key, entry);
    updated.push(entry);
  }
  return push(updated);
}

// Garde par version (réenregistrement du script, bfcache, réinjection après une mise à jour : voir disneyBridgeFlag)
installPassiveBridge<Observed>({
  flag: disneyBridgeFlag(DISNEY_BRIDGE_VERSION),
  observerKey: disneyObserverKey,
  handshakeEvent: DISNEY_HANDSHAKE_EVENT,
  decodeHandshake: (detail) => decodeDisneyHandshake(detail)?.nonce ?? null,
  encodeOffer: (nonce) => encodeDisneyPortOffer({ v: DISNEY_BRIDGE_VERSION, type: DISNEY_PORT_OFFER, nonce }),
  observe: observedRequest,
  onPayload,
  // Instantané : la requête de l'épisode précède en général l'ouverture du canal
  snapshot: () => push([...entries.values()], [...pages.values()]),
  maxResponseLength: MAX_RESPONSE_LENGTH,
});
