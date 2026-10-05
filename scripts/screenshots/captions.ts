import type { Locale } from '../../src/i18n';

// Légendes des captures (docs/store/screenshots.md). `*mot*` = mot mis en valeur (dégradé Kai).

export interface Caption {
  eyebrow: string;
  title: string;
  sub: string;
}

export type ShotId = 1 | 2 | 3 | 4 | 5;

export const SHOT_IDS: readonly ShotId[] = [1, 2, 3, 4, 5];

export const SHOT_FILES: Record<ShotId, string> = {
  1: '01-sync-at-credits',
  2: '02-page-media',
  3: '03-watching',
  4: '04-compare',
  5: '05-review',
};

/** Tuile promo « marquee » (1400 × 560) : non localisable sur le Chrome Web Store, donc en anglais */
export const MARQUEE = {
  file: 'promo-1400x560',
  width: 1400,
  height: 560,
  title: 'Your anime list, on *autopilot*',
  sub: 'Watch on Crunchyroll or ADN. SyncKai updates AniList and MyAnimeList by the credits.',
} as const;

export const CAPTIONS: Record<Locale, Record<ShotId, Caption>> = {
  fr: {
    1: { eyebrow: 'Synchro automatique', title: 'Ta liste à jour dès le *générique*', sub: 'Regarde sur Crunchyroll ou ADN : l’épisode est enregistré sur AniList et MyAnimeList, sans un clic.' },
    2: { eyebrow: 'Sur cette page', title: 'La fiche AniList de *ce que tu regardes*', sub: 'Ajoute la série à ta liste, change ta progression, ton statut ou ta note sans quitter Crunchyroll ou ADN.' },
    3: { eyebrow: 'Mes séries', title: 'Tes séries et le *prochain épisode*', sub: 'Reprends là où tu t’es arrêté, vois ce qui sort ensuite et mets une série en pause ou termine-la en un clic.' },
    4: { eyebrow: 'AniList ↔ MAL', title: 'Deux listes, *zéro écart*', sub: 'Repère les différences entre AniList et MyAnimeList, puis aligne tout en un clic.' },
    5: { eyebrow: 'Vérification', title: 'Correspondance incertaine ? *Tu choisis*', sub: 'Au moindre doute, SyncKai te propose les fiches probables au lieu de deviner.' },
  },
  en: {
    1: { eyebrow: 'Automatic sync', title: 'Your list updated by the *credits*', sub: 'Watch on Crunchyroll or ADN: the episode is saved to AniList and MyAnimeList, no click needed.' },
    2: { eyebrow: 'On this page', title: 'The AniList entry for *what you’re watching*', sub: 'Add the series to your list, change your progress, status or score without leaving Crunchyroll or ADN.' },
    3: { eyebrow: 'My series', title: 'Your series and the *next episode*', sub: 'Pick up where you left off, see what airs next, and pause or complete a series in one click.' },
    4: { eyebrow: 'AniList ↔ MAL', title: 'Two lists, *zero gaps*', sub: 'Spot the differences between AniList and MyAnimeList and align them in one click.' },
    5: { eyebrow: 'Review', title: 'Unsure match? *You choose*', sub: 'When in doubt, SyncKai suggests the likely entries instead of guessing.' },
  },
  de: {
    1: { eyebrow: 'Automatische Synchro', title: 'Liste aktuell schon zum *Abspann*', sub: 'Auf Crunchyroll oder ADN schauen: Die Folge landet ohne Klick auf AniList und MyAnimeList.' },
    2: { eyebrow: 'Auf dieser Seite', title: 'Der AniList-Eintrag zu *deiner Serie*', sub: 'Zur Liste hinzufügen, Fortschritt, Status oder Bewertung ändern, ohne Crunchyroll oder ADN zu verlassen.' },
    3: { eyebrow: 'Meine Serien', title: 'Deine Serien und die *nächste Folge*', sub: 'Mach dort weiter, wo du aufgehört hast, sieh, was als Nächstes kommt, und pausiere oder beende Serien mit einem Klick.' },
    4: { eyebrow: 'AniList ↔ MAL', title: 'Zwei Listen, *null Abweichung*', sub: 'Finde Unterschiede zwischen AniList und MyAnimeList und gleiche sie mit einem Klick ab.' },
    5: { eyebrow: 'Prüfen', title: 'Unsichere Zuordnung? *Du wählst*', sub: 'Im Zweifel schlägt SyncKai die passenden Einträge vor, statt zu raten.' },
  },
};
