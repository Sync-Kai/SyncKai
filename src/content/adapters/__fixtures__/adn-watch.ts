// Page de lecture ADN : TOUGEN ANKI, épisodes 1 et 2 (FR), plus la variante allemande de l'épisode 1.
// Reconstruite le 2026-10-11 à partir des structures relevées sur le site le 2026-09-30 (JSON-LD TVEpisode,
// surcouche du lecteur video.js) : pas de capture d'une session connectée. Anonymisée : description, vignettes,
// durées et identifiants de compte retirés ; l'identifiant et le titre de l'épisode 2 sont fictifs.
// À rafraîchir quand ADN change sa page : copier le bloc <script type="application/ld+json"> et la surcouche du lecteur.

export interface AdnWatchFixture {
  episodeId: string;
  url: string;
  /** Contenu brut du bloc <script type="application/ld+json"> */
  jsonLd: string;
  /** Textes de la surcouche du lecteur (.vjs-meta-title / .vjs-meta-subtitle) */
  player: { seriesTitle: string; subtitle: string };
}

const ORIGIN = 'https://animationdigitalnetwork.com';

function jsonLd(episode: Record<string, unknown>): string {
  return JSON.stringify([{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'ADN', url: ORIGIN }, { '@context': 'https://schema.org', ...episode }]);
}

export const TOUGEN_ANKI_E1: AdnWatchFixture = {
  episodeId: '29344',
  url: `${ORIGIN}/video/1311-tougen-anki/29344-episode-1`,
  jsonLd: jsonLd({
    '@type': 'TVEpisode',
    name: 'TOUGEN ANKI - Épisode 1 : Sang d’Oni',
    episodeNumber: '1',
    video: { '@type': 'VideoObject', name: 'TOUGEN ANKI - Épisode 1', url: `${ORIGIN}/video/1311-tougen-anki/29344-episode-1` },
    partOfSeries: { '@type': 'TVSeries', name: 'TOUGEN ANKI' },
    partOfSeason: { '@type': 'TVSeason', name: 'Saison 1', seasonNumber: '1' },
  }),
  player: { seriesTitle: 'TOUGEN ANKI', subtitle: 'Épisode 1 : Sang d’Oni' },
};

/** Épisode suivant (lecture automatique), identifiant et titre fictifs */
export const TOUGEN_ANKI_E2: AdnWatchFixture = {
  episodeId: '29345',
  url: `${ORIGIN}/video/1311-tougen-anki/29345-episode-2`,
  jsonLd: jsonLd({
    '@type': 'TVEpisode',
    name: 'TOUGEN ANKI - Épisode 2 : Titre de l’épisode suivant',
    episodeNumber: '2',
    video: { '@type': 'VideoObject', name: 'TOUGEN ANKI - Épisode 2', url: `${ORIGIN}/video/1311-tougen-anki/29345-episode-2` },
    partOfSeries: { '@type': 'TVSeries', name: 'TOUGEN ANKI' },
    partOfSeason: { '@type': 'TVSeason', name: 'Saison 1', seasonNumber: '1' },
  }),
  player: { seriesTitle: 'TOUGEN ANKI', subtitle: 'Épisode 2 : Titre de l’épisode suivant' },
};

/** Épisode 1 sur le site allemand (/de/…, « Folge », nom de saison générique « Staffel 1 ») */
export const TOUGEN_ANKI_E1_DE: AdnWatchFixture = {
  episodeId: '29344',
  url: `${ORIGIN}/de/video/1311-tougen-anki/29344-folge-1`,
  jsonLd: jsonLd({
    '@type': 'TVEpisode',
    name: 'TOUGEN ANKI - Folge 1 : Oni-Blut',
    episodeNumber: '1',
    video: { '@type': 'VideoObject', url: `${ORIGIN}/de/video/1311-tougen-anki/29344-folge-1` },
    partOfSeries: { '@type': 'TVSeries', name: 'TOUGEN ANKI' },
    partOfSeason: { '@type': 'TVSeason', name: 'Staffel 1', seasonNumber: '1' },
  }),
  player: { seriesTitle: 'TOUGEN ANKI', subtitle: 'Folge 1 : Oni-Blut' },
};
