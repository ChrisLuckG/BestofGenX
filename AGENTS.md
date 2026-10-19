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

Therefore an unranked period must render the player's OWN net for that window
("-2,37", or "0,00" before the first game), never a bare "—": 35 games played in the
month looks identical to never having played, and a plain "?" left players guessing
how far off a rank they were. "?" remains only when the value is unknown (guest,
still loading). The value comes from `me` in `/api/rankings/snapshot?userId=…`,
computed from the unfiltered list, exposed as `myPoints` by `useLiveRankings`, and
formatted by `formatUnrankedValue()` in `src/lib/rankPeriod.ts`. Do not "fix" this by
removing the filter without asking — whether a negative player is listed last or
not listed at all is a product decision about the leaderboard.

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

### Coins and day/month/year must move together

The scoreboard shows the balance next to the period ranks, so a change in one has to
show up in the other right away. `useBogxCoins` dispatches `bogx-balance-changed`
whenever the balance changes (except the first load), and `useLiveRankings` refreshes
every **current** window (day, month AND year) on that event or `bogx-updated`: once
after 150ms and once more after 2.8s, because optimistic coin updates land before the
ledger write. Month and year used to wait for their 60s poll.

Rank refreshes are refetches, not optimistic shifts: many `setCoins` calls are not
ledger moves (battle wager escrow, refunds, `setCoins(() => dbCoins)`), so shifting
the period net by the coin delta would show wrong numbers.

`useLiveRankings` accepts a response only if it is for the current query and no newer
response has been applied. Do not change that to "only the newest REQUEST wins" - with
the 5s day poll, responses slower than 5s were all discarded and the widget froze.

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

## Full-screen overlays: render through ModalPortal

A `fixed inset-0` overlay rendered inside page content is trapped in that
content's stacking context. On desktop the sticky header and the right sidebar
(z-50) then paint ON TOP of the backdrop, whatever z-index the overlay has
(Invite friends modal, Welcome back, Game intro, player card...).

Wrap every new full-screen modal in `<ModalPortal>` from
`src/components/ModalPortal.tsx` (portals into `<body>`). Embedded/inline
variants (`embedded` props) must NOT be portalled.

## Rank arrows come from the server

`buildPeriodRankings` returns `change` ('up' | 'down' | null) per entry and in
`me`: the LAST movement. Each rank is reconstructed at a ladder of earlier moments
(2 min, 5 min ... back to the period start, `TREND_LADDER_MIN`); the nearest one
with a different rank decides. An overtake shows 'down' immediately and keeps it
until the player moves again; never moved = 'up' (entered the board). Mobile
`Header` and `DesktopRankWidget` render exactly that.

They used to compare against "the last rank this browser saw" in localStorage,
so desktop and phone showed opposite arrows for the same player - and mobile
also drew an up-arrow when nothing had moved (`dir === null` was treated as up).
Do not reintroduce a client-side comparison.

## UI: every hoverable thing does something on hover

Owner preference (stated more than once): if an element can be hovered, it must react -
no dead buttons, links or cards. Use the existing building blocks instead of one-offs
(all in `globals.css`, all switched off for `prefers-reduced-motion`, hover-only ones sit
behind `(hover: hover)`):

- buttons in headers: `HeaderButton` / `HeaderChip` / `HeaderSelect` (`PageHeader.tsx`)
- nav icons `fx-wiggle`, nav labels `fx-rgb` (chroma split), the BOGX logo `fx-logo`
- primary buttons `fx-arcade` / `hover-shine`, outline buttons `fx-neon`
- text links: `fx-link` (same as the tabs: chroma flicker on the label, icon wiggles) + `fx-arrow` on the arrow icon (steps forward). A drawn-in underline was tried and rejected as boring
- cards: small lift (`hover:-translate-y-0.5 hover:shadow-md`) and the icon scales or tilts

Two things the owner explicitly did NOT want: the scoreboard lifting on hover with a hard
orange drop shadow underneath, and tooltips that are a second orange block (the scoreboard
is the orange thing; tooltips stay light, see `RankTooltip.tsx`).
## Daily Auto (admin "Daily Auto" button in Articles)

Six fixed hourly slots (Berlin time, `DEFAULT_SLOTS` in `src/lib/dailyAutoSchedule.ts`):
8/9/13 Bogx (a Menschen person), 10 Trivia Winner, 11 History, 12 Bogx + Rankroll. Each
slot has an on/off switch (`DailyAutoConfig`); one `DailyAutoRun` per slot per Berlin
calendar day (unique index = the lock). `/api/cron/daily-auto` is ticked every 5 minutes by GitHub Actions (see "Crons on Vercel Hobby" below).

- Articles are generated AHEAD of the slot as drafts and flipped to published at the
  slot's start (`leadMin`: 60 bogx, 120 history). Winners has lead 0: it reports the
  ranking day that ends at 10:00 Berlin, so there is nothing to write earlier.
- The automation calls the SAME routes as the buttons (`/api/almanac/article`,
  `/api/generate-ranking`, `/api/articles`, `/api/polls`) and publishes through
  `PUT /api/articles/[id]` (sets publishedAt + auto-place). Recipe defaults shared with
  the Menschen tab: `src/lib/personContentDefaults.ts`; score: `src/lib/personScore.ts`;
  rankroll CTA markup: `src/lib/rankrollCta.ts` (BlockEditor uses it too).
- Rankroll slot: the person article carries ONLY the Vote CTA (`data-rankroll-id`) in its
  text; the poll is created as `draft` and set `active` with the article. Do NOT set
  `poll.linkedArticleId` or `article.linkedContentId`: ArticlePage finds a poll through
  `/api/polls?articleId=` (= linkedArticleId) and then embeds the WHOLE rankroll list under
  the article (that is what a `contentType: 'rankroll'` article is for). Person rankrolls
  made in Menschen have no such link; the rankroll finds its article via the CTA text
  (`/api/polls/[id]` -> `linkedArticle`). Linking them was a bug, fixed and verified against
  the earlier Jessica Drake pair.
- Person: born today, score 70+, has a photo, no article yet; else anyone born this month.
  "Most famous" is decided by the model over ALL eligible candidates (the score only
  measures completeness - dozens tie at 85 on a normal day).
- An errored slot is NOT retried automatically (a retry could create a second article);
  use "Run now". A disabled slot does nothing, not even publishing a finished draft.
- `vercel.json`: the old `daily-facts-article` and `daily-winners-article` crons were
  REMOVED - the Daily Auto tick replaces them. Winners and History default to ENABLED so
  switching over does not stop them; the Bogx slots default to disabled.
- `scripts/check-daily-auto.ts` asserts the timing rules including the CET/CEST switch.
- **History slot = the History modal's steps, not a cron route.** `generateHistory()` asks every
  AI reporter (except Eastercorn) for one event, one after the other and each told what the
  others found plus the event titles of the last 21 days (read from the `<h2>`s of recent History
  articles - the modal keeps that list in localStorage); then `/api/editorial/history-banner`
  (picture + headline) and `/api/editorial/history-compile` (`draft: true, autoGenerated: true`).
  At least 3 events are required, and no article is made without the banner. It replaced
  `/api/cron/daily-facts-article`, whose own cover generation was refused three times in a row
  ("Failed to generate AI cover image after 3 attempts"); that route still exists, unused. An
  article for today that already exists (e.g. written in the modal) is adopted, not duplicated.
  Measured: 188s for 4 events + banner + article, inside the cron's 300s (the 09:00 tick runs
  nothing else). `history-compile` publishes straight away unless `draft` is sent - the modal's
  alert "created as draft" is wrong about that.

## Feed waterfall: History and Trivia Winner join the Top Area

The Top container (MAIN + 2H = 3 places) takes the globally newest articles; from place 4
an article falls into its own section; each article has exactly ONE place.

- `TOP_AREA_EXCLUDED_SLUGS` (history, gaming, tech) still keeps those categories out of
  the Top Area, EXCEPT `joinsTopWaterfall()` in `src/lib/containerFill.ts`: category
  `history`, and any article tagged `daily-winners` (Daily Champions is filed under
  `gaming`, so a category rule would have let all gaming/tech in). Starred (`featured`)
  articles still always qualify.
- The History/Arcade FIXED banner takes the newest article of its category that the Top
  Area has not already used - while the newest sits on top, the banner shows the next one.
- Ordering key is `articleSortDate()`: `scheduledAt` > `publishedAt` > `createdAt`. NOT
  createdAt: Daily Auto writes drafts 1-2h before go-live, so by createdAt the newest
  article sorted below manual ones made in between. Used by the live feed (WelcomeReel),
  the layout editor and the Post Manager list + date column - keep them on this helper.
- The layout logic exists twice (containerFill.ts for the admin, WelcomeReel for the live
  feed) and must stay in step. `scripts/check-top-waterfall.ts` asserts the rule on the
  shared half; the WelcomeReel half is not covered by it.
- Not changed: `ArticlesListPage` / `DesktopArticlesPage` "newest/oldest" filters and the
  `/api/articles` default sort still use createdAt.

## Article `order` (manual position) freezes the whole list

`order` (lower = higher) sorts BEFORE the date. `handleDragEnd` -> `/api/articles/reorder`
writes `order = list index` for EVERY article (drafts included), so one drag - even an
accidental one - pinned all 247 articles and an old article sat at place 3. Reset with the
"Sort by date" button in the Post Manager (`/api/articles/reset-order`) or
`scripts/reset-article-order.ts` (dry run by default; backs the old values up to
`F:/Projekte/_db-backups/` and can `--restore=<file>`).
Daily Auto publishes with `order: 0` so a draft written before a drag does not go live
pinned in the middle of the list.

## The person's picture (Menschen) is the main picture for everything about them

`Person.image` is copied into the article cover/thumbnail and the rankroll cover when those
are created - so a picture changed in Menschen afterwards used to reach nothing. Now
`PUT /api/almanac` (type people) calls `syncPersonImage()` (`src/lib/personImage.ts`) when
the image CHANGED: every article and poll with that `personRef` gets it (article focal point
resets to 50/50). Re-sending the same image, clearing it, or editing other fields does not
sync, so a cover set by hand is not overwritten by an unrelated edit.
New rankrolls start with the person's picture as cover (Daily Auto and the Menschen editor,
`initialNewImage`) instead of their first item's. Other writers of `Person.image`
(update-from-wikidata) only fill a MISSING image and do not need the sync.
`scripts/check-person-image-sync.ts` asserts the rule (throwaway docs in the real DB).

## Articles are always long

There is no short/medium option: the Length selects are gone from the Edit Article panel and
from Create Article in Menschen. `/api/almanac/article` IGNORES any `options.length` and always
asks for `ARTICLE_LENGTH` (~800 words, 6 sections of 130-170 words, intro 80-100). Asking for
~600 produced a median of 483 words; ~800 lands at 450-550 (measured on 7 people) - the model
undershoots by about a third, so the number in the prompt is deliberately higher than the goal.
Length never overrides the SOURCE rule: thin source material still yields a shorter piece.
Daily Auto therefore refuses to publish anything under `MIN_ARTICLE_WORDS` (400, `lib/dailyAuto.ts`):
it skips that person and tries the next-most-famous one (max 3), and errors the slot if none
reaches it. The Articles tab's Language select used to overwrite `aiLength` with "medium" - it now
writes "long"; the Deutsch option never reached the generator either way.

## Daily Auto "Rerun" (replace a slot's article)

The slot row shows **Rerun** instead of "Run now" once it has an article today
(`POST /api/admin/daily-auto { slotId, rerun: true }` -> `rerunSlot()` in `lib/dailyAuto.ts`).
- The replacement is created FIRST, the old article (+ its rankroll, the votes and the
  person's `hasArticle` marker) is removed only after that worked. A failed generation
  leaves the current article and the run record exactly as they were.
- History and Winners shortcut to "already exists"; Rerun passes `force` (History skips its
  adopt-today's-article check, Winners gets `?force=true`). If the generator hands back
  the CURRENT article id, or no new one, nothing is deleted.
- Bogx slots skip the replaced person, so the result is a different article about someone
  else. If the old one was live the new one goes live at once; if it was a draft waiting
  for its start, the new one waits too.
- Only articles Daily Auto generated are deleted (`autoGenerated` or the `daily-winners`
  tag); an article an editor wrote is refused with a message.
- `scripts/check-daily-auto-rerun.ts` asserts all of this with throwaway docs on a fake
  day and a fake generator (24 checks; needs the dev server).

## Profile screens: one type scale on desktop

Player Profile (`PlayerCard`, `isDesktop`) and the own Profile (`ProfilePage`, `lg:`) share ONE
desktop type scale, `src/lib/profileType.ts`: caption 11px, secondary `text-xs`, title
`text-sm` (row titles, country), heading `text-base` (section headings, level name), strong
`text-lg` (row values, level %), hero `text-xl` (username, BOGX balance, the Day/Month/Year rank
triple, the BOGX/Wins/Games triple). The scale FOLLOWS the rest of the desktop app - page title
`text-lg`, rank list and sidebar 10-14px, biggest figures elsewhere `text-xl` - so measure the
neighbours before enlarging anything here. Two earlier attempts (up to `text-5xl`, then `text-3xl`)
both still looked like a different app. Mobile keeps its own sizes and is NOT part of the scale.
ProfilePage needs the `lg:` prefix and cannot use the constants (Tailwind reads whole class
strings) - it spells out the same steps (`text-2xl lg:text-xl` etc.), change both together.

## Category of a person article: canonical, from the person

`/api/almanac/article` returns `articleCategoryFor(person, modelSuggestion)`
(`src/lib/personCategory.ts`): a specific `Person.category` (sports/music/movies-tv/politics/
gaming) > the profession > a catch-all `Person.category` (culture/lifestyle/authors - the import
default is "culture") > the model's suggestion > `lifestyle`. It is always a CANONICAL slug.
Why: the route used to store the model's `culture` / `genx-icons` / `tech`. Those are only
ALIASES in `lib/categories.ts`; the category dropdown lists canonical slugs, so such an
article showed "-" in the Post Manager and the editor select fell back to its first entry
(History) while the article kept the other value. The selects now also show an alias as its
canonical category and give an unknown value its own option instead of lying.
History/Eastercorn are never chosen for a person; `rip` only if the person died.
`scripts/check-person-category.ts` asserts the mapping (28 checks).

## YouTube search quota: when videos vanish everywhere, look for a 429 first

Every video feature shares one daily YouTube SEARCH quota (`Search Queries per day`, about 100
searches): article embeds, rankroll tiles, History events, TV. When it is gone, every search
returns HTTP 429, and the code degrades SILENTLY by design ("nothing on topic => no video is
embedded"): articles simply come out without videos and nothing errors. It resets at midnight
Pacific = 09:00 Berlin. Check it first when videos are missing:
`GET https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=test&key=$YOUTUBE_API_KEY`
Testing the generators burns it fast (one article = up to 6 searches, one History event = up to 4):
a day of testing exhausted it, and the History events that day came out with `video=-`.
Daily Auto's History slot therefore asks for `allowWithoutVideo: false` (all earlier History
articles have one video per event), re-rolls a rejected event up to 3 times, and stops with
"YouTube is probably out of search quota" after two reporters in a row find nothing, instead of
publishing a History article without videos (`collectHistoryEvents`, `scripts/check-history-events.ts`).

## Daily Auto: hourly slots with a choosable type

18 slots, one per hour 06:00-23:00 (`DEFAULT_SLOTS`, ids `HH00`; `FIRST_HOUR`/`LAST_HOUR` widen it).
Each slot stores its on/off switch AND its type (`bogx`, `bogx-rankroll`, `history`, `winners`);
the dropdown in the window changes the type (`PUT { slotId, kind }` -> `setSlotKind()`), the server
decides what is allowed (`kindProblem()`) and sends the closed types with their reason.
- History and Winners are once a day (a second one would repeat the first); Winners cannot sit
  before 10:00 (it reports the ranking day that ENDS at 10:00). Bogx / Bogx + Rankroll go anywhere.
- A stored type that is no longer allowed falls back to the default instead of breaking the schedule.
- The window starts at 06:00 because generation begins `leadMin` earlier (60 / 120 min) and must stay
  on the same calendar day: `decideAction` looks at today's slots only.
- Time budget of ONE cron tick (maxDuration 300s): `canStartGeneration()` uses a per-type estimate
  (`estSec`: bogx 60, bogx+rankroll 100, winners 150, history 220). A slot that does not fit waits for
  the next tick (its window is an hour+) - this replaced the old flat "150s used" rule, which let
  History (188s) start after a Bogx article and run past 300s.
- YouTube quota: every Bogx article spends up to 6 of the ~100 daily searches (see the YouTube
  section above). 16 Bogx articles a day use the whole quota and the rest come out without videos.

## Daily Auto: the Radio article type

Fifth slot type `radio` ("Radio Article", once a day like History/Winners, any hour; none by default - pick
it in the dropdown). It is the Radio window's flow (`RadioModal`): the songs marked "Added" go to a reporter
through `/api/editorial/chat` with `articleMode`, `skipYoutube` and `spotifyLinks`, and it lands as a draft
(`generateRadio` in `lib/dailyAuto.ts`). No YouTube search, so it costs none of the daily quota. The brief and
the song-selection rules live in `lib/radioArticle.ts` (the window uses the same `buildRadioPrompt`).
- **Automatic runs** (the cron tick) only take songs added AFTER the previous radio article, make at most one a
  week and need 3+ new songs; otherwise the run finishes WITHOUT an article and reads "Skipped: <reason>" (a
  finished run with no article id is `skipped`; Winners' "no games played" reads the same). So the slot can stay
  on every day and simply does nothing most days. **Run now / Rerun** are manual: every "Added" song, like the window.
- The earlier articles all reused the same ~39 songs; the previous radio article is found by the tag
  `community-radio` (set after creation) or, for the older ones, by tags `community` + `playlist` in Music.
- The article is filed under Music (the chat route's fallback is the alias `culture`, which the dropdown does not list).
- Reporters take turns (`earlier.length % reporters.length`) so the voice changes from one article to the next.
- Measured: 21s for 39 songs. The cover comes from the chat route (Wikimedia, Tenor GIF as fallback) - the same
  as the window; the test article got a Tenor GIF. `scripts/check-radio-article.ts` asserts the song rules.

## Push notifications: categories, switches, and "New Article"

`lib/articlePush.ts`, delivered by `/api/cron/article-push` (every 5 min, by the bogx-cron GitHub workflow - see "Crons on Vercel Hobby"). A cron
instead of a call from the publishing code, because articles go live in many ways (admin Publish,
Daily Auto, Winners and History routes, the History window) and none of them should wait for a send loop.
- Pushes only `contentType: 'article'` that is published and went live (scheduledAt > publishedAt >
  createdAt, the feed's rule) within `PUSH_WINDOW_MIN` (120) minutes: a deploy or a dead cron never
  pushes the back catalogue.
- ONE push per run, for the newest article; older unsent ones in the window are marked `pushSkipped`.
  Every push carries the tag `new-article`, so the phone shows one notification that gets replaced
  (sw.js has `renotify: true`: it still alerts). Hourly Daily Auto articles therefore do not pile up.
- Each article is claimed with an atomic update of `pushSentAt` BEFORE sending: at most once, even for
  two overlapping runs; a run that dies mid-send does not resend (a missed push beats a double one).
- Recipients: `pushSubscription` AND `pushPrefs.newArticle !== false` (see the switches below).
- `scripts/check-article-push.ts` asserts all of it with a FAKE sender, on throwaway articles/users
  (`onlyIds`) - it never reaches a real device. Never call `/api/cron/article-push` or `runArticlePush()`
  without `send`/`onlyIds` on this machine: VAPID keys are set locally and the database is the real one,
  so it WOULD push to real subscribers (3 of 38 users at the time of writing).

### The switches: ONE list, enforced in the sender

`lib/pushCategories.ts` lists the 7 categories (Battle Request, Battle Result, Battle Updates, Comment Like,
Daily Results, Song Requests, New Article) with label, description and the message titles (without emoji).
The settings page (`NotificationPage`), the sender and the message senders all read that one list.
- A user's choice is `User.pushPrefs = { battleResult: false, ... }` on the SERVER; missing key = on, only an
  explicit false blocks. `/api/user/notifications` reads and writes it (GET `push`, POST `push`; `&log=1` adds
  the last 20 messages). Always through the RAW collection: a stale dev schema silently strips an unknown
  field from a filter or `$set`, which for an OFF switch means the switch is ignored.
- It is enforced in `sendPushNotification` (`lib/webpush.ts`), for EVERY sender: it looks the user up by id, or
  by the subscription endpoint when the sender has no id (the daily crons), and returns false without sending
  when `payload.category` is off. The block is logged (`error: "blocked: ..."`), so the settings can show it.
- EVERY `sendPushNotification()` call must put `category: '...'` in its payload (the type allows only the 7
  keys). `scripts/check-push-prefs.ts` scans all call sites and fails for one without it, and for a category
  no sender uses. Only the test push may be uncategorised. The sender WARNS about nothing: a payload without
  a category is simply never blocked - that is how the old "switches" failed.
- History: the old three switches (Battle Request / Result / Comment Like) were saved only in the browser's
  localStorage and the server never read them - they blocked nothing, and the daily game / results / battle
  update pushes had no switch at all. Choices already made in a browser (`notify_battle_request`,
  `notify_battle_result`, `notify_comment_like` = 'false') are carried to the server once on the next visit
  and then removed. The older flags (`notifyBattleResults/Accepted`, `notifyRanking`) are still checked by a
  few battle routes and still returned by the API, but the page no longer sets them.
- The notification log is written through the raw collection too (`category` is kept even when the dev server
  holds an older schema), and now also for senders that pass no userId.
- REMOVED on purpose ("not needed"): the "Daily Game" category with its two pushes ("Neues Spiel gestartet!" and
  "Game starts in 1 hour!"). The `game-reminder` cron and its schedule are deleted; `game-start` still creates
  the game and only lost its push. Do not re-add a push without a category in `pushCategories.ts`.
  `scripts/check-push-prefs.ts` asserts that the route, the schedule and the push stay gone.
- The settings page shows the categories as a 2-column grid of plain cards (1 column below `sm`), with plain
  icons (`PUSH_ICONS` in `NotificationPage`) instead of the game icons used elsewhere in the app.

## Crons on Vercel Hobby: Daily Auto and the push are triggered by GitHub Actions

The Vercel project is on the **Hobby** plan: a cron may run once a day at most, an expression that runs more
often makes the DEPLOYMENT FAIL ("Hobby accounts are limited to daily cron jobs"), and even a daily one fires
anywhere within its hour. So `vercel.json` has only daily crons, and the two that need minutes are called every
5 minutes by a GitHub Actions workflow: `/api/cron/daily-auto` and `/api/cron/article-push`. Both are idempotent,
so a late, doubled or skipped GitHub run does no harm. **Never put a sub-daily expression into `vercel.json`** -
`scripts/check-cron-auth.ts` fails if someone does.
- **Where the workflow lives: NOT in this repository.** The project's GitHub repository (ChrisLuckG/BestofGenX, branch
  `main`; its default branch `master` still holds an old shop) is meant to be PRIVATE, and a private repository
  gets only 2000 free Actions minutes a month - a 5-minute schedule needs ~17000. So the workflow is a copy in
  `ops/bogx-cron/.github/workflows/cron.yml` that is put into its own small PUBLIC repository `bogx-cron` (free,
  unlimited minutes, no project code in it). A `.github/workflows` folder here would be a mistake (the test checks
  it does not exist): scheduled workflows run from the DEFAULT branch only, and on a private repo it would eat the
  minutes. The copy has a weekly empty-commit `keepalive` job (GitHub switches scheduled workflows off after 60
  days without activity; the keepalive is untested - if GitHub's mail says the workflow was disabled, enable it
  under Actions).
- **State (18.10.2026): done and verified.** `ChrisLuckG/bogx-cron` exists (public, branch `main`, one file, secret
  `CRON_SECRET` set), production was deployed with the guarded routes, a manual run of the workflow went green
  (both jobs; `keepalive` skipped as intended). It was created through the GitHub REST API with the login git has
  stored (`git credential fill`, a `gho_` token with the scopes `repo`, `workflow`, `gist`; there is no `gh`): read it
  inside a script, NEVER print it. The secret is encrypted for GitHub with a libsodium sealed box (`libsodium-wrappers`,
  installed in a throwaway folder OUTSIDE the project). The first run pushed the History article of the day to 3 people.
- **Daily Auto's master switch was left OFF** after the deploy (so the first runs could not publish by surprise).
  It stays off until it is switched on in the admin (the toggle next to "Daily Auto"); the slot switches (08:00-15:00,
  Winners, History) are as the owner left them.
- The route names are public (the workflow repository is public, the live site answers anyone). `lib/cronAuth.ts` guards both routes with
  `Authorization: Bearer $CRON_SECRET` and fails CLOSED: no `CRON_SECRET` configured = 503 in production (the
  older cron routes let everything through). Local development without a secret stays open - so do NOT open
  `/api/cron/daily-auto` or `/api/cron/article-push` in a browser on this machine: it runs a REAL tick / sends a
  REAL push (real database, VAPID keys set).
- The same secret must be in TWO places: the Vercel project env `CRON_SECRET` (Production, set) and the secret
  `CRON_SECRET` of the `bogx-cron` repository (a copy of the value is in `F:/Projekte/_secrets/cron-secret.txt`, outside
  the project - delete it once it is in GitHub). A run without it fails and GitHub mails about it. The workflow prints only the HTTP status,
  never the answer (public Action logs; the answer holds draft titles).
- Order matters: deploy the routes (the secret is already set) FIRST, create the workflow repository after. Before
  the deploy every run is a 404 and mails every 5 minutes.
- Daily Auto's own maths did not change: a tick that finds nothing due is a few database reads, a slot is claimed once
  per day (unique index), `canStartGeneration` defers what does not fit into one tick's 300s - and with a tick
  every 5 minutes (instead of hourly) the deferred slot is picked up 5 minutes later, and a ready article goes live
  within about 5 minutes of its start instead of up to an hour.

## Daily Auto: the RIP article type, and the TWO date shapes in the people collection

Sixth slot type `rip` ("RIP Article", once a day, any hour, none by default - picked in the dropdown). It remembers
a person who died on THIS day of the year (the anniversary; this also catches someone who died today).
- Pick: `pickDeceased` - `Person.died` matches today's day-and-month in either date shape, photo, score 70+, and
  no RIP article yet (`filterRipCandidates`). A person who already had a BIRTHDAY article still qualifies: that is
  exactly who gets remembered. The most famous of them is chosen (same shortlist ranking as the birthday pick).
  **No month fallback**: a day with nobody is the normal case (candidates exist on ~253 of 366 days), so the run
  finishes WITHOUT an article and reads "Skipped: nobody who died on 18.10. qualifies..." (not an error).
- It is `generateBogx(..., mode 'rip')`, i.e. the same long article, 400-word gate, Rerun and cover handling as the
  Bogx slots, with three differences: filed under category `rip` (the route files a person by profession, right for a
  birthday piece, wrong here), tag `RIP`, never a rankroll, and `RIP_BRIEF` as "extra instructions": respectful, no
  jokes, and ONE sentence saying that today is the anniversary of their death and that BOGX remembers them (the
  route's own occasion block asked for that already, and gpt-4o-mini ignored it in the first test - the brief repeats
  it at the end of the prompt, where it worked). The voice stays the neutral one: never a comedic voice for a RIP piece.
- Measured: 13-14s per article. `scripts/check-rip-article.ts` (31 checks, read-only) asserts the matching, the
  candidate rules, the slot type and the real data. A real run was made once for 18.10. (Abdul Raziq) and removed
  again, person flags restored.

**Dates are stored in TWO shapes**, from two imports: `1969-10-18` (49,637 people) and `18.10.1969` (92,845), plus a
few garbage values (`http://www` as a death date). `dayMatchers(dayKey)` in `lib/dailyAuto.ts` is the one place that
matches a day or a month in either shape (with or without a leading zero) - USE IT for any "born/died on this day"
query. The birthday pick used to match only the ISO shape and so never saw 14,385 of the 34,787 people who qualify
(41%; all of them in the GenX range), which the Menschen list does show; fixed together with the RIP pick, so the
pool of today's birthdays is bigger than before (18 Oct: 308 people in both shapes). `authorStylePrompts.parseDateParts`
already understood both shapes, so the "birthday / remembrance day" occasion text was right all along.
- Production only knows a slot type after a deploy: a stored kind the running code does not know falls back to the
  slot's default (Bogx). Deploy before relying on a newly added type.

## Daily Auto / RIP: state of 18.10.2026 (deployed)

- **Gen X is checked explicitly** in both automatic picks (birthday and RIP): `isGenXBirth()` in `lib/dateShapes.ts`
  (born 1965-1980, either date shape). Today the collection holds nobody else (all 142,482 dated people are
  1965-1980), but an import must not be able to change that silently.
- `lib/dateShapes.ts` is the one place for the two date shapes (`parseDateShape`, `dayMatchers`, `monthMatcher`,
  `isGenXBirth`); `dayMatchers` is re-exported from `lib/dailyAuto.ts`. The Menschen API month filters use
  `monthMatcher` (the old `-10-` pattern showed 91 of the 279 October deaths), and its birthday sort parses both
  shapes (`new Date("18.10.1969")` is an Invalid Date). In the "Deceased" view the Menschen cards show
  "† date · aged N · N years ago" and the day groups run by the next occurrence including the month.
  `scripts/check-date-shapes.ts` asserts the helpers and the API on real data.
- **RIP photos**: the bottleneck was the photo, not the number of people (87% of the deceased had none).
  `scripts/enrich-deceased-wikidata.ts` matches strictly (label + birth year, the Wikidata person must have died on
  the same day, birth day must match, ambiguous = skipped) and writes ONLY people who gain a photo. Run once on
  18.10.: 231 photos (Wikimedia thumbnails), backup `F:/Projekte/_db-backups/enrich-deceased-2026-10-18T13-41-59.json`,
  undo with `--revert=<that file>`. RIP candidates 432 -> 662, days of the year with one 253 -> 314. Running it again
  finds nothing new; more photos need another source (Wikidata has none for most of these people).
- **Late ticks still publish**: a run in phase `ready` is published by the first tick at or after its start, however
  late (same day). A slot whose whole hour passes without any tick is never generated ("missed").
- **GitHub's scheduler had not started the bogx-cron workflow at all** in its first hour (0 scheduled runs; manual
  dispatches worked). Until there is a reliable trigger, `F:/Projekte/_secrets/tick-loop.sh` ticks both routes every
  5 minutes from the owner's PC (log next to it; runs 6 hours). Reliable options: Vercel Pro crons, or cron-job.org -
  which aborts after 30s, so the tick route would first have to answer at once and work on in the background.

## Page header: ONE component, checked

Every page renders `src/components/PageHeader.tsx` (icon, title, subtitle, optional back arrow and right slot) -
no page draws its own. Profile, the in-app static pages (Contact, Imprint, Privacy, Terms, About = `StaticPageInline`),
Player Profile, Author Profile, the desktop article view and the cart (`PageTemplate`) each had their own until
18.10.2026, and they were noticed one at a time. `PageHeader` takes an icon component or a ready element.
- `scripts/check-page-headers.ts` (static, no server) fails when a page component (`*Page*.tsx` under
  `src/components`, plus `PlayerCard` and `StaticPageInline`) does not use `PageHeader`/`PageTemplate`, or when a
  file hand-copies the header's title class. Run it after adding a page.
- Deliberate exceptions live in its `ALLOW` list, each with a reason: login/sign-up, the invitation landing page,
  the black reward detail, the public standalone routes (`/kontakt` etc. via `StaticPageLayout`), wrappers and unused
  files. Two game headers (Solo Trivia setup/preparing, Battle preparing) keep a hand-made copy because of a
  topic-coloured back button, a loading bar and a give-up spinner; same geometry. A new exception needs a reason there.

## Every person article brings a GenX TV video (waterfall on the banner)

`lib/personTvVideo.ts`, called by POST /api/articles for every article with a `personRef` (contentType article - not
rankrolls), so the Menschen button, Daily Auto and RIP all get it. The answer carries `tvVideo` (what happened).
- Pick (`pickBestVideo`, pure): documentary > interview > other, a long one (20+ min) first, never under 10 min, only
  public + embeddable + not age-restricted (checked with videos.list), no junk titles, and the first name AND every
  part of the surname must be in the title (the old documentary button accepted any 3-letter part of the name).
- Search: up to 3 YouTube searches (`"name" documentary` long, `"name" interview` long, `"name" documentary` medium),
  stopping at the first documentary; on 403/429 it stops. No video = the article is saved anyway, `tvVideo.reason`
  says why. **Quota**: 100 units per search, 10,000 a day; with hourly articles (up to 6 searches each) plus this,
  the daily quota runs out (it did on 18.10.) - a higher quota from Google is the real fix.
- A person who already has a TV video keeps it; it just moves to the top again.
- **Waterfall** (`waterfall`/`putOnTop`): the new video takes hero position 1, 1 -> 2, 2 -> 3, the third leaves the
  banner (stays in GenX TV). The desktop GenX TV banner shows positions 1-3 in order, so the newest is on top.
- `scripts/check-person-tv-video.ts` (pure + static) asserts the pick, the waterfall and the wiring.
  `findPersonVideo()` searches without writing - use it to try a name without touching the live banner.

## "Goes to 11" instead of mood emojis under PERSON articles

Readers rate the person, not the article text: "How loud do you turn X up?" - an amp's volume scale 1-11
(Spinal Tap). `lib/personVolume.ts` (rules, labels, colours; dependency-free), `models/PersonVolume.ts` (one vote per
user and PERSON, unique index), `/api/people/volume` (GET one / GET `?ids=` batch / POST), `components/VolumeKnob.tsx`
(article page) and `components/CardVolumeBadge.tsx` ("VOL 8.7" on cards).
- Per PERSON, not per article: all articles about someone feed one number, stored on the Person as `volumeAvg` /
  `volumeCount` (written through the raw collection) so lists can show and sort by it.
- Only person articles (`article.personRef`). History, Radio, Trivia Winner and the rest keep the mood emojis.
  `CardMoodReactions`' default export decides per card (pass `personRef`); every card call site passes it.
- ONE vote per user and person, and it is FINAL: POST is insert-only, the unique index refuses a second vote atomically
  (also a double click / two tabs) with 409 + the vote that counts. The scale locks in the UI once you voted ("Your
  vote: 8 · Cranked up"); guests clicking a bar go to the login. The new vote pays the one reward (`REACTION_REWARD`,
  source `person-volume`). Results (level, votes, distribution per level) are shown to everybody.
- The card badges share ONE request (ids collected for 40 ms, cached for the session) - a feed has dozens of cards.
- `scripts/check-person-volume.ts` asserts the helpers and the API on the real database with two throwaway users
  (votes, ledger rows and the person's stored level are put back).
- The level is used for ordering too: the article lists' sort is "Loudest" (was "Most Liked"; person articles by level, the
  rest by likes), and the Timeline ranks each birth year loudest first (rank number + "VOL" badge per row). Both use
  `usePersonVolumes()` / `compareLoudness()` from `CardVolumeBadge.tsx` - same cache and batched request as the badges.
- Birthdays are for the living: `filterBirthdayCandidates` (Daily Auto) skips anyone with a death date, and the Menschen
  list defaults to "Alive · birthdays"; the deceased are listed and remembered by their death day (RIP).

## Push notifications open the thing IN the app (lib/appLinks.ts)

Every push `url` is an app link: `appLink.article(id)` = `/?article=<id>`, `/?tab=battles|notifications|rankings|radio|arcade`,
`/?battle=<id>` (a challenge - opened for confirmation, never accepted by the link); `/admin` only for admin pushes.
- `app/page.tsx` (the device redirect) passes the query on, so the same link opens /mobile on a phone and /desktop on a
  computer. Both shells read the parameters (mobile: `applyDeepLinkParams`, also used for the service worker's
  NOTIFICATION_NAVIGATE message when the app is already open; desktop: the searchParams effect). A linked visit does not
  get the desktop first-visit welcome page on top of the article.
- `public/sw.js` falls back to `/` (the redirect), not `/mobile` - that put desktop users into the phone layout.
- Before: the new-article push opened the bare standalone `/article/<id>` page, battle pushes pointed at `/battles` and
  `/notifications` - routes that do not exist (404).
- `scripts/check-push-links.ts` scans every push sender and fails for a url that is not an app link.

## GenX TV is English-only

No language flags or language labels anywhere (TV page, sidebar widget, admin), no language choice in the admin;
`/api/tv` stores every video as `en`. The article video search asks YouTube with `relevanceLanguage=en&regionCode=US`
and skips videos YouTube marks as another language (`isEnglish()`; unmarked ones pass). 18.10.2026: the 9 videos
tagged "de" were all English (wrong auto-detection) and were set to `en`.

## Rounding: badges are NOT pills

Badges, labels and filter chips use the house rounding `rounded-sm` (like `CategoryBadge`); inputs and buttons
`rounded-lg`/`rounded-xl`. `rounded-full` is for circles only: avatars, dots, round icon buttons, count bubbles.
`scripts/check-badge-rounding.ts` fails for a padded label with `rounded-full` (18.10.2026: 25 pills replaced).

## Who writes the automatic articles

- PERSON articles (Daily Auto Bogx, Bogx + Rankroll, RIP): **Eastercorn** (`lib/houseAuthor.ts` finds the admin account by
  username; without it the article falls back to "BOGX Team"). Daily Auto had posted them as `userId: 'system'` = "BOGX Team".
- **History** and **Daily Champions** (Trivia Winner): "BOGX Team". The Daily Champions used to say "BOGX Bot".
- Radio articles keep their rotating AI reporter.
- Data fix on 18.10.2026: 7 automatic person articles -> Eastercorn, 72 Daily Champions "BOGX Bot" -> "BOGX Team"
  (backup `F:/Projekte/_db-backups/article-authors-before-2026-10-18T15-41-00.json`).

### GenX TV video per article - update (18.10.2026)

- **Over 20 minutes, always** (`MIN_SECONDS = 1200`, strictly more): searches only use YouTube's "long" filter -
  `"name" documentary`, then `biography`, then `interview`; a documentary wins, then the longer film.
- Every person article stores the outcome: `tvVideoStatus` = `added` | `none` (YouTube has nothing over 20 min) |
  `pending` (the YouTube quota was used up / a network error). **Pending ones are retried by every Daily Auto tick**
  (`retryPendingTvVideos` in /api/cron/daily-auto, also when Daily Auto is switched off), oldest first, so the newest
  article still ends up on position 1; it stops as soon as YouTube refuses again.
- On 18.10. the 6 newest person articles were marked `pending` (the quota was gone all day) - they fill the banner once
  the quota is back (09:00 Berlin) and the tick runs in production.
- **Widget, not hero** (18.10.2026): the waterfall moves `TVVideo.widgetPosition` (1-3) = the GenX TV SIDEBAR widget
  (`/api/tv?widget=true`, topped up with the hero's videos while there are fewer than three). The big hero on the TV
  page keeps `featuredPosition`, which only the admin sets ("Add to GenX TV" 1/2/3).
- **The date counts, not only the number**: only videos whose `todayAt` is today (00:00 Berlin, `berlinDateAt(0, 0)`)
  stay; `expireToday()` moves older ones out on every Daily Auto tick and every `/api/tv` GET. A video fetched late
  for an older article (pending retry) enters with the ARTICLE's date, so it does not count as today's.
- Rows on the TV page show the newest ARRIVAL first (`TVVideo.categoryAt`, else `createdAt`): a video leaving "Todays
  Bogxers" starts at the front of its own row. The API's `featuredPosition` sort had put the hero's videos at the end.
- **"Todays Bogxers" = the newest 8 article videos, and ONLY there** (not additionally in their own row). `enterToday()`
  sets `category` to the admin's "today" category, remembers `homeCategory` and `todayAt`; when a 9th arrives, the
  oldest moves to its `homeCategory` (`overflowToday`, `TODAY_MAX = 8`). The home category comes from the person
  (`tvCategoryForPerson`: deceased -> Rip, Actor/Comedy -> Tv & Cinema, Music, Politik -> Politics, any sport -> Sport,
  else Lifestyle). A person who already had a video: that video enters today's row, its old category is its home.
- The Menschen "Add to GenX TV" dialog goes the same way: it sends `today: true` with the personRef, and POST/PUT
  `/api/tv` call `placePersonVideoInToday()`. Its old fixed categories ("Documentaries", "Music Videos") have no row on
  the TV page - a current category only counts as home if it is one of the admin's categories.

## Filling the people database: scripts/import-famous-genx.ts

Goal: well-known Gen X people who reach score 70 at once - not mass. Day by day over the calendar (one Wikidata
lookup per day by exact birth dates, ~3s), so there is NO cap per occupation or birth year. The old imports had
caps (">30 language versions", "2,000 per occupation for all 16 years") - that left 1966-1973 at ~6,000 people
each against 15,663 for 1965 and missed people like Olli Schulz (5 language versions).

- Taken: human, born 1965-1980, birthday known to the DAY (`wikibase:timePrecision 11` - Wikidata stores "only the
  year" as 1 January, "only the month" as the 1st), photo, birthplace, occupation, >= `--min-sitelinks` Wikipedia
  language versions (fame; 5 = the user's choice on 18.10.2026: "not only Brad Pitt"). Score: knownfor (English
  Wikidata description) 25 + photo 15 + born 15 + profession 10 + birthplace 10 = 75.
- Excluded: adult performers, terrorists, criminals (`EXCLUDE`).
- Already there (Wikidata id, or name + birth year): never duplicated; only EMPTY fields are filled (photo,
  birthplace, death data, wikidataId). The `people` collection has a unique index on firstname + lastname, so a
  namesake with another birthday is skipped (counted as "name already taken").
- 01.01. is too big for one query (every year-only date sits there) -> it falls back to one query per year.
- Undo: every applied run appends `F:/Projekte/_db-backups/famous-import-<time>.jsonl` as it goes
  (`{inserted: id}` / `{enriched: id, before}`). `--from=MM-DD` resumes an interrupted run.
- Dry run first: `--month=10` prints how many new / already there per fame threshold.

## PWA install (Android): the manifest icons must exist

`public/manifest.json` points at `/images/andlogo.png` (512) and `/images/andlogo-192.png`. Commit e4ff2c2 deleted `andlogo.png`, production answered 404 for the only manifest icon, and Chrome on Android refused to install the app ("doesn't work") - nothing in tsc or the build notices. After touching icons, check `https://www.bestofgenx.com/images/andlogo.png` returns 200.


## Flags: the country AT BIRTH (lib/countryFlags.ts)

The people import stores Wikidata's country at birth, so ~5,100 people had a country the flag lookup did not know: "Kingdom of the Netherlands" (1,756), "Czechoslovakia" (268), "Soviet Union" (375), "German Democratic Republic"... The automatic Robert Pelikán article (Prague 1979, "Czechoslovakia") showed no flag on 18.10.2026.
- States with ONE successor are in `COUNTRY_TO_CODE` (GDR -> DE, Kingdom of the Netherlands -> NL).
- States that SPLIT (Czechoslovakia, Soviet Union, Yugoslavia, Serbia and Montenegro) resolve by birth city: `countryCodeFor(country, city)` with the city lists in `SPLIT_STATES`. Unknown or missing city = no flag - a guessed flag is worse than none.
- POST /api/articles takes `personCityBorn` (Daily Auto and Menschen send it) and stores the resolved `personCountryCode`.
- `scripts/check-country-flags.ts` asserts the mapping; `scripts/fix-article-flags.ts` fills empty codes on existing articles (applied 18.10.2026, 6 articles).

## YouTube quota: section videos in person articles (lib/articleVideos.ts)

The daily YouTube quota is 10,000 units; one search.list = 100. `searchYouTubeVideo` used to try tiers x variants
(2 x 5 = up to 10 searches) per section - a section without a hit cost 1,000 units, one article up to 5,000, so the
quota was gone after 2-3 articles and every later article (and its GenX TV video) came out without videos (18./19.10.2026).

- `findSectionVideo`: at most 2 searches per section (`maxSearches`), any length, the plain phrase then "... interview",
  15 results each; the person's name must be in the title.
- `throwOnQuota`: on 403/429 `searchYouTubeVideo` throws `YouTubeQuotaError` instead of "nothing found". The generator
  then writes an invisible marker `<!--video-pending:base64{q,ctx,person}-->` where the video belongs, for that and
  every following section.
- Every Daily Auto tick runs `fillPendingArticleVideos()` (newest articles first, max 6 sections per tick, stops at
  the next 403/429): found -> the embed replaces the marker; nothing on topic -> the marker is removed.
- `scripts/backfill-article-videos.ts --days=N --apply` marks person articles that have NO videos (search = person +
  the section's <strong> work, else the heading). Applied 19.10.2026 to 9 articles.
- `scripts/check-article-videos.ts` asserts markers, the search cap and the wiring.
