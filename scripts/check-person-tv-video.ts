// Asserts the GenX TV video that comes with every person article (lib/personTvVideo.ts):
// which video is picked, the waterfall on the banner, and that POST /api/articles calls it.
// Pure + static - no YouTube call, no database.   npx tsx scripts/check-person-tv-video.ts
import fs from 'fs';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { pickBestVideo, waterfall, titleNamesPerson, videoKind, formatSeconds } = await import('../src/lib/personTvVideo');
  const v = (videoId: string, title: string, seconds: number, extra: Record<string, unknown> = {}) => ({ videoId, title, seconds, embeddable: true, isPublic: true, ageRestricted: false, ...extra });
  const pick = (c: any[], f = 'Paúl', l = 'Ambrosi') => pickBestVideo(c, f, l)?.videoId ?? null;

  // ---------------------------------------------------------------- is it about this person?
  eq('first name + surname in the title: yes (accents do not matter)', titleNamesPerson('Paul Ambrosi: The Documentary', 'Paúl', 'Ambrosi'), true);
  eq('surname only: no (that is how "Adam" alone could pass before)', titleNamesPerson('Ambrosi family documentary', 'Paúl', 'Ambrosi'), false);
  eq('a double surname needs both parts', [titleNamesPerson('Gloria Garayua interview', 'Gloria', 'Garayua Lopez'), titleNamesPerson('Gloria Garayua Lopez interview', 'Gloria', 'Garayua Lopez')], [false, true]);
  eq('a word inside another word does not count ("Cora" in "Coral")', titleNamesPerson('Alex Coral documentary', 'Alex', 'Cora'), false);

  // ---------------------------------------------------------------- kind
  eq('kinds', ['Paul Ambrosi Documentary', 'The Life Story of X', 'Paul Ambrosi Interview 2019', 'Podcast with Paul Ambrosi', 'Paul Ambrosi goals'].map(videoKind), ['documentary', 'documentary', 'interview', 'interview', 'other']);

  // ---------------------------------------------------------------- the pick
  eq('a documentary beats an interview, even a longer one', pick([v('int', 'Paul Ambrosi interview', 5400), v('doc', 'Paul Ambrosi documentary', 1500)]), 'doc');
  eq('an interview beats "other"', pick([v('oth', 'Paul Ambrosi best goals', 3000), v('int', 'Paul Ambrosi interview', 1300)]), 'int');
  eq('among documentaries the longer one', pick([v('a', 'Paul Ambrosi documentary', 1300), v('b', 'Paul Ambrosi documentary part 1', 2900)]), 'b');
  eq('20 minutes or less: never - GenX TV shows long films only', [pick([v('clip', 'Paul Ambrosi documentary', 540)]), pick([v('mid', 'Paul Ambrosi documentary', 900)]), pick([v('exact', 'Paul Ambrosi documentary', 1200)]), pick([v('ok', 'Paul Ambrosi documentary', 1201)])], [null, null, null, 'ok']);
  eq('English only: a video marked German / Spanish is skipped, en / en-GB / unmarked are fine', [pick([v('de', 'Paul Ambrosi documentary', 2000, { language: 'de' })]), pick([v('es', 'Paul Ambrosi documentary', 2000, { language: 'es-419' })]), pick([v('gb', 'Paul Ambrosi documentary', 2000, { language: 'en-GB' })]), pick([v('none', 'Paul Ambrosi documentary', 2000)])], [null, null, 'gb', 'none']);
  eq('not embeddable / not public / age-restricted: never', [pick([v('a', 'Paul Ambrosi documentary', 2000, { embeddable: false })]), pick([v('b', 'Paul Ambrosi documentary', 2000, { isPublic: false })]), pick([v('c', 'Paul Ambrosi documentary', 2000, { ageRestricted: true })])], [null, null, null]);
  eq('junk titles (reaction, compilation, trailer, #shorts): never', pick([v('a', 'Paul Ambrosi documentary reaction', 2000), v('b', 'Paul Ambrosi compilation', 2000), v('c', 'Paul Ambrosi documentary trailer', 2000)]), null);
  eq('a video about somebody else: never', pick([v('x', 'Kirk Cameron documentary', 3000)]), null);
  eq('nothing at all: null (no video is a valid answer)', pick([]), null);

  // ---------------------------------------------------------------- waterfall
  eq('new on top, the rest moves down, the third falls out', waterfall(['a', 'b', 'c'], 'n'), ['n', 'a', 'b']);
  eq('empty slots close up', waterfall([null, 'b', null], 'n'), ['n', 'b']);
  eq('a video already on the banner moves to the top, nothing doubles', waterfall(['a', 'n', 'c'], 'n'), ['n', 'a', 'c']);
  eq('already on top: unchanged', waterfall(['n', 'a', 'b'], 'n'), ['n', 'a', 'b']);
  eq('empty banner', waterfall([null, null, null], 'n'), ['n']);
  eq('durations', [formatSeconds(1260), formatSeconds(3725)], ['21:00', '1:02:05']);
  const { tvStatusOf } = await import('../src/lib/personTvVideo');
  eq('status: added / none (YouTube has nothing) / pending (quota used up, try again)', [tvStatusOf({ added: true }), tvStatusOf({ added: false }), tvStatusOf({ added: false, retry: true })], ['added', 'none', 'pending']);

  // ---------------------------------------------------------------- wiring
  const route = fs.readFileSync('src/app/api/articles/route.ts', 'utf8');
  eq('POST /api/articles calls ensurePersonTvVideo for a person article', /if \(body\.personRef && \(article\.contentType \|\| 'article'\) === 'article'\)[\s\S]{0,120}ensurePersonTvVideo/.test(route), true);
  eq('...and returns what happened (tvVideo) in the answer', route.includes('menschCreated, tvVideo }'), true);
  eq('...and stores the outcome on the article (pending ones are retried)', route.includes('markArticleTv(String(article._id), tvVideo)'), true);
  eq('every Daily Auto tick retries the pending videos', fs.readFileSync('src/app/api/cron/daily-auto/route.ts', 'utf8').includes('retryPendingTvVideos()'), true);
  const lib = fs.readFileSync('src/lib/personTvVideo.ts', 'utf8');
  eq('the TV video is written with personRef (Menschen shows it on the card)', /personRef: personId/.test(lib), true);
  eq('the sidebar widget reads the waterfall (widgetPosition) through /api/tv?widget=true', fs.readFileSync('src/app/desktop/page.tsx', 'utf8').includes("fetch('/api/tv?widget=true')") && fs.readFileSync('src/app/api/tv/route.ts', 'utf8').includes("widgetPosition: { $in: [1, 2, 3] }"), true);
  eq('the waterfall moves widgetPosition only - the TV page hero (featuredPosition) is left alone', /putOnTop[\s\S]{0,900}widgetPosition: i \+ 1/.test(lib) && !/putOnTop[\s\S]{0,900}featuredPosition: i \+ 1/.test(lib), true);
  eq('article videos enter "Todays Bogxers" (enterToday) and remember their own category', /await enterToday\(String\(doc!\._id\)/.test(lib) && /homeCategory: home/.test(lib), true);
  const { tvCategoryForPerson, overflowToday, TODAY_MAX } = await import('../src/lib/personTvVideo');
  const cats = ['Sport', 'Tv & Cinema', 'Music', 'Politics', 'History', 'Lifestyle', 'Rip', 'Movies'];
  eq('own category by profession', [{ profession: 'football' }, { profession: 'ice-hockey' }, { profession: 'Actor' }, { profession: 'Comedy' }, { profession: 'Music' }, { profession: 'Politik' }, { profession: 'Tech' }, { profession: 'Music', died: '2014-08-19' }].map(p => tvCategoryForPerson(p, cats)), ['Sport', 'Sport', 'Tv & Cinema', 'Tv & Cinema', 'Music', 'Politics', 'Lifestyle', 'Rip']);
  const vids = Array.from({ length: 10 }, (_, i) => ({ _id: 'v' + i, todayAt: new Date(2026, 9, 18, 8 + i) }));
  eq(`Todays Bogxers keeps the newest ${TODAY_MAX} - the 9th and 10th newest move on`, overflowToday(vids).map(v => v._id).sort(), ['v0', 'v1']);
  eq('8 or fewer: nobody moves', overflowToday(vids.slice(0, 8)), []);
  eq('a video leaving "Todays Bogxers" arrives at the FRONT of its row (categoryAt, and the TV page sorts by it)', /todayAt: null, categoryAt: new Date\(\)/.test(lib) && /v\.categoryAt\) \|\| v\.createdAt/.test(fs.readFileSync('src/components/TVPage.tsx', 'utf8')), true);
  const since = new Date(2026, 9, 18, 0, 0);
  const mixed = [{ _id: 'today1', todayAt: new Date(2026, 9, 18, 9) }, { _id: 'yesterday', todayAt: new Date(2026, 9, 17, 22) }, { _id: 'jackman', todayAt: new Date(2026, 9, 12, 10) }];
  eq('the date counts too: anything from before today leaves, even with room to spare', overflowToday(mixed, 8, since).map(v => v._id).sort(), ['jackman', 'yesterday']);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
