import { isRecord } from '../../shared/guards';

/** Helpers de lecture communs aux adapters (DOM, JSON-LD, texte). */

/** "12", 12, "12.5" → nombre ; "12,5" (virgule décimale) accepté aussi */
export function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Espaces normalisés ; null pour une valeur absente ou vide */
export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

/** Aplatit un bloc JSON-LD (objet, tableau ou @graph) en liste de nœuds. */
export function flattenJsonLd(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(flattenJsonLd);
  if (!isRecord(data)) return [];
  return Array.isArray(data['@graph']) ? [data, ...data['@graph'].flatMap(flattenJsonLd)] : [data];
}

/** Nœuds JSON-LD de la page ayant le type schema.org demandé (ex : "TVEpisode"). */
export function readJsonLdNodes(type: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      nodes.push(...flattenJsonLd(JSON.parse(script.textContent ?? '')).filter((n) => n['@type'] === type));
    } catch {
      // Bloc JSON-LD invalide : ignoré
    }
  }
  return nodes;
}

export interface LabelGuard {
  /** Vrai si ce libellé a déjà été attribué à un AUTRE épisode (DOM encore celui du précédent) */
  isStale(episodeId: string, key: string | null): boolean;
  remember(episodeId: string, key: string | null): void;
}

/**
 * Garde-fou pour les sources sans identifiant d'épisode (DOM) : après une navigation SPA, la page
 * affiche encore l'épisode précédent pendant un instant. Un libellé ("E1180|titre") déjà vu
 * pour un autre épisode signale donc des données périmées.
 */
export function createLabelGuard(): LabelGuard {
  const owners = new Map<string, string>();
  return {
    isStale(episodeId, key) {
      const owner = key ? owners.get(key) : undefined;
      return owner !== undefined && owner !== episodeId;
    },
    remember(episodeId, key) {
      if (key) owners.set(key, episodeId);
    },
  };
}

/** Clé de libellé d'épisode pour le garde-fou ("1180|Titre"), null sans titre */
export function labelKey(displayedNumber: number | null, title: string | null): string | null {
  return title ? `${displayedNumber ?? '?'}|${title}` : null;
}

// ─── Pages de série (fiche « Sur cette page ») ────────────────────────────

/** "black-clover" → "black clover" : dernier repli pour la recherche AniList (titre absent du DOM) */
export function slugToTitle(slug: string | null): string | null {
  if (!slug) return null;
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Slug mal encodé : utilisé tel quel
  }
  return cleanText(decoded.replace(/[-_]+/g, ' '));
}

/** Verbes d'appel à l'action des titres de page ("Watch …", "Regarder …") retirés par cleanPageTitle */
const CTA_PREFIX_REGEX = /^(?:watch|regarder|schaue?n?|ver|assistir|guarda|stream)\s+/i;
/** Séparateur entre le titre et la mention de la plateforme ("Black Clover - Crunchyroll") */
const TITLE_SEPARATOR_REGEX = /\s+[-–—|]\s+/;

/** Retire un verbe d'appel à l'action en tête de titre ("Watch TOUGEN ANKI" → "TOUGEN ANKI") */
export function stripCtaPrefix(text: string): string {
  return text.replace(CTA_PREFIX_REGEX, '').trim();
}

/**
 * Titre de série tiré d'un titre de page / og:title : les segments qui mentionnent la plateforme
 * ("Watch on Crunchyroll", "ADN") et les verbes d'appel à l'action sont retirés.
 * `platform` : motif reconnaissant la plateforme (ex : /crunchyroll/i).
 */
export function cleanPageTitle(text: string | null, platform: RegExp): string | null {
  const title = cleanText(text);
  if (!title) return null;
  const parts = title.split(TITLE_SEPARATOR_REGEX).filter((part) => !platform.test(part));
  return cleanText(stripCtaPrefix(parts[0] ?? ''));
}

/** Mention de version audio en fin de nom de saison : "(VF)", "(English Dub)", "(Sub)" */
const AUDIO_TAG_REGEX = /\s*\((?:[^)]*\b(?:dub|sub|vf|vostfr|vost|vo|doblaje|synchro|dublado)\b[^)]*)\)\s*$/i;

/** Retire la mention de version audio d'un nom de saison */
export function stripAudioTag(text: string): string {
  return text.replace(AUDIO_TAG_REGEX, '').trim();
}

/** Contenu d'une balise <meta property|name="…"> de la page */
export function readMetaContent(name: string): string | null {
  const meta = document.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`);
  return cleanText(meta?.content);
}
