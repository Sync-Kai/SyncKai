import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { MediaMapping } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';

// API d'écriture des correspondances (audit I1) : apprise (conditionnelle, jamais sur un choix), choisie (toujours écrite),
// oubli conditionnel ; toute écriture faite prévient les abonnés du service worker (L4 : cache des résolutions de la page).

const fake = installFakeChrome();
const mappings = await import('./mappings');
const { saveLearned, saveChosen, forgetIfUnchanged, forgetMapping, onMappingsWritten } = mappings;

const valid = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'season', offset: 0, episodes: 12 });
const stored = (): unknown => fake.local.peek(STORAGE_KEYS.mediaMappings);

let writes = 0;
let unsubscribe: () => void = () => undefined;

beforeEach(() => {
  fake.reset({ [STORAGE_KEYS.mediaMappings]: { 'crunchyroll:A:s1': valid(1), 'crunchyroll:C:s1': { ...valid(3), chosen: true } } });
  unsubscribe();
  writes = 0;
  unsubscribe = onMappingsWritten(() => void writes++);
});

describe('saveLearned', () => {
  it('écrite si inchangée depuis sa lecture, avec l’origine apprise', async () => {
    expect(await saveLearned('crunchyroll:B:s1', null, valid(2))).toBe(true);
    expect(stored()).toMatchObject({ 'crunchyroll:B:s1': { ...valid(2), learned: true } });
    expect(writes).toBe(1);
  });

  it('refusée si la correspondance a changé depuis sa lecture (rien n’est prévenu)', async () => {
    expect(await saveLearned('crunchyroll:A:s1', null, valid(2))).toBe(false);
    expect(await saveLearned('crunchyroll:A:s1', valid(9), valid(2))).toBe(false);
    expect(stored()).toMatchObject({ 'crunchyroll:A:s1': valid(1) });
    expect(writes).toBe(0);
  });

  it('jamais par-dessus un choix de l’utilisateur, sauf en gardant l’origine choisie (total complété)', async () => {
    const chosen = { ...valid(3), chosen: true as const };
    expect(await saveLearned('crunchyroll:C:s1', chosen, valid(4))).toBe(false);
    expect(await saveLearned('crunchyroll:C:s1', chosen, { ...valid(3), episodes: 24 }, 'unmarked')).toBe(false);
    expect(writes).toBe(0);
    expect(await saveLearned('crunchyroll:C:s1', chosen, { ...valid(3), episodes: 24 }, 'chosen')).toBe(true);
    expect((stored() as Record<string, unknown>)['crunchyroll:C:s1']).toEqual({ ...valid(3), episodes: 24, chosen: true });
  });

  it('origine gardée d’une correspondance relue : inconnue → aucun indicateur', async () => {
    expect(await saveLearned('crunchyroll:A:s1', valid(1), { ...valid(1), episodes: 24, learned: true }, 'unmarked')).toBe(true);
    expect((stored() as Record<string, unknown>)['crunchyroll:A:s1']).toEqual({ ...valid(1), episodes: 24 });
  });
});

describe('saveChosen', () => {
  it('écrite par-dessus n’importe quelle correspondance, avec la seule origine choisie', async () => {
    await saveChosen('crunchyroll:A:s1', { ...valid(5), learned: true });
    await saveChosen('crunchyroll:C:s1', valid(6));
    await saveChosen('crunchyroll:D:s1', valid(7));
    expect(stored()).toEqual({
      'crunchyroll:A:s1': { ...valid(5), chosen: true },
      'crunchyroll:C:s1': { ...valid(6), chosen: true },
      'crunchyroll:D:s1': { ...valid(7), chosen: true },
    });
    expect(writes).toBe(3);
  });
});

describe('oublis', () => {
  it('forgetIfUnchanged : seulement si la correspondance est toujours celle lue', async () => {
    expect(await forgetIfUnchanged('crunchyroll:A:s1', { ...valid(1), chosen: true })).toBe(false);
    expect(writes).toBe(0);
    expect(await forgetIfUnchanged('crunchyroll:A:s1', valid(1))).toBe(true);
    expect(stored()).toEqual({ 'crunchyroll:C:s1': { ...valid(3), chosen: true } });
    expect(writes).toBe(1);
  });

  it('forgetMapping (« Oublier ») : retire la clé, prévient seulement si elle existait', async () => {
    await forgetMapping('crunchyroll:Z:s1');
    expect(writes).toBe(0);
    await forgetMapping('crunchyroll:A:s1');
    expect(stored()).toEqual({ 'crunchyroll:C:s1': { ...valid(3), chosen: true } });
    expect(writes).toBe(1);
  });
});

describe('onMappingsWritten', () => {
  it('chaque écriture faite prévient, une écriture sans effet non', async () => {
    expect(await mappings.saveMediaMappingsIfAbsent([{ key: 'crunchyroll:A:s1', mapping: valid(9) }])).toBe(0);
    expect(await mappings.deleteMediaMappingsByPrefix('adn:')).toBe(0);
    expect(await mappings.deleteMediaMappingsIfUnchanged({ 'crunchyroll:A:s1': { mediaId: 9 } })).toBe(0);
    expect(writes).toBe(0);
    expect(await mappings.saveMediaMappingsIfAbsent([{ key: 'crunchyroll:B:s1', mapping: valid(2) }])).toBe(1);
    expect(await mappings.deleteMediaMappingsIfUnchanged({ 'crunchyroll:B:s1': { mediaId: 2 } })).toBe(1);
    expect(await mappings.deleteMediaMappingsByPrefix('crunchyroll:A')).toBe(1);
    await mappings.clearMediaMappings();
    expect(writes).toBe(4);
  });

  it('désabonné : plus prévenu ; un abonné qui lève n’empêche ni l’écriture ni les autres', async () => {
    unsubscribe();
    let other = 0;
    const offFaulty = onMappingsWritten(() => {
      throw new Error('abonné fautif');
    });
    const offOther = onMappingsWritten(() => void other++);
    await expect(saveChosen('crunchyroll:B:s1', valid(2))).resolves.toBeUndefined();
    expect(writes).toBe(0);
    expect(other).toBe(1);
    offFaulty();
    offOther();
  });
});

describe('correspondance apprise ET choisie déjà stockée (sans signification)', () => {
  beforeEach(() => fake.local.seed({ [STORAGE_KEYS.mediaMappings]: { 'crunchyroll:X:s1': { ...valid(8), learned: true, chosen: true }, 'crunchyroll:A:s1': valid(1) } }));

  it('jamais lue, mais gardée telle quelle par les écritures des autres clés (ARCH-15)', async () => {
    expect(await mappings.getMediaMapping('crunchyroll:X:s1')).toBeNull();
    expect(Object.keys(await mappings.getMediaMappings())).toEqual(['crunchyroll:A:s1']);
    await saveChosen('crunchyroll:B:s1', valid(2));
    expect(await forgetIfUnchanged('crunchyroll:A:s1', valid(1))).toBe(true);
    expect(stored()).toEqual({ 'crunchyroll:X:s1': { ...valid(8), learned: true, chosen: true }, 'crunchyroll:B:s1': { ...valid(2), chosen: true } });
  });
});

describe('aucune écriture inconditionnelle hors choix de l’utilisateur', () => {
  it('saveMediaMapping n’existe plus : seul saveChosen écrit sans condition', () => {
    expect(Object.keys(mappings)).not.toContain('saveMediaMapping');
    expect(Object.keys(mappings)).not.toContain('saveMediaMappingIf');
    expect(Object.keys(mappings)).not.toContain('deleteMediaMappingIf');
  });
});
