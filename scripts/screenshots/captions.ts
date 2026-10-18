import type { StoreLocale } from './params';

// Légendes des captures (docs/store/screenshots.md), direction C « Duo / éditorial ». `*mot*` = mot mis en valeur
// (lavande), `\n` = retour à la ligne voulu : titre en 52 px dans une colonne de 430 px, 3 lignes au plus, aucune ligne
// ne doit déborder (banner.ts le signale en console).

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

/**
 * Kana de chaque capture, commun aux trois langues : filigrane vertical du dos et accent sakura du surtitre, dans l'esprit
 * de « ツヅキ » (Reprendre) et « シンカイ ». Alignés sur le catalogue ja (docs/i18n/glossary/ja.md) :
 * 1 キロク = 記録, « enregistré » (`toast.title.saved` : 第{episode}話を記録しました) ;
 * 2 サイセイ = 再生, « lecture » (`panel.tab.nowPlaying` : 再生中) ;
 * 3 コンシュウ = 今週, « cette semaine » (`agenda.today` : 今週) ;
 * 4 ページ = « page », kana de l'ancienne carte « Sur cette page » ;
 * 5 リレキ = 履歴, « historique » (`crImport.title` : 視聴履歴をインポート).
 */
export const KANA: Record<ShotId, string> = {
  1: 'キロク',
  2: 'サイセイ',
  3: 'コンシュウ',
  4: 'ページ',
  5: 'リレキ',
};

/**
 * Tuiles promo (marquee 1400 × 560 ici, petite tuile 440 × 280 dans scripts/generate-icons.ts) : non localisables sur le
 * Chrome Web Store, donc en anglais. Kana ジドウ = 自動, « automatique » (`自動同期` du catalogue ja).
 */
export const MARQUEE = {
  file: 'promo-1400x560',
  width: 1400,
  height: 560,
  kana: 'ジドウ',
  eyebrow: 'Anime tracking',
  title: 'Your anime list,\non *autopilot*',
  sub: 'Watch on your platform: SyncKai updates AniList and MyAnimeList by the credits.',
} as const;

export const CAPTIONS: Record<StoreLocale, Record<ShotId, Caption>> = {
  fr: {
    1: { eyebrow: 'Synchro automatique', title: 'Ta liste à jour\ndès le *générique*', sub: 'L’épisode est enregistré sur AniList et MyAnimeList, sans un clic.' },
    2: { eyebrow: 'Panneau latéral', title: 'Tout l’épisode,\n*à côté de\nla vidéo*', sub: 'Fiche AniList, progression en direct, suites à regarder et discussion de l’épisode.' },
    3: { eyebrow: 'Agenda', title: 'Tes sorties\n*de la semaine*', sub: 'Heure estimée sur ta plateforme, épisodes déjà vus cochés.' },
    4: { eyebrow: 'Sur cette page', title: 'La fiche AniList\nde *ce que\ntu regardes*', sub: 'Ajoute la série à ta liste, change ta progression, ton statut ou ta note sans quitter la page.' },
    5: { eyebrow: 'Import', title: 'Ton historique,\n*rattrapé*', sub: 'SyncKai lit ton historique Crunchyroll, ADN ou Netflix et met AniList et MyAnimeList à jour, avec un aperçu avant d’écrire.' },
  },
  en: {
    1: { eyebrow: 'Automatic sync', title: 'Your list\nupdated by\nthe *credits*', sub: 'The episode is saved to AniList and MyAnimeList, no click needed.' },
    2: { eyebrow: 'Side panel', title: 'The episode,\n*right beside\nthe video*', sub: 'AniList entry, live progress, what to watch next and the episode discussion.' },
    3: { eyebrow: 'Schedule', title: 'Your releases\n*this week*', sub: 'Estimated time on your platform, episodes you’ve seen ticked off.' },
    4: { eyebrow: 'On this page', title: 'The AniList\nentry for *what\nyou’re watching*', sub: 'Add the series to your list, change your progress, status or score without leaving the page.' },
    5: { eyebrow: 'Import', title: 'Your history,\n*caught up*', sub: 'SyncKai reads your Crunchyroll, ADN or Netflix history and updates AniList and MyAnimeList, with a preview first.' },
  },
  de: {
    1: { eyebrow: 'Automatische Synchro', title: 'Liste aktuell\nschon zum\n*Abspann*', sub: 'Die Folge landet ohne Klick auf AniList und MyAnimeList.' },
    2: { eyebrow: 'Seitenleiste', title: 'Die ganze Folge,\n*neben dem Video*', sub: 'AniList-Eintrag, Live-Fortschritt, Fortsetzungen und Diskussion zur Folge.' },
    3: { eyebrow: 'Zeitplan', title: 'Deine Folgen\n*dieser Woche*', sub: 'Geschätzte Uhrzeit auf deiner Plattform, gesehene Folgen abgehakt.' },
    4: { eyebrow: 'Auf dieser Seite', title: 'AniList-Eintrag\nzu *deiner Serie*', sub: 'Zur Liste hinzufügen, Fortschritt, Status oder Bewertung ändern, ohne die Seite zu verlassen.' },
    5: { eyebrow: 'Import', title: 'Dein Verlauf,\n*nachgeholt*', sub: 'SyncKai liest deinen Verlauf von Crunchyroll, ADN oder Netflix und aktualisiert AniList und MyAnimeList – mit Vorschau.' },
  },
};
