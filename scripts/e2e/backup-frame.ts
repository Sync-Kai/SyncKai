// Page de test : monte la VRAIE page Sauvegarde (src/import/import.ts) sur l'API chrome simulée. Stockage semé d'un
// réglage et d'une correspondance ; l'import écrit dans ce stockage. Traces lues via `window.__e2e`.
import '../../src/import/import.css';
import manifest from '../../manifest.json';
import { SETTINGS_STORAGE_KEY } from '../../src/shared/settings';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { installChromeMock } from '../screenshots/mock-chrome';
import { loadedUiLocaleParam, param } from '../screenshots/params';
import type { E2EState } from './protocol';

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [], openedTabs: [] };
window.__e2e = trace;

/** `export=fail` : le téléchargement de l'export échoue (lien du fichier impossible à créer) */
if (param('export') === 'fail') {
  URL.createObjectURL = () => {
    throw new Error('Export simulé en échec');
  };
}

const uiLocale = await loadedUiLocaleParam();

installChromeMock({
  locale: uiLocale,
  version: manifest.version,
  storage: {
    [SETTINGS_STORAGE_KEY]: { language: uiLocale },
    [STORAGE_KEYS.mediaMappings]: { 'crunchyroll:GFRIEREN:s1': { mediaId: 154587, seriesLabel: 'Frieren · S1', updatedAt: 1 } },
  },
  handlers: { MAPPINGS_CHANGED: () => ({ ok: true, data: null }) },
  onSendMessage: (message) => trace.messages.push(message),
});

/** `import=hold` : l'écriture de la sauvegarde ne finit jamais (« Import… ») ; `import=fail` : elle échoue */
const importMode = param('import');
if (importMode === 'hold' || importMode === 'fail') {
  chrome.storage.local.set = () => (importMode === 'hold' ? new Promise<void>(() => undefined) : Promise.reject(new Error('Écriture simulée en échec')));
}

await import('../../src/import/import.ts');
