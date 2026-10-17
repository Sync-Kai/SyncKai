// Réglages › Mes données (maquettes Donnees, DonneesEtats) : import d'un historique (un bouton : la plateforme se
// choisit dans la page d'import), sauvegarde (export : en cours, « Exporté », échec ; import dans la page Sauvegarde)
// et ligne « Écarts AniList ↔ MyAnimeList » vers sa sous-page (compteur après la première analyse ; un seul compte
// connecté : ligne inactive avec « Comptes »). Les correspondances et les séries exclues sont dans Synchronisation.
import { t } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { BACKUP_EXPORT_PARAM, BACKUP_PAGE, downloadBackup } from '../backup-download';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { importPageUrl } from '../import-page';
import { useLocale, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import { diffBadge } from './compare-model';
import type { SettingsContext, SettingsMountedPage } from './context';
import { settingsPageTitle, settingsRowFocus } from './navigation';
import { preactPage } from './preact-page';

const log = createLogger('settings');

/** « Exporté » affiché ce temps, puis retiré */
const EXPORTED_BADGE_MS = 2_000;

export type ExportState = 'idle' | 'exporting' | 'exported' | 'error';

const CARD = 'rounded-card border border-line bg-surface';

/** Compteur d'écarts (après la première analyse) : pastille butter */
function DiffCount({ count }: { count: number }) {
  return (
    <span class="shrink-0 rounded-pill bg-butter/16 px-2 text-secondary font-extrabold text-butter tabular-nums" data-diff-count="">
      {count}
    </span>
  );
}

interface DataPageProps {
  ctx: SettingsContext;
  exportState: Store<ExportState>;
  onExport: () => void;
}

export function DataPage({ ctx, exportState, onExport }: DataPageProps) {
  useLocale();
  const exporting = useStore(exportState);
  const compare = useStore(ctx.host.compare().store);
  const anilist = useStore(ctx.host.accounts.anilist);
  const mal = useStore(ctx.host.accounts.mal);
  // Comptes en lecture : ligne de navigation normale (pas d'éclair de « Connecte AniList et MyAnimeList »)
  const loading = anilist.status === 'loading' || mal.status === 'loading';
  const both = anilist.status === 'logged-in' && mal.status === 'logged-in';
  const count = diffBadge(compare.result);
  const perSeries = `${settingsPageTitle('sync')} › ${t('settings.section.perSeries')}`;

  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.backup.crImport')}>
        <div class={`${CARD} flex flex-col gap-3 p-3`}>
          <div class="flex items-start gap-3">
            <span class="flex size-icon-button shrink-0 items-center justify-center rounded-control bg-lavender/16 text-lavender" aria-hidden="true">
              <Icon name="download" class="size-4" strokeWidth="2.2" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-body font-bold">{t('settings.import.title')}</span>
              <span class="text-secondary text-muted">{t('settings.crImport.help')}</span>
            </span>
          </div>
          <Button variant="primary" class="w-full" focusKey="history-import" onClick={() => ctx.host.openTab(importPageUrl())}>
            {t('settings.backup.crImport')}
            <Icon name="external" class="size-3.5" strokeWidth="2.4" />
          </Button>
        </div>
      </Section>

      <Section title={t('settings.section.backup')}>
        <div class={`${CARD} flex flex-col gap-3 p-3`}>
          <p class="m-0 text-secondary text-muted">{t('settings.backup.help')}</p>
          <div class="grid grid-cols-2 gap-2">
            <Button
              class="w-full"
              busy={exporting === 'exporting'}
              focusKey="backup-export"
              title={t(ctx.host.closesOnBlur ? 'settings.backup.exportTabTitle' : 'settings.backup.exportTitle')}
              onClick={onExport}
            >
              {t('settings.backup.export')}
            </Button>
            {/* Onglet dédié : le sélecteur de fichier fermerait le popup */}
            <Button class="w-full" focusKey="backup-import" title={t('settings.backup.importTitle')} onClick={() => ctx.host.openTab(chrome.runtime.getURL(BACKUP_PAGE))}>
              {t('settings.backup.import')}
              <Icon name="external" class="size-3.5" strokeWidth="2.4" />
            </Button>
          </div>
          {exporting === 'exported' && (
            <p class="m-0 flex items-center gap-1 text-secondary font-bold text-mint" role="status" data-export-status="exported">
              <Icon name="check" class="size-3 shrink-0" strokeWidth="3" />
              {t('settings.backup.exported')}
            </p>
          )}
          {exporting === 'error' && <Alert message={t('settings.backup.exportFailed')} />}
        </div>
      </Section>

      <Section title={t('settings.section.compare')}>
        <SettingsCard>
          {loading || both ? (
            <SettingsRow
              title={t('settings.compare.title')}
              description={t('settings.compare.help')}
              onClick={() => ctx.openCategory('compare')}
              focusKey={settingsRowFocus('compare')}
              trailing={count !== null && count > 0 && !loading ? <DiffCount count={count} /> : undefined}
            />
          ) : (
            <SettingsRow
              title={t('settings.compare.title')}
              description={t('compare.error.notConnected')}
              trailing={
                <Button size="sm" focusKey="compare-accounts" onClick={() => ctx.openCategory('accounts')}>
                  {t('settings.section.accounts')}
                </Button>
              }
            />
          )}
        </SettingsCard>
      </Section>
      <p class="m-0 mx-1 text-secondary text-muted">{t('settings.data.perSeries', { path: perSeries })}</p>
    </div>
  );
}

export function createDataPage(ctx: SettingsContext): SettingsMountedPage {
  // État de l'export gardé entre deux visites : un export lancé se termine même si l'on quitte la page
  const exportState = createStore<ExportState>('idle');
  let exportTimer: ReturnType<typeof setTimeout> | undefined;

  async function runExport(): Promise<void> {
    if (exportState.get() === 'exporting') return;
    // Popup : la boîte « Enregistrer sous » le fermerait avec le fichier en cours ; export depuis la page Sauvegarde
    if (ctx.host.closesOnBlur) {
      ctx.host.openTab(`${chrome.runtime.getURL(BACKUP_PAGE)}?${BACKUP_EXPORT_PARAM}`);
      return;
    }
    clearTimeout(exportTimer);
    exportState.set('exporting');
    try {
      await downloadBackup();
      exportState.set('exported');
      exportTimer = setTimeout(() => exportState.set('idle'), EXPORTED_BADGE_MS);
    } catch (error: unknown) {
      log.error('Export de la sauvegarde impossible :', error);
      exportState.set('error');
    }
  }

  return preactPage(() => <DataPage ctx={ctx} exportState={exportState} onExport={() => void runExport()} />);
}
