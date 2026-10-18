// Page Sauvegarde (onglet de 720 px, maquettes Sauvegarde, SauvegardeEtats) : en-tête SyncKai, titre, puis l'export
// (fichier .json, ce qu'il contient et ne contient jamais, téléchargement lancé ou échec) et l'import (choix du fichier,
// lecture, contenu, mode, réglages, confirmation du remplacement, import en cours, échec, terminé). Logique dans
// ../import.ts, règles dans ../view.ts.
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { getLocale, t, tp } from '../../i18n';
import type { ImportMode } from '../../shared/backup';
import type { IconName } from '../../ui/icons';
import { alertAttrs } from '../../ui/live-region';
import type { ReadonlyStore } from '../../ui/state';
import { Alert } from '../../ui/components/alert';
import { Button, buttonClass, type ButtonSize } from '../../ui/components/button';
import { Checkbox } from '../../ui/components/checkbox';
import { ChoiceCards } from '../../ui/components/choice-cards';
import { Icon } from '../../ui/components/icon';
import { PageHeader } from '../../ui/components/page-header';
import { useFocusFallback, useLocale, useStore } from '../../ui/preact/hooks';
import { fileContents, type BackupPageState, type ExportState, type ImportState, type ReadyState } from '../view';

export interface BackupActions {
  exportBackup(): void;
  /** Fichier choisi (sélecteur), lu puis vérifié */
  chooseFile(file: File | undefined): void;
  setMode(mode: ImportMode): void;
  setIncludeSettings(include: boolean): void;
  /** « Importer » : tout de suite en fusion, après confirmation en remplacement */
  importBackup(): void;
  /** « Effacer et importer » */
  confirmReplace(): void;
  cancelReplace(): void;
  closeTab(): void;
}

/** Colonne de la page : 576 px de contenu dans l'onglet de 720 px, gouttières de 16 px en fenêtre étroite */
const COLUMN = 'mx-auto w-full max-w-152 px-4';
const CARD = 'rounded-card border border-line bg-surface';
const SECTION_TITLE = 'm-0 mx-1 mt-2 text-section uppercase text-muted';
const SUB_TITLE = 'm-0 text-section uppercase';
const SPIN = 'animate-spin motion-reduce:animate-none';

function TileIcon({ name }: { name: IconName }) {
  return (
    <span class="flex size-7 shrink-0 items-center justify-center rounded-control bg-lavender/16 text-lavender" aria-hidden="true">
      <Icon name={name} class="size-3.5" strokeWidth="2.4" />
    </span>
  );
}

/** Ce que contient le fichier exporté, et ce qu'il ne contient jamais (les connexions) */
function Contents() {
  const included = [t('import.includes.settings'), t('import.includes.matches'), t('import.includes.history')];
  return (
    <div class="grid grid-cols-1 gap-2 @min-[26rem]:grid-cols-[3fr_2fr]">
      <div class="flex flex-col gap-1.5 rounded-panel bg-raised px-3 py-2.5">
        <h3 class={`${SUB_TITLE} text-mint`}>{t('import.included')}</h3>
        <ul class="m-0 flex list-none flex-col gap-1 p-0 text-secondary">
          {included.map((text) => (
            <li key={text} class="flex items-start gap-2">
              <span class="flex shrink-0 pt-0.5 text-mint">
                <Icon name="check" class="size-3.5" strokeWidth="3" />
              </span>
              <span class="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div class="flex flex-col gap-1.5 rounded-panel border border-line px-3 py-2.5">
        <h3 class={`${SUB_TITLE} text-danger`}>{t('import.neverIncluded')}</h3>
        <p class="m-0 flex items-start gap-2 text-secondary">
          <span class="flex shrink-0 pt-0.5 text-danger">
            <Icon name="close" class="size-3.5" strokeWidth="3" />
          </span>
          <span class="min-w-0 break-words">{t('import.includes.signIns')}</span>
        </p>
      </div>
    </div>
  );
}

function ExportSection({ state, onExport }: { state: ExportState; onExport: () => void }) {
  return (
    <section class="flex flex-col gap-2" aria-labelledby="sk-export-title">
      <h2 class={SECTION_TITLE} id="sk-export-title">
        {t('import.section.export')}
      </h2>
      <div class={`${CARD} @container flex flex-col gap-3 p-4`} data-export={state}>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <span class="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <TileIcon name="download" />
            <span class="flex min-w-0 flex-col">
              <span class="font-bold break-words">{t('settings.backup.exportTitle')}</span>
              <span class="text-secondary text-muted break-words">{t('import.export.help')}</span>
            </span>
          </span>
          <Button busy={state === 'exporting'} focusKey="export" onClick={onExport}>
            {t('settings.backup.export')}
          </Button>
        </div>
        <Contents />
        {state === 'exported' && (
          <p class="m-0 flex items-center gap-1.5 text-secondary font-bold text-mint" role="status">
            <Icon name="check" class="size-3.5" strokeWidth="3" />
            {t('import.export.started')}
          </p>
        )}
        {state === 'error' && <Alert message={t('settings.backup.exportFailed')} />}
      </div>
    </section>
  );
}

/** Sélecteur de fichier : le libellé porte le style du bouton, l'input masqué garde le focus clavier (anneau du libellé) */
function FilePicker({ label, disabled = false, size = 'md', onFile }: { label: string; disabled?: boolean; size?: ButtonSize; onFile: (file: File | undefined) => void }) {
  return (
    <label
      class={`${buttonClass('secondary', size)} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lavender ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      data-file-picker=""
    >
      <input
        class="sr-only"
        id="sk-file"
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        data-focus="file"
        onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          input.value = '';
          onFile(file);
        }}
      />
      {label}
    </label>
  );
}

const formatDate = (iso: string): string => new Date(iso).toLocaleString(getLocale(), { dateStyle: 'long', timeStyle: 'short' });

const VALUE_TONES = { ok: 'text-mint', warn: 'text-butter' } as const;

/** Fichier choisi, son contenu (masqué pendant l'import), le mode, les réglages, puis « Importer » ou la confirmation */
function Ready({ state, actions }: { state: ReadyState; actions: BackupActions }) {
  const { parsed, applying } = state;
  const hasSettings = parsed.backup.data.settings !== null;
  const confirmRef = useRef<HTMLDivElement>(null);
  const confirming = state.mode === 'replace' && state.confirming;
  // Confirmation affichée : le focus va sur « Annuler » (une confirmation en place ne part jamais au clavier par mégarde)
  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector<HTMLElement>('[data-focus="cancel"]')?.focus();
  }, [confirming]);
  return (
    <>
      <div class="flex flex-wrap items-center justify-end gap-3 rounded-panel border border-dashed border-field px-3 py-2.5" data-backup-file="">
        <span class="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-control bg-raised text-muted" aria-hidden="true">
            <Icon name="file" class="size-3.5" strokeWidth="2.2" />
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="font-bold break-all">{state.fileName}</span>
            <span class="text-secondary text-muted">{t('import.exportedAt', { date: formatDate(parsed.backup.exportedAt), version: parsed.backup.appVersion })}</span>
          </span>
        </span>
        {/* Pas d'autre fichier pendant l'import : l'état de l'import en cours serait écrasé (UI-07) */}
        <FilePicker label={t('import.chooseOther')} size="sm" disabled={applying} onFile={actions.chooseFile} />
      </div>

      {!applying && (
        <section class="flex flex-col gap-1.5" aria-labelledby="sk-file-contents">
          <h3 class={`${SUB_TITLE} text-muted`} id="sk-file-contents">
            {t('import.fileContents')}
          </h3>
          <dl class="m-0 flex flex-col rounded-panel bg-raised px-3 py-1 text-secondary">
            {fileContents(parsed).map((row) => (
              <div key={row.id} class="flex items-baseline justify-between gap-3 border-t border-line py-1.5 first:border-t-0" data-content={row.id}>
                <dt class="min-w-0 break-words text-muted">{row.label}</dt>
                <dd class={`m-0 shrink-0 font-bold tabular-nums ${row.tone ? VALUE_TONES[row.tone] : 'text-ink'}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          {parsed.invalidCount > 0 && (
            <p class="m-0 flex items-start gap-2 text-secondary font-bold text-butter">
              <span class="flex shrink-0 pt-0.5">
                <Icon name="info" class="size-3.5" strokeWidth="2.4" />
              </span>
              <span class="min-w-0 break-words" data-invalid="">
                {tp('import.invalid', parsed.invalidCount)}
              </span>
            </p>
          )}
        </section>
      )}

      <section class="flex flex-col gap-1.5" aria-labelledby="sk-import-mode">
        <h3 class={`${SUB_TITLE} text-muted`} id="sk-import-mode">
          {t('import.mode')}
        </h3>
        <ChoiceCards
          legend={t('import.mode')}
          legendHidden
          columns
          options={[
            { value: 'merge', label: t('import.merge.title'), description: t('import.merge.detail') },
            { value: 'replace', label: t('import.replace.title'), description: t('import.replace.detail') },
          ]}
          value={state.mode}
          disabled={applying}
          focusKey="sk-mode"
          onChange={actions.setMode}
        />
      </section>

      <label class={`flex items-center gap-2.5 font-bold ${hasSettings && !applying ? 'cursor-pointer' : 'opacity-50'}`}>
        <Checkbox checked={state.includeSettings} disabled={!hasSettings || applying} id="sk-settings" focusKey="settings" onChange={actions.setIncludeSettings} />
        {hasSettings ? t('import.includeSettings') : t('import.includeSettingsMissing')}
      </label>

      {state.error && <Alert message={state.error} />}

      <div class="border-t border-line pt-3">
        {confirming ? (
          <div
            ref={confirmRef}
            class="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-menu border border-danger/45 bg-danger/10 px-3 py-2.5"
            data-replace-confirm=""
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || applying) return;
              event.preventDefault();
              actions.cancelReplace();
            }}
          >
            <p class="m-0 min-w-0 flex-1 basis-56 font-bold text-danger break-words" {...alertAttrs(t('import.replaceWarning'))}>
              {t('import.replaceWarning')}
            </p>
            <span class="flex shrink-0 gap-2">
              <Button disabled={applying} focusKey="cancel" onClick={actions.cancelReplace}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" busy={applying} focusKey="confirm" onClick={actions.confirmReplace}>
                {applying ? t('import.importing') : t('import.eraseAndImport')}
              </Button>
            </span>
          </div>
        ) : (
          <div class="flex justify-end">
            <Button variant="primary" busy={applying} focusKey="import" onClick={actions.importBackup}>
              {applying ? t('import.importing') : t('import.import')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function Done({ onClose }: { onClose: () => void }) {
  return (
    <div class="flex flex-col items-center gap-2 py-2 text-center" role="status" data-backup-done="">
      <span class="flex size-10 items-center justify-center rounded-pill bg-mint text-on-fill" aria-hidden="true">
        <Icon name="check" class="size-5" strokeWidth="2.6" />
      </span>
      <p class="m-0 text-stat font-display">{t('import.done')}</p>
      <p class="m-0 text-secondary text-muted">{t('import.doneHint')}</p>
      <Button focusKey="close-tab" onClick={onClose}>
        {t('import.closeTab')}
      </Button>
    </div>
  );
}

function ImportBody({ state, actions }: { state: ImportState; actions: BackupActions }) {
  switch (state.kind) {
    case 'idle':
      return (
        <>
          <p class="m-0 text-secondary">{t('import.intro')}</p>
          {state.error && <Alert message={state.error} />}
          <div class="flex">
            <FilePicker label={t('import.choose')} onFile={actions.chooseFile} />
          </div>
        </>
      );
    case 'reading':
      return (
        <p class="m-0 flex items-center gap-2 text-secondary text-muted" role="status">
          <Icon name="spinner" class={`size-4 shrink-0 text-lavender ${SPIN}`} strokeWidth="2.6" />
          {t('import.reading')}
        </p>
      );
    case 'ready':
      return <Ready state={state} actions={actions} />;
    case 'done':
      return <Done onClose={actions.closeTab} />;
  }
}

export function BackupApp({ store, actions }: { store: ReadonlyStore<BackupPageState>; actions: BackupActions }) {
  useLocale();
  const page = useStore(store);
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root);
  return (
    <div ref={root} class="flex min-h-full flex-col">
      <PageHeader column={COLUMN} />
      <main class={`${COLUMN} flex flex-1 flex-col gap-3 pt-6 pb-8`}>
        <div class="flex flex-col gap-0.5">
          <h1 class="m-0 font-display text-stat">{t('import.title')}</h1>
          <p class="m-0 text-secondary text-muted">{t('import.subtitle')}</p>
        </div>
        <ExportSection state={page.export} onExport={actions.exportBackup} />
        <section class="flex flex-col gap-2" aria-labelledby="sk-import-title">
          <h2 class={SECTION_TITLE} id="sk-import-title">
            {t('import.section.import')}
          </h2>
          <div class={`${CARD} @container flex flex-col gap-3 p-4`} data-import={page.import.kind}>
            <ImportBody state={page.import} actions={actions} />
          </div>
        </section>
      </main>
    </div>
  );
}

/** Monte la page dans `container` ; renvoie le démontage */
export function mountBackupApp(container: HTMLElement, store: ReadonlyStore<BackupPageState>, actions: BackupActions): () => void {
  render(<BackupApp store={store} actions={actions} />, container);
  return () => render(null, container);
}
