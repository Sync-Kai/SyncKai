import { mergeExclusion } from '../../shared/exclusions';
import { withStorageLock } from './lock';
import { EXCLUDED_SERIES_KEY, readExcludedSeries } from './exclusions-read';

// Écritures des séries exclues, sous le verrou du stockage (règles de fusion : shared/exclusions.ts).

/** Exclut une série ; fusionne avec une exclusion existante qui partage la même platformKey ou le même mediaId. */
export async function excludeSeries(input: { platformKey: string | null; mediaId: number | null; label: string }): Promise<void> {
  await withStorageLock(async () => {
    const list = mergeExclusion(await readExcludedSeries(), input, Date.now());
    await chrome.storage.local.set({ [EXCLUDED_SERIES_KEY]: list });
  });
}

export async function includeSeries(id: string): Promise<void> {
  await withStorageLock(async () => {
    const list = (await readExcludedSeries()).filter((e) => e.id !== id);
    await chrome.storage.local.set({ [EXCLUDED_SERIES_KEY]: list });
  });
}

