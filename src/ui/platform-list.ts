import { getLocale } from '../i18n';
import { PLATFORMS, type StreamingPlatform } from '../shared/platforms';

/**
 * Plateformes citées dans une phrase, dans la langue active : « Crunchyroll, ADN et Netflix » (`conjunction`),
 * « Crunchyroll, ADN ou Disney+ » (`disjunction`). Les plateformes optionnelles ne sont citées qu'activées.
 */
export function formatPlatformList(platforms: readonly StreamingPlatform[], type: 'conjunction' | 'disjunction'): string {
  const labels = platforms.map((platform) => PLATFORMS[platform].label);
  try {
    return new Intl.ListFormat(getLocale(), { style: 'long', type }).format(labels);
  } catch {
    return labels.join(', ');
  }
}
