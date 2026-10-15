// Contrat entre la vue Réglages, ses pages et l'hôte qui la monte (popup ou panneau latéral).
import type { AiringCheckResult } from '../../shared/airing.types';
import type { StreamingPlatform } from '../../platforms/registry';
import type { SyncSettings } from '../../shared/settings';
import type { MediaMapping } from '../../shared/sync.types';
import type { ExclusionsState, ReadonlyStore } from '../state';
import type { AccountsController } from '../accounts';
import type { PlatformAccessStore } from '../platform-access-store';
import type { SettingsCategory, SettingsPage } from './navigation';

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
  /** Comptes AniList / MyAnimeList (état partagé avec le reste de l'hôte) */
  accounts: AccountsController;
  /** Accès Netflix / Disney+ / Prime Video de la page (store unique de l'hôte, partagé avec ses autres écrans) */
  platformAccess: PlatformAccessStore;
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
  readonly data: SettingsData;
  /** Touches des raccourcis (relues quand la vue reprend le focus) : suivies par la page Raccourcis (Preact) */
  readonly shortcuts: ReadonlyStore<ShortcutKeys>;
  /** Enregistre un changement de réglage ; `redraw` : la page dépend de la valeur (affichage conditionnel) */
  update(patch: Partial<SyncSettings>, redraw?: boolean): Promise<void>;
  /** Redessine la page affichée si elle fait partie de `pages` (toutes si absent) */
  redraw(pages?: readonly SettingsPage[]): void;
  /** Relit les correspondances (après une modification) */
  refreshMappings(): Promise<void>;
  /** Relit le nombre d'erreurs du journal */
  refreshJournal(): Promise<void>;
  /** Ouvre une autre catégorie (lien d'une page vers une autre, ex. Lecture & synchro → Raccourcis) */
  openCategory(category: SettingsCategory): void;
}

/** Une sous-page : rendu à la demande, état local conservé entre deux visites */
export interface SettingsDomPage {
  render(): Node[];
  /** Repère `data-focus` à focaliser à l'ouverture de la page à la place de son titre (null : le titre) */
  initialFocus?(): string | null;
}

/**
 * Sous-page Preact (pilote) : montée dans le conteneur de la vue à l'ouverture, elle suit ensuite seule ses sources
 * (stores, langue) ; `mount` rend la fonction qui la démonte (page quittée). État à conserver entre deux visites : hors
 * de l'arbre (store de la page), le démontage efface l'état des composants.
 */
export interface SettingsMountedPage {
  mount(container: HTMLElement): () => void;
  initialFocus?(): string | null;
}

export type SettingsPageView = SettingsDomPage | SettingsMountedPage;

export function isMountedPage(page: SettingsPageView): page is SettingsMountedPage {
  return 'mount' in page;
}
