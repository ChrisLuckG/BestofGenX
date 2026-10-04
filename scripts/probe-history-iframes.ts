/**
 * Read-only probe: do history articles actually carry the YouTube iframe?
 *
 * /api/editorial/history-compile passes each event's `youtubeVideoId` into the
 * PROMPT and merely asks the model to "include it as <iframe ...>". That is a soft
 * guarantee, and it matters now that the admin can attach a video BY HAND - a
 * hand-picked video that the model drops is silently lost work.
 *
 * Run: npx tsx scripts/probe-history-iframes.ts
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

(async () => {
  await mongoose.connect(readEnv('MONGODB_URI'));
  const Article = mongoose.connection.collection('articles');

  const arts = await Article.find({
    $or: [
      { title: /Moments That Shaped/i },
      { title: /On This Day/i },
      { title: /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+:/ },
    ],
  })
    .project({ title: 1, content: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log(`\nfound ${arts.length} history-style article(s)\n`);

  let withSections = 0;
  let withIframes = 0;
  let literalPlaceholders = 0;

  for (const a of arts as any[]) {
    const html: string = a.content || '';
    const ids: string[] = [];
    const re = /youtube\.com\/embed\/([\w-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) ids.push(m[1]);
    const placeholders = (html.match(/VIDEO_ID/g) || []).length;
    const sections = (html.match(/<h2/g) || []).length;

    if (sections > 0) withSections++;
    if (ids.length > 0) withIframes++;
    literalPlaceholders += placeholders;

    const when = a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '?';
    console.log(`- [${when}] ${String(a.title).slice(0, 56)}`);
    console.log(`    sections: ${sections} | iframes: ${ids.length} | literal "VIDEO_ID": ${placeholders}`);
    if (ids.length) console.log(`    ids: ${ids.join(', ')}`);
  }

  console.log('\n--- summary ---');
  console.log(`articles with <h2> sections : ${withSections}/${arts.length}`);
  console.log(`articles with an iframe     : ${withIframes}/${arts.length}`);
  console.log(`literal "VIDEO_ID" leaks    : ${literalPlaceholders}`);
  console.log(
    withIframes < withSections
      ? '\n=> the model does NOT reliably embed the video it is given.\n'
      : '\n=> every sectioned article carried an iframe.\n'
  );

  process.exit(0);
})().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});
