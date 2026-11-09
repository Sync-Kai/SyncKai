# Watch order — design

Part of the single 2.5.0 release (branch `feature/watch-order`, stacked on `feature/sequel-alerts`). Owner's choice on the mockup page (2026-11-06): option 1 « Section repliable dans le panneau »; network approach (dedicated query, background lane, 24 h cache) approved; 2026-11-09: MAL-only users get the list states too (option B), AniList is the only catalogue source.

## 1. Intent

Long franchises (Monogatari, Attack on Titan, Gundam, Mushoku Tensei) are hard to follow: seasons, parts, films and OVAs are scattered, and the side panel's « Suites et histoires liées » shows only the direct neighbours of the current entry. The user wants to see, from the entry they are on, the whole franchise in release order, where they are in it and what to watch next, without leaving the panel. Success: one glance at the folded section answers « how far am I and what's next? ».

## 2. Goals, non-goals, anti-goals

Goals:
- A collapsible « Ordre de visionnage » section in the panel's details card, in place of « Suites et histoires liées ».
- Folded: « N / M vus », a bar with one cell per main entry, and « Ensuite : <title> ».
- Unfolded: a vertical timeline in release order, a « Série principale / Tout » switch, the list state of each entry, links to the entry and « Regarder » like today's related rows.
- States for AniList accounts (from AniList) and for MAL accounts (from the user's MAL list).

Non-goals:
- No chronological (story) order: AniList has none; a permanent note under the list says the order is the release order.
- No popup part (option 4 was not kept), no « Prochain » card, no full-panel sub-view.
- No new list action in this section beyond what the related rows already offer (entry link, « Regarder »); « + À regarder » on a sequel stays where the sequel alerts put it.

Anti-goals:
- A burst of AniList requests when the panel opens or the user switches season (the limit is 30/min in degraded mode).
- Unrelated series pulled in (crossovers through OTHER relations: Monogatari → Nisekoi).
- A wrong « Ensuite » pointing backwards (an OVA prequel the user skipped) or to a side story.
- Hoarding AniList data (terms rule 3): the cache is short (24 h, session storage) and only holds franchises the user opened.

## 3. Constraints

- AniList terms and MAL agreement (`docs/memory/auth-and-api-terms.md`): AniList is the catalogue source; MAL is only read for the user's own list.
- Requests on the `'background'` lane; one franchise load in flight per franchise; cache in `chrome.storage.session` (cleared when the browser closes), like `PanelMedia` (`browser/storage/session-cache.ts`).
- Measured on the real API (2026-11-09): the nested `relations` of a related node comes back with `edges: []` in all four captures, so each request advances one hop only. Sequential background requests on a first open: Attack on Titan 8, Monogatari 9, Gundam 9, Mushoku Tensei 6, then 24 h of cache (the « 6 to 9 requests per franchise, dedicated background request, 24 h cache » the owner accepted on the mockup page). Gundam 0079 reaches 55 PREQUEL / SEQUEL entries.
- Panel: Preact, charter `docs/design/README.md`, 320–360 px wide; every string in 21 languages with its context note.
- No new `addListener` in `background/`; account-bound data rules for anything stored per account (the franchise cache holds catalogue data only, no list state).

## 4. Approaches considered

1. **Dedicated franchise query, one relation hop per request, rounds until the chain closes** (chosen). Each round asks `Page(id_in: frontier)` with the relations of each entry; ids not yet read become the next frontier. 6 to 9 background requests per franchise on a first open (measured, §3), cached 24 h under every entry id of the franchise.
2. Reuse the relations already loaded by the panel (`PanelMedia`): one level only, no dates, no list states: no timeline and no « Ensuite » possible. Rejected.
3. Walk one entry at a time with the existing by-id reads: 6 to 9 requests per franchise, exhausts the rate limit. Rejected.

## 5. Design

### 5.1 Franchise graph (service worker, `background/franchise/`)

- **Query**: `Page(perPage: 50) { media(id_in: $ids) { <node fields> relations { edges { relationType node { <node fields> } } } } }` with node fields `id idMal type format status episodes duration title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear externalLinks { url }` (the last for « Regarder », like `PanelMedia`). No inner `relations` level: AniList returns it empty, so it would only add cost. Edges whose `node` is null are dropped. Exact field set and batch size: builder's call after checking the complexity on the real API (§7).
- **Walk**: start from the panel's current entry. Main chain = entries connected by PREQUEL / SEQUEL, any format (the data needs it: the OVA *No Regrets* is PREQUEL of AoT S1, AoT *Final Chapters* are SPECIAL, *Zoku Owarimonogatari* is an OVA), ANIME type only, MUSIC excluded. Rounds continue while the frontier has unread main-chain ids, at most 50 main entries and 8 rounds; a cap reached → the section says the franchise is too long to show fully (shows what was read).
- **« Tout »** adds, one hop from any main entry: SIDE_STORY, SPIN_OFF, ALTERNATIVE, SUMMARY, PARENT. Never OTHER, CHARACTER, SOURCE, ADAPTATION, COMPILATION, CONTAINS, MUSIC; entries of 5 minutes or less per episode excluded (PVs). At most 40 extra entries.
- **Several chains** (Gundam): only the connected component that contains the current entry.
- **Order**: release order by `startDate` (year, month, day); unknown dates last in the order AniList lists them; NOT_YET_RELEASED entries at their announced place, marked announced.
- **Cache**: a complete component (no cap reached) is stored under every entry id it contains, so any entry of it hits the cache; a capped graph is stored under the start id only (another start may read a different part). The finished graph (catalogue data only) is stored in `chrome.storage.session` for 24 h under a versioned key per entry id of the franchise (`franchise:v1:<id>` → the franchise id, plus one record for the franchise), so opening another entry of the same franchise costs nothing. One load in flight per franchise (concurrent panel requests share it). Failed load: nothing cached, error shown, « Réessayer ».
- **Message**: `GET_FRANCHISE { mediaId } → FranchiseResult` (`ok` + graph, or `error` with a translated message), origin `extension`.

### 5.2 List states

- AniList connected: the states come from the user's AniList list. Builder's call: `mediaListEntry { status progress }` in the franchise query on the authenticated client (then the graph cache must NOT store them, or must be split per account), or one separate authenticated read of the user's statuses for the franchise ids (`Page(id_in) { media { id mediaListEntry { status progress } } }`, not cached across accounts). The cache stays catalogue-only.
- MAL connected: the user's MAL full list (`fetchMalFullList`, existing), read once per panel page and kept in memory for the page's lifetime (no storage), matched by `idMal`.
- Both connected: the state of the service chosen in `settings.entryService` drives the counts and « Ensuite »; when the other service differs, its state is in the row's tooltip.
- MAL-only users: the franchise query is a public AniList query (no AniList token needed, `anilistPublicQuery`, like `PanelMedia` for them); the panel already works on AniList ids for MAL-only users. Showing the user's own MAL list status next to an AniList entry is what « Ta liste » already does: it is the user's list data, not MAL catalogue content, so it does not breach « MAL data never merged into AniList data ».
- An entry without `idMal` (not on MAL yet) has no MAL state: shown « pas sur MyAnimeList » and left out of « N / M vus » and of the « Ensuite » search when MAL drives the counts.
- Freshness: the in-memory MAL list is re-read when the panel redetects the page (URL change, Refresh) and after a list action made from the panel; stale in between is acceptable. AniList states are read with the franchise load and after a list action.
- The service chosen in `entryService` is not connected or its read failed → the other connected service's states are used; neither → no states.
- No account: the timeline without states, no « N / M vus », no « Ensuite ».
- States: watched = COMPLETED or REPEATING; in progress = CURRENT (with progress); planned = PLANNING; paused / dropped shown as such; none.

### 5.3 Section (side panel, `details-card.tsx`)

- `relations` becomes `order` in `PANEL_SECTIONS` (first section of the details card), folded by default; the fold state follows the existing sections' rule. No section when the franchise has a single entry; then the old related rows are not shown either (nothing to show).
- Folded header (three lines, a `Collapsible` variant): title « Ordre de visionnage », « N / M vus » (released main entries only), a bar of 6 px with one cell per released main entry (mint = watched, lavender partly filled = in progress, line = not watched; announced entries dotted), « Ensuite : <title> ».
- Unfolded: an ordered list (`<ol>`), one row per entry: node (shape + icon carry the state, never colour alone), overline (format · season / year, lavender for main, muted for extras), title (AniList preferred title on 2 lines with the full title as tooltip; the root title removed only when it prefixes the entry's title), state text, « Regarder » (`choosePlatformLink`, preferred player) and the entry link (`entryLink` rule). The current entry is highlighted (`raised` + badge « Ici », `aria-current`).
- Long chains: 3 or more consecutive watched entries collapse into one line « N vus » (expandable); « Afficher N de plus » after 5 rows (3 at 320 px).
- Switch « Série principale / Tout » (`Segmented`), kept for the panel page's lifetime.
- « Ensuite »: the first released main entry (RELEASING counts as released: it can be watched now) not watched AFTER the user's furthest watched or in-progress main entry in release order — the first released main entry when nothing is watched; never a side entry, never a gap behind (a skipped OVA prequel stays in the list without becoming « Ensuite »); none when everything released is watched (« Tout vu », with the announced next one if any).
- Note under the list: « Ordre de sortie, pas l'ordre de l'histoire ».
- Loading: skeleton with `aria-busy`; error: `Alert` danger with « Réessayer » inside the section; the rest of the card is unaffected.
- Sequel alerts keep working: the « Annoncée » badge and « + À regarder » (sequel store gating) move from the old related rows to the timeline rows of NOT_YET_RELEASED / RELEASING sequels.

### 5.4 Texts (FR / EN, 21 languages)

`panel.order.title` Ordre de visionnage / Watch order · `panel.order.watched_*` {count} / {total} vus · `panel.order.next` Ensuite : {title} · `panel.order.allWatched` Tout vu · `panel.order.here` Ici · `panel.order.main` Série principale · `panel.order.all` Tout · `panel.order.releaseNote` Ordre de sortie, pas l'ordre de l'histoire · `panel.order.watchedRun_*` {count} vus · `panel.order.more_*` Afficher {count} de plus · `panel.order.tooLong` Franchise trop longue : seules les {count} premières entrées sont affichées · `panel.order.state.*` (watched, inProgress {progress}, planned, paused, dropped) · `panel.order.otherService` {service} : {state}. Final keys: builder's call within `docs/memory/i18n.md`.

## 6. Tests and checks

- Unit (tests first): walk on fixtures captured from the real API (AoT, Monogatari with the Nisekoi crossover through OTHER, Mushoku Tensei with parts, Gundam with several chains and the caps, a cycle); release ordering with unknown and announced dates; « Ensuite » cases (skipped prequel OVA, side story never chosen, everything watched, announced next); watched counts; root-title shortening; state merge with two services; request count (rounds) per fixture; cache hit for another entry of the same franchise; one load in flight.
- Components: folded header, unfolded list, switch, collapse of watched runs, « more », loading / error / single-entry / no-account states, `aria-current`.
- `npm run verify`, `CI=1 npm run test:e2e` (panel changes), `CI=1 npm run test:i18n-layout` with a seeded franchise in the panel demo.
- Owner on the real browser: a long franchise (AoT or Monogatari), a MAL-only account, switching seasons on a series page.

## 7. Left to the builder

- Exact query fields and batch size after measuring complexity on the real API; fixtures captured anonymously (no tokens, headers or account ids).
- How AniList list states are read (in the query vs a separate authenticated read) as long as the cache stays catalogue-only.
- Module split in `background/franchise/` and `shared/` (pure walk, ordering, « Ensuite » rules in `shared/`).
- Exact i18n keys.

## 8. Calls made by the assistant (approved by the owner on 2026-11-09)

After the builder check (2026-11-09), settled here: MAL-only users read the graph through the public AniList client; entries without `idMal` excluded from MAL-driven counts; MAL list refreshed on redetect and after a panel list action; `entryService` unavailable → the other service; complete components cached under every id, capped graphs under the start id only; « Ensuite » in release order, RELEASING counts as released, first released entry when nothing is watched; requests share the existing background budget (`rate-limit.ts` › `backgroundQuota`), no extra per-minute ceiling; an announced sequel cut by a cap is not shown in the timeline (Activité and the Agenda still show it).


- Main chain = PREQUEL / SEQUEL any format; « Tout » adds one hop of side relations; OTHER never; MUSIC and ≤ 5 min entries excluded (from the UX study).
- Caps: 50 main entries, 8 rounds, 40 extras.
- Two services: `entryService` decides; the other service in the tooltip.
- The sequel badge and « + À regarder » move to the timeline rows.
