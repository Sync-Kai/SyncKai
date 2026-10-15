// Page de lecture Crunchyroll (FR) : One Piece E1180, saison Crunchyroll « Elbaph » (S24), épisode 25 de la saison.
// Reconstruite le 2026-10-11 à partir des structures relevées sur le site le 2026-09-29 (JSON-LD TVEpisode, <h1>,
// lien vers la série) : pas de capture d'une session connectée. Anonymisée : description, vignettes et identifiants
// de compte retirés ; l'épisode suivant (E1181) et son identifiant sont fictifs.
// À rafraîchir quand Crunchyroll change sa page : copier le bloc <script type="application/ld+json"> et le <h1>.

export interface CrunchyrollWatchFixture {
  /** Identifiant de lecture (/watch/{episodeId}/…) */
  episodeId: string;
  url: string;
  /** Contenu brut du bloc <script type="application/ld+json"> */
  jsonLd: string;
  /** Texte du <h1> de l'épisode */
  heading: string;
  seriesLink: { text: string; href: string };
}

const SERIES = { '@type': 'TVSeries', name: 'One Piece', '@id': 'https://www.crunchyroll.com/fr/series/GRMG8ZQZR/one-piece' };
const SEASON = { '@type': 'TVSeason', name: 'Elbaph', seasonNumber: 24 };
const SERIES_LINK = { text: 'One Piece', href: 'https://www.crunchyroll.com/fr/series/GRMG8ZQZR/one-piece' };

/** Nœud TVEpisode tel que relevé : ni `url` ni `@id` (CONT-04) */
function episodeNode(name: string, episodeNumber: number): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVEpisode',
    name,
    episodeNumber,
    inLanguage: 'ja-JP',
    partOfSeason: SEASON,
    partOfSeries: SERIES,
    potentialAction: { '@type': 'WatchAction', target: { '@type': 'EntryPoint', actionPlatform: ['http://schema.org/DesktopWebPlatform'] } },
  };
}

/** JSON-LD de la page : organisation + épisode (deux blocs fusionnés en un @graph pour la fixture) */
function jsonLd(episode: Record<string, unknown>): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'Crunchyroll' }, episode] });
}

export const ONE_PIECE_E1180: CrunchyrollWatchFixture = {
  episodeId: 'GE00376431JAJP',
  url: 'https://www.crunchyroll.com/fr/watch/GE00376431JAJP/despair-engulfs-elbaph',
  jsonLd: jsonLd(episodeNode('Elbaph | E1180 - Le désespoir envahit Elbaph !', 25)),
  heading: 'E1180 - Le désespoir envahit Elbaph !',
  seriesLink: SERIES_LINK,
};

/** Épisode suivant (lecture automatique), identifiant et titre fictifs */
export const ONE_PIECE_E1181: CrunchyrollWatchFixture = {
  episodeId: 'GE00376432JAJP',
  url: 'https://www.crunchyroll.com/fr/watch/GE00376432JAJP/next-episode',
  jsonLd: jsonLd(episodeNode('Elbaph | E1181 - Titre de l’épisode suivant', 26)),
  heading: 'E1181 - Titre de l’épisode suivant',
  seriesLink: SERIES_LINK,
};

/** Même épisode E1180, nœud portant son URL : contrôle par identifiant plutôt que par le <h1> */
export const ONE_PIECE_E1180_WITH_URL: CrunchyrollWatchFixture = {
  ...ONE_PIECE_E1180,
  jsonLd: jsonLd({ ...episodeNode('Elbaph | E1180 - Le désespoir envahit Elbaph !', 25), url: ONE_PIECE_E1180.url }),
};
