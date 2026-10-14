// Attribution d'un texte affiché aux chaînes des catalogues (contrôle de mise en page des langues,
// scripts/e2e/i18n-layout.e2e.ts). Module pur, sans DOM ni Node : chargé dans la page de test par layout-probe.ts et
// testé en unitaire (layout-text.test.ts).
//
// Principe : un texte coupé n'est signalé que s'il vient d'un catalogue (traduction) et qu'il déborde encore une fois
// les données de démo (titres, pseudos, commentaires…) remplacées par « X ». Un titre d'anime tronqué par une ellipse
// est voulu ; un libellé traduit tronqué, non.

/** Textes d'un catalogue (clé → modèle avec `{param}`) */
export type CatalogEntries = Readonly<Record<string, string>>;

/** Remplaçant d'une donnée de démo dans le texte « catalogue seul » */
export const DATA_TOKEN = 'X';

/** Paramètres imbriqués suivis au plus (`{label}: {value}` dont `label` est lui-même traduit) */
const MAX_DEPTH = 2;

/**
 * Séparateurs posés par le code entre deux textes traduits (« Détaillées · À l'heure ») : un texte sans modèle qui
 * l'explique en entier est découpé à ces endroits
 */
const SEPARATORS = / [·•|—–›] /u;
const SEPARATOR_SPLIT = /( [·•|—–›] )/u;

const LETTER = /\p{L}/gu;
const PLACEHOLDER = /\{\w+\}/u;

/** Espaces de toutes sortes (insécables, fines, sans chasse) ramenées à une espace simple, extrémités retirées */
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/[\s​]+/gu, ' ').trim();
}

export function countLetters(text: string): number {
  return text.match(LETTER)?.length ?? 0;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Template {
  key: string;
  /** Morceaux fixes du modèle (en minuscules), entre les paramètres */
  literals: readonly string[];
  /** Morceau fixe le plus long : préfiltre rapide (`includes`) avant l'expression régulière */
  anchor: string;
  regex: RegExp;
  letters: number;
}

export interface CatalogIndex {
  /** Texte exact (minuscules) → clés */
  exact: ReadonlyMap<string, readonly string[]>;
  templates: readonly Template[];
  /** Résultats déjà calculés (mêmes textes d'un écran et d'une largeur à l'autre) */
  memo: Map<string, TextAttribution | null>;
}

/** Index d'un catalogue : textes sans paramètre par valeur exacte, modèles en expressions régulières ancrées */
export function indexCatalog(entries: CatalogEntries): CatalogIndex {
  const exact = new Map<string, string[]>();
  const templates: Template[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    const value = normalizeText(raw);
    if (!value) continue;
    if (!PLACEHOLDER.test(value)) {
      const lower = value.toLowerCase();
      exact.set(lower, [...(exact.get(lower) ?? []), key]);
      continue;
    }
    const literals = value.split(/\{\w+\}/u).map((part) => part.toLowerCase());
    const anchor = literals.reduce((longest, part) => (part.trim().length > longest.length ? part.trim() : longest), '');
    // Paramètres non vides, au plus court ; indices des captures (`d`) pour reconstruire le texte
    const source = literals.map(escapeRegExp).join('([\\s\\S]+?)');
    templates.push({ key, literals, anchor, regex: new RegExp(`^${source}$`, 'diu'), letters: countLetters(literals.join('')) });
  }
  return { exact, templates, memo: new Map() };
}

/** Part d'un texte expliquée par le catalogue */
export interface TextAttribution {
  /** Clés qui expliquent le texte, la plus englobante d'abord (sous-textes traduits ensuite) */
  keys: string[];
  /** Texte avec chaque donnée de démo remplacée par DATA_TOKEN : ce qui reste quand les données sont courtes */
  catalogOnly: string;
  /** Lettres apportées par le catalogue (parties fixes des modèles, sous-textes traduits) */
  letters: number;
  /** Données de démo remplacées */
  data: number;
}

/**
 * Donnée de démo : texte qui contient l'une des chaînes connues, ou morceau d'au moins 5 caractères de l'une d'elles
 * (titre raccourci par le code), casse ignorée. Large exprès : une donnée prise pour du texte fixe ferait signaler une
 * troncature voulue.
 */
export function createDataMatcher(dataStrings: readonly string[]): (fragment: string) => boolean {
  const known = [...new Set(dataStrings.map((s) => normalizeText(s).toLowerCase()).filter((s) => s.length >= 3))];
  return (fragment) => {
    const lower = normalizeText(fragment).toLowerCase();
    if (!lower) return false;
    return known.some((data) => lower.includes(data) || (lower.length >= 5 && data.includes(lower)));
  };
}

/** Paramètre d'un modèle : sous-texte traduit, donnée de démo (remplacée) ou valeur gardée telle quelle (nombre, date, plateforme) */
function attributeCapture(capture: string, index: CatalogIndex, isData: (fragment: string) => boolean, depth: number): { text: string; letters: number; data: number; keys: string[] } {
  const nested = depth < MAX_DEPTH ? attributeTextAt(capture, index, isData, depth + 1) : null;
  if (nested && nested.letters > 0) return { text: nested.catalogOnly, letters: nested.letters, data: nested.data, keys: nested.keys };
  if (isData(capture)) return { text: DATA_TOKEN, letters: 0, data: 1, keys: [] };
  return { text: capture, letters: 0, data: 0, keys: [] };
}

function bestTemplate(text: string, index: CatalogIndex, isData: (fragment: string) => boolean, depth: number): TextAttribution | null {
  const lower = text.toLowerCase();
  let best: TextAttribution | null = null;
  /** Lettres propres (hors paramètres) du modèle retenu : départage un modèle générique (« {label} : {value} ») */
  let bestOwn = -1;
  for (const template of index.templates) {
    if (template.anchor && !lower.includes(template.anchor)) continue;
    const match = template.regex.exec(text);
    if (!match?.indices) continue;
    let letters = template.letters;
    let data = 0;
    const keys = [template.key];
    // Reconstruction de droite à gauche : chaque paramètre remplacé par sa version « catalogue seul »
    let rebuilt = text;
    for (let i = match.length - 1; i >= 1; i--) {
      const range = match.indices[i];
      const capture = match[i];
      if (!range || capture === undefined) continue;
      const part = attributeCapture(capture, index, isData, depth);
      letters += part.letters;
      data += part.data;
      keys.push(...part.keys);
      rebuilt = rebuilt.slice(0, range[0]) + part.text + rebuilt.slice(range[1]);
    }
    // Le plus précis l'emporte : le plus de lettres venues du catalogue, puis le modèle le plus spécifique (texte fixe
    // le plus long : « Bölüm {episode}: {delay} sonra » plutôt que « {label}: {value} » rempli de deux sous-textes),
    // puis le moins de données remplacées
    const better =
      !best || letters > best.letters || (letters === best.letters && (template.letters > bestOwn || (template.letters === bestOwn && data < best.data)));
    if (better) {
      best = { keys, catalogOnly: rebuilt, letters, data };
      bestOwn = template.letters;
    }
  }
  return best;
}

/** Texte assemblé par le code (« Texte A · Texte B ») : chaque morceau expliqué à part */
function bySegments(text: string, index: CatalogIndex, isData: (fragment: string) => boolean, depth: number): TextAttribution | null {
  if (!SEPARATORS.test(text)) return null;
  const pieces = text.split(SEPARATOR_SPLIT);
  let letters = 0;
  let data = 0;
  const keys: string[] = [];
  const rebuilt = pieces.map((piece, i) => {
    // Indices impairs : séparateurs capturés
    if (i % 2 === 1 || !piece.trim()) return piece;
    const part = attributeCapture(piece, index, isData, depth);
    letters += part.letters;
    data += part.data;
    keys.push(...part.keys);
    return part.text;
  });
  return letters > 0 ? { keys, catalogOnly: rebuilt.join(''), letters, data } : null;
}

/** Au-delà, un texte n'est pas attribué (bloc entier plutôt qu'un libellé ; évite les retours arrière coûteux) */
const MAX_TEXT_LENGTH = 400;

function attributeTextAt(raw: string, index: CatalogIndex, isData: (fragment: string) => boolean, depth: number): TextAttribution | null {
  const text = normalizeText(raw);
  if (!text || text.length > MAX_TEXT_LENGTH) return null;
  const memoKey = `${depth}\u0000${text}`;
  const known = index.memo.get(memoKey);
  if (known !== undefined) return known;
  const exactKeys = index.exact.get(text.toLowerCase());
  let result: TextAttribution | null = exactKeys ? { keys: [...exactKeys], catalogOnly: text, letters: countLetters(text), data: 0 } : null;
  if (!result) {
    const template = bestTemplate(text, index, isData, depth);
    result = template && template.letters > 0 ? template : depth < MAX_DEPTH ? bySegments(text, index, isData, depth) : null;
  }
  // Aucune lettre venue du catalogue (« {label} : {value} » sur un titre) : pas une chaîne du catalogue
  if (result && result.letters === 0) result = null;
  index.memo.set(memoKey, result);
  return result;
}

/**
 * Part du catalogue dans un texte affiché : texte exact d'une clé, modèle dont les paramètres ont été remplis (titres,
 * nombres, dates…, sous-textes traduits compris) ou textes traduits joints par « · ». null : aucune lettre du texte ne
 * vient du catalogue (titre d'anime, pseudo, date seule, nom de langue).
 */
export function attributeText(text: string, index: CatalogIndex, isData: (fragment: string) => boolean): TextAttribution | null {
  return attributeTextAt(text, index, isData, 0);
}

const isUrlLike = (text: string): boolean => /^(?:[a-z][\w+.-]*:|\/|www\.)/i.test(text) || text.includes('://');
/** Identifiants et valeurs d'énumération des données (`CURRENT`, `next-episode`, `anilist:21`) : jamais affichés tels quels */
const isIdentifier = (text: string): boolean => /^[A-Z0-9_]+$/.test(text) || /^[a-z0-9_:.\-]+$/.test(text);

/**
 * Chaînes affichables des données de démo (titres, pseudos, commentaires, libellés de saison…) relevées dans des objets
 * quelconques : adresses, identifiants, énumérations et textes de catalogue (`isCatalogText`) écartés
 */
export function collectDataStrings(values: readonly unknown[], isCatalogText: (text: string) => boolean): string[] {
  const found = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 12) return;
    if (typeof value === 'string') {
      const text = normalizeText(value);
      if (text.length >= 3 && countLetters(text) > 0 && !isUrlLike(text) && !isIdentifier(text) && !isCatalogText(text)) found.add(text);
      return;
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, depth + 1);
  };
  for (const value of values) visit(value, 0);
  return [...found].sort();
}
