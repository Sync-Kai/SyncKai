// Réglages › Affichage (maquette Affichage) : langue de l'interface (page Langue), panneau latéral (onglet à
// l'ouverture, progression en direct) et raccourcis clavier (page Raccourcis, la ligne décrit les touches sans les montrer).
import { useId } from 'preact/hooks';
import { getLocale, t } from '../../i18n';
import type { PanelDefaultTab } from '../../shared/settings';
import { Section } from '../components/section';
import { Segmented } from '../components/segmented';
import { SettingsCard, SettingsRow } from '../components/settings-row';
import { useLocale, useStore } from '../preact/hooks';
import type { SettingsContext, SettingsMountedPage } from './context';
import { settingsRowFocus } from './navigation';
import { SettingsPlaceholder } from './placeholder';
import { preactPage } from './preact-page';
import { languageSummary } from './summary';

function panelTabOptions(): { value: PanelDefaultTab; label: string }[] {
  return [
    { value: 'last', label: t('settings.panel.tab.last') },
    { value: 'nowPlaying', label: t('panel.tab.nowPlaying') },
    { value: 'agenda', label: t('panel.tab.agenda') },
  ];
}

export function DisplayPage({ ctx }: { ctx: SettingsContext }) {
  useLocale();
  const data = useStore(ctx.state);
  const tabLabel = useId();
  const s = data.settings;
  if (!s) return <SettingsPlaceholder error={data.settingsError} />;
  return (
    <div class="flex flex-col gap-4">
      <Section title={t('settings.section.language')}>
        <SettingsCard>
          <SettingsRow
            title={t('settings.language.groupLabel')}
            description={languageSummary(s.language, getLocale())}
            onClick={() => ctx.openCategory('language')}
            focusKey={settingsRowFocus('language')}
          />
        </SettingsCard>
      </Section>
      <Section title={t('settings.section.panel')}>
        <SettingsCard>
          <div class="flex flex-col gap-2 p-3">
            <span class="text-body font-bold" id={tabLabel}>
              {t('settings.panel.defaultTab')}
            </span>
            <Segmented
              options={panelTabOptions()}
              value={s.panelDefaultTab}
              onChange={(value) => void ctx.update({ panelDefaultTab: value })}
              labelledBy={tabLabel}
              focusKey="panel-tab"
              fill
            />
          </div>
          <SettingsRow
            title={t('settings.panel.live.label')}
            description={t('settings.panel.live.help')}
            toggle={{ checked: s.panelLiveProgress, onChange: (checked) => void ctx.update({ panelLiveProgress: checked }) }}
            focusKey="sk-panel-live"
            divider
          />
        </SettingsCard>
      </Section>
      <Section title={t('settings.display.keyboard')}>
        <SettingsCard>
          <SettingsRow
            title={t('settings.shortcuts.pointer')}
            description={t('settings.display.shortcutsHelp')}
            onClick={() => ctx.openCategory('shortcuts')}
            focusKey={settingsRowFocus('shortcuts')}
          />
        </SettingsCard>
      </Section>
    </div>
  );
}

export function createDisplayPage(ctx: SettingsContext): SettingsMountedPage {
  return preactPage(() => <DisplayPage ctx={ctx} />);
}
