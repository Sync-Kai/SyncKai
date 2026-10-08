// Jaquettes de remplacement (aucune image protégée) : duotone abstrait dans la palette du thème.

export type CoverMotif = 'sun' | 'moon' | 'wave' | 'peaks' | 'rings' | 'bolt';

interface CoverSpec {
  from: string;
  to: string;
  accent: string;
  motif: CoverMotif;
}

function motif(spec: CoverSpec): string {
  const a = spec.accent;
  switch (spec.motif) {
    case 'sun':
      return `<circle cx="30" cy="38" r="16" fill="${a}" opacity=".9"/><path d="M0 62 Q15 50 30 58 T60 54 V90 H0Z" fill="#000" opacity=".28"/><path d="M0 72 Q20 62 34 70 T60 66 V90 H0Z" fill="#000" opacity=".3"/>`;
    case 'moon':
      return `<circle cx="38" cy="26" r="12" fill="${a}"/><circle cx="44" cy="22" r="10" fill="${spec.from}"/><g fill="#fff" opacity=".8"><circle cx="12" cy="16" r="1.2"/><circle cx="20" cy="40" r=".9"/><circle cx="50" cy="48" r="1"/><circle cx="8" cy="54" r=".8"/></g><path d="M0 70 L14 58 L24 66 L38 52 L60 68 V90 H0Z" fill="#000" opacity=".35"/>`;
    case 'wave':
      return `<path d="M0 40 Q15 30 30 40 T60 40 V90 H0Z" fill="${a}" opacity=".55"/><path d="M0 52 Q15 42 30 52 T60 52 V90 H0Z" fill="${a}" opacity=".7"/><path d="M0 66 Q15 56 30 66 T60 66 V90 H0Z" fill="#000" opacity=".25"/>`;
    case 'peaks':
      return `<circle cx="44" cy="22" r="7" fill="${a}" opacity=".85"/><path d="M-4 90 L20 40 L34 62 L44 50 L66 90Z" fill="#000" opacity=".32"/><path d="M20 40 L26 52 L22 50 L17 46Z" fill="#fff" opacity=".7"/>`;
    case 'rings':
      return `<g fill="none" stroke="${a}" stroke-width="2.4"><circle cx="30" cy="44" r="8" opacity=".95"/><circle cx="30" cy="44" r="15" opacity=".6"/><circle cx="30" cy="44" r="22" opacity=".35"/><circle cx="30" cy="44" r="29" opacity=".18"/></g>`;
    case 'bolt':
      return `<path d="M34 10 L18 48 H30 L24 80 L44 38 H32 Z" fill="${a}" opacity=".9"/><path d="M0 0 L60 90" stroke="#fff" stroke-width="10" opacity=".06"/>`;
  }
}

/** Data URI d'une jaquette 2:3 */
export function coverUrl(spec: CoverSpec): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 90" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${spec.from}"/><stop offset="1" stop-color="${spec.to}"/></linearGradient><radialGradient id="v" cx=".5" cy=".4" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs><rect width="60" height="90" fill="url(#g)"/>${motif(spec)}<rect width="60" height="90" fill="url(#v)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Avatar à initiale (aucun avatar réel) */
export function avatarUrl(letter: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="30" fill="#1A0F1C">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Bannière panoramique (fiche du panneau latéral) : paysage abstrait, aucune image protégée */
export function bannerUrl(spec: Omit<CoverSpec, 'motif'>): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${spec.from}"/><stop offset="1" stop-color="${spec.to}"/></linearGradient></defs><rect width="400" height="120" fill="url(#s)"/><circle cx="300" cy="44" r="22" fill="${spec.accent}" opacity=".85"/><g fill="#fff" opacity=".7"><circle cx="40" cy="20" r="1.2"/><circle cx="120" cy="34" r="1"/><circle cx="210" cy="14" r="1.1"/><circle cx="360" cy="18" r=".9"/></g><path d="M0 92 L60 58 L100 78 L160 40 L220 80 L270 62 L330 86 L400 60 V120 H0Z" fill="#000" opacity=".28"/><path d="M0 104 Q80 86 160 100 T320 96 T400 92 V120 H0Z" fill="#000" opacity=".35"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
