import { getLocale, initI18n, onLocaleChange, t, tp, type PluralKey } from '../i18n';
import { BACKUP_MAX_BYTES, parseBackup, summarizeBackup, type BackupSummary, type ImportMode, type ParsedBackup } from '../shared/backup';
import { applyBackup } from '../shared/backup-store';
import { busyAttrs, h, nodes, preserveFocus, type Child } from '../ui/dom';
import { icon, kai } from '../ui/icons';
import { renderAlert } from '../ui/alert';
import { alertAttrs } from '../ui/live-region';
import { BTN_GHOST, BTN_PRIMARY, CARD } from '../ui/kit';
import { BACKUP_EXPORT_PARAM, downloadBackup } from '../ui/backup-download';
import { createLogger } from '../shared/logger';

const log = createLogger('import');

// Page Sauvegarde ouverte dans un onglet depuis Réglages › Mes données : le sélecteur de fichier et la boîte
// « Enregistrer sous » fermeraient le popup. Export (lancé à l'ouverture avec `?export`) et import.

type ExportState = 'idle' | 'exporting' | 'exported' | 'error';

type ImportState =
  | { kind: 'idle'; error: string | null }
  | { kind: 'reading' }
  | { kind: 'ready'; fileName: string; parsed: ParsedBackup; mode: ImportMode; includeSettings: boolean; confirming: boolean; applying: boolean; error: string | null }
  | { kind: 'done' };

const BTN_DANGER =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-danger px-4 text-[12px] font-bold text-on-fill shadow-pop transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

const SUMMARY_LABELS: { key: Exclude<keyof BackupSummary, 'settings'>; label: PluralKey }[] = [
  { key: 'mediaMappings', label: 'import.summary.mediaMappings' },
  { key: 'excludedSeries', label: 'import.summary.excludedSeries' },
  { key: 'recentSyncs', label: 'import.summary.recentSyncs' },
  { key: 'pendingReviews', label: 'import.summary.pendingReviews' },
  { key: 'pendingRatings', label: 'import.summary.pendingRatings' },
  { key: 'rewatchDeclined', label: 'import.summary.rewatchDeclined' },
];

const app = document.getElementById('app');
let state: ImportState = { kind: 'idle', error: null };
let exportState: ExportState = 'idle';

function draw(): void {
  if (app) preserveFocus(app, () => app.replaceChildren(render()));
}

function setState(next: ImportState): void {
  state = next;
  draw();
}

/** Import en cours d'application : le fichier et les options sont figés */
function isApplying(): boolean {
  return state.kind === 'ready' && state.applying;
}

async function runExport(): Promise<void> {
  if (exportState === 'exporting') return;
  exportState = 'exporting';
  draw();
  try {
    await downloadBackup();
    exportState = 'exported';
  } catch (error: unknown) {
    log.error('Export de la sauvegarde impossible :', error);
    exportState = 'error';
  }
  draw();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'long', timeStyle: 'short' });
}

async function onFile(file: File | undefined): Promise<void> {
  // Sélecteur désactivé pendant l'application ; garde contre un changement arrivé quand même (UI-07)
  if (!file || isApplying()) return;
  // Taille vérifiée avant lecture : un fichier énorme n'est jamais chargé en mémoire
  if (file.size > BACKUP_MAX_BYTES) {
    setState({ kind: 'idle', error: t('import.tooLarge') });
    return;
  }
  setState({ kind: 'reading' });
  try {
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setState({ kind: 'idle', error: result.message });
      return;
    }
    setState({ kind: 'ready', fileName: file.name, parsed: result.data, mode: 'merge', includeSettings: false, confirming: false, applying: false, error: null });
  } catch (error: unknown) {
    log.error('Lecture du fichier impossible :', error);
    setState({ kind: 'idle', error: t('import.readFailed') });
  }
}

async function runImport(): Promise<void> {
  if (state.kind !== 'ready') return;
  if (state.applying) return;
  const current = state;
  const applying: ImportState = { ...current, applying: true, error: null };
  setState(applying);
  try {
    await applyBackup(current.parsed.backup.data, current.mode, current.includeSettings);
    // Résultat appliqué seulement si la page n'a pas changé d'état entre-temps (UI-07)
    if (state === applying) setState({ kind: 'done' });
  } catch (error: unknown) {
    log.error('Import impossible :', error);
    if (state === applying) setState({ ...current, applying: false, confirming: false, error: t('import.failed') });
  }
}

function renderHeader(): HTMLElement {
  return h(
    'header',
    { class: 'flex items-center gap-3' },
    kai('h-10 w-10', { size: 'large' }),
    h(
      'div',
      { class: 'flex min-w-0 flex-col' },
      h('h1', { class: 'm-0 font-display text-[18px] font-extrabold' }, t('import.title')),
      h('p', { class: 'm-0 text-[12px] text-muted' }, t('import.subtitle')),
    ),
  );
}

function renderFilePicker(label: string, disabled = false): HTMLElement {
  const input = h('input', {
    class: 'sr-only',
    attrs: { id: 'sk-file', type: 'file', accept: '.json,application/json', 'data-focus': 'file', ...(disabled ? { disabled: '' } : {}) },
    on: {
      change: () => {
        const file = input.files?.[0];
        input.value = '';
        void onFile(file);
      },
    },
  });
  // Le label porte le style du bouton ; l'input masqué garde le focus clavier (anneau via focus-within)
  return h(
    'div',
    {},
    h(
      'label',
      {
        class: `${BTN_GHOST} border border-line px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-lavender ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`,
        attrs: { for: 'sk-file' },
      },
      input,
      label,
    ),
  );
}

function renderSummary(parsed: ParsedBackup, fileName: string): HTMLElement {
  const summary = summarizeBackup(parsed.backup);
  const rows = SUMMARY_LABELS.map(({ key, label }) => {
    const n = summary[key];
    return h('li', { class: 'flex justify-between gap-2' }, h('span', { class: 'text-muted' }, tp(label, n)), h('span', { class: 'font-bold tabular-nums' }, String(n)));
  });
  return h(
    'div',
    { class: 'flex flex-col gap-2' },
    h(
      'p',
      { class: 'm-0 text-[12px] text-muted' },
      h('span', { class: 'font-bold break-all text-ink' }, fileName),
      t('import.exportedOn', { date: formatDate(parsed.backup.exportedAt), version: parsed.backup.appVersion }),
    ),
    h(
      'ul',
      { class: 'm-0 flex list-none flex-col gap-1 rounded-lg bg-raised px-3 py-2 text-[12px]' },
      h('li', { class: 'flex justify-between gap-2' }, h('span', { class: 'text-muted' }, t('import.summary.settings')), h('span', { class: 'font-bold' }, summary.settings ? t('import.summary.included') : t('import.summary.missing'))),
      ...rows,
    ),
    parsed.invalidCount > 0 &&
      h(
        'p',
        { class: 'm-0 text-[12px] font-bold text-butter' },
        tp('import.invalid', parsed.invalidCount),
      ),
  );
}

function renderRadio(mode: ImportMode, current: ImportMode, title: string, detail: string, disabled: boolean): HTMLElement {
  const id = `sk-mode-${mode}`;
  return h(
    'label',
    { class: `flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-raised ${mode === current ? 'bg-raised' : ''}`, attrs: { for: id } },
    h('input', {
      class: 'mt-0.5',
      attrs: { id, type: 'radio', name: 'sk-mode', value: mode, 'data-focus': id, ...(mode === current ? { checked: '' } : {}), ...(disabled ? { disabled: '' } : {}) },
      on: {
        change: () => {
          if (state.kind !== 'ready') return;
          // Réglages cochés par défaut en remplacement, décochés en fusion
          setState({ ...state, mode, includeSettings: mode === 'replace' && state.parsed.backup.data.settings !== null, confirming: false });
        },
      },
    }),
    h('span', { class: 'flex flex-col' }, h('span', { class: 'text-[13px] font-bold' }, title), h('span', { class: 'text-[12px] text-muted' }, detail)),
  );
}

function renderActions(s: Extract<ImportState, { kind: 'ready' }>): Child {
  const busy = s.applying ? [icon('spinner', 'h-3.5 w-3.5 animate-spin'), t('import.importing')] : null;
  if (s.mode === 'replace' && s.confirming) {
    return h(
      'div',
      { class: 'flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3' },
      h('p', { class: 'm-0 text-[12px] font-bold text-danger', attrs: alertAttrs(t('import.replaceWarning')) }, t('import.replaceWarning')),
      h(
        'div',
        { class: 'flex justify-end gap-2' },
        h(
          'button',
          {
            class: `${BTN_GHOST} text-muted`,
            attrs: { type: 'button', 'data-focus': 'cancel', ...busyAttrs(s.applying) },
            on: { click: () => !s.applying && setState({ ...s, confirming: false }) },
          },
          t('common.cancel'),
        ),
        h(
          'button',
          { class: BTN_DANGER, attrs: { type: 'button', 'data-focus': 'confirm', ...busyAttrs(s.applying, true) }, on: { click: () => void runImport() } },
          ...(busy ?? [t('import.eraseAndImport')]),
        ),
      ),
    );
  }
  return h(
    'div',
    { class: 'flex justify-end' },
    h(
      'button',
      {
        class: s.mode === 'replace' ? BTN_DANGER : BTN_PRIMARY,
        attrs: { type: 'button', 'data-focus': 'import', ...busyAttrs(s.applying, true) },
        on: { click: () => (s.applying ? undefined : s.mode === 'replace' ? setState({ ...s, confirming: true }) : void runImport()) },
      },
      ...(busy ?? [t('import.import')]),
    ),
  );
}

function renderReady(s: Extract<ImportState, { kind: 'ready' }>): Child[] {
  const hasSettings = s.parsed.backup.data.settings !== null;
  return [
    renderSummary(s.parsed, s.fileName),
    h(
      'fieldset',
      { class: 'm-0 flex flex-col gap-1 border-0 p-0' },
      h('legend', { class: 'mb-1 p-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase' }, t('import.mode')),
      renderRadio('merge', s.mode, t('import.merge.title'), t('import.merge.detail'), s.applying),
      renderRadio('replace', s.mode, t('import.replace.title'), t('import.replace.detail'), s.applying),
    ),
    h(
      'label',
      { class: `flex items-center gap-2 px-2 text-[13px] font-bold ${hasSettings ? 'cursor-pointer' : 'opacity-50'}`, attrs: { for: 'sk-settings' } },
      h('input', {
        attrs: {
          id: 'sk-settings',
          type: 'checkbox',
          'data-focus': 'settings',
          ...(s.includeSettings ? { checked: '' } : {}),
          ...(!hasSettings || s.applying ? { disabled: '' } : {}),
        },
        on: { change: (event) => event.target instanceof HTMLInputElement && setState({ ...s, includeSettings: event.target.checked, confirming: false }) },
      }),
      hasSettings ? t('import.includeSettings') : t('import.includeSettingsMissing'),
    ),
    s.error && renderAlert({ message: s.error }),
    renderActions(s),
    // Pas d'autre fichier pendant l'application : l'état de l'import en cours serait écrasé (UI-07)
    h('div', { class: 'border-t border-dotted border-line pt-3' }, renderFilePicker(t('import.chooseOther'), s.applying)),
  ];
}

function renderDone(): Child[] {
  return [
    h(
      'div',
      { class: 'flex flex-col items-center gap-2 py-4 text-center', attrs: { role: 'status' } },
      h('span', { class: 'flex h-10 w-10 items-center justify-center rounded-full bg-mint text-on-fill' }, icon('check', 'h-5 w-5', '2.6')),
      h('p', { class: 'm-0 text-[15px] font-bold' }, t('import.done')),
      h('p', { class: 'm-0 text-[12px] text-muted' }, t('import.doneHint')),
    ),
    h(
      'div',
      { class: 'flex justify-center' },
      h(
        'button',
        {
          class: `${BTN_GHOST} border border-line px-4`,
          attrs: { type: 'button' },
          on: {
            click: () => {
              // window.close() ne ferme pas un onglet ouvert par chrome.tabs.create
              chrome.tabs.getCurrent((tab) => {
                if (tab?.id !== undefined) void chrome.tabs.remove(tab.id);
              });
            },
          },
        },
        t('import.closeTab'),
      ),
    ),
  ];
}

const SECTION_TITLE = 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase';

/** Export : bouton, « Téléchargement lancé » ou erreur */
function renderExport(): HTMLElement {
  const exporting = exportState === 'exporting';
  return h(
    'section',
    { class: 'flex flex-col gap-2', attrs: { 'aria-labelledby': 'sk-export-title' } },
    h('h2', { class: SECTION_TITLE, attrs: { id: 'sk-export-title' } }, t('import.section.export')),
    h(
      'div',
      { class: 'flex items-center justify-between gap-3' },
      h('p', { class: 'm-0 text-[12px] text-muted' }, t('import.export.help')),
      h(
        'button',
        {
          class: `${BTN_GHOST} border border-line px-4`,
          attrs: { type: 'button', 'data-focus': 'export', ...busyAttrs(exporting, true) },
          on: { click: () => void runExport() },
        },
        exporting && icon('spinner', 'h-3.5 w-3.5 animate-spin'),
        t('settings.backup.export'),
      ),
    ),
    exportState === 'exported' &&
      h('p', { class: 'm-0 flex items-center gap-1 text-[12px] font-bold text-mint', attrs: { role: 'status' } }, icon('check', 'h-3 w-3', '3'), t('import.export.started')),
    exportState === 'error' && renderAlert({ message: t('settings.backup.exportFailed') }),
  );
}

function render(): HTMLElement {
  let body: Child[];
  switch (state.kind) {
    case 'idle':
      body = [
        h('p', { class: 'm-0 text-[12px] text-muted' }, t('import.intro')),
        state.error && renderAlert({ message: state.error }),
        renderFilePicker(t('import.choose')),
      ];
      break;
    case 'reading':
      body = [h('p', { class: 'm-0 flex items-center gap-2 text-[12px] text-muted', attrs: { role: 'status' } }, icon('spinner', 'h-4 w-4 animate-spin'), t('import.reading'))];
      break;
    case 'ready':
      body = renderReady(state);
      break;
    case 'done':
      body = renderDone();
      break;
  }
  return h(
    'div',
    { class: `${CARD} flex flex-col gap-4 p-5 shadow-pop` },
    renderHeader(),
    renderExport(),
    h(
      'section',
      { class: 'flex flex-col gap-4 border-t border-dotted border-line pt-4', attrs: { 'aria-labelledby': 'sk-import-title' } },
      h('h2', { class: SECTION_TITLE, attrs: { id: 'sk-import-title' } }, t('import.section.import')),
      ...nodes(body),
    ),
  );
}

// Langue lue avant le premier rendu ; un changement depuis le popup redessine la page
await initI18n();
document.title = t('import.pageTitle');
onLocaleChange(() => {
  document.title = t('import.pageTitle');
  setState(state);
});
setState(state);

// Ouverte par « Exporter » du popup : export lancé tout de suite, paramètre retiré (un rechargement ne relance rien)
const url = new URL(location.href);
if (url.searchParams.has(BACKUP_EXPORT_PARAM)) {
  url.searchParams.delete(BACKUP_EXPORT_PARAM);
  history.replaceState(null, '', url);
  void runExport();
}
