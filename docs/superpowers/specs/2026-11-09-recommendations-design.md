# Recommendations — design

Part of the single 2.5.0 release (branch `feature/recommendations`, stacked on `feature/watch-order`). Owner's choices on the mockup page (2026-11-06): options 1 + 2 + 3 + 4 of « Recommandations selon tes goûts » (panel « Découvrir » tab, Agenda empty-week link, popup suggestion when the list is empty, « Dans le même esprit » in En lecture); the 19 AniList genres translated in the whole extension, tags kept in English; 2026-11-09: AniList is the only source (MAL recommendation votes dropped: MAL agreement 3 (vii) / 3 (xii)), MAL-only users included (AniList catalogue read for them, grey zone accepted). Written while the owner granted full autonomy for the night of 2026-11-09: this document is treated as approved; every call the assistant made is listed in §8 for the owner to check.

## 1. Intent

The user finishes a series and wonders what to watch next. SyncKai knows their scores and their whole list, so it can suggest series they have not seen, explain why (« Parce que tu as noté Frieren ★ 9/10 »), say where to watch, and add one to Planning in one click. Success: a credible suggestion, never something already in the list, in one click from the panel, the Agenda or the popup.

## 2. Goals, non-goals, anti-goals

Goals:
- Panel tab « Découvrir » with one large suggestion card, a « 🎲 Autre » draw, « + À regarder », « Pas intéressé » (5 s undo) and « Déjà tirées » (earlier draws).
- Agenda: the empty-week state gains « 🎲 Une idée ? › » opening the Découvrir tab.
- Popup « Mes séries »: its empty state shows one compact suggestion and « Plus d'idées dans le panneau › ».
- En lecture: a collapsible « Dans le même esprit » section with the current series' community recommendations not in the user's lists.
- The 19 AniList genres translated in 21 languages wherever genres are shown (panel hero chips included); tags stay in English.

Non-goals:
- No MAL recommendation data, no MAL catalogue data.
- No season catalogue browsing (beyond the cold-start « season's top rated » list, 10 entries).
- No chronological / « similar users » machine learning: a transparent score from AniList community recommendations.
- No management page for dismissed suggestions (a « Réafficher les suggestions écartées » button in Settings › My data instead).

Anti-goals:
- A suggestion already in one of the user's lists (any status, either account).
- A suggestion of a sequel of something unseen (S3 of a series the user never started): sequels and prequels of entries not in the list are not suggested.
- Hoarding AniList data: the computed batch is cached 24 h, account-bound, ≤ 60 entries; nothing else is kept.
- A burst of requests on the interactive lane.

## 3. Constraints

- AniList terms (`docs/memory/auth-and-api-terms.md`): fetch what is shown, short caches, background lane; MAL only for the user's own list.
- Measured on the real API (2026-11-09): `Page(perPage: 25) { media(id_in) { genres tags recommendations(sort: RATING_DESC, perPage: 25) { nodes { rating mediaRecommendation { … } } } } }` answers without a complexity error (570 recommendations for 25 seeds); 50 ids with 10 recommendations each also passes.
- Account-bound data rules (`docs/memory/security.md`): the batch and the dismissed ids follow the epochs; dismissed ids are kept in the Backup like other user preferences.
- No new `addListener` in `background/`; Preact rules; charter `docs/design/README.md`; 320–360 px panel; popup 496 × 600 with 440 px content; every string in 21 languages.

## 4. Approaches considered

1. **AniList community recommendations of the user's best-rated completed series, scored and cached as a batch** (chosen). One full-list read + one or two batched recommendation reads per day, then every draw is local.
2. Genre / tag affinity search over the catalogue (`Page(genre_in, tag_in, sort: SCORE_DESC)`): needs many searches, suggests popular generic titles, harder to explain. Rejected.
3. Recommendations of the series on screen only (option 4 alone): no « selon tes goûts », absent outside streaming pages. Kept as the « Dans le même esprit » section, not as the main engine.

## 5. Design

### 5.1 Batch (service worker, `background/recommendations/`)

- **Seeds**: completed (and repeating) series of the connected accounts scored ≥ 7/10 (score normalized with `shared/score.ts` codecs), best scores first, at most 50; MAL entries mapped to AniList ids with `aniListIdsByMal` (`background/anilist/by-mal.ts`). The service that drives seeds: both lists merged (an entry on both: the higher score).
- **Exclusions**: every entry of every list of every connected account (any status), by AniList id and `idMal`; dismissed ids; sequels / prequels / side stories of entries not in the lists are excluded only when the candidate's own PREQUEL is not in the user's lists (needs the candidate's relations: `relations { edges { relationType node { id } } }` in the recommendation node, measured cheap).
- **Candidates**: one request `Page(perPage: 50) { media(id_in: seeds) { id genres tags { name rank isMediaSpoiler } recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { <card fields> } } } } }` on the background lane (two when seeds > 25 if needed; builder measures).
- **Score**: Σ over seeds recommending it of (seed score × max(rating, 1)) × (1 + genre affinity) where genre affinity = share of the candidate's genres among the seeds' genres weighted by seed score; tags with rank ≥ 60 and not spoilers count half as much as genres. Builder may tune constants; the « why » shown is the seed with the largest contribution (« Parce que tu as noté {title} ★ {score}/10 ») plus up to 4 of the candidate's genres / tags that matched.
- **Batch**: the top 60 candidates kept with their card fields and reasons, stored account-bound in `chrome.storage.local` (`reco:batch`, scope `account`) with `computedAt`; recomputed when older than 24 h or after a list change made by SyncKai (add / remove / status) — the batch is just recomputed lazily at next read.
- **Cold start**: fewer than 3 seeds → the 10 best-scored entries of the current season (`Page(season, seasonYear, sort: SCORE_DESC, perPage: 10)`), minus the user's lists, labelled « En attendant : les mieux notées de la saison ».
- **Messages**: `GET_RECOMMENDATIONS { force?: boolean } → RecoResult` (`{ ok: true; batch; seedCount; cold: boolean } | { ok: false; message }`), `DISMISS_RECOMMENDATION { id; undo?: boolean } → boolean`, `RESTORE_RECOMMENDATIONS → boolean`; origin `extension`.
- **Dismissed ids**: `reco:dismissed` in `chrome.storage.local`, scope `user` (kept across sessions of the same user, purged when no session is left), at most 500, included in the Backup.

### 5.2 Panel « Découvrir » tab (option 1)

- Third tab in `sidepanel/tabs.ts` `PANEL_TABS` (« En lecture », « Agenda », « Découvrir »), never chosen automatically by `followPageContext`; an unselected tab whose label does not fit becomes icon-only (accessible name and tooltip kept).
- Card: banner (72 px, `bannerImage`, gradient to `surface`, `coverImage.color` fallback), `Cover` hero, title (2 lines, tooltip), format · year · episodes, « why » box (`raised`, sparkles icon, translated genres in lavender chips, tags in line chips, ≤ 4), « Où regarder » platform chips (optional platforms without access greyed with « Activer »), « 🎲 Autre » (secondary), « + À regarder » (primary; becomes « ✓ Dans À regarder »), « Pas intéressé » and « Fiche AniList ↗ » as text buttons; « Déjà tirées » strip (last 8 draws, page lifetime).
- Draw: local, weighted random over the batch minus drawn / dismissed / added; dice turn 360 ms then a cross-fade (reduced motion: fade only); a polite live region announces the new title and reason; focus stays on « Autre ».
- States: loading (skeleton, « On fouille tes goûts… »), cold start, MAL-only note, error with « Réessayer », nothing left (« Plus rien à te proposer », « Revoir les écartées »), no account.
- Controller without DOM `sidepanel/discover-controller.ts` (`dispose()`), loads on first open of the tab.

### 5.3 Agenda link (option 2)

The empty-week state of the Agenda gains a line « 🎲 Une idée ? › » that switches the panel to the Découvrir tab.

### 5.4 Popup suggestion (option 3)

When « Mes séries » is empty (no series being watched), the empty state shows one compact suggestion (cover, title, why in one line, « + À regarder ») and « Plus d'idées dans le panneau › » (opens the side panel on Découvrir, inside the click: same user-gesture rule as the existing panel button).

### 5.5 « Dans le même esprit » (option 4)

A collapsible section in the details card of En lecture, after « Ordre de visionnage »: the current series' AniList recommendations (top 5 by rating, from `PanelMedia` with `recommendations(sort: RATING_DESC, perPage: 8)` added to its query, cache version bumped), minus entries in the user's lists (states from `GET_LIST_STATES`), minus dismissed ids; each row: cover, title, « {count} fans de {title} » (rating), entry link, « Regarder » when a platform link exists, « + À regarder ». Hidden when empty.

### 5.6 Genres in 21 languages

`genre.<Name>` keys for the 19 AniList genres (Action, Adventure, Comedy, Drama, Ecchi, Fantasy, Hentai, Horror, Mahou Shoujo, Mecha, Music, Mystery, Psychological, Romance, Sci-Fi, Slice of Life, Sports, Supernatural, Thriller), one helper `genreLabel(name)` (unknown → the AniList name), used by the panel hero chips and the recommendation cards. Tags unchanged.

### 5.7 Settings

Settings › My data: « Réafficher les {count} suggestions écartées » (`RESTORE_RECOMMENDATIONS`), shown when there are dismissed ids.

## 6. Tests and checks

- Unit (tests first): seed selection (score threshold, normalization, both accounts, MAL mapping), exclusions (any status, both ids, dismissed, unseen-prequel rule), score and « why » on a real captured fixture (Frieren and three more seeds), weighted draw without repeats, cold start, batch cache (24 h, account switch), dismiss / undo / restore, genre labels.
- Request-count test: a 300-entry list → expected background requests.
- Components: Découvrir card and every state, three tabs at 320 / 360 px, Agenda link, popup empty-state suggestion, « Dans le même esprit ».
- `npm run verify`, `CI=1 npm run test:e2e`, `CI=1 npm run test:i18n-layout`, `npm run test:ext` when a scenario fits.

## 7. Left to the builder

- Exact score constants; batch size per request after measuring; module split; exact i18n keys (within the UX study's list).

## 8. Calls made by the assistant (night of 2026-11-09, owner's autonomy grant)

After the builder check (2026-11-09), settled here:
- Adult content: `isAdult` titles are never suggested (batch, popup, « Dans le même esprit »); no setting. The Hentai genre label is still translated (it may appear on the user's own entries).
- « + À regarder » uses the existing `ADD_TO_LIST` (every connected service, like everywhere else). A candidate without `idMal` for a MAL-only user shows « pas encore sur MyAnimeList » and no add button (same rule as the sequel alerts).
- MAL scores and MAL entries mapped to AniList ids seed the AniList queries: it is the user's own list data reading the AniList catalogue for them, the MAL-only grey zone the owner accepted; no MAL catalogue content is read or merged.
- Card fields: `id idMal isAdult format status episodes duration averageScore genres tags { name rank isMediaSpoiler } title { userPreferred } coverImage { large medium color } bannerImage siteUrl startDate { year } season seasonYear externalLinks { url } relations { edges { relationType node { id } } }`; « Où regarder » = `buildPlatforms(externalLinks, [])` (same path as the panel and « Regarder »), an optional platform without access greyed with « Activer » through the page's platform-access store.
- Unseen-sequel rule: a candidate with a PREQUEL (one hop) whose prequel is not in the user's lists as COMPLETED, CURRENT or REPEATING is not suggested (Planning / Paused / Dropped prequel → excluded too). Measure the relations field's cost with the batch query before coding; if it pushes complexity over the limit, drop to 8 recommendations per seed.
- Seeds: scored ≥ 7/10 first; when fewer than 3, unscored completed series are added with weight 6 (most recently updated first) until 3; cold start only with fewer than 3 completed series at all.
- After a SyncKai add or dismiss: the id is removed from the batch locally (no recompute); full recompute only when the batch is older than 24 h or on « Réessayer ».
- Dismissed ids: one list per user (shared by both accounts), purged when no session is left; the Backup carries it and a restore replaces it (schema change handled like other backup fields, builder checks `backup-store.ts`).
- Popup: when « Mes séries » is empty it reads `reco:batch` from storage; with no batch it sends `GET_RECOMMENDATIONS` once (the popup already talks to the worker on open). Opening the panel on Découvrir: a short-lived session key read by the panel on load (same pattern as `browser/popup-screen.ts`), set inside the click with the panel opening.
- « Dans le même esprit »: user's lists, dismissed ids, adult and unseen-sequel rules applied (relations of the recommendation nodes in the `PanelMedia` query).

Earlier calls:

- Seeds: completed / repeating scored ≥ 7/10, up to 50, both accounts merged with the higher score.
- Unseen-sequel exclusion rule (a candidate whose PREQUEL is not in the user's lists is not suggested).
- Batch of 60, account-bound, 24 h; dismissed ids user-scoped, ≤ 500, in the Backup.
- No management page: a « Réafficher » button in Settings › My data.
- Popup: only the empty-state suggestion (no « Pour toi » popup tab: the final mockup choices kept options 1–4 only).
- Genres translated everywhere genres are shown (panel hero included), per the owner's « 19 genres traduits ».
