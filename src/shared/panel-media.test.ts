import { describe, expect, it } from 'vitest';
import { decodeEntities, isLongDescription, malForumUrl, redditSearchUrl, sanitizeDescription } from './panel-media';

describe('sanitizeDescription', () => {
  it('convertit les <br> en sauts de ligne et retire les autres balises', () => {
    expect(sanitizeDescription('Ligne 1<br>Ligne 2<br />\n<i>italique</i> et <b>gras</b>')).toBe('Ligne 1\nLigne 2\n\nitalique et gras');
  });

  it('décode les entités nommées et numériques', () => {
    expect(sanitizeDescription('Tom &amp; Jerry &mdash; l&#39;aventure &#x2764; &quot;ok&quot;')).toBe('Tom & Jerry — l\'aventure ❤ "ok"');
  });

  it('ne réinterprète jamais une entité décodée comme du HTML', () => {
    // &lt;script&gt; devient du texte brut « <script> » (inséré comme nœud texte), pas une balise retirée
    expect(sanitizeDescription('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
    expect(sanitizeDescription('<img src=x onerror=alert(1)>Texte')).toBe('Texte');
  });

  it('masque les spoilers AniList et le gras du balisage', () => {
    expect(sanitizeDescription('Début ~!le héros meurt!~ fin. __Important__')).toBe('Début fin. Important');
  });

  it('réduit les lignes vides multiples et les espaces', () => {
    expect(sanitizeDescription('  A  \n\n\n\n   B\t\tC  ')).toBe('A\n\nB C');
  });

  it('retourne null pour un synopsis vide ou absent', () => {
    expect(sanitizeDescription(null)).toBeNull();
    expect(sanitizeDescription(undefined)).toBeNull();
    expect(sanitizeDescription('<br><br>')).toBeNull();
  });

  it('tronque un synopsis démesuré', () => {
    const text = sanitizeDescription('a'.repeat(10_000));
    expect(text?.length).toBe(4000);
    expect(text?.endsWith('…')).toBe(true);
  });

  it('ignore les entités inconnues ou invalides', () => {
    expect(decodeEntities('&inconnue; &#0; &#xD800;')).toBe('&inconnue;  ');
  });
});

describe('isLongDescription', () => {
  it('replie au-delà de 280 caractères ou 4 lignes', () => {
    expect(isLongDescription('court')).toBe(false);
    expect(isLongDescription('a'.repeat(281))).toBe(true);
    expect(isLongDescription('1\n2\n3\n4\n5')).toBe(true);
  });
});

describe('redditSearchUrl', () => {
  it('cherche le fil de l’épisode sur r/anime (requête encodée)', () => {
    expect(redditSearchUrl('Sousou no Frieren', 5)).toBe(
      'https://www.reddit.com/r/anime/search/?q=flair%3AEpisode%20%22Sousou%20no%20Frieren%22%20%22Episode%205%22&restrict_sr=1&sort=relevance',
    );
  });

  it('encode les caractères spéciaux et retire les guillemets du titre', () => {
    const url = redditSearchUrl('Re:Zero kara "Hajimeru" Isekai Seikatsu & co #2', 12);
    expect(url).not.toBeNull();
    const query = new URL(url ?? '').searchParams.get('q');
    expect(query).toBe('flair:Episode "Re:Zero kara Hajimeru Isekai Seikatsu & co #2" "Episode 12"');
  });

  it('null sans titre ou sans épisode valide', () => {
    expect(redditSearchUrl(null, 3)).toBeNull();
    expect(redditSearchUrl('  ', 3)).toBeNull();
    expect(redditSearchUrl('Titre', null)).toBeNull();
    expect(redditSearchUrl('Titre', 0)).toBeNull();
    expect(redditSearchUrl('Titre', 2.5)).toBeNull();
  });
});

describe('malForumUrl', () => {
  it('forum de l’épisode', () => {
    expect(malForumUrl(52991, 5)).toBe('https://myanimelist.net/anime/52991/_/episode/5');
  });

  it('forum de la série sans épisode connu', () => {
    expect(malForumUrl(52991, null)).toBe('https://myanimelist.net/anime/52991/_/forum');
  });

  it('null sans fiche MAL', () => {
    expect(malForumUrl(null, 5)).toBeNull();
    expect(malForumUrl(0, 5)).toBeNull();
  });
});
