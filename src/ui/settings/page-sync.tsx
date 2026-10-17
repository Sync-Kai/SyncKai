// Réglages › Synchronisation (maquettes Sync, SyncEtats) : synchro automatique (en pause : avertissement butter), moment
// où l'épisode compte comme vu (au générique ou à un pourcentage fixe) et curseur du pourcentage (pourcentage de repli en
// mode générique), puis les pages « Par série » : Correspondances et Séries exclues. Le lecteur préféré et les accès aux
// plateformes optionnelles sont dans Plateformes (page-platforms.ts).
import { useId, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { PERCENTAGE_RANGE, type CompletionTrigger, type SyncSettings } from '../../shared/settings';
import { ChoiceCards } from '../components/choice-cards';
import { Section } from '../components/section';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { useLocale, useStore } from '../preact/hooks';
import type { SettingsContext, SettingsData, SettingsMountedPage } from './context';
import { settingsRowFocus } from './navigation';
import { SettingsPlaceholder } from './placeholder';
import { preactPage } from './preact-page';

/** "85 %" (fr, de) / "85%" (en) */
export function formatPercent(value: number): string {
  return t('settings.percent', { value });
}

function triggerOptions(): { value: CompletionTrigger; label: string; description: string }[] {
  return [
    { value: 'credits', label: t('settings.trigger.credits'), description: t('settings.trigger.creditsHelp') },
    { value: 'percentage', label: t('settings.trigger.percentage'), description: t('settings.trigger.percentageHelp') },
  ];
}

/**
 * Curseur du pourcentage (70–98 %) : la valeur affichée suit le glissement (`input`), l'enregistrement se fait au relâchement
 * (`change`). Mode générique : pourcentage de repli (plateforme sans générique, ADN).
 */
function PercentField({ settings, onSave }: { settings: SyncSettings; onSave: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? settings.completionPercentage;
  const percentage = settings.completionTrigger === 'percentage';
  return (
    <div class="flex flex-col gap-1 px-0.5 pt-1">
      <div class="flex items-center justify-between gap-3">
        <label class="font-bold" for={`${id}-range`}>
          {t(percentage ? 'settings.percentage.label' : 'settings.percentage.fallbackLabel')}
        </label>
        <span class={`shrink-0 font-extrabold tabular-nums ${draft !== null ? 'text-lavender' : ''}`} aria-hidden="true" data-percent-value="">
          {formatPercent(value)}
        </span>
      </div>
      <input
        class="m-0 h-6 w-full cursor-pointer accent-lavender"
        id={`${id}-range`}
        type="range"
        min={PERCENTAGE_RANGE.min}
        max={PERCENTAGE_RANGE.max}
        step={1}
        value={value}
        aria-describedby={`${id}-help`}
        aria-valuetext={formatPercent(value)}
        data-focus="pct"
        onInput={(event) => setDraft(Number(event.currentTarget.value))}
        onChange={(event) => {
          setDraft(null);
          onSave(Number(event.currentTarget.value));
        }}
      />
      <div class="flex justify-between text-section tracking-normal text-muted tabular-nums" aria-hidden="true">
        <span>{formatPercent(PERCENTAGE_RANGE.min)}</span>
        <span>{formatPercent(PERCENTAGE_RANGE.max)}</span>
      </div>
      <span class="text-secondary text-muted" id={`${id}-help`}>
        {t(percentage ? 'settings.percentage.help' : 'settings.percentage.fallbackHelp')}
      </span>
    </div>
  );
}

/** Nombre affiché à droite d'une ligne « Par série » ; null : pas encore lu (ou illisible) */
function mappingsCount(data: SettingsData): string | undefined {
  return data.mappings !== null && data.mappingsError === null ? String(data.mappings.length) : undefined;
}

function exclusionsCount(data: SettingsData): string | undefined {
  return data.exclusions.status === 'ready' ? String(data.exclusions.items.length) : undefined;
}

export function SyncPage({ ctx }: { ctx: SettingsContext }) {
  useLocale();
  const data = useStore(ctx.state);
  const s = data.settings;
  if (!s) return <SettingsPlaceholder error={data.settingsError} />;
  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.section.automatic')}>
        <SettingsCard>
          <SettingsRow
            title={t('settings.autoSync.label')}
            description={t(s.autoSync ? 'settings.autoSync.helpOn' : 'settings.autoSync.helpOff')}
            descriptionTone={s.autoSync ? undefined : 'warn'}
            toggle={{ checked: s.autoSync, onChange: (checked) => void ctx.update({ autoSync: checked }) }}
            focusKey="sk-auto"
          />
          <div class="relative flex flex-col gap-2 p-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-line">
            <ChoiceCards
              legend={t('settings.trigger.legend')}
              options={triggerOptions()}
              value={s.completionTrigger}
              onChange={(value) => void ctx.update({ completionTrigger: value })}
              focusKey="trigger"
            />
            <PercentField settings={s} onSave={(value) => void ctx.update({ completionPercentage: value })} />
          </div>
        </SettingsCard>
      </Section>
      <Section title={t('settings.section.perSeries')}>
        <SettingsCard>
          <SettingsRow
            title={t('settings.sync.mappingsRow')}
            description={t('settings.sync.mappingsRowHelp')}
            summary={mappingsCount(data)}
            onClick={() => ctx.openCategory('mappings')}
            focusKey={settingsRowFocus('mappings')}
          />
          <SettingsRow
            title={t('settings.section.exclusions')}
            description={t('settings.sync.exclusionsRowHelp')}
            summary={exclusionsCount(data)}
            onClick={() => ctx.openCategory('exclusions')}
            focusKey={settingsRowFocus('exclusions')}
            divider
          />
        </SettingsCard>
      </Section>
    </div>
  );
}

export function createSyncPage(ctx: SettingsContext): SettingsMountedPage {
  return preactPage(() => <SyncPage ctx={ctx} />);
}
