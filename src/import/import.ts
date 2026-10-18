import { getLocale, initI18n, onLocaleChange, t } from '../i18n';
import { BACKUP_MAX_BYTES, parseBackup, type ImportMode } from '../shared/backup';
import { applyBackup } from '../browser/storage/backup-store';
import { createStore } from '../ui/state';
import { BACKUP_EXPORT_PARAM, downloadBackup } from '../ui/backup-download';
import { notifyMappingsChanged } from '../ui/worker-call';
import { createLogger } from '../browser/logger';
import { mountBackupApp, type BackupActions } from './components/backup-app';
import { readyState, withConfirming, withIncludeSettings, withMode, type BackupPageState, type ExportState, type ImportState } from './view';

const log = createLogger('import');

// Page Sauvegarde ouverte dans un onglet depuis Réglages › Mes données : le sélecteur de fichier et la boîte
// « Enregistrer sous » fermeraient le popup. Export (lancé à l'ouverture avec `?export`) et import.
// Logique ici, rendu Preact dans components/backup-app.tsx (état publié dans `store`).

let state: ImportState = { kind: 'idle', error: null };
let exportState: ExportState = 'idle';

const store = createStore<BackupPageState>({ export: exportState, import: state });

function publish(): void {
  store.set({ export: exportState, import: state });
}

function setState(next: ImportState): void {
  state = next;
  publish();
}

/** Import en cours d'application : le fichier et les options sont figés */
function isApplying(): boolean {
  return state.kind === 'ready' && state.applying;
}

async function runExport(): Promise<void> {
  if (exportState === 'exporting') return;
  exportState = 'exporting';
  publish();
  try {
    await downloadBackup();
    exportState = 'exported';
  } catch (error: unknown) {
    log.error('Export de la sauvegarde impossible :', error);
    exportState = 'error';
  }
  publish();
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
    setState(readyState(file.name, result.data));
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
    // Correspondances restaurées : résolutions de page gardées en mémoire par le service worker oubliées (L4)
    void notifyMappingsChanged();
    // Résultat appliqué seulement si la page n'a pas changé d'état entre-temps (UI-07)
    if (state === applying) setState({ kind: 'done' });
  } catch (error: unknown) {
    log.error('Import impossible :', error);
    if (state === applying) setState({ ...current, applying: false, confirming: false, error: t('import.failed') });
  }
}

/** Options de l'import figées pendant l'application */
function updateReady(change: (ready: Extract<ImportState, { kind: 'ready' }>) => ImportState): void {
  if (state.kind !== 'ready' || state.applying) return;
  setState(change(state));
}

const actions: BackupActions = {
  exportBackup: () => void runExport(),
  chooseFile: (file) => void onFile(file),
  setMode: (mode: ImportMode) => updateReady((ready) => withMode(ready, mode)),
  setIncludeSettings: (include) => updateReady((ready) => withIncludeSettings(ready, include)),
  // Remplacement : confirmation d'abord (« Effacer et importer »)
  importBackup: () => (state.kind === 'ready' && state.mode === 'replace' ? updateReady((ready) => withConfirming(ready, true)) : void runImport()),
  confirmReplace: () => void runImport(),
  cancelReplace: () => updateReady((ready) => withConfirming(ready, false)),
  closeTab: () => {
    // window.close() ne ferme pas un onglet ouvert par chrome.tabs.create
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id !== undefined) void chrome.tabs.remove(tab.id);
    });
  },
};

// Langue lue avant le premier rendu ; un changement depuis le popup redessine la page (useLocale)
await initI18n();
document.title = t('import.pageTitle');
onLocaleChange(() => {
  document.title = t('import.pageTitle');
});
const app = document.getElementById('app');
if (app) mountBackupApp(app, store, actions);
log.debug(`Page Sauvegarde prête (${getLocale()})`);

// Ouverte par « Exporter » du popup : export lancé tout de suite, paramètre retiré (un rechargement ne relance rien)
const url = new URL(location.href);
if (url.searchParams.has(BACKUP_EXPORT_PARAM)) {
  url.searchParams.delete(BACKUP_EXPORT_PARAM);
  history.replaceState(null, '', url);
  void runExport();
}
