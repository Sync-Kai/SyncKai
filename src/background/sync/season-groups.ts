import { normalizeTitle } from './matching';

// Saisons découpées en plusieurs fiches AniList (cours) : « Part 2 », « 2nd Cour », « Cour 2 », « 第2クール »…
// Crunchyroll regroupe généralement ces parties dans une seule saison (Mushoku Tensei « Season 2 » = « II » + « II Part 2»).

const ROMAN: Readonly<Record<string, number>> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** Séparateurs tolérés avant le marqueur : " Part 2", ": Part 2", " - Part 2", " (Part 2)", " ～第2クール～" */
const LEAD = String.raw`[\s:：\-–—~～(（\[]*`;
const TRAIL = String.raw`\s*[)）\]~～]?\s*$`;

/**
 * Marqueurs de partie en fin de titre (titre brut, avant normalisation : les caractères japonais
 * seraient perdus). Le groupe 1 capture le numéro de la partie.
 */
const COUR_MARKERS: readonly RegExp[] = [
  // "Part 2", "Part II", "Part.2", "Cour 2"
  new RegExp(String.raw`${LEAD}\b(?:part|cour)\s*\.?\s*(\d+|[ivx]+)${TRAIL}`, 'i'),
  // "2nd Part", "2nd Cour"
  new RegExp(String.raw`${LEAD}\b(\d+)\s*(?:st|nd|rd|th)\s+(?:part|cour)${TRAIL}`, 'i'),
  // "第2クール", "第2部" (chiffres pleine chasse acceptés)
  new RegExp(String.raw`${LEAD}第\s*([0-9０-９]+)\s*(?:クール|部)${TRAIL}`),
];

function toPartNumber(raw: string): number | null {
  const ascii = raw.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).toLowerCase();
  const value = /^\d+$/.test(ascii) ? Number.parseInt(ascii, 10) : (ROMAN[ascii] ?? null);
  return value !== null && value >= 1 && value <= 10 ? value : null;
}

/**
 * Retire un marqueur de partie final : "Mushoku Tensei II: … Part 2" → { base: "mushoku tensei ii …", part: 2 }.
 * "Season 2 Part 2" → base "… season 2". null si le titre ne se termine pas par un marqueur.
 */
export function stripCourMarker(title: string): { base: string; part: number } | null {
  for (const marker of COUR_MARKERS) {
    const match = marker.exec(title);
    const part = match ? toPartNumber(match[1] ?? '') : null;
    if (!match || part === null) continue;
    const base = normalizeTitle(title.slice(0, match.index));
    if (base) return { base, part };
  }
  return null;
}

/** Clés de référence d'une fiche : titres normalisés, avec et sans marqueur de partie */
function referenceKeys(titles: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const title of titles) {
    const key = normalizeTitle(title);
    if (key) keys.add(key);
    const stripped = stripCourMarker(title);
    if (stripped) keys.add(stripped.base);
  }
  return keys;
}

/**
 * Vrai si `entry` prolonge la saison des fiches de référence : l'un de ses titres porte un marqueur
 * de partie ≥ 2 et, sans ce marqueur, correspond à un titre d'une fiche de référence.
 * Prudent : une suite sans marqueur de partie ("II", "Season 2", "2nd Season", "Final Season") n'est jamais rattachée.
 */
function continuesSeason(entry: readonly string[], references: readonly (readonly string[])[]): boolean {
  const keys = new Set(references.flatMap((titles) => [...referenceKeys(titles)]));
  return entry.some((title) => {
    const stripped = stripCourMarker(title);
    return stripped !== null && stripped.part >= 2 && keys.has(stripped.base);
  });
}

/**
 * Regroupe les fiches d'une série (ordre de diffusion, voir seasonPool) en saisons :
 * une fiche « Part 2 » / « Cour 2 » rejoint la saison de la fiche précédente ou de la première fiche de cette saison.
 * Ex. Mushoku Tensei : [S1, S1 Part 2, II, II Part 2, III, III Part 2] → 3 saisons de 2 fiches.
 * Limite : seule la saison en cours de constitution est comparée (une partie diffusée après une autre saison
 * liée, ou titrée sans marqueur reconnu, forme une saison à part).
 */
export function groupSeasons<T extends { titles: readonly string[] }>(pool: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (const entry of pool) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (current && previous && continuesSeason(entry.titles, [current[0].titles, previous.titles])) {
      current.push(entry);
    } else {
      groups.push([entry]);
    }
  }
  return groups;
}
