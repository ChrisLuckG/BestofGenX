// Section videos in person articles (lib/articleVideos.ts): the quota-saving search, the invisible markers for
// "quota used up, search later", and the wiring that fills them. Pure + static, no YouTube calls.
//   npx tsx scripts/check-article-videos.ts
import fs from 'fs';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { pendingMarker, readMarkers, embeddedVideoIds, buildYoutubeIframe, SECTION_MAX_SEARCHES } = await import('../src/lib/articleVideos');
  const m = pendingMarker({ q: 'Trey Parker Cannibal! The Musical', ctx: 'The 1993 musical — "Alferd Packer" & friends', person: 'Trey Parker' });
  eq('a marker is an invisible HTML comment', /^<!--video-pending:[A-Za-z0-9+/=]+-->$/.test(m), true);
  eq('it carries the search, the passage and the person - also with quotes, dashes, umlauts', readMarkers(`<p>a</p>${m}<p>b</p>`)[0].data, { q: 'Trey Parker Cannibal! The Musical', ctx: 'The 1993 musical — "Alferd Packer" & friends', person: 'Trey Parker' });
  eq('several markers are all found', readMarkers(m + m + pendingMarker({ q: 'x', ctx: 'y' })).length, 3);
  eq('embedded videos are recognised (to never put one twice)', Array.from(embeddedVideoIds(buildYoutubeIframe('8g2ImE4moVw') + '<iframe src="https://www.youtube-nocookie.com/embed/U4rEr5IaO8c">')), ['8g2ImE4moVw', 'U4rEr5IaO8c']);
  eq('the embed is the editor\'s "video-embed" wrapper (ArticlePage unwraps exactly that)', buildYoutubeIframe('abcdefghijk').startsWith('<div class="video-embed"'), true);
  eq('at most 2 searches per section (a miss used to cost up to 10 = 1,000 quota units)', SECTION_MAX_SEARCHES, 2);

  const yt = fs.readFileSync('src/lib/youtubeSearch.ts', 'utf8');
  eq('youtubeSearch: maxSearches caps the calls, 403/429 stop at once (YouTubeQuotaError with throwOnQuota)', /if \(searches >= maxSearches\) return null/.test(yt) && /res\.status === 403 \|\| res\.status === 429/.test(yt) && /throw new YouTubeQuotaError/.test(yt), true);
  const route = fs.readFileSync('src/app/api/almanac/article/route.ts', 'utf8');
  eq('the article generator uses findSectionVideo and writes a marker when the quota is gone', /findSectionVideo\(/.test(route) && /pendingMarker\(/.test(route) && /quotaGone = true/.test(route), true);
  eq('every Daily Auto tick fills markers', /fillPendingArticleVideos\(\)/.test(fs.readFileSync('src/app/api/cron/daily-auto/route.ts', 'utf8')), true);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
