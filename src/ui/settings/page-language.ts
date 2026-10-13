// Réglages › Langue : liste de boutons radio (« Automatique » épinglé en tête, puis les langues triées par endonyme),
// champ de recherche au-delà de LANGUAGE_SEARCH_MIN langues et ligne « Aider à traduire » si TRANSLATION_URL existe.
// Prévue pour une vingtaine de langues ; le modèle (sans DOM) est testé, le rendu par les tests de bout en bout.
import { detectUiLocale, getLocale, t, type Locale } from '../../i18n';
import { filterLanguages, endonym, showsLanguageSearch, supportedLanguages, TRANSLATION_URL } from '../../i18n/language-list';
import type { LanguageSetting } from '../../shared/settings';
import { CARD, LINK } from '../kit';
import { h } from '../dom';
import { icon } from '../icons';
import type { SettingsContext, SettingsPageView } from './context';
import { settingsPlaceholder } from './page-sync';
import { DIVIDER, HELP_TEXT } from './rows';

const GROUP_LABEL_ID = 'sk-language-label';
const RADIO_NAME = 'sk-language';
const SEARCH_FOCUS = 'language-search';

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

export function createLanguagePage(ctx: SettingsContext): SettingsPageView {
  /** Recherche en cours : conservée entre deux rendus (changement de langue, retour sur la page) */
  let query = '';

  function renderRow(row: LanguageRowModel, divider: string): HTMLElement {
    const input = h('input', {
      class:
        'h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-line bg-transparent transition-[border-color,border-width] checked:border-[5px] checked:border-sakura',
      attrs: { type: 'radio', name: RADIO_NAME, value: row.value, 'data-focus': `language-${row.value}` },
      // Enregistré tout de suite : la vue se redessine dans la nouvelle langue (onLocaleChange), sans rechargement
      on: { change: () => input.checked && void ctx.update({ language: row.value }, true) },
    });
    input.checked = row.checked;
    return h(
      'label',
      { class: `flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 transition-colors hover:bg-raised ${divider}`, attrs: { 'data-language-row': row.value } },
      h(
        'span',
        { class: 'flex min-w-0 flex-1 flex-col gap-px' },
        h('span', { class: 'truncate text-[13px] font-bold', attrs: row.lang ? { lang: row.lang } : {} }, row.label),
        row.subtitle && h('span', { class: `truncate ${HELP_TEXT}` }, row.subtitle),
      ),
      input,
    );
  }

  /** Lignes des langues (sous « Automatique ») ; aucune ne correspond à la recherche : message à la place */
  function renderRows(model: LanguagePageModel): HTMLElement[] {
    if (model.rows.length === 0) {
      return [h('p', { class: `m-0 border-t border-line px-3 py-3 ${HELP_TEXT}`, attrs: { role: 'status', 'data-language-empty': '' } }, t('settings.language.noResult'))];
    }
    // Séparateur plein après « Automatique », pointillés entre les langues
    return model.rows.map((row, index) => renderRow(row, index === 0 ? 'border-t border-line' : DIVIDER));
  }

  function renderSearch(list: HTMLElement): HTMLElement {
    const input = h('input', {
      class: 'h-8 w-full min-w-0 rounded-lg border border-line bg-ground pr-2 pl-7 text-[12px] text-ink placeholder:text-muted/70',
      attrs: {
        type: 'search',
        placeholder: t('settings.language.searchPlaceholder'),
        'aria-label': t('settings.language.searchPlaceholder'),
        'aria-controls': 'sk-language-list',
        maxlength: '60',
        autocomplete: 'off',
        spellcheck: 'false',
        'data-focus': SEARCH_FOCUS,
      },
      on: {
        // Seules les lignes sont redessinées : le champ garde le focus et le curseur
        input: () => {
          query = input.value;
          list.replaceChildren(...renderRows(model()));
        },
      },
    });
    input.value = query;
    return h(
      'div',
      { class: 'relative p-2' },
      h('span', { class: 'pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 text-muted', attrs: { 'aria-hidden': 'true' } }, icon('search', 'h-3.5 w-3.5')),
      input,
    );
  }

  function renderTranslate(url: string): HTMLElement {
    return h(
      'a',
      {
        class: `${LINK} flex min-h-10 items-center gap-2 border-t border-line px-3 text-[12px] font-bold`,
        attrs: { href: url, target: '_blank', rel: 'noopener noreferrer', 'data-focus': 'language-translate' },
      },
      icon('pencil', 'h-3.5 w-3.5'),
      h('span', { class: 'min-w-0 flex-1' }, t('settings.language.helpTranslate')),
      icon('external', 'h-3 w-3'),
    );
  }

  function model(): LanguagePageModel {
    return languagePageModel({
      setting: ctx.data.settings?.language ?? 'auto',
      uiLocale: getLocale(),
      browserLocale: detectUiLocale(),
      query,
      translationUrl: TRANSLATION_URL,
    });
  }

  return {
    render(): Node[] {
      if (!ctx.data.settings) return settingsPlaceholder(ctx);
      const current = model();
      const list = h('div', { class: 'flex flex-col', attrs: { id: 'sk-language-list' } }, ...renderRows(current));
      return [
        h(
          'section',
          { class: 'flex flex-col gap-2' },
          h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase', attrs: { id: GROUP_LABEL_ID } }, t('settings.language.groupLabel')),
          h(
            'div',
            { class: `${CARD} flex flex-col overflow-hidden` },
            current.search && renderSearch(list),
            // Vrais boutons radio d'un même nom : un seul arrêt de tabulation, flèches haut / bas pour choisir
            h(
              'div',
              { class: `flex flex-col ${current.search ? 'border-t border-line' : ''}`, attrs: { role: 'radiogroup', 'aria-labelledby': GROUP_LABEL_ID } },
              renderRow(current.auto, ''),
              list,
            ),
            current.translationUrl !== null && renderTranslate(current.translationUrl),
          ),
        ),
      ];
    },
    // Champ de recherche affiché : il reçoit le focus à l'ouverture de la page (au lieu du titre)
    initialFocus: () => (model().search ? SEARCH_FOCUS : null),
  };
}
