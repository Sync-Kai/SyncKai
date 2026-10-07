// Fonctions pures de l'onglet « En lecture » : synopsis en texte brut et liens de discussion.

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  times: '×',
  hearts: '♥',
};

/** Décode les entités HTML (nommées courantes et numériques) sans passer par le DOM */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      // Points de code invalides ou caractères de contrôle : retirés
      if (!Number.isInteger(code) || code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Longueur maximale du synopsis conservé (texte affiché, cache de session) */
const MAX_DESCRIPTION = 4000;

/**
 * Synopsis AniList (`description(asHtml: false)`, mélange de HTML et de balisage AniList) → texte brut :
 * `<br>` → saut de ligne, autres balises retirées, spoilers `~!…!~` masqués, entités décodées,
 * lignes vides multiples réduites. Le résultat est inséré comme nœud texte (jamais d'innerHTML).
 */
export function sanitizeDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/~!([\s\S]*?)!~/g, '') // Spoilers AniList
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/<[^>]*$/, '') // Balise tronquée en fin de texte
    .replace(/(\*\*|__)(.+?)\1/g, '$2'); // Gras du balisage AniList
  const plain = decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!plain) return null;
  return plain.length > MAX_DESCRIPTION ? `${plain.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : plain;
}

/** Synopsis assez long pour être replié (« Lire la suite ») */
export function isLongDescription(text: string): boolean {
  return text.length > 280 || text.split('\n').length > 4;
}

const isEpisode = (episode: number | null): episode is number => episode !== null && Number.isInteger(episode) && episode >= 1;

/**
 * Recherche r/anime du fil de discussion d'un épisode (flair « Episode », titre romaji, « Episode N »).
 * null sans titre ou sans épisode connu.
 */
export function redditSearchUrl(romajiTitle: string | null, episode: number | null): string | null {
  const title = romajiTitle?.replace(/"/g, '').trim();
  if (!title || !isEpisode(episode)) return null;
  const query = `flair:Episode "${title}" "Episode ${episode}"`;
  return `https://www.reddit.com/r/anime/search/?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance`;
}

/** Forum MyAnimeList de l'épisode, ou forum de la série si l'épisode est inconnu ; null sans fiche MAL */
export function malForumUrl(idMal: number | null, episode: number | null): string | null {
  if (idMal === null || !Number.isInteger(idMal) || idMal < 1) return null;
  return isEpisode(episode) ? `https://myanimelist.net/anime/${idMal}/_/episode/${episode}` : `https://myanimelist.net/anime/${idMal}/_/forum`;
}
