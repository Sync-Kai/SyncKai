// Réglages › Mes données : correspondances mémorisées, séries exclues, import Crunchyroll,
// sauvegarde (export / import) et zone de danger (réinitialisation des correspondances).
import { t, tp } from '../../i18n';
import { backupFileName } from '../../shared/backup';
import { exportBackup } from '../../shared/backup-store';
import { includeSeries, type ExcludedSeries } from '../../shared/exclusions';
import { createLogger } from '../../shared/logger';
import { clearMediaMappings, deleteMediaMapping } from '../../shared/storage';
import type { MediaMapping } from '../../shared/sync.types';
import { renderAlert } from '../alert';
import { BTN_GHOST, CARD, LINK } from '../kit';
import { platformIcon } from '../brand-icons';
import { busyAttrs, h, nodes, type Child } from '../dom';
import { icon } from '../icons';
import type { SettingsContext, SettingsPageView } from './context';
import { BTN_DANGER, BTN_DANGER_FILL, dangerRow, dangerZone, DIVIDER, HELP_TEXT, settingsSection } from './rows';

const log = createLogger('settings');

const IMPORT_PAGE = 'src/import/import.html';
/** Import de l'historique Crunchyroll (onglet dédié : lecture, analyse et aperçu durent plusieurs minutes) */
const CR_IMPORT_PAGE = 'src/import-cr/import-cr.html';
const EXPORTED_BADGE_MS = 2_000;

type ExportState = 'idle' | 'exporting' | 'exported' | 'error';

function numberingLabel(mapping: MediaMapping): string {
  const source = t(mapping.numbering === 'displayed' ? 'settings.mappings.displayed' : 'settings.mappings.season');
  return mapping.offset !== 0 ? t('settings.mappings.offset', { source, offset: mapping.offset }) : source;
}

export function createDataPage(ctx: SettingsContext): SettingsPageView {
  let expanded = false;
  let confirmingReset = false;
  let mappingsActionError: string | null = null;
  let reactivatingId: string | null = null;
  let exclusionsError: string | null = null;
  let exportState: ExportState = 'idle';
  let exportTimer: ReturnType<typeof setTimeout> | undefined;

  const redraw = (): void => ctx.redraw(['data']);

  // ─── Correspondances ───

  async function runMappingAction(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      mappingsActionError = null;
    } catch (error: unknown) {
      log.error('Modification des correspondances impossible :', error);
      mappingsActionError = t('settings.mappings.saveFailed');
    }
    await ctx.refreshMappings();
  }

  function renderMappings(): Child[] {
    const mappings = ctx.data.mappings ?? [];
    const count = mappings.length;
    if (count === 0) expanded = false;
    const summary = count > 0 ? tp('settings.mappings.count', count) : t('settings.mappings.empty');
    const error = mappingsActionError ?? ctx.data.mappingsError;

    const header =
      count > 0
        ? h(
            'button',
            {
              class: 'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 bg-transparent px-3 text-left text-ink transition-colors hover:bg-raised',
              attrs: { type: 'button', 'aria-expanded': String(expanded), 'aria-controls': 'sk-maps', 'data-focus': 'maps-toggle' },
              on: {
                click: () => {
                  expanded = !expanded;
                  redraw();
                },
              },
            },
            h('span', { class: 'text-[13px] font-bold' }, summary),
            h(
              'span',
              { class: 'inline-flex items-center gap-1 text-[12px] font-bold text-sakura' },
              expanded ? t('settings.mappings.hide') : t('settings.mappings.manage'),
              icon('chevronDown', `h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`, '2.6'),
            ),
          )
        : h('p', { class: 'm-0 flex min-h-11 items-center px-3 text-[12px] text-muted' }, ctx.data.mappings === null && !error ? t('settings.summary.loading') : summary);

    const alert = error && h('div', { class: 'px-3 pb-3' }, renderAlert({ message: error }));
    if (!expanded) return [header, alert];

    const rows = mappings.map(([key, mapping]) => {
      const label = mapping.seriesLabel ?? key;
      return h(
        'li',
        { class: `flex min-h-12 items-center gap-2 ${DIVIDER}` },
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h('span', { class: 'truncate text-[12px] font-bold', attrs: { title: key } }, label),
          h(
            'span',
            { class: 'truncate text-[11px] font-semibold text-muted' },
            '→ ',
            h(
              'a',
              { class: LINK, attrs: { href: `https://anilist.co/anime/${mapping.mediaId}`, target: '_blank', rel: 'noopener noreferrer' } },
              mapping.mediaTitle ?? t('settings.mappings.entryFallback', { id: mapping.mediaId }),
            ),
            ` · ${numberingLabel(mapping)}`,
          ),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} text-danger`,
            attrs: { type: 'button', 'aria-label': t('settings.mappings.forgetAria', { label }), title: t('settings.mappings.forgetTitle'), 'data-focus': `forget-${key}` },
            on: { click: () => void runMappingAction(() => deleteMediaMapping(key)) },
          },
          t('settings.mappings.forget'),
        ),
      );
    });

    return [
      header,
      h('p', { class: `m-0 px-3 pb-2 ${HELP_TEXT}` }, t('settings.mappings.help')),
      h('ul', { class: 'm-0 list-none py-0 pr-1 pl-3', attrs: { id: 'sk-maps' } }, ...rows),
      alert,
    ];
  }

  // ─── Séries exclues ───

  function renderExclusionRow(item: ExcludedSeries, first: boolean): HTMLElement {
    const busy = reactivatingId === item.id;
    return h(
      'li',
      { class: `flex min-h-11 items-center gap-2 ${first ? '' : DIVIDER}` },
      icon('ban', 'h-3.5 w-3.5 text-muted'),
      h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold', attrs: { title: item.label } }, item.label),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-sakura`,
          attrs: { type: 'button', 'aria-label': t('settings.exclusions.reactivateAria', { title: item.label }), 'data-focus': `include-${item.id}`, ...busyAttrs(reactivatingId !== null, busy) },
          on: { click: () => void reactivate(item.id) },
        },
        busy && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
        t('settings.exclusions.reactivate'),
      ),
    );
  }

  function renderExclusions(): Child[] {
    const { exclusions } = ctx.data;
    if (exclusions.status === 'loading') {
      return [h('div', { class: 'm-3 h-5 rounded bg-raised motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', 'aria-label': t('settings.exclusions.loading') } })];
    }
    if (exclusions.status === 'error') return [h('div', { class: 'p-3' }, renderAlert({ message: t('settings.exclusions.loadError') }))];
    const { items } = exclusions;
    return [
      items.length > 0
        ? h('ul', { class: 'm-0 list-none py-0 pr-1 pl-3' }, ...items.map((item, i) => renderExclusionRow(item, i === 0)))
        : h('p', { class: 'm-0 flex min-h-11 items-center px-3 text-[12px] text-muted' }, t('settings.exclusions.empty')),
      exclusionsError && h('div', { class: 'px-3 pb-3' }, renderAlert({ message: exclusionsError })),
    ];
  }

  async function reactivate(id: string): Promise<void> {
    reactivatingId = id;
    exclusionsError = null;
    redraw();
    try {
      // La liste est relue par la vue via storage.onChanged
      await includeSeries(id);
    } catch (error: unknown) {
      log.error('Réactivation de la série impossible :', error);
      exclusionsError = t('settings.exclusions.reactivateFailed');
    }
    reactivatingId = null;
    redraw();
  }

  // ─── Import Crunchyroll et sauvegarde ───

  function renderCrImport(): HTMLElement {
    return h(
      'div',
      { class: `${CARD} flex items-center gap-3 border border-line bg-linear-135 from-raised from-0% to-surface to-70% px-3 py-2.5` },
      platformIcon('crunchyroll', 'h-8 w-8 rounded-[9px]', { decorative: true }),
      h(
        'span',
        { class: 'flex min-w-0 flex-1 flex-col gap-px' },
        h('span', { class: 'text-[13px] font-bold' }, t('settings.backup.crImport')),
        h('span', { class: HELP_TEXT }, t('settings.crImport.help')),
      ),
      h(
        'button',
        {
          class: `${BTN_GHOST} border border-line px-3.5 text-sakura`,
          attrs: { type: 'button', 'data-focus': 'cr-import', title: t('settings.backup.crImportTitle'), 'aria-label': t('settings.crImport.openAria') },
          on: { click: () => ctx.host.openTab(chrome.runtime.getURL(CR_IMPORT_PAGE)) },
        },
        t('settings.crImport.open'),
        icon('external', 'h-3 w-3'),
      ),
    );
  }

  function renderBackup(): Child[] {
    const exporting = exportState === 'exporting';
    return [
      h('p', { class: `m-0 ${HELP_TEXT}` }, t('settings.backup.help')),
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-end gap-2' },
        exportState === 'exported' &&
          h('span', { class: 'mr-auto flex items-center gap-1 text-[11px] font-bold text-mint', attrs: { role: 'status' } }, icon('check', 'h-3 w-3', '3'), t('settings.backup.exported')),
        h(
          'button',
          {
            class: `${BTN_GHOST} border border-line px-3.5 text-ink`,
            attrs: { type: 'button', 'data-focus': 'backup-export', title: t('settings.backup.exportTitle'), ...busyAttrs(exporting, true) },
            on: { click: () => void runExport() },
          },
          exporting && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
          t('settings.backup.export'),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} border border-line px-3.5 text-sakura`,
            attrs: { type: 'button', 'data-focus': 'backup-import', title: t('settings.backup.importTitle') },
            // Onglet dédié : le sélecteur de fichier fermerait le popup
            on: { click: () => ctx.host.openTab(chrome.runtime.getURL(IMPORT_PAGE)) },
          },
          t('settings.backup.import'),
        ),
      ),
      exportState === 'error' && renderAlert({ message: t('settings.backup.exportFailed') }),
    ];
  }

  async function runExport(): Promise<void> {
    clearTimeout(exportTimer);
    exportState = 'exporting';
    redraw();
    try {
      const backup = await exportBackup();
      // Téléchargement via un lien temporaire : aucune permission "downloads" nécessaire
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = h('a', { attrs: { href: url, download: backupFileName(new Date()) } });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      exportState = 'exported';
      exportTimer = setTimeout(() => {
        exportState = 'idle';
        redraw();
      }, EXPORTED_BADGE_MS);
    } catch (error: unknown) {
      log.error('Export de la sauvegarde impossible :', error);
      exportState = 'error';
    }
    redraw();
  }

  // ─── Zone de danger ───

  function renderResetAction(): HTMLElement {
    const count = ctx.data.mappings?.length ?? 0;
    if (!confirmingReset) {
      return h(
        'div',
        { class: 'flex justify-end' },
        h(
          'button',
          {
            class: BTN_DANGER,
            attrs: { type: 'button', 'data-focus': 'reset', ...(count === 0 ? { disabled: '' } : {}) },
            on: {
              click: () => {
                confirmingReset = true;
                redraw();
              },
            },
          },
          t('settings.mappings.reset'),
        ),
      );
    }
    return h(
      'div',
      { class: 'flex flex-wrap items-center justify-end gap-2' },
      h('span', { class: 'mr-auto text-[12px] font-semibold text-butter', attrs: { role: 'status' } }, t('settings.mappings.resetConfirm')),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-muted`,
          attrs: { type: 'button', 'data-focus': 'reset-cancel' },
          on: {
            click: () => {
              confirmingReset = false;
              redraw();
            },
          },
        },
        t('common.cancel'),
      ),
      h(
        'button',
        {
          class: BTN_DANGER_FILL,
          attrs: { type: 'button', 'data-focus': 'reset-confirm' },
          on: {
            click: () => {
              confirmingReset = false;
              expanded = false;
              void runMappingAction(clearMediaMappings);
            },
          },
        },
        t('common.confirm'),
      ),
    );
  }

  return {
    render: () => [
      settingsSection(t('settings.section.mappings'), h('div', { class: `${CARD} overflow-hidden` }, ...nodes(renderMappings()))),
      settingsSection(t('settings.section.exclusions'), h('div', { class: `${CARD} overflow-hidden` }, ...nodes(renderExclusions()))),
      settingsSection(t('settings.section.import'), renderCrImport()),
      settingsSection(t('settings.section.backup'), h('div', { class: `${CARD} flex flex-col gap-2 px-3 py-2.5` }, ...nodes(renderBackup()))),
      dangerZone(dangerRow({ title: t('settings.section.mappings'), help: t('settings.mappings.resetHelp'), action: renderResetAction() })),
    ],
  };
}
