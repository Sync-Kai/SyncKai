import { isRecord } from './guards';
import { PLATFORMS, platformFromHost, STREAMING_PLATFORMS, type StreamingPlatform } from './platforms';
import { toSafeUrl } from './url';
import type { PlatformLink, WatchingEntry } from './watching.types';

// Liens de séries appris en naviguant (fiche AniList → page de la série sur chaque plateforme).
// AniList ne référence presque jamais ADN dans ses externalLinks : sans ces liens, « Ouvrir » ne connaît
// ADN que par l'historique des synchros (5 saisons). Fonctions pures ; l'accès au stockage est dans
// platform-links-store.ts. Rien n'est jamais envoyé à un serveur.

export const PLATFORM_LINKS_KEY = 'platformLinks';
/** Fiches mémorisées au plus (les moins récemment vues sont oubliées en premier) */
export const MAX_PLATFORM_LINKS = 500;

/** Liens appris pour une fiche AniList */
export interface LearnedLinks {
  links: Partial<Record<StreamingPlatform, string>>;
  /** Dernier ajout ou changement d'un lien de la fiche (ms) : sert à l'éviction LRU */
  updatedAt: number;
}

/** Liens appris, indexés par identifiant AniList (clé texte : objet JSON du stockage) */
export type PlatformLinkStore = Record<string, LearnedLinks>;

/** Plateforme SyncKai reconnue dans un lien externe (https uniquement) */
export function platformFromUrl(value: string): StreamingPlatform | null {
  const safe = toSafeUrl(value);
  if (!safe) return null;
  return platformFromHost(new URL(safe).hostname);
}

/**
 * Lien externe AniList → lien de plateforme. Les vieux liens AniList sont souvent en http
 * (« http://www.crunchyroll.com/naruto-shippuden ») : passés en https pour les plateformes SyncKai uniquement,
 * sinon le lien est écarté et « Ouvrir » ignore la plateforme.
 */
export function platformLinkFromExternal(raw: string | null): PlatformLink | null {
  if (!raw) return null;
  let candidate = raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      candidate = url.toString();
    }
  } catch {
    return null;
  }
  const url = toSafeUrl(candidate);
  const platform = url ? platformFromUrl(url) : null;
  return url && platform ? { platform, url } : null;
}

/** Slug d'URL (minuscules, chiffres, tirets) : tout autre caractère rend le lien douteux */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Page de la série sur la plateforme, forme canonique sans préfixe de langue (voir PLATFORMS[…].seriesUrl).
 * null si l'identifiant manque ou n'a pas la forme attendue.
 */
export function platformSeriesUrl(platform: StreamingPlatform, seriesId: string | null, seriesSlug: string | null): string | null {
  const slug = seriesSlug !== null && SLUG.test(seriesSlug.toLowerCase()) ? seriesSlug.toLowerCase() : null;
  return PLATFORMS[platform].seriesUrl(seriesId, slug);
}

/**
 * Clé de série (`${platform}:${seriesId}`, forme de platformSeriesKey) d'un lien de plateforme, null si le lien ne
 * désigne pas la série (page d'épisode Crunchyroll ou Netflix, ancien lien Crunchyroll sans identifiant).
 */
export function seriesKeyFromLink(link: PlatformLink): string | null {
  if (platformFromUrl(link.url) !== link.platform) return null;
  const id = PLATFORMS[link.platform].seriesIdInPath.exec(new URL(link.url).pathname)?.[1];
  return id ? `${link.platform}:${id}` : null;
}

// Mentions de saison / partie / cour en fin de titre : la recherche des plateformes ne les trouve pas
const SEASON_SUFFIX =
  /\s+(?:\(\d{4}\)|(?:the\s+)?final\s+season|\d+(?:st|nd|rd|th)\s+(?:season|cour|part)|(?:season|part|cour|saison|staffel)\s*\d+|s\d+|ii|iii|iv|v|vi)\s*$/i;

/**
 * Titre réduit au nom de l'anime pour la recherche d'une plateforme (retours utilisateur : « Black Clover
 * 2nd Season » ou « BLEACH: Sennen Kessen-hen - Ketsubetsu-tan » ne donnent aucun résultat) :
 * sous-titre après « : » / « - » retiré, puis mentions de saison, de partie et d'année en fin de titre.
 */
export function searchTitle(title: string): string {
  let base = title.trim();
  const cut = base.search(/\s*(?::|\s[-–]\s)/);
  if (cut >= 3) base = base.slice(0, cut);
  // Plusieurs mentions possibles (« Season 2 Part 2 ») : on retire tant que le titre change
  for (let previous = ''; previous !== base; ) {
    previous = base;
    const stripped = base.replace(SEASON_SUFFIX, '').trim();
    if (stripped.length >= 2) base = stripped;
  }
  return capitalizeWords(base);
}

/** « BLEACH », « black clover » → « Bleach », « Black Clover » : majuscule en tête de chaque mot, le reste en minuscules */
function capitalizeWords(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/(^|[\s\-×:/(])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
      // « Hunter x Hunter » : le « x » isolé reste en minuscule
      .replace(/(\s)X(\s)/g, '$1x$2')
  );
}

/** Page de recherche de la plateforme pour un titre (voir PLATFORMS[…].searchUrl) */
export function platformSearchUrl(platform: StreamingPlatform, title: string): string {
  return PLATFORMS[platform].searchUrl(encodeURIComponent(searchTitle(title)));
}

/** Lien stocké valide : https, hôte de la plateforme annoncée */
function validLink(platform: StreamingPlatform, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = toSafeUrl(value);
  return url !== null && platformFromUrl(url) === platform ? url : null;
}

/** Valeur du stockage → liens valides uniquement (entrées illisibles ignorées) */
export function parsePlatformLinkStore(value: unknown): PlatformLinkStore {
  const store: PlatformLinkStore = {};
  if (!isRecord(value)) return store;
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[1-9]\d{0,9}$/.test(key) || !isRecord(entry) || !isRecord(entry.links)) continue;
    if (typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt)) continue;
    const links: LearnedLinks['links'] = {};
    for (const platform of STREAMING_PLATFORMS) {
      const url = validLink(platform, entry.links[platform]);
      if (url) links[platform] = url;
    }
    if (Object.keys(links).length > 0) store[key] = { links, updatedAt: entry.updatedAt };
  }
  return store;
}

/**
 * Mémorise (ou rafraîchit) le lien d'une fiche. Au-delà de MAX_PLATFORM_LINKS fiches, les moins
 * récemment vues sont oubliées. Retourne le nouveau magasin, ou null si le lien était déjà connu
 * (seul l'horodatage changerait : pas d'écriture, donc pas de réveil des écouteurs du stockage).
 */
export function rememberPlatformLink(
  store: PlatformLinkStore,
  mediaId: number,
  link: PlatformLink,
  now: number,
  max: number = MAX_PLATFORM_LINKS,
): PlatformLinkStore | null {
  if (!Number.isInteger(mediaId) || mediaId < 1) return null;
  const url = validLink(link.platform, link.url);
  if (!url) return null;
  const key = String(mediaId);
  const current = store[key];
  if (current?.links[link.platform] === url) return null;

  const next: PlatformLinkStore = { ...store, [key]: { links: { ...current?.links, [link.platform]: url }, updatedAt: now } };
  const keys = Object.keys(next);
  if (keys.length > max) {
    // Éviction LRU : la fiche qui vient d'être apprise n'est jamais retirée
    const oldest = keys.filter((k) => k !== key).sort((a, b) => next[a].updatedAt - next[b].updatedAt);
    for (const stale of oldest.slice(0, keys.length - max)) delete next[stale];
  }
  return next;
}

/** Liens appris d'une fiche (ordre fixe des plateformes) */
export function learnedLinksFor(store: PlatformLinkStore, mediaId: number | null): PlatformLink[] {
  const entry = mediaId === null ? undefined : store[String(mediaId)];
  if (!entry) return [];
  return STREAMING_PLATFORMS.flatMap((platform) => {
    const url = entry.links[platform];
    return url ? [{ platform, url }] : [];
  });
}

/** Fusionne des groupes de liens par ordre de priorité : un seul lien par plateforme, le premier l'emporte */
export function mergePlatformLinks(...groups: readonly (readonly PlatformLink[])[]): PlatformLink[] {
  const merged: PlatformLink[] = [];
  for (const group of groups) {
    for (const link of group) if (!merged.some((l) => l.platform === link.platform)) merged.push(link);
  }
  return merged;
}

/** Plateformes sans lien connu pour une série (proposées en recherche dans le menu « ⋯ ») ; plateformes non `searchable` (Netflix) exclues */
export function platformsWithoutLink(platforms: readonly PlatformLink[]): StreamingPlatform[] {
  return STREAMING_PLATFORMS.filter(
    (platform) => PLATFORMS[platform].searchable && !platforms.some((link) => link.platform === platform),
  );
}

/**
 * Séries affichées complétées par les liens appris (plateformes encore sans lien uniquement) :
 * mise à jour immédiate du popup quand un lien est appris. null si rien ne change.
 */
export function withLearnedLinks<T extends Pick<WatchingEntry, 'mediaId' | 'platforms'>>(entries: readonly T[], store: PlatformLinkStore): T[] | null {
  let changed = false;
  const next = entries.map((entry) => {
    const platforms = mergePlatformLinks(entry.platforms, learnedLinksFor(store, entry.mediaId));
    if (platforms.length === entry.platforms.length) return entry;
    changed = true;
    return { ...entry, platforms };
  });
  return changed ? next : null;
}
