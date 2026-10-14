# Matching corpus

Real matching cases, frozen against real AniList data, so every change to the matching (concordance score, year,
episode count, duration, format, country signals…) is measured against the same situations.

- `cases.ts`: one case per real situation (platform page → expected AniList entry). Each case has
  - `episode` (watch page, run through `resolveEpisode`, the sync path) or `page` (series page, run through
    `resolvePageMedia`, the *On this page* card);
  - `searches`: the AniList searches the code sends today, in order (the request budget is frozen too);
  - `expected`: what the CURRENT code returns (`mediaId`, `confidence`: `high` = synced directly, `low` = « À vérifier » /
    « Saison devinée », `ignored`, `not-found`; `progress` on watch pages). Asserted strictly: a different entry, a
    different confidence or a different progress fails;
  - `ideal` + `gap`: only when the owner wants something else (right entry; `high` only when a link or signals prove it).
    These are the targets of the next steps; they are reported as `todo` tests and in the summary table
    (`npx vitest run src/background/sync/__corpus__ --silent=false`), never failing;
  - `signals`: platform data captured on the real site (Netflix season start years, Disney+ series start year, episode
    durations…), or assumed (said in `source`, « SUPPOSÉ »). `corpus.test.ts` turns them into
    `EpisodeInfo.signals` / `PageMediaInfo.signals` the way each content script does: Netflix through the shared
    `netflixSignals` (reduced metadata rebuilt from the captured `seasons[]`), Prime Video through `reducePrimeDetail` +
    `primeSignals` (a detail page carrying the season's `releaseYear`), Disney+ with the playback rules (series start
    year and season episode count of the series page, duration, format; never a season year); Crunchyroll and ADN watch
    pages send no signals yet, so their captured signals keep the assumed shape (displayed season: year and episode
    count; series start year; duration in minutes; format; airing). Rules in `src/background/sync/concordance.ts`. A
    case without `signals` shows the behaviour without signals (page without the data).
- `anilist/<franchise>.json`: AniList snapshots. `searches` / `byIds` map each request (exact search text; sorted ids
  joined by `,`) to the returned ids in API order; `media` holds the entries in the shape of `MEDIA_FIELDS`
  (`src/background/api/media.ts`), links reduced to the supported platforms, with `duration`, `countryOfOrigin`,
  `status`, `endDate` (and a copy of `seasonYear`) stored apart in `signals`; `corpus.test.ts` puts them back in the entry
  it serves. `fetchedAt` is the snapshot date.
- `corpus.test.ts`: mocks only `anilistPublicQuery` (the real `searchAnime` / `getAnimeByIds` / `parseMedia` run), with
  the fake chrome storage; no network. A request missing from the snapshots fails the case with its key.

## Adding a case

Rule: **a real case reported by the owner becomes a corpus case** (with the page data as the platform sends it).

1. Add the case to `cases.ts` with `searches: []` and any `expected`, and its snapshot name in `anilist` (create
   `anilist/<name>.json` as `{ "fetchedAt": "", "searches": {}, "byIds": {}, "media": [] }` for a new franchise).
2. Run `npx vitest run src/background/sync/__corpus__`: the case fails with the missing requests
   (`searches: "…"`, `byIds: "…"`). Add each one to the JSON with the value `null`.
3. Fetch them: `node scripts/refresh-anilist-corpus.ts --pending <name>`. Repeat 2–3 until nothing is missing (relation
   fetches only appear once the searches are known).
4. Set `searches` and `expected` from the failure diff (the current behaviour), then `ideal` and `gap` if the owner wants
   another result.

## Refreshing the snapshots

`node scripts/refresh-anilist-corpus.ts [name…]` re-fetches every request of the snapshots (all of them, or the named
ones) from the public AniList API, anonymously, 2.5 s apart (about 24 requests per minute), and sets `fetchedAt` to
today. Run it manually, never in `npm run verify`. AniList data moves (new seasons, links added): after a refresh,
review each changed `expected` before accepting it, since a change can be a regression as well as a catalog update.
The script keeps a copy of `MEDIA_FIELDS`; a test checks it is identical to the one in `api/media.ts`.
