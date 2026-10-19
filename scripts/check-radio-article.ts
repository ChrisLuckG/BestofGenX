// Asserts which songs go into the Radio article and when an automatic run does nothing.
// Pure logic - no database, no model.
//   npx tsx scripts/check-radio-article.ts
import {
  RADIO_FIRST_RUN_DAYS, RADIO_MIN_DAYS, RADIO_MIN_SONGS, buildRadioPrompt, planRadio, radioSpotifyLinks,
} from '../src/lib/radioArticle';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

const DAY = 86_400_000;
const NOW = new Date('2026-10-18T10:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const song = (n: number, addedDaysAgo: number) => ({ song: `Song ${n}`, band: `Band ${n}`, username: `user${n}`, playlist: 'Techno', link: `https://open.spotify.com/track/${n}`, coverImage: `c${n}.jpg`, updatedAt: ago(addedDaysAgo) });
const songs = (n: number, addedDaysAgo: number) => Array.from({ length: n }, (_, i) => song(i + 1, addedDaysAgo));

// --- a person at the Radio window / Run now / Rerun: everything marked "Added", no rules ---
const all = [...songs(5, 90), song(9, 1)];
let plan = planRadio(all, ago(1), NOW, true);
eq('manual: every Added song, even old ones, even the day after the last article', [plan.songs.length, plan.skip], [6, null]);
eq('manual: no songs at all -> says so', planRadio([], null, NOW, true).skip, 'No songs are marked "Added"');
eq('manual: one song is enough (the window only needs one)', planRadio(songs(1, 5), ago(2), NOW, true).songs.length, 1);

// --- automatic: one article a week ---
plan = planRadio(songs(10, 0), ago(3), NOW, false);
eq('automatic: 3 days after the last article -> skipped, however many new songs', plan.songs.length, 0);
eq('automatic: the reason names the age', plan.skip, 'the last radio article is only 3 days old (one a week)');
eq('automatic: yesterday is "1 day" (singular)', planRadio(songs(10, 0), ago(1), NOW, false).skip, 'the last radio article is only 1 day old (one a week)');
eq('automatic: exactly 7 days after is allowed', planRadio(songs(5, 1), ago(RADIO_MIN_DAYS), NOW, false).skip, null);

// --- automatic: only songs added AFTER the previous article ---
plan = planRadio([...songs(4, 20), ...songs(3, 2)], ago(10), NOW, false);
eq('automatic: songs added before the previous article are left out', plan.songs.length, 3);
eq('automatic: and the new ones are the ones kept', plan.songs.every(s => (s as any).updatedAt > ago(10)), true);
eq('automatic: a song added exactly at the previous article is not new', planRadio(songs(3, 10), ago(10), NOW, false).skip?.startsWith('only 0 new songs'), true);

// --- automatic: needs enough new songs ---
plan = planRadio(songs(RADIO_MIN_SONGS - 1, 1), ago(10), NOW, false);
eq('automatic: too few new songs -> skipped with the numbers', plan.skip, `only ${RADIO_MIN_SONGS - 1} new songs since ${ago(10).toISOString().slice(0, 10)} (need ${RADIO_MIN_SONGS})`);
eq('automatic: exactly the minimum is enough', planRadio(songs(RADIO_MIN_SONGS, 1), ago(10), NOW, false).songs.length, RADIO_MIN_SONGS);
eq('automatic: one new song reads "1 new song"', planRadio(songs(1, 1), ago(10), NOW, false).skip?.startsWith('only 1 new song since'), true);

// --- automatic, nothing to measure from: the last 30 days only ---
plan = planRadio([...songs(5, RADIO_FIRST_RUN_DAYS + 20), ...songs(4, 10)], null, NOW, false);
eq('first run: only songs added in the last 30 days', plan.songs.length, 4);
eq('first run with nothing recent -> skipped (the real data: 39 songs, newest from August)', planRadio(songs(39, 65), null, NOW, false).skip?.startsWith('only 0 new songs since'), true);
eq('a song without a date can never count as new', planRadio([{ song: 'x', band: 'y', username: 'u', playlist: 'p' }], ago(10), NOW, false).songs.length, 0);

// --- the brief and the Spotify links ---
const two = songs(2, 1);
const prompt = buildRadioPrompt(two);
eq('the brief lists every song with its requester and Spotify link', prompt.includes('- "Song 1" by Band 1 (requested by @user1 for Techno) [SPOTIFY: https://open.spotify.com/track/1]'), true);
eq('it asks for Spotify embeds and forbids YouTube', prompt.includes('use "spotifyEmbed" instead of "youtubeSearch"') && prompt.includes('DO NOT search for YouTube videos'), true);
// (the fixed brief itself mentions "[SPOTIFY: ...]", so look at the song's own line)
const noLink = buildRadioPrompt([{ song: 'a', band: 'b', username: 'c', playlist: 'd' }]).split('\n').find(l => l.startsWith('- "a"'));
eq('a song without a link has no [SPOTIFY] marker on its line', noLink, '- "a" by b (requested by @c for d)');
eq('spotifyLinks carry song, band, link and cover - nothing else', radioSpotifyLinks(two)[0], { song: 'Song 1', band: 'Band 1', link: 'https://open.spotify.com/track/1', coverImage: 'c1.jpg' });

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
