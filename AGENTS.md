# Project notes

## Verification commands

- Typecheck: `npx tsc --noEmit`
- Dev server: `npm run dev` (http://localhost:3000)

`tsc` alone is not sufficient — see the client/server bundling trap below.

### Visual check for fiddly CSS (borders, tabs, fillets)

Chrome is installed and can render a screenshot headless, which the agent can then
read as an image. Use it BEFORE handing over pixel-level geometry; the Solo Trivia
stake tab took four blind rounds that a single render would have caught (an
absolutely positioned child's `bottom` is measured from the PADDING box, a
transparent border eats half of a corner's diagonal, etc.).

```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=3 --window-size=940,560 \
  --screenshot="F:/Projekte/sporttock/tmp.png" "file:///F:/Projekte/sporttock/tmp.html"
```

Reproduce the construction in a throwaway HTML file, render the edge cases (first /
middle / last), then delete the temp files.

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

## "Which day does this count towards" — use rankingDayKey()

The ranking day runs **10:00 Berlin → 10:00 Berlin**. Any per-day counter must be
keyed with `rankingDayKey()` from `src/lib/berlinTime.ts` (dependency-free, so
client components can import it too).

A UTC or browser-local midnight is **not** a day boundary here — it falls inside
the ranking day. The daily trivia limit was keyed on `getUTC*()`, so the counter
reset at 01:00/02:00 Berlin, halfway through the ranking day, and handed out a
second set of 5 games that still scored towards the same day: **10 games instead
of 5** on the primary earning path. The client's localStorage fallback used the
*browser's* midnight, so changing the system timezone also reset it.

`scripts/check-ranking-day-key.ts` asserts the boundaries, including the CET/CEST
switch and the month/year rollover. Run it after touching the helper — a wrong
offset here silently misfiles a whole day of activity.

Still on their own, inconsistent day definitions (not yet unified): the
`gameDate` string written by `awardBogx`/`update-bogx`/`game-results` is a Berlin
*calendar* date, and the historical branch of `buildPeriodRankings` ends the day at
09:00 instead of 10:00, so a historical day and the month do not reconcile.

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

## Author voices: FOUR, and one definition

`src/config/authorStyles.ts` offers the selectable styles, `src/lib/authorStylePrompts.ts`
holds the briefs. Every id in the first must have a brief in the second —
`scripts/check-author-styles.ts` asserts it.

There are four voices plus the neutral `informative` baseline:
`irvine-welsh`, `benjamin-stuckrad-barre`, `nora-ephron`, `slavenka-drakulic`.
The selection criterion is **humour**, not literary standing: each brief carries a
`MUST BE FUNNY` clause and a `FORBIDDEN` list. Joan Didion was evaluated and rejected
because her voice bans humour by design.

This was previously defined in FOUR places that had all drifted:

- the dropdowns offered 16 names
- `generateReporterPrompt.ts` had 16 worked guides (the good ones)
- `/api/generate-ranking-article` had its own shorter 7, keyed `hunter-thompson`
  while the UI sent `hunter-s-thompson`
- `src/prompts/almanac.txt` had a fourth set

Every mismatch failed **silently**: the article was still produced, just in the fallback
voice. Nine of the sixteen offered styles had no brief at all, so picking "Murakami" and
picking "Informative" returned the same prose.

`/api/almanac/article` (the "Create Article" button in Menschen) was worse — it resolved
nothing. The slug went into the *user* message as `Tone: irvine-welsh` with nothing
explaining it, while the system prompt simultaneously demanded "nostalgic, engaging,
celebrate GenX culture". That combination is what produced "emerged as a beacon of hope"
and "a testament to resilience and hard work". Rules that follow from it:

- the brief belongs in the **system** prompt, and it must say it overrides house tone
- the generic-nostalgia instruction has to be **dropped** when a voice is picked; the two
  contradict each other and the house tone wins
- headings must be voiced too — a neutral heading over voiced prose breaks the piece
- `temperature` 0.95 for a voice, 0.7 for `informative`

A reporter's `writingStyle` is a **select**, never free text: an unrecognised id falls
back to another voice, so a typo produced a profile that claimed one style while the
articles came out in another.

Reporters are four, one per voice (`/api/editorial/seed`). It was nine, and five of them
pointed at styles with no brief (`bill-bryson` never had one). The seed only upserts, so
`RETIRED_REPORTER_SLUGS` clears `isAIReporter` and deletes the profile — the User row
stays, because articles reference it as author and deleting it orphans the byline.

## Article facts: write FROM a verified source, never from memory

`src/lib/wikipediaSource.ts` is the single definition of the source lookup and the prompt
blocks that go with it. Used by `/api/almanac/article` and `/api/editorial/chat`.

Without source text the routes were handed a name, a profession and a birth year and then
told to produce "a specific moment, quote or anecdote" per section. That does not yield a
thin article, it yields a **wrong** one - the model has to invent the specifics. Measured:
Marco Sturm (ice hockey) was described as playing for **Schalke 04**, a football club, and
as drafted by Buffalo in 1995 when it was San Jose in 1996.

**The verification is the important half.** Handing over the WRONG page is worse than
handing over nothing, because the invented facts then look sourced - and "Marco Sturm",
"Chris Powell", "Thorsten Schmidt" all match several people in different fields. A
candidate page is accepted only when its text corroborates the record we already hold:
the birth year, or failing that a profession word. Otherwise `null`, and the prompt is
told plainly that no source exists. Same contract as `formatBirthdayUnavailable()`.

- the extract cap is 14000 chars, not 6000: the interesting material (odd transfer,
  injury, fallout) sits in the article BODY. Marco Sturm's article is 13181 chars, so the
  old cap discarded more than half of it
- `buildSourceBlock()` carries BOTH halves - the factual limits AND the instruction to
  build a story out of the material. The restrictive half alone produced correct but flat
  articles; the story half alone produced invented ones
- `/api/editorial/chat` fetches a source only when the caller passes `subject` explicitly.
  It deliberately refuses to guess the subject out of the free-text message, because a
  wrong page would make invented facts look sourced. `NewsroomConference` passes it when
  writing about a selected proposal
- `scripts/check-wikipedia-source.ts` / `check-source-material.ts` probe this against the
  real Marco Sturm case

## History flow: the roster is FOUR, not five

`/api/admin/users?isAIReporter=true` returns **five** accounts. The fifth,
`ai_eastercorn` / "Eastercorn", is the admin account, not a reporter - its
`writingStyle` ("Authoritative & Bold") is not one of the four defined voices, so
asking it for an event silently uses a fallback voice. Both callers filter it out:

```ts
.filter(u => u._id && u.username !== 'ai_eastercorn' && u.displayName !== 'Eastercorn')
```

`src/components/admin/HistoryModal.tsx` is the standalone "On This Day" flow, driven
from the Articles tab; `NewsroomConference` has its own copy of the same filter.
Two things in it carry behaviour and must not be "simplified":

- reporters are asked **sequentially**, each told what the others already found via
  `excludeEvents`. In parallel they return the same event
- used titles are remembered for 21 days under `localStorage['newsroom-historyUsed']` -
  the **same key** the conference uses. A separate key would let a multi-day event
  (Woodstock, 15-18 Aug 1969) be retold once per day of its span

`bannerImage` and `headline` are optional for `/api/editorial/history-compile`: with no
banner the route generates a cover itself, which costs ~2 minutes per article.

**`allowWithoutVideo` decides whether "no footage" kills the event.**
`/api/editorial/history-event` searches YouTube four times and, by default, returns
`success: false, noVideo: true` when all four miss - discarding an event that had
already passed the pool and day-exactness gates. Measured on 4 Oct for one reporter:
three of four reporters lost a valid event ("Lesotho Gains Independence from the UK",
"Free Software Foundation is Born", "Janis Joplin Joins the '27 Club'") purely for
lack of footage.

`HistoryModal` sends `allowWithoutVideo: true`, so the event survives with
`youtubeVideoId: undefined` and `noVideo: true`, and the admin pastes a link instead.
The default stays `false` so `NewsroomConference` is untouched. This does NOT weaken
the relevance gate in `youtubeSearch.ts`: an unrelated video is still rejected, the
event simply no longer dies with it.

A pasted link goes through `parseYouTubeId()` in `HistoryModal.tsx`, which accepts
watch/youtu.be/embed/shorts/live URLs and bare ids, and returns `null` for anything
not id-shaped - a typo must clear the video rather than store a string that renders
as a broken thumbnail and then gets compiled into the article.
`scripts/check-youtube-id-parse.ts` covers both directions.

`scripts/check-history-roster.ts` asserts the exclusion against the live endpoint and
the 21-day memory semantics.

## Community Radio articles: two flags that only work together

`src/components/admin/RadioModal.tsx` (Articles tab) and the Radio row in
`NewsroomConference` both POST to `/api/editorial/chat` with `articleMode: true`.
Unlike the History path, **the route creates the Article itself** and returns
`articleDraftId`; `status` is `autoPublish ? 'published' : 'draft'`, so omitting
`autoPublish` is what keeps it a draft.

`skipYoutube: true` and `spotifyLinks` must be sent **together**:

- `skipYoutube` switches off the YouTube search, selects the radio JSON format
  (`spotifyEmbed` per section instead of `youtubeSearch`) and turns on @username
  highlighting
- `spotifyLinks` is what the route matches against, keyed `song|band`. With
  `skipYoutube` but no links the sections have nothing to embed

Songs come from `/api/song-request?status=added` only - the ones curated in the
Requests tab. A request without `link` cannot be embedded, so the modal marks it.

Despite the field being called `spotifyEmbed`, the output is **inline
`<a href="open.spotify.com/track/...">` links inside the prose**, not iframe
players. Measured on the 12 Aug article: 16 track links, 0 iframes, 0 YouTube
iframes, 4 highlighted usernames. Do not "fix" a missing player - there never was
one. `scripts/probe-radio-embeds.ts` reports these counts.

## History events must fall on the EXACT day

`/api/editorial/history-event` builds its pool from Wikipedia's `onthisday` feed for
today's month/day across 13 language editions. The prompt always carried an EXACT DATE
RULE - but nothing checked the answer, and `date` was stored verbatim, so an event three
days either side was accepted silently.

Three gates now, all of them BEFORE the YouTube search (which costs quota and seconds):

1. **empty pool aborts.** `wikiEventsList` used to become `''` while the prompt still
   said "You MUST choose from this list" - with no list. The model then answered from
   memory and the route returned `success: true`. Now: `{ success: false, noPool: true }`
2. **pool membership.** The chosen year must exist in the pool, and the title+description
   must overlap a pool entry for that year by >= 0.15 of its distinctive words. Pool
   membership is what really enforces "same day", since the pool IS today's feed.
   Measured separation: a voiced retelling scores 0.50, an unrelated event 0.00. The
   threshold is low on purpose - reporters rewrite in their own voice and translate out
   of German/Russian/Chinese, so a high bar would reject legitimate rewrites
3. **date string.** Must still resolve to today (`September 8, 1978`, `8 September 1978`
   and `1978-09-08` all parse). Unparseable counts as failure, not as a pass.

The stored `date` is then written canonically from `todayStr` + year - the model's string
is never kept. `scripts/check-history-day-exact.ts` covers the 3-days-either-side cases.

## PowerShell file splicing corrupts emoji

`Get-Content` (no `-Encoding`) reads a BOM-less UTF-8 file as ANSI; `Set-Content -Encoding
UTF8` then writes it back double-encoded and adds a BOM. This destroyed every emoji and
em-dash in `generateReporterPrompt.ts` (59 lines) while `npx tsc --noEmit` stayed green,
because mojibake is valid TypeScript inside a string.

Use the `edit`/`write` tools for source files. If a range splice is unavoidable, read and
write explicitly:
`[System.IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)` /
`WriteAllText($f, $s, (New-Object Text.UTF8Encoding($false)))`.
The damage is reversible while it is single-pass - encode as Windows-1252, decode as
UTF-8 - but verify against `git diff` afterwards that only intended lines changed.

### Birthday piece structure: chronological spine, selective stations

`buildSourceBlock()` first said "do NOT walk through it chronologically". That was aimed
at a real failure - restating Wikipedia in Wikipedia's own order and weighting - but it
banned too much: a birthday article IS a look back over a life, so the spine has to be
chronological.

The distinction that matters:

- chronological **order**: right
- chronological **completeness**: wrong (weight by interest, skip the dead years and say
  so rather than padding them)
- chronological **headings** ("Early Life", "The Breakthrough", "Legacy"): banned, see
  `BANNED_HEADINGS_RULE`

Shape: hook out of order once, then forward in time one station per section, then land in
the present - what they do today. The closing paragraph carries three things at once and
must stay ONE paragraph: present day + the single birthday mention (`buildOccasionBlock`)
+ the grudging-respect stance (`CLOSING_STANCE`). Stacked separately they read as three
endings.

`buildOccasionBlock` is conditional on the real Berlin calendar day, and returns the
remembrance variant on a death anniversary. An unconditional birthday line would land in
obituaries and in articles about video games. The age is computed in code, not by the
model - it has already been caught contradicting itself inside one paragraph
("a 19-year-old phenomenon" / "the kid was a mere 20").

## `bg-white` is NOT white - it is cream (#F5F0E8)

`tailwind.config.ts` overrides the `white` colour token:

```ts
colors: { white: '#F5F0E8', paper: '#FFFFFF' }
```

So `bg-white` compiles to `background-color: rgb(245 240 232)` and `text-white` to the
same cream. This is deliberate for the **public app** (the whole frontend is cream-themed
and ~100 components rely on it). Do not remove it.

It is wrong for the **admin**, and it fails in the most expensive way possible: an
unexplained warm-brown tint that no CSS override can fix, because the override IS the
colour. Hours went into chasing it through `body`, nested layouts, a route-group layout,
`!important` cascades and ~130 lines of `.admin-page [class*="bg-gray-9"]` overrides -
all of which were either dead code or fighting the wrong declaration. The giveaway, had
anyone looked: the admin tab bar WAS white, because `.admin-tab` in `globals.css` uses
the raw CSS keyword `background-color: white` rather than the Tailwind token.

Rules:

- admin surfaces use **`bg-paper` / `text-paper`** (real `#FFFFFF`), never `bg-white`
- never bulk-replace a dark class with `bg-white` in `src/components/admin/` - a
  `bg-gray-800 -> bg-white` codemod moved 465 declarations from dark grey to *cream* and
  looked like it had done nothing. A script doing exactly that was written and deleted;
  do not reinvent it
- verify colour against the COMPILED css, not the source:
  `curl -s localhost:3000/_next/static/css/app/layout.css | grep -A2 '\.bg-paper{'`
- `tailwind.config.ts` is read once at dev-server **start**. A new colour token does not
  hot-reload - `bg-paper` silently renders as *no background at all* until you restart,
  which looks identical to "my change did nothing"

The first rule above is correct but was not enough: knowing the rule and typing `bg-white`
anyway is the actual failure mode, and it recurred repeatedly in one session even with this
section already written. `globals.css` therefore pins the white utilities back to a real
`#FFFFFF` inside `.admin-scope` (set on the wrapper in `src/app/admin/layout.tsx`):

```css
.admin-scope .bg-white { background-color: #fff !important; }
```

It sits after the Tailwind utilities and has higher specificity, so it wins; the public app
is untouched because it is outside that subtree. `bg-paper` is still the right thing to
write, but a stray `bg-white` in admin no longer renders brown. If an admin surface must be
cream on purpose, write `bg-cream` or `bg-[#F5F0E8]` - also self-documenting.

Do **not** "fix" this by editing `--bogx-cream` in `globals.css`. That variable feeds
`.bg-cream` for the public frontend; setting it to `#FFFFFF` whitens the public app and does
not touch `bg-white` at all, since that comes from the Tailwind token. It was tried.

A `ContainerBlock`'s outer box keeps its **theme** colour (cream included) on purpose -
it previews the section colour the live feed renders. The editor looked like a flat brown
mush because the cards *inside* that cream box were cream too, not because the box is
coloured. Same reason bestofgenx looks cleaner: it has no `white` override, so its
`bg-white` cards sit on the cream box with real contrast.

## Dynamic categories: a container rename creates one

Categories are the static list in `src/lib/categories.ts` PLUS anything an admin typed
into a container name. Renaming a container fires `ensureCategory()` on **blur**
(`ContainerBlock`'s input), which POSTs to `/api/categories` and creates a `Category` row
if the name is new. Every mounted `useCategories()` then refetches on the shared
`categories-updated` window event.

Four pieces have to agree, and three of them failed silently when they did not:

- **`slugify()` is the contract.** `getAutoFillSlugs()` and `POST /api/categories` must
  produce the same slug from the same name, or the container auto-fills `eishockey` while
  the Category row says something else and the two never meet. Umlauts are
  transliterated, not stripped: `Fußball` and `Fussball` must both give `fussball`,
  otherwise typing the ß version creates a SECOND category.
- **`Article.category` must not be an `enum`.** It used to list the twelve static slugs,
  so assigning a freshly created category failed Mongoose validation - a generic 500 from
  the article API with nothing pointing at the category field. Widening cannot invalidate
  existing rows, so there is no migration.
- **Matching a static category needs all three of slug, slugified label and aliases** -
  see `findStaticCategory()`. For five of the nine static entries the slug is NOT the
  slugified label:

  | slug | label | slugify(label) |
  |---|---|---|
  | `sports` | Sport | `sport` |
  | `movies-tv` | TV & Cinema | `tv-cinema` |
  | `gaming` | Gaming & Tech | `gaming-tech` |
  | `lifestyle` | Lifestyle & Culture | `lifestyle-culture` |
  | `news` | Politics | `politics` |

  Matching on `slug` alone made renaming a container to "Sport" create a dynamic `sport`
  beside the static `sports`, both rendering the identical label in every dropdown with
  no way to tell which one the articles were on. "Sport" and "Politics" are both live
  container names here, so this was not hypothetical.
- **`useCategories` is `"use client"` and must stay Mongo-free.** It may import
  `@/lib/categories` (pure data) but never `@/models/*` - see the client/server bundling
  trap above.

`getAutoFillSlugs()` falls back to the slugified container name when no keyword regex and
no theme matches. Without it, a container named `Fussball` resolved to `[]` and rendered
EMPTY - indistinguishable from "nothing published yet". Measured on the live template:
`Fussball` and `EisHockey` both resolved to `[]`, because the sports regex matches the
English `football`, not the German `fussball`.

Checks: `scripts/check-autofill.ts` (every container name resolves to at least one slug),
`scripts/check-category-slugs.ts` (slugify + the slug/label mismatch table),
`scripts/check-category-validation.ts` (the schema accepts dynamic slugs).
`scripts/cleanup-shadow-categories.ts` removes dynamic rows that shadow a static one -
dry run by default, `--delete` to apply, `--slugs=a,b` for extra rows.

## .env.local has a UTF-8 BOM - scripts cannot read MONGODB_URI

`.env.local` begins with `EF BB BF`, so its FIRST key parses as `"\uFEFFMONGODB_URI"`.
`next dev` tolerates this; `dotenv` and tsx's loader do not, so in a script
`process.env.MONGODB_URI` is undefined, mongoose falls back to its
`mongodb://localhost:27017` default and dies with `ECONNREFUSED ::1:27017` - which reads
like "the database is down" rather than "the variable never arrived".

Moving `dotenv.config()` above the import does **not** help: ES imports are hoisted, and
`src/lib/mongoose.ts` reads `process.env.MONGODB_URI` into a module-level const at import
time. Either strip the BOM when parsing the file yourself (see
`scripts/cleanup-shadow-categories.ts`'s `readMongoUri()`) or `await import()` the
connection module after loading env.

## contentType is not a second category - do not merge them

`Article.contentType` and `Article.category` get mistaken for duplicates because their
vocabularies overlap (`tv`/`radio`/`music-community`/`arcade` vs `movies-tv` "TV &
Cinema", `music`, `gaming` "Gaming & Tech"). They are different axes:

| | `category` | `contentType` |
|---|---|---|
| what it is | a label | a behavioural discriminator |
| code branches on a specific value | no | **yes** - each value is a code path |
| may be dynamic | **yes** (see above) | no - a new value needs code |

That asymmetry is why `category` has no enum and `contentType` keeps one. A new category
("EisHockey") needs zero code. A new type would need rendering, routing and linking.

Measured on 197 articles before anyone proposes collapsing them:

- `article` 190, `banner-page` 5, `rankroll` 1, `arcade` 1 - all 7 non-article rows are
  **published**
- **5 of 10 categories contain more than one contentType** (`music` holds `article`,
  `rankroll` AND `banner-page`), so the type is NOT derivable from the category
- `linkedContentId` is set on **0 of 197** rows, although it is read by `/api/feed`,
  `/api/polls`, `ArticlePage`, `RankingListCard` and `DesktopRankrollPage` - the
  pointer-to-a-Poll/TVVideo mechanism is wired up but dormant

Dropping `contentType` would force "this is a banner page" into `category`, overloading
the subject taxonomy: you could no longer have a banner-page AND an article about the same
subject, because the single slot would be taken. Concretely, `/api/articles` lets
`banner-page` and `music-community` rows with no cover inherit the FIXED block's banner
image (`BANNER_FALLBACK_TYPES`); remove the discriminator and those 5 live pages lose
their image.

The Post Manager therefore renders the type MUTED when it is `article` (190 of 197 rows)
and only badges the values that change behaviour. It is still a `<select>` in the row -
that change is presentation only.

### Known inconsistency: the arcade auto-tag does not fire

`POST /api/articles` sets `contentType = 'arcade'` for categories `gaming`/`tech`. The
data says 58 articles in `gaming` and **1** with `contentType: 'arcade'` - the other 57
were created through routes that skip this rule (the almanac/editorial endpoints build
their own Article documents). So the rule is effectively dead code that fires only for
articles created through that one endpoint. Either move it into the model as a pre-save
hook or delete it; leaving it where it is guarantees the two paths keep disagreeing.
