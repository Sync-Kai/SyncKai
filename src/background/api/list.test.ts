import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AniListToken } from '../../shared/auth.types';

// Token AniList simulé : requêtes authentifiées (retrait, commentaire) envoyées sur un fetch simulé
vi.mock('../../shared/token-access', () => ({ getValidToken: async (): Promise<AniListToken> => ({ accessToken: 'A', expiresAt: Number.MAX_SAFE_INTEGER }) }));
vi.mock('../../shared/session-end', () => ({ endSessionIfToken: async () => true }));

import { anilistEntryVariables, deleteListEntry, getMediaListInfo, saveListNotes } from './list';

describe('SaveMediaListEntry (AniList)', () => {
  it('envoie les statuts du popup tels quels (énumération MediaListStatus)', () => {
    expect(anilistEntryVariables(21, 5, 'PAUSED')).toEqual({ mediaId: 21, progress: 5, status: 'PAUSED' });
    expect(anilistEntryVariables(21, 5, 'DROPPED')).toEqual({ mediaId: 21, progress: 5, status: 'DROPPED' });
    expect(anilistEntryVariables(21, 12, 'COMPLETED')).toEqual({ mediaId: 21, progress: 12, status: 'COMPLETED' });
  });

  it('ajoute le compteur de revisionnages seulement s’il est fourni', () => {
    expect(anilistEntryVariables(21, 12, 'COMPLETED', 2)).toEqual({ mediaId: 21, progress: 12, status: 'COMPLETED', repeat: 2 });
  });
});

describe('ajout à la liste AniList (fiche de la page)', () => {
  it('PLANNING / CURRENT à 0 épisode', () => {
    expect(anilistEntryVariables(21, 0, 'PLANNING')).toEqual({ mediaId: 21, progress: 0, status: 'PLANNING' });
    expect(anilistEntryVariables(21, 0, 'CURRENT')).toEqual({ mediaId: 21, progress: 0, status: 'CURRENT' });
  });
});

describe('commentaire et retrait (AniList)', () => {
  interface Sent {
    query: string;
    variables: Record<string, unknown>;
  }
  const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  /** Réponses successives du faux AniList ; requêtes envoyées relevées */
  function stubAniList(...responses: unknown[]): Sent[] {
    const sent: Sent[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_input, init) => {
        sent.push(JSON.parse(String(init?.body)) as Sent);
        return json({ data: responses.shift() });
      }),
    );
    return sent;
  }
  const media = (mediaListEntry: unknown): unknown => ({ Media: { id: 21, episodes: 12, title: { userPreferred: 'Frieren' }, mediaListEntry } });

  afterEach(() => vi.unstubAllGlobals());

  it('lit l’identifiant et le commentaire de l’entrée (vide = aucun)', async () => {
    const sent = stubAniList(media({ id: 555, status: 'CURRENT', progress: 3, notes: '  À revoir  ' }), media({ id: 556, status: 'CURRENT', progress: 3, notes: '' }));
    expect(await getMediaListInfo(21)).toMatchObject({ entryId: 555, notes: 'À revoir', entry: { status: 'CURRENT', progress: 3 } });
    expect(await getMediaListInfo(21)).toMatchObject({ entryId: 556, notes: null });
    expect(sent[0]?.query).toMatch(/mediaListEntry \{ id status progress repeat score notes \}/);
  });

  it('SaveMediaListEntry(mediaId, notes) : seul le commentaire est écrit', async () => {
    const sent = stubAniList({ SaveMediaListEntry: { status: 'CURRENT', progress: 3, repeat: 0, notes: 'Top' } });
    await expect(saveListNotes(21, 'Top')).resolves.toMatchObject({ status: 'CURRENT', progress: 3 });
    expect(sent[0]?.query).toMatch(/SaveMediaListEntry\(mediaId: \$mediaId, notes: \$notes\)/);
    expect(sent[0]?.variables).toEqual({ mediaId: 21, notes: 'Top' });
  });

  it('DeleteMediaListEntry prend l’identifiant de l’ENTRÉE, relu juste avant', async () => {
    const sent = stubAniList(media({ id: 555, status: 'PLANNING', progress: 0 }), { DeleteMediaListEntry: { deleted: true } });
    await deleteListEntry(21);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.query).toMatch(/DeleteMediaListEntry\(id: \$id\)/);
    expect(sent[1]?.variables).toEqual({ id: 555 });
  });

  it('série déjà absente de la liste : aucune suppression envoyée ; « deleted: false » : erreur', async () => {
    const absent = stubAniList(media(null));
    await deleteListEntry(21);
    expect(absent).toHaveLength(1);

    stubAniList(media({ id: 555, status: 'CURRENT', progress: 1 }), { DeleteMediaListEntry: { deleted: false } });
    await expect(deleteListEntry(21)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
