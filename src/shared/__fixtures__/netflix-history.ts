import type { NetflixBookmark, NetflixEpisodeMetadata, NetflixShowMetadata } from '../../platforms/netflix/metadata';
import type { NetflixHistoryRow } from '../../platforms/netflix/history';

// Historique Netflix réaliste (profil français, relevé le 2026-10-12 sur netflix.com/viewingactivity) et métadonnées
// réduites AVEC points de lecture (réponse du pont pour une demande `bookmarks`). Ranma ½ S1 : valeurs relevées
// (E1 1308 / fin 1269 / générique 1302 / durée 1462 → vu ; E2 193 → non ; E3 1462 → vu ; E4 1308 / 1284 → vu ;
// E5 1342 / 1284 → vu ; E6 1262 / 1283, générique 1293 → NON vu) : progression S1 attendue 5. One Piece, arc Elbaph
// (numérotation absolue E1156…E1180) : E1162 à 5 s (lancé), E1180 à 963 / 1417 (partiel), les autres jamais vus.

const RANMA_ID = 81301833;

function episode(id: number, seq: number, timing: { runtime?: number; credits?: number; offset?: number; end?: number } = {}): NetflixEpisodeMetadata {
  const bookmark: NetflixBookmark | null = timing.offset === undefined ? null : { offset: timing.offset, watchedToEndOffset: timing.end ?? null };
  return { id: String(id), seq, title: `Épisode ${seq}`, runtime: timing.runtime ?? 1462, creditsOffset: timing.credits ?? 1302, bookmark };
}

/** Ranma ½ (2024) : 2 saisons de 12 épisodes, S1 relevée, S2 jamais vue */
export function ranmaShow(): NetflixShowMetadata {
  const s1 = [
    episode(RANMA_ID + 1, 1, { offset: 1308, end: 1269 }),
    episode(RANMA_ID + 2, 2, { offset: 193, end: 1270 }),
    episode(RANMA_ID + 3, 3, { offset: 1462, end: 1270 }),
    episode(RANMA_ID + 4, 4, { offset: 1308, end: 1284, credits: 1300 }),
    episode(RANMA_ID + 5, 5, { offset: 1342, end: 1284, credits: 1300 }),
    episode(RANMA_ID + 6, 6, { offset: 1262, end: 1283, credits: 1293 }),
    ...Array.from({ length: 6 }, (_, i) => episode(RANMA_ID + 7 + i, 7 + i)),
  ];
  const s2 = Array.from({ length: 12 }, (_, i) => episode(RANMA_ID + 100 + i, i + 1));
  return {
    showId: String(RANMA_ID),
    type: 'show',
    title: 'Ranma1/2',
    runtime: null,
    creditsOffset: null,
    seasons: [
      { seq: 1, title: 'Season 1', episodes: s1 },
      { seq: 2, title: 'Season 2', episodes: s2 },
    ],
  };
}

export const RANMA_S1E5 = String(RANMA_ID + 5);

const OP_EAST_BLUE = 80217863;
const OP_ELBAPH = 82000000;

/** One Piece : East Blue (E1…E61, jamais vu) et l'arc Elbaph (E1156…E1180, numérotation absolue) ; `watched` : E1170 vu */
export function onePieceShow(watched = false): NetflixShowMetadata {
  const elbaph = Array.from({ length: 25 }, (_, i) => {
    const seq = 1156 + i;
    if (seq === 1162) return episode(OP_ELBAPH + i, seq, { runtime: 1417, credits: 1350, offset: 5, end: 1360 });
    if (seq === 1180) return episode(OP_ELBAPH + i, seq, { runtime: 1417, credits: 1350, offset: 963, end: 1360 });
    if (seq === 1170 && watched) return episode(OP_ELBAPH + i, seq, { runtime: 1417, credits: 1350, offset: 1400, end: 1360 });
    return episode(OP_ELBAPH + i, seq, { runtime: 1417, credits: 1350 });
  });
  return {
    showId: '80107103',
    type: 'show',
    title: 'One Piece',
    runtime: null,
    creditsOffset: null,
    seasons: [
      { seq: 1, title: 'East Blue', episodes: Array.from({ length: 61 }, (_, i) => episode(OP_EAST_BLUE + i, i + 1)) },
      { seq: 40, title: 'Elbaph Arc', episodes: elbaph },
    ],
  };
}

export const ONE_PIECE_E1170 = String(OP_ELBAPH + 14);

/** Film d'animation vu jusqu'au générique */
export function movieShow(offset: number): NetflixShowMetadata {
  return { showId: '60023642', type: 'movie', title: 'Spirited Away', runtime: 7489, creditsOffset: 7200, seasons: [], bookmark: { offset, watchedToEndOffset: null } };
}

/** Lignes de la page Activité (plus récentes d'abord) : séries FR, film, série qui n'est pas un anime */
export const NETFLIX_ROWS: NetflixHistoryRow[] = [
  { id: RANMA_S1E5, text: 'Ranma ½ : Saison 1 : "Épisode 5"' },
  { id: String(OP_ELBAPH + 24), text: 'One Piece : Elbaph Arc : "Épisode 1180"' },
  { id: '81231974', text: 'Mercredi : Saison 1 : "Mercredi, quel malheur"' },
  { id: String(RANMA_ID + 4), text: 'Ranma ½ : Saison 1 : "Épisode 4"' },
  { id: '60023642', text: 'Le Voyage de Chihiro' },
  { id: String(OP_ELBAPH + 6), text: 'One Piece : Elbaph Arc : "Épisode 1162"' },
  { id: String(RANMA_ID + 1), text: 'Ranma ½ : Saison 1 : "Épisode 1"' },
  { id: '81231975', text: 'Mercredi : Saison 1 : "Malheur, malheur, malheur"' },
];

// Nouvelle page d'historique (netflix.com/viewingactivity → /settings/viewed, relevée le 2026-11-13, profil français) :
// structure assainie (titres et identifiants fictifs ; classes générées du site remplacées par une seule, factice).
// Conteneur `viewing-activity-page+container` : onglets « Vu » / « Évalué », une ligne `+list-item` par vidéo (6 au
// départ), puis un div sans data-uia ; lien du titre ABSOLU ; boutons « Signaler » / « Masquer » dans chaque ligne ;
// « Voir plus » `+show-more-btn` hors des lignes.

/** Liens des 6 premières lignes de la page /settings/viewed (plus récentes d'abord) */
export const NETFLIX_VIEWED_ROWS: readonly { href: string; text: string }[] = [
  { href: 'https://www.netflix.com/title/80000001', text: 'Le Renard des neiges : Saison 1 : "Épisode 4"' },
  { href: 'https://www.netflix.com/title/80000002', text: 'Lames d’automne : Saison 2 : "Le pont"' },
  { href: 'https://www.netflix.com/title/80000003', text: 'Le Phare' },
  { href: 'https://www.netflix.com/title/80000004', text: 'Le Renard des neiges : Saison 1 : "Épisode 3"' },
  { href: 'https://www.netflix.com/title/80000005', text: 'Cuisine de minuit : Mini-série : "Épisode 1"' },
  { href: 'https://www.netflix.com/title/80000006', text: 'Lames d’automne : Saison 2 : "La forge"' },
];

/** HTML (corps de page) de /settings/viewed ; `more` : libellé du bouton « Voir plus » (null : bouton absent) */
export function netflixViewedPageHtml(more: string | null = 'Voir plus'): string {
  const rows = NETFLIX_VIEWED_ROWS.map(
    (row, i) =>
      `<div data-uia="viewing-activity-page+list-item" class="default-ltr-x-cache-0"><div>${String(13 - i).padStart(2, '0')}/11/26</div>` +
      `<p><span data-uia="viewing-activity-page+list-item+description"><a data-uia="viewing-activity-page+list-item+description+title-link" href="${row.href}">${row.text}</a></span></p>` +
      '<div data-uia="viewing-activity-page+list-item+action-list">' +
      '<button data-uia="viewing-activity-page+list-item+report-problem-btn" aria-label="Signaler un problème"><svg></svg></button>' +
      '<button data-uia="viewing-activity-page+list-item+hide-series-btn" aria-label="Masquer dans l’historique"><svg></svg></button></div></div>',
  ).join('');
  const button = more === null ? '' : `<button data-uia="viewing-activity-page+show-more-btn">${more}</button>`;
  return (
    '<main><div data-uia="viewing-activity-page+right-col"><section><h1>Historique de lecture et évaluations</h1>' +
    '<div data-uia="viewing-activity-page+container"><div data-uia="viewing-activity-page+tabbed-layout+tabs"><button>Vu</button><button>Évalué</button></div>' +
    `${rows}<div>${button}</div></div></section></div></main>`
  );
}
