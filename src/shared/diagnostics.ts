import { tl, type Locale } from '../i18n';
import type { AiringCheckResult } from './airing.types';
import { redactSecrets, type JournalEntry } from './error-journal';
import { isRecord } from './guards';
import type { SyncSettings } from './settings';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from './tracker.types';

// Rapport de diagnostic (Réglages › Aide) : fonctions pures, testées. La collecte des données
// se fait dans diagnostics-store.ts. Le rapport ne contient jamais de token ni de nom de compte.

export const ISSUES_NEW_URL = 'https://github.com/Sync-Kai/SyncKai/issues/new';
/** Longueur maximale de l'URL de signalement (limite pratique des navigateurs / GitHub) */
export const MAX_ISSUE_URL_LENGTH = 2000;
const MAX_BROWSER_LENGTH = 120;
/** Titre prérempli, complété par l'utilisateur */
const ISSUE_TITLE = '[Bug] ';

export type BuildMode = 'development' | 'production';

export interface DiagnosticsCounters {
  mappings: number;
  excludedSeries: number;
  pendingReviews: number;
  queuePending: number;
  queueFailed: number;
  pendingRatings: number;
  recentSyncs: number;
}

export interface DiagnosticsInput {
  generatedAt: number;
  version: string;
  buildMode: BuildMode;
  /** Navigateur lisible (voir describeBrowser) */
  browser: string;
  uiLocale: Locale;
  browserLanguage: string;
  settings: SyncSettings;
  /** Services connectés : oui / non seulement */
  services: Readonly<Record<TrackerId, boolean>>;
  counters: DiagnosticsCounters;
  airing: AiringCheckResult | null;
  journal: readonly JournalEntry[];
  /** Valeurs à masquer partout (tokens, noms de compte) : expurgation défensive */
  sensitiveValues: readonly string[];
}

/** « Google Chrome 129 · Windows » depuis navigator.userAgentData, sinon l'user agent brut (tronqué) */
export function describeBrowser(userAgentData: unknown, userAgent: string): string {
  if (isRecord(userAgentData) && Array.isArray(userAgentData.brands)) {
    const brands = userAgentData.brands
      .filter(isRecord)
      .map((b) => ({ brand: typeof b.brand === 'string' ? b.brand : '', version: typeof b.version === 'string' ? b.version : '' }))
      // Marques « GREASE » (ex : "Not)A;Brand") ignorées ; Chromium seulement si rien de plus précis
      .filter((b) => b.brand && !/not.?a.?brand/i.test(b.brand));
    const main = brands.find((b) => b.brand !== 'Chromium') ?? brands[0];
    if (main) {
      const platform = typeof userAgentData.platform === 'string' && userAgentData.platform ? ` · ${userAgentData.platform}` : '';
      return `${main.brand} ${main.version}${platform}`.slice(0, MAX_BROWSER_LENGTH);
    }
  }
  return (userAgent || 'unknown').slice(0, MAX_BROWSER_LENGTH);
}

function iso(ms: number): string {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : String(ms);
}

function formatSettingValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value) ?? 'null';
}

function journalLine(entry: JournalEntry, sensitive: readonly string[]): string {
  // Expurgation répétée (défense en profondeur) ; les ``` casseraient le bloc de code
  const message = redactSecrets(entry.message, sensitive).replace(/\r?\n/g, ' ↵ ').replace(/```/g, "'''");
  return `${iso(entry.at)} ${entry.level.toUpperCase().padEnd(5)} [${redactSecrets(entry.scope, sensitive)}] ${message}`;
}

/** Rapport Markdown (en anglais : destiné aux mainteneurs, quelle que soit la langue de l'interface) */
export function buildDiagnosticsReport(input: DiagnosticsInput): string {
  const sensitive = input.sensitiveValues;
  const clean = (text: string): string => redactSecrets(text, sensitive);
  const c = input.counters;
  const airing = input.airing;

  const lines: string[] = [
    '## SyncKai diagnostic report',
    '',
    `- Generated: ${iso(input.generatedAt)}`,
    `- Version: ${clean(input.version)} (${input.buildMode})`,
    `- Browser: ${clean(input.browser)}`,
    `- Language: UI ${input.uiLocale}, browser ${clean(input.browserLanguage)}`,
    '',
    '### Accounts',
    ...TRACKER_IDS.map((id) => `- ${TRACKER_LABELS[id]}: ${input.services[id] ? 'connected' : 'not connected'}`),
    '',
    '### Settings',
    ...Object.entries(input.settings).map(([key, value]) => `- ${key}: ${clean(formatSettingValue(value))}`),
    '',
    '### Data',
    `- Remembered matches: ${c.mappings}`,
    `- Excluded series: ${c.excludedSeries}`,
    `- Pending reviews: ${c.pendingReviews}`,
    `- Sync queue: ${c.queuePending} pending, ${c.queueFailed} failed`,
    `- Pending ratings: ${c.pendingRatings}`,
    `- Recent syncs: ${c.recentSyncs}`,
    '',
    '### Airing check',
    airing
      ? `- Last check: ${iso(airing.checkedAt)} · notified ${airing.notified}${airing.skipped ? ` · skipped (${airing.skipped})` : ''}${airing.error ? ` · error: ${clean(airing.error)}` : ''}`
      : '- Never run',
    '',
    `### Recent errors (${input.journal.length})`,
  ];

  if (input.journal.length === 0) {
    lines.push('- None');
  } else {
    lines.push('```', ...input.journal.map((entry) => journalLine(entry, sensitive)), '```');
  }
  return `${lines.join('\n')}\n`;
}

export interface IssueInfo {
  version: string;
  browser: string;
  locale: Locale;
}

/** URL « nouvelle issue » GitHub préremplie (modèle court dans la langue de l'interface, sans le rapport complet) */
export function buildIssueUrl(info: IssueInfo): string {
  const browser = info.browser.slice(0, MAX_BROWSER_LENGTH);
  const params = new URLSearchParams({
    title: ISSUE_TITLE,
    body: tl(info.locale, 'help.issue.body', { version: info.version, browser, language: info.locale }),
  });
  const url = `${ISSUES_NEW_URL}?${params.toString()}`;
  // Garde-fou : sans corps si un navigateur exotique allongeait trop l'URL
  return url.length <= MAX_ISSUE_URL_LENGTH ? url : `${ISSUES_NEW_URL}?${new URLSearchParams({ title: ISSUE_TITLE }).toString()}`;
}
