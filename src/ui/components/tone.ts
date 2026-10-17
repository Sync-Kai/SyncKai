// Tons d'état partagés par les composants de base (docs/design/README.md › Principles : le ton passe par une icône,
// un point ou une pastille). Classes listées en entier pour que Tailwind les génère.

/** ok : succès, disponible (mint) ; info : en cours, à venir (lavender) ; warn : à vérifier (butter) ; error : échec (danger) */
export type Tone = 'ok' | 'info' | 'warn' | 'error' | 'muted';

export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  ok: 'text-mint',
  info: 'text-lavender',
  warn: 'text-butter',
  error: 'text-danger',
  muted: 'text-muted',
};

export const TONE_BG: Readonly<Record<Tone, string>> = {
  ok: 'bg-mint',
  info: 'bg-lavender',
  warn: 'bg-butter',
  error: 'bg-danger',
  muted: 'bg-muted',
};
