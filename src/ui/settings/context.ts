// Contrat entre la vue Réglages, ses pages et l'hôte qui la monte (popup ou panneau latéral).
import type { AiringCheckResult } from '../../shared/airing.types';
import type { StreamingPlatform } from '../../platforms/registry';
import type { SyncSettings } from '../../shared/settings';
import type { MediaMapping } from '../../shared/sync.types';
import type { ExclusionsState } from '../state';
import type { AccountsController } from '../accounts';
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
  /** Raccourci « valider l'épisode » : undefined = en lecture, '' = non défini */
  shortcut: string | undefined;
  /** Raccourci « ouvrir le panneau latéral » : undefined = en lecture, '' = non défini */
  panelShortcut: string | undefined;
  /** Accès à Netflix (permission optionnelle) : undefined = en lecture */
  netflixAccess: boolean | undefined;
  /** Accès à Disney+ (permission optionnelle) : undefined = en lecture */
  disneyAccess: boolean | undefined;
  /** Accès à Prime Video (permission optionnelle) : undefined = en lecture */
  primeAccess: boolean | undefined;
}

/** Plateformes optionnelles accordées (lecteur préféré Netflix ou Prime Video) ; undefined tant que les accès sont en lecture */
export function grantedPlatforms(data: Pick<SettingsData, 'netflixAccess' | 'disneyAccess' | 'primeAccess'>): StreamingPlatform[] | undefined {
  const access = { netflix: data.netflixAccess, disney: data.disneyAccess, prime: data.primeAccess } as const;
  if (Object.values(access).some((value) => value === undefined)) return undefined;
  return (['netflix', 'disney', 'prime'] as const).filter((platform) => access[platform] === true);
}

/** Contexte passé aux pages */
export interface SettingsContext {
  readonly host: SettingsHost;
  readonly data: SettingsData;
  /** Enregistre un changement de réglage ; `redraw` : la page dépend de la valeur (affichage conditionnel) */
  update(patch: Partial<SyncSettings>, redraw?: boolean): Promise<void>;
  /** Redessine la page affichée si elle fait partie de `pages` (toutes si absent) */
  redraw(pages?: readonly SettingsPage[]): void;
  /** Relit les correspondances (après une modification) */
  refreshMappings(): Promise<void>;
  /** Relit le nombre d'erreurs du journal */
  refreshJournal(): Promise<void>;
  /** Relit l'accès à Netflix, Disney+ et Prime Video (après une demande ou un retrait de permission) */
  refreshPlatformAccess(): Promise<void>;
  /** Ouvre une autre catégorie (lien d'une page vers une autre, ex. Lecture & synchro → Raccourcis) */
  openCategory(category: SettingsCategory): void;
}

/** Une sous-page : rendu à la demande, état local conservé entre deux visites */
export interface SettingsPageView {
  render(): Node[];
  /** Repère `data-focus` à focaliser à l'ouverture de la page à la place de son titre (null : le titre) */
  initialFocus?(): string | null;
}
