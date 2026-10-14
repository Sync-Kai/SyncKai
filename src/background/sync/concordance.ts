import type { PlatformSignals } from '../../shared/match-signals';
import { normalizeTitle, withoutDiacritics } from '../../shared/title';

// Concordance entre les signaux de la plateforme (année, épisodes, durée, format, titre original, pays) et les fiches
// AniList candidates, par groupe de saison (fiches consécutives qu'une saison de la plateforme peut réunir : Mushoku
// Tensei S2 Netflix = « II » + « II Part 2 »). Règle du propriétaire : « prouvé ou à vérifier ». Une synchro automatique
// sans lien AniList vers la plateforme exige UN seul groupe sans contradiction ET au moins un signal confirmant
// au-delà du titre (année, nombre d'épisodes, titre original). Pur, sans i18n : textes des raisons dans matching.ts.

/** Champs d'une fiche lus ici (MediaCandidate de matching.ts, sans en dépendre : pas de cycle d'imports) */
export interface ConcordanceEntry {
  id: number;
  format: string | null;
  episodes: number | null;
  /** Date de début triable (AAAAMMJJ) */
  startDate: number | null;
  titles: readonly string[];
  endYear?: number | null | undefined;
  status?: string | null | undefined;
  /** Minutes par épisode */
  duration?: number | null | undefined;
  country?: string | null | undefined;
}

/**
 * Groupe de saison évalué : fiches dans l'ordre de diffusion, `chain` = franchise (fiches reliées par suite /
 * préquelle : deux remakes au même titre forment deux franchises), `first` = premier groupe de sa franchise.
 */
export interface SignalGroup<T extends ConcordanceEntry = ConcordanceEntry> {
  entries: readonly T[];
  chain: number;
  first: boolean;
}

export type SignalName = 'format' | 'seasonYear' | 'seriesYear' | 'episodeCount' | 'episodeMinutes' | 'country' | 'originalTitle';

/**
 * - `agree` / `contradict` : le signal confirme / écarte le groupe ;
 * - `weak-agree` : concordance approximative (année à ±1, format série), jamais une preuve ;
 * - `weak-contradict` : indice contraire jamais éliminatoire seul (pays), qui empêche seulement la preuve ;
 * - `unknown` : donnée absente, ou comparaison sans valeur (saison au milieu d'une fiche longue, diffusion en cours).
 */
export type SignalCheck = 'agree' | 'weak-agree' | 'contradict' | 'weak-contradict' | 'unknown';

export type SignalChecks = Partial<Record<SignalName, SignalCheck>>;

export interface GroupVerdict<T extends ConcordanceEntry = ConcordanceEntry> extends SignalGroup<T> {
  checks: SignalChecks;
}

export interface ConcordanceVerdict<T extends ConcordanceEntry = ConcordanceEntry> {
  groups: GroupVerdict<T>[];
  /** Groupes sans contradiction */
  kept: GroupVerdict<T>[];
  /** Groupe gardé le plus confirmé (le plus ancien à égalité), null si tous se contredisent */
  best: GroupVerdict<T> | null;
  /** Un seul groupe gardé, confirmé par l'année, le nombre d'épisodes ou le titre original */
  proven: boolean;
  /** Tous les groupes se contredisent : résultat jamais fiable */
  allContradict: boolean;
}

export interface ConcordanceContext {
  /** Numérotation absolue (One Piece E1180, cumul Netflix) : le nombre d'épisodes de la saison ne contredit rien */
  absolute: boolean;
}

/** Signaux qui prouvent un groupe (au-delà du titre) */
export const PROOF_SIGNALS: readonly SignalName[] = ['seasonYear', 'seriesYear', 'episodeCount', 'originalTitle'];

/** Écart toléré sur le nombre d'épisodes (épisode 0, récapitulatif), comme alignPlatformSeasons */
const COUNT_TOLERANCE = 2;
/** Durée : ±30 % ; format court (< 8 min) contre normal (≥ 20 min) : contradiction */
const DURATION_TOLERANCE = 0.3;
const SHORT_MINUTES = 8;
const NORMAL_MINUTES = 20;
const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
/** Fiche encore ouverte (épisodes à venir) : une saison de la plateforme peut commencer au milieu */
const OPEN_STATUSES = new Set(['RELEASING', 'HIATUS', 'NOT_YET_RELEASED']);

const yearOf = (entry: ConcordanceEntry): number | null => (entry.startDate === null ? null : Math.floor(entry.startDate / 10_000));

function totalEpisodes(entries: readonly ConcordanceEntry[]): number | null {
  let total = 0;
  for (const entry of entries) {
    if (entry.episodes === null) return null;
    total += entry.episodes;
  }
  return total;
}

const isOpen = (entries: readonly ConcordanceEntry[]): boolean => entries.some((e) => OPEN_STATUSES.has(e.status ?? '') || (e.episodes === null && e.status !== 'FINISHED'));

/** Fin de diffusion du groupe (année), null si inconnue */
function endYearOf(entries: readonly ConcordanceEntry[]): number | null {
  const years = entries.flatMap((e) => [e.endYear ?? null, yearOf(e)]).filter((y): y is number => y !== null);
  return years.length > 0 ? Math.max(...years) : null;
}

/**
 * Année de début (saison ou série) comparée au premier épisode du groupe : égale → `agree` ; à un an près → `weak-agree`
 * (rendu contradictoire par concordanceVerdict si un autre groupe tombe juste) ; saison commencée pendant la diffusion
 * du groupe (fiche longue ou en cours : arcs de One Piece) → `unknown` ; sinon `contradict`.
 */
function yearCheck(year: number, entries: readonly ConcordanceEntry[]): SignalCheck {
  const [head] = entries;
  const start = head ? yearOf(head) : null;
  if (start === null) return 'unknown';
  if (start === year) return 'agree';
  const end = endYearOf(entries);
  if (year > start && (isOpen(entries) || (end !== null && year <= end))) return 'unknown';
  return Math.abs(year - start) === 1 ? 'weak-agree' : 'contradict';
}

/**
 * Année de la SÉRIE : comparée au premier groupe de la franchise seulement. Saison suivante : contradiction seulement si
 * la série commence APRÈS elle (ou si le premier groupe de sa franchise est contredit : autre franchise au même titre).
 */
function seriesYearCheck(year: number, group: SignalGroup, firstCheck: SignalCheck | undefined): SignalCheck {
  if (group.first) return yearCheck(year, group.entries);
  if (firstCheck === 'contradict') return 'contradict';
  const [head] = group.entries;
  const start = head ? yearOf(head) : null;
  return start !== null && year > start ? 'contradict' : 'unknown';
}

/**
 * Nombre d'épisodes de la saison contre le total du groupe : ±2 → `agree` ; groupe nettement plus court (et terminé)
 * → `contradict`, sauf numérotation absolue ou saison en cours sur la plateforme ; plateforme plus courte (saison
 * partielle, en cours) ou total inconnu → `unknown`.
 */
function countCheck(count: number, entries: readonly ConcordanceEntry[], airing: boolean, context: ConcordanceContext): SignalCheck {
  const total = totalEpisodes(entries);
  if (total !== null && Math.abs(total - count) <= COUNT_TOLERANCE) return 'agree';
  if (context.absolute || airing || total === null || isOpen(entries)) return 'unknown';
  return count > total + COUNT_TOLERANCE ? 'contradict' : 'unknown';
}

function minutesCheck(minutes: number, entries: readonly ConcordanceEntry[]): SignalCheck {
  const durations = entries.map((e) => e.duration ?? null).filter((d): d is number => d !== null && d > 0);
  if (durations.length === 0) return 'unknown';
  const sorted = [...durations].sort((a, b) => a - b);
  const duration = sorted[Math.floor(sorted.length / 2)] ?? durations[0];
  if (Math.abs(minutes - duration) <= duration * DURATION_TOLERANCE) return 'agree';
  const isShort = (value: number): boolean => value < SHORT_MINUTES;
  const isNormal = (value: number): boolean => value >= NORMAL_MINUTES;
  return (isShort(minutes) && isNormal(duration)) || (isNormal(minutes) && isShort(duration)) ? 'contradict' : 'unknown';
}

/**
 * Format : un film de la plateforme écarte une série de plusieurs épisodes (une ONA d'un épisode publiée comme film,
 * MONSTERS, reste possible) ; une série écarte un film AniList ; un spécial ne contredit jamais rien.
 */
export function formatCheck(format: PlatformSignals['format'], entries: readonly ConcordanceEntry[]): SignalCheck {
  if (format === undefined || format === 'special' || entries.length === 0) return 'unknown';
  const isSeries = entries.every((e) => e.format !== null && SERIES.has(e.format));
  const isMovie = entries.every((e) => e.format === 'MOVIE');
  if (format === 'movie') {
    if (isMovie) return 'weak-agree';
    return isSeries && !entries.every((e) => e.episodes === 1) ? 'contradict' : 'unknown';
  }
  if (isMovie) return 'contradict';
  return isSeries ? 'weak-agree' : 'unknown';
}

/** Pays : même pays → indice ; série chinoise ou coréenne pour une plateforme qui la dit japonaise → indice contraire */
function countryCheck(country: string, entries: readonly ConcordanceEntry[]): SignalCheck {
  const own = entries[0]?.country ?? null;
  if (own === null) return 'unknown';
  if (own === country) return 'weak-agree';
  return country === 'JP' && (own === 'CN' || own === 'KR') ? 'weak-contradict' : 'unknown';
}

/** Clés de comparaison d'un titre original : normalisé (romaji), et brut sans accents (titres japonais, que normalizeTitle vide) */
function titleKeys(title: string): string[] {
  const rawKey = (withoutDiacritics(title) ?? title).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return [normalizeTitle(title), rawKey].filter((key) => key.length > 0);
}

function originalTitleCheck(original: string, entries: readonly ConcordanceEntry[]): SignalCheck {
  const wanted = new Set(titleKeys(original));
  const matches = entries.some((e) => e.titles.some((title) => titleKeys(title).some((key) => wanted.has(key))));
  return matches ? 'agree' : 'unknown';
}

/** Signaux comparés au groupe (`firstCheck` : année de série du premier groupe de la même franchise) */
export function checkGroup(group: SignalGroup, signals: PlatformSignals, context: ConcordanceContext, firstCheck?: SignalCheck): SignalChecks {
  const checks: SignalChecks = {};
  const { entries } = group;
  if (signals.format !== undefined) checks.format = formatCheck(signals.format, entries);
  if (signals.seasonYear !== undefined) checks.seasonYear = yearCheck(signals.seasonYear, entries);
  if (signals.seriesYear !== undefined) checks.seriesYear = seriesYearCheck(signals.seriesYear, group, firstCheck);
  if (signals.seasonEpisodeCount !== undefined) checks.episodeCount = countCheck(signals.seasonEpisodeCount, entries, signals.airing === true, context);
  if (signals.episodeMinutes !== undefined) checks.episodeMinutes = minutesCheck(signals.episodeMinutes, entries);
  if (signals.country !== undefined) checks.country = countryCheck(signals.country, entries);
  if (signals.originalTitle !== undefined) checks.originalTitle = originalTitleCheck(signals.originalTitle, entries);
  return checks;
}

export const contradicts = (checks: SignalChecks): boolean => Object.values(checks).includes('contradict');

/** Signaux qui confirment (preuve) ou contredisent le groupe, dans l'ordre de SignalName */
export function signalsWith(checks: SignalChecks, check: SignalCheck): SignalName[] {
  return (Object.keys(checks) as SignalName[]).filter((name) => checks[name] === check);
}

/** Au moins un signal comparé au groupe (autre que `unknown`) */
export const isApplicable = (checks: SignalChecks): boolean => Object.values(checks).some((check) => check !== 'unknown');

/** Confirmé au-delà du titre (année, épisodes, titre original), sans indice contraire */
export const isConfirmed = (checks: SignalChecks): boolean =>
  PROOF_SIGNALS.some((name) => checks[name] === 'agree') && !Object.values(checks).includes('weak-contradict');

const agreeCount = (checks: SignalChecks): number => Object.values(checks).filter((check) => check === 'agree').length;

/**
 * Verdict sur les groupes de saison. Une année à un an près ne vaut que s'il n'existe aucun groupe exact : sinon le
 * groupe exact l'emporte et l'autre est contredit (Berserk 2016 contre « Berserk 2 », 2017, pour une saison de 2016).
 */
export function concordanceVerdict<T extends ConcordanceEntry>(groups: readonly SignalGroup<T>[], signals: PlatformSignals, context: ConcordanceContext): ConcordanceVerdict<T> {
  const firstChecks = new Map<number, SignalCheck | undefined>();
  for (const group of groups) {
    if (group.first && signals.seriesYear !== undefined) firstChecks.set(group.chain, yearCheck(signals.seriesYear, group.entries));
  }
  const evaluated: GroupVerdict<T>[] = groups.map((group) => ({ ...group, checks: checkGroup(group, signals, context, firstChecks.get(group.chain)) }));
  for (const name of ['seasonYear', 'seriesYear'] as const) {
    if (!evaluated.some((group) => group.checks[name] === 'agree')) continue;
    for (const group of evaluated) if (group.checks[name] === 'weak-agree') group.checks[name] = 'contradict';
  }
  const kept = evaluated.filter((group) => !contradicts(group.checks));
  const [onlyKept] = kept;
  const best = [...kept].sort((a, b) => agreeCount(b.checks) - agreeCount(a.checks))[0] ?? null;
  return {
    groups: evaluated,
    kept,
    best,
    proven: kept.length === 1 && onlyKept !== undefined && isConfirmed(onlyKept.checks),
    allContradict: evaluated.length > 0 && kept.length === 0,
  };
}

/**
 * Correspondance en cache confrontée aux signaux (fiche seule, sans les autres candidats) : signaux qui l'écartent
 * nettement (format, année à plus d'un an hors diffusion, année de série postérieure, durée), dans cet ordre ; vide si
 * elle tient. Le nombre d'épisodes n'est pas comparé : la fiche peut n'être qu'une partie de la saison (« II Part 2 »).
 */
export function contradictingSignals(entry: ConcordanceEntry, signals: PlatformSignals): SignalName[] {
  const entries = [entry];
  const names: SignalName[] = [];
  if (signals.format !== undefined && formatCheck(signals.format, entries) === 'contradict') names.push('format');
  if (signals.seasonYear !== undefined && yearCheck(signals.seasonYear, entries) === 'contradict') names.push('seasonYear');
  const start = yearOf(entry);
  if (signals.seriesYear !== undefined && start !== null && signals.seriesYear > start + 1) names.push('seriesYear');
  if (signals.episodeMinutes !== undefined && minutesCheck(signals.episodeMinutes, entries) === 'contradict') names.push('episodeMinutes');
  return names;
}

/** Premier signal qui écarte la correspondance en cache (voir contradictingSignals), null si elle tient */
export const contradictingSignal = (entry: ConcordanceEntry, signals: PlatformSignals): SignalName | null => contradictingSignals(entry, signals)[0] ?? null;
