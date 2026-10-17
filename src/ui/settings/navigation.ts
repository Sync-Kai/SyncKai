// Navigation des Réglages (accueil → catégories → pages de second niveau) : arbre des pages et réducteur pur, testés
// sans DOM. La vue applique l'effet renvoyé (focus du titre, retour du focus sur la ligne quittée, sortie).
import { t, type MessageKey } from '../../i18n';

/** Catégories de l'accueil, dans l'ordre d'affichage (maquette Main) */
export const SETTINGS_CATEGORIES = ['accounts', 'sync', 'platforms', 'notifications', 'display', 'data', 'help'] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

/**
 * Toutes les sous-pages : les catégories, puis les pages de second niveau. Ajouter une page : son id ici, son parent
 * (SETTINGS_PAGE_PARENTS), son titre (SETTINGS_PAGE_TITLES), puis sa vue dans settings-view.tsx (Record exhaustif).
 */
export const SETTINGS_SUBPAGES = [...SETTINGS_CATEGORIES, 'mappings', 'exclusions', 'language', 'shortcuts', 'compare'] as const;
export type SettingsSubPage = (typeof SETTINGS_SUBPAGES)[number];
export type SettingsPage = 'home' | SettingsSubPage;

/** Page où mène le retour (« ← Affichage ») ; la ligne de la page quittée y reçoit le focus */
export const SETTINGS_PAGE_PARENTS: Readonly<Record<SettingsSubPage, SettingsPage>> = {
  accounts: 'home',
  sync: 'home',
  platforms: 'home',
  notifications: 'home',
  display: 'home',
  data: 'home',
  help: 'home',
  mappings: 'sync',
  exclusions: 'sync',
  language: 'display',
  shortcuts: 'display',
  compare: 'data',
};

/** Titre de chaque page : ligne qui l'ouvre, titre de la barre, bouton retour de ses enfants et chemins cités ailleurs */
export const SETTINGS_PAGE_TITLES: Readonly<Record<SettingsSubPage, MessageKey>> = {
  accounts: 'settings.section.accounts',
  sync: 'settings.section.sync',
  platforms: 'settings.cat.platforms',
  notifications: 'settings.cat.notifications',
  display: 'settings.cat.display',
  data: 'settings.cat.data',
  help: 'settings.cat.help',
  mappings: 'settings.section.mappings',
  exclusions: 'settings.section.exclusions',
  language: 'settings.section.language',
  shortcuts: 'settings.cat.shortcuts',
  compare: 'compare.section',
};

/** Titre affiché d'une page (accueil : « Réglages ») */
export function settingsPageTitle(page: SettingsPage): string {
  return page === 'home' ? t('nav.settings') : t(SETTINGS_PAGE_TITLES[page]);
}

/** 0 : accueil, 1 : catégorie, 2 : page de second niveau */
export function settingsDepth(page: SettingsPage): number {
  return page === 'home' ? 0 : settingsDepth(SETTINGS_PAGE_PARENTS[page]) + 1;
}

/** Chemin vers une page (« Réglages › Affichage › Raccourcis ») construit depuis les titres affichés (UX-06) */
export function settingsPath(page: SettingsSubPage): string {
  const titles: string[] = [];
  for (let current: SettingsPage = page; current !== 'home'; current = SETTINGS_PAGE_PARENTS[current]) titles.unshift(settingsPageTitle(current));
  return [t('nav.settings'), ...titles].join(' › ');
}

export interface SettingsNavState {
  page: SettingsPage;
}

export type SettingsNavAction =
  /** Ouverture d'une page depuis sa ligne, ou directement (pastille de compte, lien d'une autre page) */
  | { type: 'open'; page: SettingsSubPage }
  /** « ← parent », Échap : page → parent, accueil → sortie des réglages */
  | { type: 'back' }
  /** Entrée dans les réglages : toujours l'accueil */
  | { type: 'reset' };

export type SettingsNavEffect =
  | { kind: 'none' }
  /** Nouvelle page : focus sur son titre (ou l'élément qu'elle désigne) */
  | { kind: 'focus-heading' }
  /** Retour au parent : focus rendu à la ligne de la page quittée */
  | { kind: 'focus-row'; page: SettingsSubPage }
  /** Retour depuis l'accueil : l'hôte quitte les réglages (popup : écran précédent, panneau : onglet) */
  | { kind: 'exit' };

export const INITIAL_SETTINGS_NAV: SettingsNavState = { page: 'home' };

export function isSettingsSubPage(value: unknown): value is SettingsSubPage {
  return SETTINGS_SUBPAGES.some((page) => page === value);
}

export function settingsNavReducer(state: SettingsNavState, action: SettingsNavAction): { state: SettingsNavState; effect: SettingsNavEffect } {
  switch (action.type) {
    case 'open':
      if (state.page === action.page) return { state, effect: { kind: 'none' } };
      return { state: { page: action.page }, effect: { kind: 'focus-heading' } };
    case 'back':
      if (state.page === 'home') return { state, effect: { kind: 'exit' } };
      return { state: { page: SETTINGS_PAGE_PARENTS[state.page] }, effect: { kind: 'focus-row', page: state.page } };
    case 'reset':
      return { state: INITIAL_SETTINGS_NAV, effect: { kind: 'none' } };
  }
}

/** Repère `data-focus` de la ligne qui ouvre une page (accueil, ou page parente) */
export function settingsRowFocus(page: SettingsSubPage): string {
  return `settings-cat-${page}`;
}
