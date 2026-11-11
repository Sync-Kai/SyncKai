// Préférences d'affichage des sections du popup (« Pour toi » : filtre retenu), enregistrées comme `popupPrefs` dans le
// stockage local, jamais synchronisées. Lecture tolérante (valeur illisible : défaut), écriture par fusion : les champs
// absents du patch et ceux d'une autre version sont conservés.
import { createLogger } from '../../browser/logger';
import { isRecord } from '../../shared/guards';
import { ALL_RECO_FILTER, isRecoFilter, type RecoFilter } from '../../shared/recommendations';

const log = createLogger('popup');

export const SECTION_PREFS_KEY = 'popupPrefs:sections';
/** Nom de genre plus long : valeur écartée (stockage altéré) */
const MAX_GENRE_LENGTH = 40;

export interface SectionPrefs {
  recoFilter: RecoFilter;
}

export const DEFAULT_SECTION_PREFS: SectionPrefs = { recoFilter: ALL_RECO_FILTER };

export function normalizeSectionPrefs(raw: unknown): SectionPrefs {
  const filter = isRecord(raw) ? raw.recoFilter : undefined;
  if (!isRecoFilter(filter)) return DEFAULT_SECTION_PREFS;
  return { recoFilter: { genre: filter.genre !== null && filter.genre.length <= MAX_GENRE_LENGTH ? filter.genre : null, format: filter.format } };
}

export async function loadSectionPrefs(): Promise<SectionPrefs> {
  try {
    return normalizeSectionPrefs((await chrome.storage.local.get(SECTION_PREFS_KEY))[SECTION_PREFS_KEY]);
  } catch (error: unknown) {
    log.warn('Préférences des sections illisibles :', error);
    return DEFAULT_SECTION_PREFS;
  }
}

/** Lecture, fusion, écriture : un échec est journalisé, jamais remonté (préférence d'affichage) */
export async function saveSectionPrefs(patch: Partial<SectionPrefs>): Promise<void> {
  try {
    const stored: unknown = (await chrome.storage.local.get(SECTION_PREFS_KEY))[SECTION_PREFS_KEY];
    await chrome.storage.local.set({ [SECTION_PREFS_KEY]: { ...(isRecord(stored) ? stored : {}), ...patch } });
  } catch (error: unknown) {
    log.warn('Préférences des sections non enregistrées :', error);
  }
}
