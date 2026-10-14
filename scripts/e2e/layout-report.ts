// Liste d'exceptions et rapport du contrôle de mise en page des langues (i18n-layout.e2e.ts). Module pur (Node, sans
// navigateur) : testé par layout-report.test.ts.
import type { LayoutIssue, LayoutIssueKind } from './layout-probe';

const KINDS: readonly LayoutIssueKind[] = ['truncated', 'clipped', 'spill', 'overflow', 'offscreen', 'placeholder', 'scroll'];

/** Exception de scripts/e2e/i18n-layout.allowlist.json : tous les champs renseignés doivent correspondre */
export interface AllowEntry {
  /** Code de langue, ou « * » */
  locale?: string;
  /** Écran exact (`popup/settings-sync`) ou préfixe terminé par « * » (`panel-320/*`) */
  screen?: string;
  kind?: LayoutIssueKind;
  /** L'une des clés du catalogue de l'anomalie */
  key?: string;
  /** Morceau du texte de l'anomalie */
  text?: string;
  /** Pourquoi l'anomalie est acceptée (obligatoire) */
  reason: string;
}

const ENTRY_FIELDS = new Set(['locale', 'screen', 'kind', 'key', 'text', 'reason']);

const isKind = (value: unknown): value is LayoutIssueKind => KINDS.some((kind) => kind === value);

/** Contenu du fichier d'exceptions validé ; erreur explicite sur toute entrée mal formée */
export function parseAllowlist(raw: unknown): AllowEntry[] {
  if (typeof raw !== 'object' || raw === null || !('allow' in raw) || !Array.isArray(raw.allow)) throw new Error('liste d’exceptions : objet { "allow": [...] } attendu');
  return raw.allow.map((entry: unknown, i): AllowEntry => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error(`exception ${i} : objet attendu`);
    const fields = Object.entries(entry);
    for (const [name, value] of fields) {
      if (!ENTRY_FIELDS.has(name)) throw new Error(`exception ${i} : champ inconnu « ${name} »`);
      if (typeof value !== 'string' || !value.trim()) throw new Error(`exception ${i} : « ${name} » doit être un texte non vide`);
    }
    const get = (name: string): string | undefined => {
      const value: unknown = fields.find(([field]) => field === name)?.[1];
      return typeof value === 'string' ? value : undefined;
    };
    const reason = get('reason');
    if (!reason) throw new Error(`exception ${i} : « reason » obligatoire`);
    const kind = get('kind');
    if (kind !== undefined && !isKind(kind)) throw new Error(`exception ${i} : type « ${kind} » inconnu (${KINDS.join(', ')})`);
    const optional = (name: 'locale' | 'screen' | 'key' | 'text'): Partial<AllowEntry> => {
      const value = get(name);
      return value === undefined ? {} : { [name]: value };
    };
    return { ...optional('locale'), ...optional('screen'), ...(kind !== undefined ? { kind } : {}), ...optional('key'), ...optional('text'), reason };
  });
}

/** Anomalie relevée sur un écran d'une langue */
export interface Finding extends LayoutIssue {
  locale: string;
  screen: string;
  /** Capture de l'écran, relative au dossier du rapport */
  screenshot: string;
}

export function allows(entry: AllowEntry, finding: Finding): boolean {
  if (entry.locale !== undefined && entry.locale !== '*' && entry.locale !== finding.locale) return false;
  if (entry.screen !== undefined && !(entry.screen.endsWith('*') ? finding.screen.startsWith(entry.screen.slice(0, -1)) : entry.screen === finding.screen)) return false;
  if (entry.kind !== undefined && entry.kind !== finding.kind) return false;
  if (entry.key !== undefined && !finding.keys.includes(entry.key)) return false;
  return entry.text === undefined || finding.text.includes(entry.text);
}

/** Résultat d'un écran (toutes les anomalies, signalées ou non) */
export interface ScreenResult {
  locale: string;
  screen: string;
  screenshot: string;
  issues: LayoutIssue[];
}

export interface ReportInput {
  generatedAt: Date;
  durationMs: number;
  outDir: string;
  locales: readonly string[];
  screens: readonly ScreenResult[];
  /** Erreurs d'exécution (page qui plante, écran jamais affiché) par langue */
  errors: readonly { locale: string; message: string }[];
  allowlist: readonly AllowEntry[];
}

export interface Report {
  json: string;
  markdown: string;
  /** Anomalies signalées hors exceptions : le contrôle échoue s'il y en a */
  failures: Finding[];
}

const amount = (finding: Pick<LayoutIssue, 'dx' | 'dy'>): number => Math.max(finding.dx, finding.dy);

function px(finding: Pick<LayoutIssue, 'dx' | 'dy' | 'catalogDx' | 'catalogDy'>): string {
  const parts = [finding.dx > 1 ? `+${finding.dx} px →` : null, finding.dy > 1 ? `+${finding.dy} px ↓` : null].filter(Boolean);
  const alone = finding.catalogDx !== undefined || finding.catalogDy !== undefined ? ` (catalog text alone: +${Math.max(finding.catalogDx ?? 0, finding.catalogDy ?? 0)} px)` : '';
  return `${parts.join(' ')}${alone}`;
}

/** Cellule de tableau Markdown : barres verticales échappées, une seule ligne */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** Ligne courte d'une anomalie (message d'échec du test, rapport) */
export function describeFinding(finding: Finding): string {
  const key = finding.keys.length > 0 ? finding.keys.join(', ') : '(no key)';
  return `${finding.locale} ${finding.screen} #${finding.id} ${finding.kind} ${px(finding)} ${key} « ${finding.text} »`;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
}

export function buildReport(input: ReportInput): Report {
  const all: Finding[] = input.screens.flatMap((screen) => screen.issues.map((issue) => ({ ...issue, locale: screen.locale, screen: screen.screen, screenshot: screen.screenshot })));
  const flagged = all.filter((finding) => finding.flagged);
  const ignored = all.filter((finding) => !finding.flagged);
  const allowedBy = new Map<Finding, AllowEntry>();
  for (const finding of flagged) {
    const entry = input.allowlist.find((candidate) => allows(candidate, finding));
    if (entry) allowedBy.set(finding, entry);
  }
  const failures = flagged.filter((finding) => !allowedBy.has(finding));
  const stale = input.allowlist.filter((entry) => !flagged.some((finding) => allows(entry, finding)));
  const screenNames = [...new Set(input.screens.map((screen) => screen.screen))];

  const byLocale = input.locales.map((locale) => {
    const mine = failures.filter((finding) => finding.locale === locale).sort((a, b) => amount(b) - amount(a));
    return {
      locale,
      findings: mine.length,
      allowed: flagged.filter((finding) => finding.locale === locale && allowedBy.has(finding)).length,
      ignored: ignored.filter((finding) => finding.locale === locale).length,
      errors: input.errors.filter((error) => error.locale === locale).length,
      worst: mine.slice(0, 3),
    };
  });

  // Même élément de l'interface (data-focus, sinon chemin) dans plusieurs langues : souvent un problème de CSS (rangée
  // qui ne peut pas passer à la ligne, largeur fixe) plutôt que d'une traduction
  const groups = new Map<string, Finding[]>();
  for (const finding of failures) {
    const surface = finding.screen.split('/')[0]?.replace(/-\d+$/, '') ?? '';
    const id = `${surface} ${finding.focus ? `[data-focus=${finding.focus}]` : finding.path}`;
    groups.set(id, [...(groups.get(id) ?? []), finding]);
  }
  const byElement = [...groups.entries()]
    .map(([element, findings]) => ({
      element,
      keys: [...new Set(findings.flatMap((finding) => finding.keys))].slice(0, 4),
      locales: [...new Set(findings.map((finding) => finding.locale))],
      kinds: [...new Set(findings.map((finding) => finding.kind))],
      screens: [...new Set(findings.map((finding) => finding.screen))],
      max: Math.max(...findings.map(amount)),
      examples: [...findings].sort((a, b) => amount(b) - amount(a)).slice(0, 2).map((finding) => `${finding.locale} « ${finding.text} » ${px(finding)}`),
    }))
    .sort((a, b) => b.locales.length - a.locales.length || b.max - a.max);

  const json = JSON.stringify(
    {
      generatedAt: input.generatedAt.toISOString(),
      durationMs: input.durationMs,
      outDir: input.outDir,
      locales: input.locales,
      screens: screenNames,
      summary: {
        findings: failures.length,
        allowed: allowedBy.size,
        ignored: ignored.length,
        errors: input.errors.length,
        byLocale: byLocale.map(({ worst, ...counts }) => ({ ...counts, worst: worst.map(describeFinding) })),
        byElement,
      },
      findings: failures,
      allowed: [...allowedBy].map(([finding, entry]) => ({ ...finding, reason: entry.reason })),
      ignored,
      errors: input.errors,
      staleAllowlist: stale,
    },
    null,
    2,
  );

  const md: string[] = [
    '# SyncKai — i18n layout check',
    '',
    `Generated ${input.generatedAt.toISOString()} · ${input.locales.length} locales × ${screenNames.length} screens · ${formatDuration(input.durationMs)}`,
    '',
    `**${failures.length} findings** (${allowedBy.size} allowlisted) · ${ignored.length} intentional truncations of demo data ignored · ${input.errors.length} run errors`,
    '',
    'Screenshots: `<locale>/<screen>.png` next to this file, whole content (scroll areas expanded), findings outlined in red and numbered (`#` below).',
    'Kinds: `truncated` (ellipsis / line clamp), `clipped` (cut by overflow: hidden), `spill` (text out of its box), `overflow` (element out of its parent: row too narrow, or fixed-height box whose label wraps), `offscreen` (positioned element cut by the window or a container), `placeholder` (field hint too long), `scroll` (area wider than its visible part).',
    'Element: `data-focus` of the element or its closest ancestor; `~` = no such ancestor, first control of the same row or card. Source: `catalog` (translation only), `mixed` (translation + demo data, re-measured with the data replaced by « X »), `data` / `other` (not a catalog string).',
    '',
    '## Summary by locale',
    '',
    '| Locale | Findings | Allowlisted | Ignored | Errors | Worst |',
    '|---|---:|---:|---:|---:|---|',
    ...byLocale.map((row) => `| ${row.locale} | ${row.findings} | ${row.allowed} | ${row.ignored} | ${row.errors} | ${cell(row.worst.map((finding) => `${finding.screen} ${finding.kind} ${px(finding)} ${finding.keys.slice(0, 2).join(' / ')} « ${finding.text} »`).join(' ; '))} |`),
    '',
  ];
  if (byElement.length > 0) {
    md.push('## Findings by element', '', 'An element failing in many locales usually points to CSS (a row that cannot wrap, a fixed width) rather than to one translation.', '');
    md.push('| Element | Keys | Locales | Kinds | Screens | Max px | Worst |', '|---|---|---|---|---|---:|---|');
    for (const group of byElement) {
      md.push(`| ${cell(group.element)} | ${cell(group.keys.join(', '))} | ${group.locales.length} (${group.locales.join(' ')}) | ${group.kinds.join(', ')} | ${cell(group.screens.join(', '))} | ${group.max} | ${cell(group.examples.join(' ; '))} |`);
    }
    md.push('');
  }
  if (input.errors.length > 0) {
    md.push('## Run errors', '');
    for (const error of input.errors) md.push(`- ${error.locale}: ${cell(error.message)}`);
    md.push('');
  }
  for (const locale of input.locales) {
    const mine = failures.filter((finding) => finding.locale === locale);
    if (mine.length === 0) continue;
    md.push(`## ${locale} (${mine.length})`, '');
    for (const screen of [...new Set(mine.map((finding) => finding.screen))]) {
      const rows = mine.filter((finding) => finding.screen === screen);
      md.push(`### ${screen} — [screenshot](${rows[0]?.screenshot.replace(/\\/g, '/') ?? ''})`, '', '| # | Kind | Excess | Key | Text | Source | Element |', '|---:|---|---|---|---|---|---|');
      for (const finding of rows) {
        md.push(`| ${finding.id} | ${finding.kind} | ${px(finding)} | ${cell(finding.keys.join(', '))} | ${cell(finding.text)} | ${finding.source} | ${cell(finding.focus ? `[data-focus=${finding.focus}] ` : '')}\`${cell(finding.path)}\` |`);
      }
      md.push('');
    }
  }
  if (allowedBy.size > 0) {
    md.push('## Allowlisted', '');
    for (const [finding, entry] of allowedBy) md.push(`- ${cell(describeFinding(finding))} — ${cell(entry.reason)}`);
    md.push('');
  }
  if (stale.length > 0) {
    md.push('## Stale allowlist entries (match nothing)', '');
    for (const entry of stale) md.push(`- \`${JSON.stringify(entry)}\``);
    md.push('');
  }
  return { json, markdown: md.join('\n'), failures };
}
