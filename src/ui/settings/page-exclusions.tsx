// Réglages › Synchronisation › Séries exclues (maquettes SyncExclues, SyncExcluesEtats) : séries jamais synchronisées, avec
// leur plateforme, l'année d'une série désignée par son titre et la date d'exclusion, et « Réactiver ». États : chargement
// (squelette), lecture impossible, réactivation en cours (les autres boutons attendent), réactivation en échec, liste vide.
// La liste est relue par la vue (storage.onChanged) : la ligne disparaît une fois la série réactivée.
import type { ComponentChild } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { includeSeries } from '../../browser/storage/exclusions-store';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { ServiceLogo } from '../components/service-logo';
import { useFocusFallback, useLocale, useStore } from '../preact/hooks';
import type { SettingsContext, SettingsMountedPage } from './context';
import { exclusionRows, type ExclusionRowModel } from './exclusions-model';
import { preactPage } from './preact-page';

const log = createLogger('settings');

const CARD = 'rounded-card border border-line bg-surface';
/** Séparateur entre deux lignes, décalé après le logo */
const ROW_DIVIDER = 'before:absolute before:top-0 before:right-3 before:left-12 before:h-px before:bg-line';

function ExclusionRow({ row, first, busy, blocked, onReactivate }: { row: ExclusionRowModel; first: boolean; busy: boolean; blocked: boolean; onReactivate: () => void }) {
  return (
    <li class={`relative flex min-h-14 items-center gap-3 px-3 py-2.5 ${first ? '' : ROW_DIVIDER}`} data-exclusion={row.id}>
      <span class="flex w-6 shrink-0 justify-center text-muted">
        {row.platform !== null ? <ServiceLogo id={row.platform} size="lg" /> : <Icon name="ban" class="size-4" strokeWidth="2.2" />}
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="font-bold break-words">{row.label}</span>
        {row.meta !== '' && <span class="text-secondary text-muted">{row.meta}</span>}
      </span>
      <Button
        busy={busy}
        disabled={blocked && !busy}
        ariaLabel={t('settings.exclusions.reactivateAria', { title: row.label })}
        focusKey={`include-${row.id}`}
        onClick={onReactivate}
      >
        {t('settings.exclusions.reactivate')}
      </Button>
    </li>
  );
}

/** Squelette de deux lignes (lecture des exclusions) */
function ExclusionsSkeleton() {
  return (
    <div class={`${CARD} flex flex-col`} aria-busy="true" aria-label={t('settings.exclusions.loading')} data-exclusions-skeleton="">
      {[0, 1].map((index) => (
        <div key={index} class={`relative flex items-center gap-3 px-3 py-2.5 ${index === 0 ? '' : ROW_DIVIDER}`} aria-hidden="true">
          <span class="h-10 w-7 shrink-0 rounded-cover bg-raised motion-safe:animate-pulse" />
          <span class="flex flex-1 flex-col gap-1.5">
            <span class="h-3 w-2/5 rounded-pill bg-raised motion-safe:animate-pulse" />
            <span class="h-2.5 w-3/5 rounded-pill bg-raised motion-safe:animate-pulse" />
          </span>
          <span class="h-8 w-22 shrink-0 rounded-pill bg-raised motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ExclusionsPage({ ctx }: { ctx: SettingsContext }) {
  useLocale();
  const data = useStore(ctx.state);
  const root = useRef<HTMLDivElement>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Ligne réactivée retirée : focus sur la ligne voisine, sinon le titre de la page
  useFocusFallback(root);
  const { exclusions } = data;

  async function reactivate(id: string): Promise<void> {
    setReactivating(id);
    setFailed(false);
    try {
      // La liste est relue par la vue via storage.onChanged
      await includeSeries(id);
    } catch (error: unknown) {
      log.error('Réactivation de la série impossible :', error);
      setFailed(true);
    }
    setReactivating(null);
  }

  const title = t('settings.exclusions.section');
  let body: ComponentChild;
  if (exclusions.status === 'loading') {
    body = (
      <Section title={title}>
        <ExclusionsSkeleton />
      </Section>
    );
  } else if (exclusions.status === 'error') {
    body = (
      <Section title={title}>
        <div class={`${CARD} p-3`}>
          <Alert message={t('settings.exclusions.loadError')} />
        </div>
      </Section>
    );
  } else if (exclusions.items.length === 0) {
    body = (
      <div class="flex flex-col items-center gap-1.5 rounded-card border border-dashed border-line bg-surface px-3 py-4 text-center" data-exclusions-empty="">
        <span class="flex size-8 items-center justify-center rounded-pill bg-mint/14 text-mint" aria-hidden="true">
          <Icon name="check" class="size-4" strokeWidth="2.6" />
        </span>
        <span class="font-bold">{t('settings.exclusions.empty')}</span>
        <span class="text-secondary text-muted">{t('settings.exclusions.emptyHelp', { action: t('common.stopSyncSeries') })}</span>
      </div>
    );
  } else {
    const rows = exclusionRows(exclusions.items, Date.now());
    body = (
      <>
        <Section title={title} count={rows.length}>
          <div class={`${CARD} flex flex-col`}>
            <ul class="m-0 flex list-none flex-col p-0">
              {rows.map((row, index) => (
                <ExclusionRow
                  key={row.id}
                  row={row}
                  first={index === 0}
                  busy={reactivating === row.id}
                  blocked={reactivating !== null}
                  onReactivate={() => void reactivate(row.id)}
                />
              ))}
            </ul>
            {failed && <Alert class="mx-3 mb-3" message={t('settings.exclusions.reactivateFailed')} />}
          </div>
        </Section>
        <p class="m-0 mx-1 text-secondary text-muted">{t('settings.exclusions.help', { action: t('settings.exclusions.reactivate') })}</p>
      </>
    );
  }
  return (
    <div ref={root} class="flex flex-col gap-3">
      {body}
    </div>
  );
}

export function createExclusionsPage(ctx: SettingsContext): SettingsMountedPage {
  return preactPage(() => <ExclusionsPage ctx={ctx} />);
}
