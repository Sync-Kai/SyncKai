// Réglages › Affichage › Langue (maquettes Langue, LangueRecherche) : champ de recherche, puis liste de boutons radio
// (« Automatique » épinglé en tête, puis les langues triées par endonyme, nom dans la langue de l'interface à droite)
// et lien « Aider à traduire » si TRANSLATION_URL existe. Le modèle (sans DOM) est testé, le rendu par les tests de bout en bout.
import { detectUiLocale, getLocale, t, type Locale } from '../../i18n';
import { filterLanguages, endonym, showsLanguageSearch, supportedLanguages, TRANSLATION_URL } from '../../i18n/language-list';
import type { LanguageSetting } from '../../shared/settings';
import { Icon } from '../components/icon';
import { useLocale, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage } from './context';
import { SettingsPlaceholder } from './placeholder';
import { preactPage } from './preact-page';

const RADIO_NAME = 'sk-language';
const LIST_ID = 'sk-language-list';

export interface LanguageRowModel {
  value: LanguageSetting;
  label: string;
  subtitle: string | null;
  /** Langue du libellé (`lang`), pour la synthèse vocale ; null : langue de l'interface */
  lang: Locale | null;
  checked: boolean;
}

export interface LanguagePageModel {
  /** Champ de recherche affiché (nombre de langues ≥ LANGUAGE_SEARCH_MIN) */
  search: boolean;
  /** « Automatique », toujours en tête, jamais filtré */
  auto: LanguageRowModel;
  /** Langues retenues par la recherche, triées par endonyme */
  rows: LanguageRowModel[];
  /** Ligne « Aider à traduire SyncKai » ; null : masquée */
  translationUrl: string | null;
}

export interface LanguagePageInput {
  setting: LanguageSetting;
  /** Langue de l'interface (noms traduits) */
  uiLocale: Locale;
  /** Langue détectée du navigateur (sous-titre d'« Automatique ») */
  browserLocale: Locale;
  query: string;
  translationUrl: string | null;
}

export function languagePageModel({ setting, uiLocale, browserLocale, query, translationUrl }: LanguagePageInput): LanguagePageModel {
  const all = supportedLanguages(uiLocale);
  const search = showsLanguageSearch(all.length);
  return {
    search,
    auto: {
      value: 'auto',
      label: t('settings.language.auto'),
      subtitle: t('settings.language.autoDetail', { language: endonym(browserLocale) }),
      lang: null,
      checked: setting === 'auto',
    },
    // Champ masqué : une recherche restée en mémoire ne filtre rien
    rows: filterLanguages(all, search ? query : '').map((entry) => ({ value: entry.code, label: entry.endonym, subtitle: entry.subtitle, lang: entry.code, checked: setting === entry.code })),
    translationUrl,
  };
}

const SEARCH_FOCUS = 'language-search';

/** Une langue : vrai bouton radio (masqué, cercle dessiné à côté), choisie = fond `raised` (maquette Langue) */
function LanguageRow({ row, stacked, onPick }: { row: LanguageRowModel; stacked: boolean; onPick: (value: LanguageSetting) => void }) {
  return (
    <label class="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-panel px-2.5 py-1.5 transition-colors hover:bg-raised has-checked:bg-raised" data-language-row={row.value}>
      <input
        class="peer sr-only"
        type="radio"
        name={RADIO_NAME}
        value={row.value}
        checked={row.checked}
        data-focus={`language-${row.value}`}
        // Enregistré tout de suite : la vue se redessine dans la nouvelle langue (onLocaleChange), sans rechargement
        onChange={(event) => {
          if (event.currentTarget.checked) onPick(row.value);
        }}
      />
      <span
        class="flex size-4.5 shrink-0 items-center justify-center rounded-pill border-2 border-field peer-checked:border-lavender peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender"
        aria-hidden="true"
      >
        <span class={`size-2 rounded-pill ${row.checked ? 'bg-lavender' : ''}`} />
      </span>
      <span class={`flex min-w-0 flex-1 ${stacked ? 'flex-col' : 'flex-wrap items-baseline gap-x-2'}`}>
        <span class="font-bold" lang={row.lang ?? undefined} data-language-label="">
          {row.label}
        </span>
        {row.subtitle && <span class={`text-secondary text-muted ${stacked ? '' : 'ml-auto text-right'}`}>{row.subtitle}</span>}
      </span>
    </label>
  );
}

export function LanguagePage({ ctx, query }: { ctx: SettingsContext; query: Store<string> }) {
  useLocale();
  const data = useStore(ctx.state);
  const search = useStore(query);
  if (!data.settings) return <SettingsPlaceholder error={data.settingsError} />;
  const model = languagePageModel({ setting: data.settings.language, uiLocale: getLocale(), browserLocale: detectUiLocale(), query: search, translationUrl: TRANSLATION_URL });
  const pick = (value: LanguageSetting): void => void ctx.update({ language: value });
  return (
    <div class="flex flex-col gap-2">
      {model.search && (
        <label class="flex h-10 items-center gap-2 rounded-pill border border-field bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-lavender">
          <span class="flex shrink-0 text-muted">
            <Icon name="search" class="size-4" strokeWidth="2.4" />
          </span>
          <input
            class="min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none placeholder:text-muted"
            type="search"
            placeholder={t('settings.language.searchPlaceholder')}
            aria-label={t('settings.language.searchPlaceholder')}
            aria-controls={LIST_ID}
            maxLength={60}
            autocomplete="off"
            spellcheck={false}
            value={search}
            data-focus={SEARCH_FOCUS}
            onInput={(event) => query.set(event.currentTarget.value)}
          />
        </label>
      )}
      {/* Vrais boutons radio d'un même nom : un seul arrêt de tabulation, flèches haut / bas pour choisir */}
      <div class="flex flex-col rounded-card border border-line bg-surface p-1" role="radiogroup" aria-label={t('settings.language.groupLabel')}>
        <LanguageRow row={model.auto} stacked onPick={pick} />
        <hr class="mx-2.5 my-1 h-px border-0 bg-line" />
        <div class="flex flex-col" id={LIST_ID}>
          {model.rows.length === 0 ? (
            <p class="m-0 px-2.5 py-2 text-secondary text-muted" role="status" data-language-empty="">
              {t('settings.language.noResult')}
            </p>
          ) : (
            model.rows.map((row) => <LanguageRow key={row.value} row={row} stacked={false} onPick={pick} />)
          )}
        </div>
      </div>
      {model.translationUrl !== null && (
        <a
          class="inline-flex min-h-8 items-center justify-center gap-1 self-center text-secondary font-bold text-lavender underline underline-offset-2"
          href={model.translationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-focus="language-translate"
        >
          {t('settings.language.helpTranslate')}
          <Icon name="external" class="size-3" />
        </a>
      )}
    </div>
  );
}

export function createLanguagePage(ctx: SettingsContext): SettingsMountedPage {
  /** Recherche en cours : conservée entre deux visites et aux changements de langue */
  const query = createStore('');
  return preactPage(() => <LanguagePage ctx={ctx} query={query} />, {
    // Champ de recherche affiché : il reçoit le focus à l'ouverture de la page (au lieu du titre)
    initialFocus: () => (showsLanguageSearch(supportedLanguages(getLocale()).length) ? SEARCH_FOCUS : null),
  });
}
