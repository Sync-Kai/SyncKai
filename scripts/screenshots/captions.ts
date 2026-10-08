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
  2: '02-side-panel',
  3: '03-agenda',
  4: '04-page-media',
  5: '05-cr-import',
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
    2: { eyebrow: 'Panneau latéral', title: 'Tout l’épisode, *à côté de la vidéo*', sub: 'Fiche AniList, progression en direct, suites à regarder et discussion de l’épisode.' },
    3: { eyebrow: 'Agenda', title: 'Tes sorties *de la semaine*', sub: 'Heure estimée sur Crunchyroll ou ADN, épisodes déjà vus cochés.' },
    4: { eyebrow: 'Sur cette page', title: 'La fiche AniList de *ce que tu regardes*', sub: 'Ajoute la série à ta liste, change ta progression, ton statut ou ta note sans quitter Crunchyroll ou ADN.' },
    5: { eyebrow: 'Import', title: 'Ton historique Crunchyroll, *rattrapé*', sub: 'SyncKai lit ton historique et met AniList et MyAnimeList à jour, avec un aperçu avant d’écrire.' },
  },
  en: {
    1: { eyebrow: 'Automatic sync', title: 'Your list updated by the *credits*', sub: 'Watch on Crunchyroll or ADN: the episode is saved to AniList and MyAnimeList, no click needed.' },
    2: { eyebrow: 'Side panel', title: 'The whole episode, *beside the video*', sub: 'AniList entry, live progress, what to watch next and the episode discussion.' },
    3: { eyebrow: 'Schedule', title: 'Your releases *this week*', sub: 'Estimated time on Crunchyroll or ADN, episodes you’ve already seen ticked off.' },
    4: { eyebrow: 'On this page', title: 'The AniList entry for *what you’re watching*', sub: 'Add the series to your list, change your progress, status or score without leaving Crunchyroll or ADN.' },
    5: { eyebrow: 'Import', title: 'Your Crunchyroll history, *caught up*', sub: 'SyncKai reads your history and updates AniList and MyAnimeList, with a preview before anything is written.' },
  },
  de: {
    1: { eyebrow: 'Automatische Synchro', title: 'Liste aktuell schon zum *Abspann*', sub: 'Auf Crunchyroll oder ADN schauen: Die Folge landet ohne Klick auf AniList und MyAnimeList.' },
    2: { eyebrow: 'Seitenleiste', title: 'Die ganze Folge, *neben dem Video*', sub: 'AniList-Eintrag, Live-Fortschritt, Fortsetzungen und Diskussion zur Folge.' },
    3: { eyebrow: 'Zeitplan', title: 'Deine Folgen *dieser Woche*', sub: 'Geschätzte Uhrzeit auf Crunchyroll oder ADN, gesehene Folgen abgehakt.' },
    4: { eyebrow: 'Auf dieser Seite', title: 'Der AniList-Eintrag zu *deiner Serie*', sub: 'Zur Liste hinzufügen, Fortschritt, Status oder Bewertung ändern, ohne Crunchyroll oder ADN zu verlassen.' },
    5: { eyebrow: 'Import', title: 'Dein Crunchyroll-Verlauf, *nachgeholt*', sub: 'SyncKai liest deinen Verlauf und aktualisiert AniList und MyAnimeList – mit Vorschau, bevor etwas geschrieben wird.' },
  },
};
