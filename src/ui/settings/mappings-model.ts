// Réglages › Synchronisation › Correspondances (maquettes SyncCorrespondances, SyncCorrespondancesEtats) : modèle sans DOM
// de la liste. Groupes par plateforme (préfixe de la clé, platforms/series-identity.ts › mappingKey), du plus fourni au
// moins fourni ; MAPPINGS_GROUP_LIMIT lignes par groupe, les autres derrière « Voir les N autres » ; recherche sur le
// titre de série et celui de la fiche (sans casse ni accents, tous les mots), résultats jamais repliés. Lignes triées par
// titre, les correspondances sans libellé à la fin.
import { t, tp } from '../../i18n';
import { PLATFORMS, STREAMING_PLATFORMS } from '../../platforms/registry';
import { isStreamingPlatform, type StreamingPlatform } from '../../shared/episode.types';
import { mappingOrigin, type MediaMapping } from '../../shared/sync.types';

/** Lignes montrées par groupe avant « Voir les N autres » */
export const MAPPINGS_GROUP_LIMIT = 4;

/** Pastille d'origine : choisie, apprise, ancienne (ni l'une ni l'autre) ou importée d'une sauvegarde, pas encore revérifiée */
export type MappingBadge = 'chosen' | 'learned' | 'unmarked' | 'unverified';

export const MAPPING_BADGES: readonly MappingBadge[] = ['chosen', 'learned', 'unmarked', 'unverified'];

export interface MappingRowModel {
  key: string;
  /** Saison de la plateforme (« Frieren · S1 ») ; clé brute pour une correspondance d'avant la 1.1 */
  title: string;
  /** Fiche AniList où SyncKai écrit, ou « Fiche AniList #id » */
  entry: string;
  url: string;
  /** « 28 ép. · numéro dans la saison, décalage de 11 » */
  meta: string;
  badge: MappingBadge;
}

export interface MappingGroupModel {
  /** Plateforme, ou préfixe brut d'une clé inconnue */
  id: string;
  label: string;
  /** Lignes du groupe retenues par la recherche */
  count: number;
  rows: MappingRowModel[];
  /** Lignes repliées derrière « Voir les N autres » */
  hidden: number;
  /** Bouton « Voir les N autres » / « Masquer » affiché */
  expandable: boolean;
}

export interface MappingsPageModel {
  total: number;
  /** Correspondances retenues par la recherche (toutes sans recherche) */
  matches: number;
  groups: MappingGroupModel[];
}

export function mappingBadge(mapping: MediaMapping): MappingBadge {
  return mapping.unverified === true ? 'unverified' : mappingOrigin(mapping);
}

export function mappingPlatform(key: string): StreamingPlatform | null {
  const prefix = key.split(':', 1)[0];
  return isStreamingPlatform(prefix) ? prefix : null;
}

/** « numéro dans la saison », « numéro affiché, décalage de 11 » */
export function numberingLabel(mapping: MediaMapping): string {
  const source = t(mapping.numbering === 'displayed' ? 'settings.mappings.displayed' : 'settings.mappings.season');
  return mapping.offset !== 0 ? t('settings.mappings.offset', { source, offset: mapping.offset }) : source;
}

/** Texte comparable : minuscules de la langue, sans accents (« AU-DELA » trouve « au-delà ») */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

function toRow(key: string, mapping: MediaMapping): MappingRowModel {
  const episodes = mapping.episodes !== null ? tp('page.episodes', mapping.episodes) : null;
  return {
    key,
    title: mapping.seriesLabel ?? key,
    entry: mapping.mediaTitle ?? t('settings.mappings.entryFallback', { id: mapping.mediaId }),
    url: `https://anilist.co/anime/${mapping.mediaId}`,
    meta: [episodes, numberingLabel(mapping)].filter((part) => part !== null).join(' · '),
    badge: mappingBadge(mapping),
  };
}

/** Rang de la plateforme dans le registre (groupes à égalité), clés inconnues à la fin */
const platformRank = (id: string): number => {
  const index = STREAMING_PLATFORMS.findIndex((platform) => platform === id);
  return index === -1 ? STREAMING_PLATFORMS.length : index;
};

export interface MappingsPageInput {
  query: string;
  /** Groupes dépliés (« Voir les N autres ») */
  expanded: ReadonlySet<string>;
}

export function mappingsPageModel(mappings: readonly (readonly [string, MediaMapping])[], { query, expanded }: MappingsPageInput): MappingsPageModel {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const rows = mappings.map(([key, mapping]) => toRow(key, mapping));
  const kept = searching ? rows.filter((row) => words.every((word) => fold(`${row.title} ${row.entry}`).includes(word))) : rows;

  const byGroup = new Map<string, MappingRowModel[]>();
  for (const row of kept) {
    const id = mappingPlatform(row.key) ?? row.key.split(':', 1)[0] ?? '';
    byGroup.set(id, [...(byGroup.get(id) ?? []), row]);
  }
  const groups = [...byGroup]
    .map(([id, list]): MappingGroupModel => {
      // Correspondances sans libellé (d'avant la 1.1, titre = clé brute) après les autres
      const sorted = [...list].sort((a, b) => Number(a.title === a.key) - Number(b.title === b.key) || a.title.localeCompare(b.title));
      const expandable = !searching && sorted.length > MAPPINGS_GROUP_LIMIT;
      const visible = expandable && !expanded.has(id) ? sorted.slice(0, MAPPINGS_GROUP_LIMIT) : sorted;
      return { id, label: isStreamingPlatform(id) ? PLATFORMS[id].label : id, count: sorted.length, rows: visible, hidden: sorted.length - visible.length, expandable };
    })
    .sort((a, b) => b.count - a.count || platformRank(a.id) - platformRank(b.id));
  return { total: mappings.length, matches: kept.length, groups };
}
