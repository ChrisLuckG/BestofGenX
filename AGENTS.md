# Project notes

## Verification commands

- Typecheck: `npx tsc --noEmit`
- Dev server: `npm run dev` (http://localhost:3000)

`tsc` alone is not sufficient — see the client/server bundling trap below.

## Client/server bundling trap

`"use client"` components must not import from a module that (even indirectly, even
behind a dynamic `await import()`) reaches `@/lib/mongodb`. Webpack follows the
dynamic import anyway, pulls the mongodb driver into the browser bundle and every
route starts returning **500** — while `npx tsc --noEmit` stays completely green.

The failure shows up only in the dev-server log:

```
Import trace for requested module:
./node_modules/mongodb/lib/index.js
./src/lib/mongodb.ts
./src/lib/<your lib>.ts
./src/components/<your client component>.tsx
```

So after touching imports in a client component, always load a page and check the
status, e.g. `Invoke-WebRequest http://localhost:3000/admin -UseBasicParsing`.

Pattern to follow: keep the client-safe helpers in their own module.
See `src/lib/releaseCategory.ts` (client-safe) next to `src/lib/wikidataReleases.ts`
(server-only, uses MongoDB for caching).

## Ranking periods: a negative balance means NO rank

`buildPeriodRankings` in `src/app/api/rankings/snapshot/route.ts` ends with
`rankings.filter(r => r.points > 0)`. A player whose net `pointsChange` over the
window is <= 0 is dropped from that leaderboard entirely — they are not sorted to
the bottom, they simply have no rank.

Day, month and year are independent windows over the same GameResult events
(10:00 Berlin boundaries), so the three ranks routinely disagree, and that is
correct behaviour rather than a bug. Measured for Bacon77 on 02.09.:
day **+0.13 → #22**, month **−2.37 → no rank**, year **+101.56 → #2** — losses on
the 1st outweighed the small gain on the 2nd.

Therefore an unranked period must render as an explained "?", never as a bare "—":
35 games played in the month looks identical to never having played. Do not "fix"
this by removing the filter without asking — whether a negative player is listed
last or not listed at all is a product decision about the leaderboard.

The tooltip wording lives in `src/lib/rankPeriod.ts` and is used by BOTH
`src/components/Header.tsx` (mobile, tap + 5s auto-close, no `mouseleave` on touch)
and `src/components/desktop/DesktopRankWidget.tsx` (hover). Edit the helper, not the
components: these two widgets already drifted apart once, which is how the day ended
up with an explained "?" while month and year showed a silent "—".

`scripts/diagnose-month-rank.ts` replicates the API's window maths and the
`points > 0` filter for one user, which is the fastest way to answer
"why do I have a day rank but no month rank".

## BOGX coin counter: optimistic vs. server value

Two things write the balance: optimistic local updates (instant reward feedback,
count-up animations) and `syncFromServer()` in `useBogxCoins`, which writes the
authoritative value. Mixing a RELATIVE optimistic update with an ABSOLUTE sync makes
the counter double-count: the sync lands first with the already-credited balance,
then the animation's steps are added on top (96.71 → 96.75 → back to 96.73).

Rules:

- `setCoins` returned by `useBogxCoins` marks the counter as locally owned for
  `OPTIMISTIC_WINDOW_MS`; syncs arriving in that window are postponed, not applied
- count-up animations must write **absolute** values (`start + progress`), never
  `prev + step`
- dispatch `bogx-updated` **after** the reward POST resolves - dispatching before it
  makes the refresh read the pre-credit balance

## Video relevance (articles, history, cron)

All YouTube searches for embedded videos go through `src/lib/youtubeSearch.ts`.
There used to be three separate copies with three different levels of rigour
(article route: scored but no minimum; shared lib: format keywords only, no topical
check; daily-facts cron: `maxResults=1` used blindly) — which is how a Korn music
video ended up next to a paragraph about a tattoo studio.

Rules now:

- callers pass `context` = the heading + paragraph the video will sit next to, so
  relevance is judged against the passage, not only against the search phrase
- a candidate passes if it covers enough of the **query** OR if its own title words
  are largely covered by the **context**
- nothing on topic ⇒ `null` ⇒ **no video is embedded**. This is intended; an
  unrelated embed is worse than none
- `minRelevance: 0` disables the gate and is only for ranking tiles/thumbnails,
  where a loose thumbnail beats an empty tile

Thresholds (`DEFAULT_MIN_RELEVANCE`, `MIN_TITLE_IN_CONTEXT`) were tuned against real
pairings, and the measured scores are recorded in the code comment next to them. If
you change them, re-check both a known-good and a known-bad pairing — a plainly
correct video sat exactly on the line at the first values tried.

## Rankroll item → video matching

`src/lib/rankrollMatch.ts` assigns pool videos to ranking entries. Rules that must
not be softened:

- an entry without a real textual match gets **no video** (`confident: false`,
  no `videoId`). Padding with leftover pool videos was tried and produced rankings
  such as a Spanish tennis match illustrated by a Brazilian football clip
- consumers must filter on `confident`, not on the presence of a `videoId` —
  otherwise the "🎬 n/m videos" count on the proposal card is meaningless
- a proposal needs at least `max(3, ceil(wanted / 2))` matched entries, otherwise it
  is surfaced as an error. For obscure subjects YouTube simply has no footage, and
  that is a legitimate "no" rather than something to paper over

`videoEmbeddable=true` on `search.list` is not sufficient — deleted, private and
region-blocked videos still appear. `youtube-search-bulk` therefore verifies the ids
with `videos.list` (1 quota unit for 50 ids, vs 100 for a search).

## Wikidata date verification (newsroom events)

`src/lib/wikidataReleases.ts` verifies "on this day" event dates.

The pool SPARQL query is unavoidably slow: measured 9s / 12s / 20s and once over
55s for the identical query — the variance is endpoint load, not query shape.
Variants without the label service or without `ORDER BY` were measured and were
slower or returned HTTP 504. Therefore:

- results are cached in memory **and** in MongoDB (`wikidataReleaseCache`), keyed by
  category + month + day, because they describe historical facts
- an empty result is cached too, so `getPoolIfCached` returns `null` for
  "not cached" and `[]` for "checked, nothing on this day"
- `verifyRelease()` reads the cache only and never triggers the slow query — doing
  it per reporter would add minutes to a search
- the pool is warmed when an event template is selected, not when Send is pressed

## Wikidata birthday pool (newsroom Birthday/RIP)

`src/lib/wikidataBirthdays.ts` supplies the verified list of GenX people born on a
given day. When it returns nothing, reporters answer from model memory and invent
birth years — so a failure here is not a degraded result, it is a wrong article.

Bind the day with `VALUES ?birthDate`, never with `MONTH()`/`DAY()` filters:

```sparql
VALUES ?birthDate { "1965-08-21T00:00:00Z"^^xsd:dateTime ... }   # 16 GenX years
```

`FILTER(MONTH(?birthDate) = 8 && DAY(?birthDate) = 21)` makes WDQS read the birth
date of every person with that occupation and evaluate a function on it. Measured
on 21.08. for `politics`: **HTTP 504 after 65s**, both with `wdt:P106/wdt:P279*`
and with plain `wdt:P106`. The `VALUES` form is an index lookup — same day, same
category, **1.5s and 63 politicians**. All categories in parallel: 3.4s.

Rules:

- `fetchWikidataBirthdays` returns `null` for "could not ask" (unmapped category,
  HTTP error, timeout) and `[]` for "asked, nobody matches". Collapsing both into
  `[]` is what hid the 504: the caller did `births.length ? block : ''` and simply
  omitted the birthday block, so the reporter had nothing to pick from and guessed
- on `null` the prompt gets `formatBirthdayUnavailable()` — "source unavailable, do
  NOT name anyone from memory". Absence of information must reach the model as an
  instruction
- the whole lookup is capped by `TOTAL_BUDGET_MS` (25s). `Retry-After` must not be
  obeyed verbatim: WDQS answers 429 with `Retry-After: 60`, and the unbounded
  `retryAfter * 1000` produced a **124s** call. The caller runs with
  `maxDuration = 60` and still needs an OpenAI completion afterwards
- an empty `country` must never satisfy a country/continent filter. `wanted.includes('')`
  is always true, which put a Slovak politician with no P27 into a "Germany ONLY" list
- "no pool wanted" must resolve to `null`, never to `[]`. **An empty array is truthy**,
  so `wikidataBirths ? formatBirthdayContext(...) : ''` formatted a pool that had never
  been fetched into "Source: Wikidata (complete). Result: NOBODY matches" — and
  `formatBirthdayContext([], m, d, undefined)` then threw on `category.toUpperCase()`.
  With CATEGORY = "Any" that TypeError 500'd the whole route, which the newsroom
  displayed as "Reporter returned an empty response" for every reporter
- CATEGORY = "Any" is a birthday request too. `hasWikidataCategory(undefined)` is
  false, so an unfiltered request used to get no pool at all — the exact situation
  where reporters invent birth years. It now queries the union of all occupation
  categories (`fetchWikidataBirthdaysAnyCategory`), in parallel and per-slug cached:
  measured 15.8s cold for 139 people on 23.08. Categories whose occupation classes
  are a subset of another's are skipped — `news` (Q1930187) is contained in `culture`
  and contributed nothing while costing a full 20s timeout slot

A failed request must never be rendered as "the reporter found nothing" — the reporter
was never asked. `/api/editorial/chat` returns the real cause (OpenAI message, 429 →
`RATE_LIMIT`, empty completion → `EMPTY_COMPLETION` with `finish_reason`), and
`NewsroomConference` shows it instead of parsing an empty string into
"Reporter returned an empty response".

`/api/almanac/generate` has **no** Wikidata gate — it saves raw gpt-4o-mini output.
Do not use it to judge whether the reporters can find someone; it happily produced
"Tim Griffin 1967" (really 1968), "Goshi Hosono 1968" (really 1971) and two people
who do not exist. The reporter path is `/api/editorial/chat`.
