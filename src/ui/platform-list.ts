import { formatList } from '../i18n';
import { PLATFORMS, type StreamingPlatform } from '../platforms/registry';

/**
 * Plateformes citées dans une phrase, dans la langue active : « Crunchyroll, ADN et Netflix » (`conjunction`),
 * « Crunchyroll, ADN ou Disney+ » (`disjunction`). Les plateformes optionnelles ne sont citées qu'activées.
 */
export function formatPlatformList(platforms: readonly StreamingPlatform[], type: 'conjunction' | 'disjunction'): string {
  return formatList(platforms.map((platform) => PLATFORMS[platform].label), type);
}
