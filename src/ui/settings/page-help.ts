// Réglages › Aide & à propos : rapport de diagnostic, signalement, version, code source
// et zone de danger (effacement du journal d'erreurs).
import { getLocale, t, tp } from '../../i18n';
import { buildIssueUrl } from '../../shared/diagnostics';
import { buildCurrentReport, currentBrowser } from '../../shared/diagnostics-store';
import { clearJournal } from '../../shared/error-journal';
import { createLogger } from '../../shared/logger';
import { BTN_GHOST, CARD } from '../kit';
import { busyAttrs, h, nodes, type Child } from '../dom';
import { icon } from '../icons';
import type { SettingsContext, SettingsPageView } from './context';
import { BTN_DANGER, dangerRow, dangerZone, DIVIDER, HELP_TEXT, linkRow, rowsCard, settingsSection } from './rows';

const log = createLogger('settings');

const REPO_URL = 'https://github.com/Sync-Kai/SyncKai';
const HELP_FEEDBACK_MS = 2_500;

/** Retour des actions de la page Aide */
type HelpFeedback = { tone: 'ok' | 'error'; text: string } | null;

export function createHelpPage(ctx: SettingsContext): SettingsPageView {
  const version = chrome.runtime.getManifest().version;
  // Modèle court : version, navigateur, langue (le rapport complet est collé par l'utilisateur)
  const issueUrl = (): string => buildIssueUrl({ version, browser: currentBrowser(), locale: getLocale() });
  let busy: 'copy' | 'clear' | null = null;
  let feedback: HelpFeedback = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  const redraw = (): void => ctx.redraw(['help']);

  function showFeedback(next: HelpFeedback): void {
    clearTimeout(feedbackTimer);
    feedback = next;
    // Le succès s'efface ; l'erreur reste jusqu'à la prochaine action
    if (next?.tone === 'ok') {
      feedbackTimer = setTimeout(() => {
        feedback = null;
        redraw();
      }, HELP_FEEDBACK_MS);
    }
  }

  async function copyReport(): Promise<void> {
    busy = 'copy';
    redraw();
    try {
      // Clic utilisateur : l'API Clipboard n'exige pas la permission clipboardWrite
      await navigator.clipboard.writeText(await buildCurrentReport());
      showFeedback({ tone: 'ok', text: t('settings.help.copied') });
    } catch (error: unknown) {
      log.error('Copie du rapport de diagnostic impossible :', error);
      showFeedback({ tone: 'error', text: t('settings.help.copyFailed') });
    }
    busy = null;
    await ctx.refreshJournal();
  }

  async function clearLog(): Promise<void> {
    busy = 'clear';
    redraw();
    try {
      await clearJournal();
      showFeedback({ tone: 'ok', text: t('settings.help.cleared') });
    } catch {
      // Pas de log ici : il serait aussitôt réécrit dans le journal qu'on vient d'effacer
      showFeedback({ tone: 'error', text: t('settings.help.clearFailed') });
    }
    busy = null;
    await ctx.refreshJournal();
  }

  function renderHelp(): Child[] {
    const { journalCount } = ctx.data;
    const count = journalCount === null ? '' : journalCount === 0 ? t('settings.help.noErrors') : tp('settings.help.errors', journalCount);
    return [
      h('p', { class: `m-0 ${HELP_TEXT}` }, t('settings.help.text')),
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-2' },
        h(
          'button',
          {
            class: `${BTN_GHOST} border border-line px-3.5 text-ink`,
            attrs: { type: 'button', 'data-focus': 'help-copy', title: t('settings.help.copyTitle'), ...busyAttrs(busy !== null, busy === 'copy') },
            on: { click: () => void copyReport() },
          },
          busy === 'copy' && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
          t('settings.help.copy'),
        ),
        h(
          'a',
          {
            class: `${BTN_GHOST} border border-line px-3.5 text-sakura`,
            attrs: { href: issueUrl(), target: '_blank', rel: 'noopener noreferrer', title: t('settings.help.reportTitle'), 'data-focus': 'help-report' },
          },
          t('settings.help.report'),
          icon('external', 'h-3 w-3'),
        ),
      ),
      h(
        'div',
        { class: `flex min-h-8 items-center pt-2 ${DIVIDER}` },
        feedback
          ? h(
              'span',
              { class: `flex min-w-0 items-center gap-1 text-[11px] font-bold ${feedback.tone === 'ok' ? 'text-mint' : 'text-danger'}`, attrs: { role: 'status' } },
              icon(feedback.tone === 'ok' ? 'check' : 'alert', 'h-3 w-3 shrink-0', feedback.tone === 'ok' ? '3' : '2'),
              feedback.text,
            )
          : h('span', { class: `min-w-0 ${HELP_TEXT}`, attrs: { role: 'status' } }, count),
      ),
    ];
  }

  return {
    render: () => [
      settingsSection(t('settings.section.help'), h('div', { class: `${CARD} flex flex-col gap-2 px-3 py-2.5` }, ...nodes(renderHelp()))),
      settingsSection(
        t('settings.section.about'),
        rowsCard(
          h(
            'div',
            { class: 'flex min-h-10 items-center justify-between gap-2 px-3' },
            h('span', { class: 'text-[13px] font-bold' }, 'SyncKai'),
            h('span', { class: 'text-[11px] font-semibold text-muted tabular-nums' }, `v${version}`),
          ),
          linkRow({ label: t('settings.about.source'), href: REPO_URL, divider: true }),
        ),
      ),
      dangerZone(
        dangerRow({
          title: t('settings.help.journal'),
          help: t('settings.help.clearHelp'),
          action: h(
            'div',
            { class: 'flex justify-end' },
            h(
              'button',
              {
                class: BTN_DANGER,
                attrs: { type: 'button', 'data-focus': 'help-clear', ...(ctx.data.journalCount === 0 ? { disabled: '' } : busyAttrs(busy !== null, busy === 'clear')) },
                on: { click: () => void clearLog() },
              },
              busy === 'clear' && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
              t('settings.help.clear'),
            ),
          ),
        }),
      ),
    ],
  };
}
