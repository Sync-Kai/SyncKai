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
  2: '02-watch-order',
  3: '03-for-you',
  4: '04-announced',
  5: '05-stats',
};

/**
 * Kana de chaque capture, commun aux trois langues : filigrane vertical du dos et accent sakura du surtitre, dans l'esprit
 * de « ツヅキ » (Reprendre) et « シンカイ ». Alignés sur le catalogue ja (docs/i18n/glossary/ja.md) :
 * 1 キロク = 記録, « enregistré » (`toast.title.saved` : 第{episode}話を記録しました) ;
 * 2 ジュンバン = 順番, « ordre » (`panel.order.title` : 視聴順) ;
 * 3 オススメ = おすすめ, « recommandé » (`reco.title` : 今日のおすすめ, glossaire « Recommended ») ;
 * 4 ハッピョウ = 発表, « annoncé » (`agenda.view.announced` : 発表済み, `sequel.notification.single` : 続編が発表されました) ;
 * 5 トウケイ = 統計, « statistiques » (`nav.stats` : 統計).
 */
export const KANA: Record<ShotId, string> = {
  1: 'キロク',
  2: 'ジュンバン',
  3: 'オススメ',
  4: 'ハッピョウ',
  5: 'トウケイ',
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
    1: { eyebrow: 'Synchro automatique', title: 'Tu regardes,\nta liste se met\n*à jour seule*', sub: 'Sur Crunchyroll, ADN, Netflix, Disney+ ou Prime Video : l’épisode est enregistré sur AniList et MyAnimeList, sans un clic.' },
    2: { eyebrow: 'Ordre de visionnage', title: 'Toute la saga,\n*dans l’ordre*', sub: 'Dans « En lecture » : saisons, films et OVA par date de sortie, ce que tu as vu coché et ce qui vient ensuite.' },
    3: { eyebrow: 'Pour toi', title: 'Ta prochaine\nsérie, *d’après\ntes notes*', sub: 'Des suggestions AniList tirées de ce que tu as aimé, à filtrer par genre, en séries ou en films.' },
    4: { eyebrow: 'Annoncées', title: 'Les suites,\n*dès l’annonce*', sub: 'Une alerte quand une de tes séries a une suite, et le calendrier de ce qui arrive, séries de ta liste comprises.' },
    5: { eyebrow: 'Stats', title: 'Tes animes\n*en chiffres*', sub: 'Épisodes synchronisés par jour ou par mois, totaux et statistiques de ton profil AniList ou MyAnimeList.' },
  },
  en: {
    1: { eyebrow: 'Automatic sync', title: 'You watch,\nyour list\n*updates itself*', sub: 'On Crunchyroll, ADN, Netflix, Disney+ or Prime Video: the episode is saved to AniList and MyAnimeList, no click needed.' },
    2: { eyebrow: 'Watch order', title: 'The whole saga,\n*in order*', sub: 'In Now playing: seasons, films and OVAs by release date, what you’ve watched ticked off and what comes next.' },
    3: { eyebrow: 'For you', title: 'Your next series,\n*from your\nscores*', sub: 'AniList suggestions drawn from what you loved, filtered by genre, series or movies.' },
    4: { eyebrow: 'Announced', title: 'Sequels,\n*before they air*', sub: 'An alert when one of your series gets a sequel, and a calendar of what’s coming, series in your list included.' },
    5: { eyebrow: 'Stats', title: 'Your anime,\n*by the numbers*', sub: 'Episodes synced per day or month, plus the totals and statistics of your AniList or MyAnimeList profile.' },
  },
  de: {
    1: { eyebrow: 'Automatische Synchro', title: 'Du schaust,\ndeine Liste\n*bleibt aktuell*', sub: 'Auf Crunchyroll, ADN, Netflix, Disney+ oder Prime Video: Die Folge landet ohne Klick auf AniList und MyAnimeList.' },
    2: { eyebrow: 'Schaureihenfolge', title: 'Die ganze Saga,\n*der Reihe nach*', sub: 'In „Läuft gerade“: Staffeln, Filme und OVAs nach Erscheinen, Gesehenes abgehakt, das Nächste im Blick.' },
    3: { eyebrow: 'Für dich', title: 'Neue Serien,\n*nach deinem\nGeschmack*', sub: 'AniList-Vorschläge nach dem, was dir gefallen hat – nach Genre, Serien oder Filmen gefiltert.' },
    4: { eyebrow: 'Angekündigt', title: 'Fortsetzungen,\n*vor dem Start*', sub: 'Eine Meldung, wenn eine deiner Serien fortgesetzt wird, und ein Kalender mit allem, was kommt – samt Serien aus deiner Liste.' },
    5: { eyebrow: 'Statistik', title: 'Deine Animes\n*in Zahlen*', sub: 'Synchronisierte Folgen pro Tag oder Monat, dazu Summen und Statistiken deines AniList- oder MyAnimeList-Profils.' },
  },
};
