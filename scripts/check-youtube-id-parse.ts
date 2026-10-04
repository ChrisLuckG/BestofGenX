/**
 * Asserts parseYouTubeId() in src/components/admin/HistoryModal.tsx.
 *
 * Context: /api/editorial/history-event used to REJECT an event when YouTube had
 * no footage, discarding an event that had already passed the pool and
 * day-exactness gates. It now delivers the event with `allowWithoutVideo` and the
 * admin pastes a link by hand - so this parser is the only thing between a pasted
 * string and `youtubeVideoId`. A wrong id renders as a broken thumbnail and is
 * then compiled into the article, which is why the bad cases matter as much as
 * the good ones.
 *
 * Run: npx tsx scripts/check-youtube-id-parse.ts
 */
export {};

function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
    /\/live\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  return null;
}

let failures = 0;
const expect = (input: string, want: string | null, note = '') => {
  const got = parseYouTubeId(input);
  const ok = got === want;
  if (!ok) failures++;
  const shown = input.length > 46 ? `${input.slice(0, 43)}...` : input;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${shown.padEnd(48)} -> ${String(got).padEnd(12)}${ok ? '' : ` expected ${want}`}${note ? `  (${note})` : ''}`
  );
};

const ID = 'dQw4w9WgXcQ';

console.log('\n--- the forms a link can arrive in ---');
expect(`https://www.youtube.com/watch?v=${ID}`, ID);
expect(`http://youtube.com/watch?v=${ID}`, ID);
expect(`https://m.youtube.com/watch?v=${ID}`, ID);
expect(`https://youtu.be/${ID}`, ID);
expect(`https://www.youtube.com/embed/${ID}`, ID);
expect(`https://www.youtube.com/shorts/${ID}`, ID);
expect(`https://www.youtube.com/live/${ID}`, ID);
expect(ID, ID, 'bare id');

console.log('\n--- real-world noise around the id ---');
expect(`https://www.youtube.com/watch?v=${ID}&t=42s`, ID, 'timestamp');
expect(`https://www.youtube.com/watch?list=PL123&v=${ID}`, ID, 'v is not first param');
expect(`https://youtu.be/${ID}?t=90`, ID, 'short link + timestamp');
expect(`  https://youtu.be/${ID}  `, ID, 'whitespace pasted along');
expect(`https://www.youtube.com/watch?v=${ID}&feature=share&si=AbCdEf`, ID);

console.log('\n--- must NOT produce an id ---');
expect('', null, 'empty clears the video');
expect('   ', null, 'whitespace only');
expect('not a link', null);
expect('https://vimeo.com/123456789', null, 'different platform');
expect('https://www.youtube.com/watch?v=tooshort', null, 'id shorter than 11');
expect('https://www.youtube.com/@somechannel', null, 'channel, not a video');
expect('https://www.youtube.com/results?search_query=woodstock', null, 'search page');

console.log('\n--- ids containing - and _ survive ---');
expect('https://www.youtube.com/watch?v=a_b-c_d-e_f', 'a_b-c_d-e_f');
expect('_yiRD0gk4yc', '_yiRD0gk4yc', 'leading underscore, seen in real data');

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
