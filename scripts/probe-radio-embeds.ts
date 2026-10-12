/**
 * Read-only probe: do Community Radio articles really carry Spotify embeds and
 * NO YouTube iframes?
 *
 * The radio path sends `skipYoutube: true` plus `spotifyLinks` to
 * /api/editorial/chat. Both flags must arrive together: `skipYoutube` alone
 * switches off the YouTube search and selects the radio JSON format, while
 * `spotifyLinks` is what the route matches songs against (by `song|band`) to
 * build the embeds. Send only the first and the sections have nothing embedded.
 *
 * Run: npx tsx scripts/probe-radio-embeds.ts
 */
export {};

import fs from 'fs';
import mongoose from 'mongoose';

function readEnv(key: string): string {
  // .env.local carries a UTF-8 BOM, which makes dotenv name the first key
  // "\uFEFFMONGODB_URI" and every script fall back to localhost (see AGENTS.md).
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env.local`);
}

function countMatches(html: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, 'g');
  while ((m = r.exec(html)) !== null) n++;
  return n;
}

(async () => {
  await mongoose.connect(readEnv('MONGODB_URI'));
  const articles = mongoose.connection.collection('articles');

  const arts = await articles
    .find({
      $or: [{ title: /radio/i }, { title: /community/i }, { content: /open\.spotify\.com/ }],
    })
    .project({ title: 1, content: 1, category: 1, status: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(8)
    .toArray();

  console.log(`\nfound ${arts.length} radio-style article(s)\n`);

  let withSpotify = 0;
  let withYoutube = 0;

  for (const a of arts as any[]) {
    const html: string = a.content || '';
    const spotify = countMatches(html, /open\.spotify\.com\/embed/);
    const spotifyAny = countMatches(html, /open\.spotify\.com/);
    const youtube = countMatches(html, /youtube\.com\/embed/);
    const mentions = countMatches(html, /class="[^"]*username/);
    const sections = countMatches(html, /<h2/);

    if (spotifyAny > 0) withSpotify++;
    if (youtube > 0) withYoutube++;

    const when = a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '?';
    console.log(`- [${when}] ${String(a.title).slice(0, 54)}`);
    console.log(
      `    category: ${a.category || '?'} | status: ${a.status || '?'} | sections: ${sections}`
    );
    // Measured on the one existing radio article: the output is inline
    // <a href="open.spotify.com/track/..."> links inside the prose plus
    // highlighted @username spans - NOT iframe players, despite the route
    // calling the field "spotifyEmbed". 16 links / 0 iframes on 12 Aug.
    console.log(
      `    spotify track links: ${spotifyAny} | iframe players: ${spotify} | youtube iframes: ${youtube} | @username spans: ${mentions}`
    );
  }

  console.log('\n--- summary ---');
  console.log(`articles containing Spotify  : ${withSpotify}/${arts.length}`);
  console.log(`articles containing YouTube  : ${withYoutube}/${arts.length}  (should be 0)`);
  console.log(
    withYoutube === 0 && withSpotify === arts.length && arts.length > 0
      ? '\n=> skipYoutube + spotifyLinks behave as intended.\n'
      : '\n=> inspect the above: a radio article should carry Spotify and no YouTube.\n'
  );

  process.exit(0);
})().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});
