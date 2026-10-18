// Kit d'interface commun (popup, panneau latéral, réglages, pages d'import), direction « Kotatsu » : les composants
// Preact sont dans components/ ; il reste ici les libellés des plateformes et les initiales des jaquettes.

export { PLATFORM_LABELS } from '../platforms/registry';

export function initials(title: string): string {
  const words = title.split(/[\s:·\-–]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase();
}
