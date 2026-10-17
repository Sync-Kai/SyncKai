import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import type { MediaMapping } from '../../shared/sync.types';
import { mappingBadge, mappingPlatform, mappingsPageModel, MAPPINGS_GROUP_LIMIT } from './mappings-model';

const base: MediaMapping = { mediaId: 154587, numbering: 'season', offset: 0, episodes: 28 };

function entry(key: string, patch: Partial<MediaMapping> = {}): [string, MediaMapping] {
  return [key, { ...base, ...patch }];
}

describe('mappingBadge', () => {
  it('origine lue sur les indicateurs stockés ; importée d’une sauvegarde : « à revérifier » d’abord', () => {
    expect(mappingBadge({ ...base, chosen: true })).toBe('chosen');
    expect(mappingBadge({ ...base, learned: true })).toBe('learned');
    expect(mappingBadge(base)).toBe('unmarked');
    expect(mappingBadge({ ...base, learned: true, unverified: true })).toBe('unverified');
    expect(mappingBadge({ ...base, unverified: true })).toBe('unverified');
  });
});

describe('mappingPlatform', () => {
  it('plateforme = premier segment de la clé', () => {
    expect(mappingPlatform('crunchyroll:GRMG8ZQZR:s1')).toBe('crunchyroll');
    expect(mappingPlatform('prime:title:berserk:y2016:s1')).toBe('prime');
    expect(mappingPlatform('netflix:80000:s2')).toBe('netflix');
    expect(mappingPlatform('inconnue:1:s1')).toBeNull();
  });
});

describe('mappingsPageModel', () => {
  const initial = getLocale();
  beforeEach(() => setLocale('fr'));
  afterEach(() => setLocale(initial));

  it('groupes par plateforme, du plus fourni au moins fourni (ordre du registre à égalité), lignes triées par titre', () => {
    const model = mappingsPageModel(
      [
        entry('adn:1:s2', { seriesLabel: 'Les Carnets de l’apothicaire · S2' }),
        entry('crunchyroll:B:s1', { seriesLabel: 'One Piece · Elbaph' }),
        entry('prime:title:berserk:y2016:s1', { seriesLabel: 'Berserk (2016) · S1' }),
        entry('crunchyroll:A:s1', { seriesLabel: 'Frieren · S1' }),
      ],
      { query: '', expanded: new Set() },
    );
    expect(model.total).toBe(4);
    expect(model.groups.map((g) => [g.id, g.label, g.count])).toEqual([
      ['crunchyroll', 'Crunchyroll', 2],
      ['adn', 'ADN', 1],
      ['prime', 'Prime Video', 1],
    ]);
    expect(model.groups[0]?.rows.map((r) => r.title)).toEqual(['Frieren · S1', 'One Piece · Elbaph']);
  });

  it('ligne : titre de série (clé sinon), fiche (repli « Fiche AniList #id »), épisodes et numérotation, origine', () => {
    const model = mappingsPageModel(
      [
        entry('crunchyroll:A:s1', { seriesLabel: 'Frieren · S1', mediaTitle: 'Frieren', episodes: 28, chosen: true }),
        entry('crunchyroll:B:s1', { mediaId: 171018, numbering: 'displayed', episodes: null }),
        entry('netflix:1:s2', { seriesLabel: 'Mushoku Tensei · S2', mediaTitle: 'Mushoku Tensei II Part 2', episodes: 12, offset: 12, learned: true }),
      ],
      { query: '', expanded: new Set() },
    );
    const [frieren, untitled] = model.groups[0]?.rows ?? [];
    expect(frieren).toMatchObject({ key: 'crunchyroll:A:s1', title: 'Frieren · S1', entry: 'Frieren', url: 'https://anilist.co/anime/154587', meta: '28 ép. · numéro dans la saison', badge: 'chosen' });
    // Correspondance d'avant la 1.1 : ni libellé ni titre ; nombre d'épisodes inconnu : omis
    expect(untitled).toMatchObject({ title: 'crunchyroll:B:s1', entry: 'Fiche AniList #171018', meta: 'numéro affiché', badge: 'unmarked' });
    expect(model.groups[1]?.rows[0]).toMatchObject({ meta: '12 ép. · numéro dans la saison, décalage de 12', badge: 'learned' });
  });

  it(`au-delà de ${MAPPINGS_GROUP_LIMIT} lignes : les suivantes sont repliées, sauf groupe déplié`, () => {
    const many = Array.from({ length: 7 }, (_, i) => entry(`crunchyroll:S${i}:s1`, { seriesLabel: `Série ${i}` }));
    const folded = mappingsPageModel(many, { query: '', expanded: new Set() });
    expect(folded.groups[0]?.rows).toHaveLength(MAPPINGS_GROUP_LIMIT);
    expect(folded.groups[0]?.hidden).toBe(7 - MAPPINGS_GROUP_LIMIT);
    const open = mappingsPageModel(many, { query: '', expanded: new Set(['crunchyroll']) });
    expect(open.groups[0]?.rows).toHaveLength(7);
    expect(open.groups[0]?.hidden).toBe(0);
    expect(open.groups[0]?.expandable).toBe(true);
  });

  it('recherche sur le titre de série et celui de la fiche, sans casse ni accents, tous les mots ; résultats jamais repliés', () => {
    const list = [
      entry('crunchyroll:A:s1', { seriesLabel: 'Frieren · Saison 1', mediaTitle: 'Frieren : Sur la route de l’au-delà' }),
      entry('prime:title:berserk:y1997:s1', { seriesLabel: 'Berserk (1997) · Saison 1', mediaTitle: 'Berserk' }),
      entry('prime:title:berserk:y2016:s1', { seriesLabel: 'Berserk (2016) · Saison 1', mediaTitle: 'Berserk (2016)' }),
      ...Array.from({ length: 6 }, (_, i) => entry(`crunchyroll:S${i}:s1`, { seriesLabel: `Route ${i}` })),
    ];
    expect(mappingsPageModel(list, { query: 'AU-DELA', expanded: new Set() }).groups.flatMap((g) => g.rows.map((r) => r.key))).toEqual(['crunchyroll:A:s1']);
    expect(mappingsPageModel(list, { query: 'berserk 2016', expanded: new Set() }).groups.flatMap((g) => g.rows.map((r) => r.key))).toEqual(['prime:title:berserk:y2016:s1']);
    const routes = mappingsPageModel(list, { query: 'route', expanded: new Set() });
    expect(routes.matches).toBe(7);
    expect(routes.groups[0]?.rows).toHaveLength(7);
    expect(routes.groups[0]?.expandable).toBe(false);
    expect(mappingsPageModel(list, { query: 'berserk 1998', expanded: new Set() })).toMatchObject({ matches: 0, groups: [] });
    // Espaces seuls : aucune recherche
    expect(mappingsPageModel(list, { query: '   ', expanded: new Set() }).matches).toBe(list.length);
  });
});
