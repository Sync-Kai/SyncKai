// Contrat entre la vue Réglages, ses pages et l'hôte qui la monte (popup ou panneau latéral).
import type { AiringCheckResult } from '../../shared/airing.types';
import type { StreamingPlatform } from '../../platforms/registry';
import type { SyncSettings } from '../../shared/settings';
import type { MediaMapping } from '../../shared/sync.types';
import type { ExclusionsState, ReadonlyStore } from '../state';
import type { AccountsController } from '../accounts';
import type { CompareController } from '../compare-controller';
import type { PlatformAccessStore } from '../platform-access-store';
import type { SettingsSubPage } from './navigation';

/** Ce que l'hôte fournit : tout comportement propre au popup ou au panneau passe par ici */
export interface SettingsHost {
  /** Quitte les Réglages (popup : écran précédent ; panneau : onglet précédent) */
  navigateBack(): void;
  /** Ouvre une page dans un nouvel onglet (import, sauvegarde) */
  openTab(url: string): void;
  /**
   * Vue fermée dès qu'elle perd le focus (popup) : une boîte de dialogue (fichier, « Enregistrer sous ») la ferme,
   * l'export passe donc par la page Sauvegarde dans un onglet (BAK-05)
   */
  closesOnBlur: boolean;
  /**
   * L'hôte affiche déjà son propre bandeau « SyncKai n'a pas accès à Crunchyroll / ADN » au-dessus des écrans (popup) :
   * Réglages › Plateformes ne le répète pas (il garde « Accès manquant » sur les lignes)
   */
  hostAccessBanner: boolean;
  /** Comptes AniList / MyAnimeList (état partagé avec le reste de l'hôte) */
  accounts: AccountsController;
  /** Accès Netflix / Disney+ / Prime Video de la page (store unique de l'hôte, partagé avec ses autres écrans) */
  platformAccess: PlatformAccessStore;
  /**
   * Écarts AniList ↔ MAL (Mes données) : contrôleur unique de l'hôte (popup : aussi la ligne de l'Activité), créé et lu au
   * premier appel au plus tard
   */
  compare(): CompareController;
}

/** Données lues du stockage par la vue (suivies via storage.onChanged) */
export interface SettingsData {
  /** null : en lecture ; erreur de lecture : `settingsError` */
  settings: SyncSettings | null;
  settingsError: boolean;
  /** Correspondances triées par clé ; null : pas encore lues */
  mappings: [string, MediaMapping][] | null;
  mappingsError: string | null;
  exclusions: ExclusionsState;
  /** Nombre d'entrées du journal ; null = en lecture ou illisible */
  journalCount: number | null;
  airing: AiringCheckResult | null;
  /**
   * Plateformes optionnelles accordées (interrupteurs, lecteur préféré Netflix ou Prime Video), copie du store de
   * l'hôte (`SettingsHost.platformAccess`) : undefined tant que les accès sont en lecture
   */
  platformAccess: readonly StreamingPlatform[] | undefined;
}

/** Touches des commandes de l'extension, lues par commands.getAll() */
export interface ShortcutKeys {
  /** Raccourci « valider l'épisode » : undefined = en lecture, '' = non défini */
  shortcut: string | undefined;
  /** Raccourci « ouvrir le panneau latéral » : undefined = en lecture, '' = non défini */
  panelShortcut: string | undefined;
}

/** Contexte passé aux pages */
export interface SettingsContext {
  readonly host: SettingsHost;
  /** Données courantes, lues au moment d'une action (gestionnaire d'événement : valeur à jour sans attendre un rendu) */
  readonly data: SettingsData;
  /**
   * Mêmes données pour le rendu des pages (`useStore(ctx.state)`) : un nouvel instantané à chaque changement (lecture,
   * stockage, accès, comptes, `update`), jamais modifié ensuite
   */
  readonly state: ReadonlyStore<SettingsData>;
  /** Touches des raccourcis (relues quand la vue reprend le focus) : suivies par la page Raccourcis */
  readonly shortcuts: ReadonlyStore<ShortcutKeys>;
  /** Enregistre un changement de réglage (pastille « Enregistré / Échec » de la barre) */
  update(patch: Partial<SyncSettings>): Promise<void>;
  /** Relit les correspondances (après une modification) */
  refreshMappings(): Promise<void>;
  /** Relit le nombre d'erreurs du journal */
  refreshJournal(): Promise<void>;
  /** Ouvre une autre page (ligne d'une page parente, lien d'une page vers une autre) ; le retour mène à son parent */
  openCategory(page: SettingsSubPage): void;
}

/**
 * Sous-page (Preact) : montée dans le conteneur de la vue à l'ouverture, elle suit ensuite seule ses sources
 * (`ctx.state`, stores, langue) ; `mount` rend la fonction qui la démonte (page quittée, vue fermée). État à conserver
 * entre deux visites : hors de l'arbre (store de la page), le démontage efface l'état des composants.
 * `preactPage` (preact-page.tsx) construit ce contrat depuis un composant.
 */
export interface SettingsMountedPage {
  mount(container: HTMLElement): () => void;
  /** Repère `data-focus` à focaliser à l'ouverture de la page à la place de son titre (null : le titre) */
  initialFocus?(): string | null;
}
