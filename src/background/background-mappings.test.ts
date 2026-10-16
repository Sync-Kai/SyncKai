import { describe, expect, it, vi } from 'vitest';
import type { PageMediaInfo } from '../shared/page-media.types';
import { FakeEvent, installFakeChrome } from '../test/fake-chrome';

// Correspondances modifiées par une page de l'extension (« Oublier » dans Réglages, restauration d'une sauvegarde) :
// MAPPINGS_CHANGED fait oublier au service worker les résolutions de page gardées en mémoire (L4, sans storage.onChanged).

const resolver = vi.hoisted(() => ({ resolveEpisode: vi.fn() }));
vi.mock('./sync/resolver', async (importOriginal) => ({ ...(await importOriginal<typeof import('./sync/resolver')>()), resolveEpisode: resolver.resolveEpisode }));
// Scripts des plateformes (imports `?script` de crxjs, sans objet ici)
vi.mock('./platform-access', () => ({ listenPlatformAccess: (): void => undefined }));
vi.mock('./content-reinjection', () => ({ listenContentReinjection: (): void => undefined }));

type Respond = (response: unknown) => void;
const onMessage = new FakeEvent<[unknown, chrome.runtime.MessageSender, Respond]>();
const event = (): FakeEvent<unknown[]> => new FakeEvent<unknown[]>();

const fake = installFakeChrome({
  extensionId: 'synckai-test',
  extra: {
    runtime: {
      id: 'synckai-test',
      getURL: (path: string) => `chrome-extension://synckai-test/${path.replace(/^\//, '')}`,
      onMessage,
      onInstalled: event(),
      onStartup: event(),
    },
    commands: { onCommand: event() },
    notifications: { onClicked: event(), onButtonClicked: event() },
    permissions: { onAdded: event(), onRemoved: event() },
  },
});
fake.reset({ settings: { language: 'en' } });
await import('./background');

const PAGE_SENDER = { id: 'synckai-test', url: 'chrome-extension://synckai-test/src/sidepanel/sidepanel.html' };
const CONTENT_SENDER = { id: 'synckai-test', tab: { id: 7 } as chrome.tabs.Tab, url: 'https://www.crunchyroll.com/watch/GFRIEREN3/x' };

function send(message: unknown): Promise<unknown> {
  return new Promise((resolve) => onMessage.emit(message, PAGE_SENDER, resolve));
}

const page: PageMediaInfo = {
  platform: 'crunchyroll',
  kind: 'episode',
  seriesId: 'GFRIEREN',
  seriesSlug: 'frieren',
  seriesTitle: 'Frieren',
  seasonNumber: 1,
  seasonTitle: null,
  episode: {
    platform: 'crunchyroll',
    episodeId: 'GFRIEREN3',
    seriesId: 'GFRIEREN',
    seriesSlug: 'frieren',
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/GFRIEREN3/x',
  },
};
const resolvePage = (): Promise<unknown> => send({ type: 'RESOLVE_PAGE_MEDIA', payload: { page, mediaId: null } });

describe('MAPPINGS_CHANGED', () => {
  it('envoyé par une page de l’extension : la page suivante est résolue de nouveau ; par un script de contenu : refusé', async () => {
    resolver.resolveEpisode.mockResolvedValue({ result: { ok: false, reason: 'x', ignored: true }, candidates: [], seasons: [], seasonGroups: [] });
    await resolvePage();
    await resolvePage();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);

    // Script de contenu (page tierce) : jamais accepté, la résolution en mémoire reste
    const answered = vi.fn();
    onMessage.emit({ type: 'MAPPINGS_CHANGED', payload: null }, CONTENT_SENDER, answered);
    await resolvePage();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);
    expect(answered).not.toHaveBeenCalled();

    await expect(send({ type: 'MAPPINGS_CHANGED', payload: null })).resolves.toBeNull();
    await resolvePage();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(2);
  });

  it('payload autre que null : refusé', async () => {
    const answered = vi.fn();
    onMessage.emit({ type: 'MAPPINGS_CHANGED', payload: { key: 'x' } }, PAGE_SENDER, answered);
    await Promise.resolve();
    expect(answered).not.toHaveBeenCalled();
  });
});
