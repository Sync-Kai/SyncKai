// Réglages › Aide & à propos (maquettes APropos, AProposEtats, AProposDev) : rapport de diagnostic (titre et bouton sur
// une ligne, description dessous ; copie en cours, copié, échec), « Signaler un problème », journal d'erreurs (nombre,
// liste dépliable, « Effacer »), puis la version (seul endroit qui l'affiche ; build de dev : version_name) et les liens
// Nouveautés, Confidentialité, Code source. Builds de dev seulement : diagnostic des correspondances et trace de
// débogage (sous `__SYNCKAI_DEBUG__`, absents des bundles publiés). Le rapport est construit et expurgé par le service
// worker (GET_DIAGNOSTICS_REPORT), seul à déchiffrer les jetons (SEC-06).
import { useEffect, useId, useState } from 'preact/hooks';
import { getLocale, t, tp } from '../../i18n';
import { buildIssueUrl } from '../../shared/diagnostics';
import { currentBrowser } from '../../browser/storage/diagnostics-store';
import { sendMessage } from '../../protocol/messages';
import { clearJournal, readJournal, redactSecrets, type JournalEntry } from '../../browser/error-journal';
import { createLogger } from '../../browser/logger';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { useLocale, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage } from './context';
import { DebugTraceSection } from './debug-trace';
import { MatchDiagnosticSection } from './match-diagnostic';
import { preactPage } from './preact-page';

const log = createLogger('settings');

const REPO_URL = 'https://github.com/Sync-Kai/SyncKai';
const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;
/** Langues du site synckai.app (page « Nouveautés ») ; les autres lisent la version anglaise */
const SITE_LANGUAGES = ['fr', 'en', 'de'] as const;
const HELP_FEEDBACK_MS = 2_500;

/** Retour d'une action : succès effacé après HELP_FEEDBACK_MS, échec gardé jusqu'à la prochaine action */
type Feedback = { tone: 'ok' | 'error'; text: string } | null;

interface HelpState {
  busy: 'copy' | 'clear' | null;
  copy: Feedback;
  clear: Feedback;
}

/** Page « Nouveautés » de synckai.app dans la langue de l'interface (fr, en, de ; sinon en) */
export function whatsNewUrl(locale: string): string {
  const base = locale.split('-')[0] ?? 'en';
  const lang = SITE_LANGUAGES.find((code) => code === base) ?? 'en';
  return `https://synckai.app/${lang}/changelog`;
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const ok = feedback.tone === 'ok';
  return (
    <p class={`m-0 flex items-center gap-1 text-secondary font-bold ${ok ? 'text-mint' : 'text-danger'}`} role="status" data-help-feedback={feedback.tone}>
      <Icon name={ok ? 'check' : 'alert'} class="size-3 shrink-0" strokeWidth={ok ? '3' : '2.2'} />
      {feedback.text}
    </p>
  );
}

const time = (at: number, now: Date): string => {
  const date = new Date(at);
  const today = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(getLocale(), today ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

/** Entrées du journal, les plus récentes d'abord : heure · module, message (déjà expurgé) */
function JournalList({ entries }: { entries: readonly JournalEntry[] }) {
  const now = new Date();
  return (
    <ul class="m-0 flex list-none flex-col p-0" data-journal-list="">
      {entries.map((entry, index) => (
        <li key={`${entry.at}:${index}`} class={`flex flex-col gap-0.5 py-2 ${index > 0 ? 'border-t border-line' : ''}`}>
          <span class="flex items-center gap-1.5 text-secondary font-bold text-muted tabular-nums">
            <span class={`size-1.5 shrink-0 rounded-pill ${entry.level === 'error' ? 'bg-danger' : 'bg-butter'}`} aria-hidden="true" />
            {`${time(entry.at, now)} · ${entry.scope}`}
          </span>
          {/* Déjà expurgé à l'écriture ; repassé ici (Bearer, JWT, paramètres OAuth) : la liste peut finir en capture d'écran */}
          <span class="text-secondary break-words">{redactSecrets(entry.message)}</span>
        </li>
      ))}
    </ul>
  );
}

interface HelpPageProps {
  ctx: SettingsContext;
  help: Store<HelpState>;
  onCopy: () => void;
  onClear: () => void;
}

export function HelpPage({ ctx, help, onCopy, onClear }: HelpPageProps) {
  const locale = useLocale();
  const { journalCount } = useStore(ctx.state);
  const { busy, copy, clear } = useStore(help);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const journalId = useId();
  const manifest = chrome.runtime.getManifest();
  // Modèle court : version, navigateur, langue (le rapport complet est collé par l'utilisateur)
  const issueUrl = buildIssueUrl({ version: manifest.version, browser: currentBrowser(), locale });
  const hasErrors = journalCount !== null && journalCount > 0;

  // Journal déplié : relu à chaque changement de son nombre (nouvelle erreur, effacement)
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    readJournal().then(
      (read) => live && setEntries(read.slice().reverse()),
      () => live && setEntries([]),
    );
    return () => {
      live = false;
    };
  }, [open, journalCount]);
  // Journal vidé : replié
  useEffect(() => {
    if (!hasErrors) setOpen(false);
  }, [hasErrors]);

  const count = journalCount === null ? '' : journalCount === 0 ? t('settings.help.noErrors') : tp('settings.help.errors', journalCount);

  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.section.help')}>
        <SettingsCard>
          <div class="flex flex-col gap-1 px-3 py-2.5" data-help-report="">
            {/* Titre et bouton sur une ligne ; trop étroit (panneau à 320 px, langues longues) : le bouton passe dessous, à droite */}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span class="flex size-icon-button shrink-0 items-center justify-center rounded-control bg-lavender/16 text-lavender" aria-hidden="true">
                <Icon name="clipboard" class="size-4" strokeWidth="2.2" />
              </span>
              <span class="min-w-0 flex-auto text-body font-bold break-words">{t('settings.help.diagnostic')}</span>
              <Button size="sm" class="ml-auto" busy={busy === 'copy'} disabled={busy === 'clear'} focusKey="help-copy" onClick={onCopy}>
                {t('settings.help.copy')}
              </Button>
            </div>
            <p class="m-0 pl-10 text-secondary text-muted">{t('settings.help.diagnosticHelp')}</p>
            {copy && (
              <div class="pl-10">
                <FeedbackLine feedback={copy} />
              </div>
            )}
          </div>
          <SettingsRow icon="bug" tile="lavender" title={t('settings.help.report')} href={issueUrl} external divider focusKey="help-report" />
          <div class="relative flex flex-col px-3 py-2.5 before:absolute before:top-0 before:right-3 before:left-13 before:h-px before:bg-line" data-help-journal="">
            <div class="flex items-center gap-3">
              <span class="flex size-icon-button shrink-0 items-center justify-center rounded-control bg-muted/16 text-muted" aria-hidden="true">
                <Icon name="list" class="size-4" strokeWidth="2.2" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-body font-bold">{t('settings.help.journal')}</span>
                {clear ? (
                  <FeedbackLine feedback={clear} />
                ) : (
                  <span class={`text-secondary ${hasErrors ? 'font-bold text-butter' : 'text-muted'}`} role="status" data-journal-count="">
                    {count}
                  </span>
                )}
              </span>
              {hasErrors && (
                <button
                  type="button"
                  class="flex size-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent text-muted transition-colors hover:bg-raised hover:text-ink"
                  aria-expanded={open ? 'true' : 'false'}
                  aria-controls={journalId}
                  aria-label={t('settings.help.journal')}
                  title={t('settings.help.journal')}
                  data-focus="help-journal-toggle"
                  onClick={() => setOpen(!open)}
                >
                  <Icon name="chevronDown" class={`size-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth="2.4" />
                </button>
              )}
              <Button
                variant="danger"
                size="sm"
                busy={busy === 'clear'}
                disabled={!hasErrors || busy === 'copy'}
                ariaLabel={t('settings.help.clear')}
                focusKey="help-clear"
                onClick={onClear}
              >
                {t('settings.matchDiag.clear')}
              </Button>
            </div>
            <div id={journalId} class="pl-10" hidden={!open}>
              {open && <JournalList entries={entries} />}
            </div>
          </div>
        </SettingsCard>
        {open && <p class="m-0 mx-1 text-secondary text-muted">{t('settings.help.journalNote')}</p>}
      </Section>

      <Section title={t('settings.section.about')}>
        <SettingsCard>
          <div class="flex items-center gap-3 px-3 py-3" data-about-version="">
            <img class="size-10 shrink-0 rounded-control" src={chrome.runtime.getURL('icons/icon-48.png')} alt="" draggable={false} />
            <span class="flex min-w-0 flex-col">
              <span class="font-display text-stat">SyncKai</span>
              <span class="text-secondary text-muted tabular-nums">{t('settings.summary.version', { version: manifest.version })}</span>
              {/* Build de dev : version_name (« 2.4.0-dev · 3f1d98d ») ; absent des builds publiés */}
              {__SYNCKAI_DEBUG__ && manifest.version_name && <span class="text-secondary text-muted tabular-nums">{manifest.version_name}</span>}
            </span>
          </div>
          <SettingsRow icon="sparkles" title={t('settings.about.whatsNew')} summary="synckai.app" href={whatsNewUrl(locale)} external divider focusKey="about-whats-new" />
          <SettingsRow icon="shield" title={t('settings.about.privacy')} href={PRIVACY_URL} external divider focusKey="about-privacy" />
          <SettingsRow icon="code" title={t('settings.about.source')} summary="GitHub" href={REPO_URL} external divider focusKey="about-source" />
        </SettingsCard>
      </Section>

      {/* Builds de dev seulement (`npm run build:dev`) : sections absentes des bundles publiés */}
      {__SYNCKAI_DEBUG__ && <MatchDiagnosticSection />}
      {__SYNCKAI_DEBUG__ && <DebugTraceSection />}
    </div>
  );
}

export function createHelpPage(ctx: SettingsContext): SettingsMountedPage {
  // Retours gardés entre deux visites (l'échec reste affiché jusqu'à la prochaine action)
  const help = createStore<HelpState>({ busy: null, copy: null, clear: null });
  let timer: ReturnType<typeof setTimeout> | undefined;

  function finish(kind: 'copy' | 'clear', feedback: Feedback): void {
    clearTimeout(timer);
    help.set({ busy: null, copy: kind === 'copy' ? feedback : null, clear: kind === 'clear' ? feedback : null });
    if (feedback?.tone === 'ok') timer = setTimeout(() => help.set({ ...help.get(), [kind]: null }), HELP_FEEDBACK_MS);
  }

  async function copyReport(): Promise<void> {
    if (help.get().busy !== null) return;
    help.set({ busy: 'copy', copy: null, clear: null });
    try {
      // Rapport construit et expurgé par le service worker, seul à déchiffrer les jetons (SEC-06)
      const report = await sendMessage('GET_DIAGNOSTICS_REPORT', null);
      if (!report.ok) throw new Error(report.message);
      // Clic utilisateur : l'API Clipboard n'exige pas la permission clipboardWrite
      await navigator.clipboard.writeText(report.data);
      finish('copy', { tone: 'ok', text: t('settings.help.copied') });
    } catch (error: unknown) {
      log.error('Copie du rapport de diagnostic impossible :', error);
      finish('copy', { tone: 'error', text: t('settings.help.copyFailed') });
    }
    await ctx.refreshJournal();
  }

  async function clearLog(): Promise<void> {
    if (help.get().busy !== null) return;
    help.set({ busy: 'clear', copy: null, clear: null });
    try {
      await clearJournal();
      finish('clear', { tone: 'ok', text: t('settings.help.cleared') });
    } catch {
      // Pas de log ici : il serait aussitôt réécrit dans le journal qu'on vient d'effacer
      finish('clear', { tone: 'error', text: t('settings.help.clearFailed') });
    }
    await ctx.refreshJournal();
  }

  return preactPage(() => <HelpPage ctx={ctx} help={help} onCopy={() => void copyReport()} onClear={() => void clearLog()} />);
}
