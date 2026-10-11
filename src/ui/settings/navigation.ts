// Navigation des Réglages (accueil → sous-pages) : réducteur pur, testé sans DOM.
// La vue applique l'effet renvoyé (focus du titre, retour du focus sur la ligne d'origine, sortie).
import { t, type MessageKey } from '../../i18n';

/** Catégories de l'accueil, dans l'ordre d'affichage */
export const SETTINGS_CATEGORIES = ['accounts', 'sync', 'notifications', 'data', 'language', 'help'] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];
export type SettingsPage = 'home' | SettingsCategory;

/** Titre de chaque catégorie : ligne de l'accueil, titre de la sous-page et chemins cités ailleurs */
export const SETTINGS_CATEGORY_TITLES: Record<SettingsCategory, MessageKey> = {
  accounts: 'settings.section.accounts',
  sync: 'settings.cat.sync',
  notifications: 'settings.cat.notifications',
  data: 'settings.cat.data',
  language: 'settings.section.language',
  help: 'settings.cat.help',
};

/** Chemin vers une catégorie (« Réglages › Lecture & synchro ») construit depuis les titres affichés (UX-06) */
export function settingsPath(category: SettingsCategory): string {
  return `${t('nav.settings')} › ${t(SETTINGS_CATEGORY_TITLES[category])}`;
}

export interface SettingsNavState {
  page: SettingsPage;
  /** Ligne de catégorie d'où l'on vient : le focus y revient au retour sur l'accueil */
  origin: SettingsCategory | null;
}

export type SettingsNavAction =
  /** Ouverture d'une sous-page depuis sa ligne (ou directement : pastille de compte, rechargement) */
  | { type: 'open'; category: SettingsCategory }
  /** « ← Réglages », Échap : sous-page → accueil, accueil → sortie des réglages */
  | { type: 'back' }
  /** Entrée dans les réglages : toujours l'accueil */
  | { type: 'reset' };

export type SettingsNavEffect =
  | { kind: 'none' }
  /** Nouvelle sous-page : focus sur son titre */
  | { kind: 'focus-heading' }
  /** Retour à l'accueil : focus rendu à la ligne de la catégorie quittée */
  | { kind: 'focus-row'; category: SettingsCategory }
  /** Retour depuis l'accueil : l'hôte quitte les réglages (popup : écran précédent, panneau : onglet) */
  | { kind: 'exit' };

export const INITIAL_SETTINGS_NAV: SettingsNavState = { page: 'home', origin: null };

export function isSettingsCategory(value: unknown): value is SettingsCategory {
  return SETTINGS_CATEGORIES.some((category) => category === value);
}

export function isSettingsPage(value: unknown): value is SettingsPage {
  return value === 'home' || isSettingsCategory(value);
}

export function settingsNavReducer(state: SettingsNavState, action: SettingsNavAction): { state: SettingsNavState; effect: SettingsNavEffect } {
  switch (action.type) {
    case 'open':
      if (state.page === action.category) return { state, effect: { kind: 'none' } };
      return { state: { page: action.category, origin: action.category }, effect: { kind: 'focus-heading' } };
    case 'back':
      if (state.page === 'home') return { state, effect: { kind: 'exit' } };
      return { state: INITIAL_SETTINGS_NAV, effect: { kind: 'focus-row', category: state.origin ?? state.page } };
    case 'reset':
      return { state: INITIAL_SETTINGS_NAV, effect: { kind: 'none' } };
  }
}
