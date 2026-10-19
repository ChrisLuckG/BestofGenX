// Person articles that came out WITHOUT section videos (the YouTube quota was used up while they were written) get
// invisible markers in up to --per sections; the Daily Auto tick fills them in (lib/articleVideos.ts).
// The search per section = person name + section heading, judged against the section's own text.
//   npx tsx scripts/backfill-article-videos.ts --days=2            dry run: what would be marked
//   npx tsx scripts/backfill-article-videos.ts --days=2 --apply    mark (backup of the old content in _db-backups)
import fs from 'fs';
import mongoose from 'mongoose';
const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const APPLY = process.argv.includes('--apply');
const DAYS = Number(arg('days') || 2);
const PER = Number(arg('per') || 2);
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const dbConnect = (await import('../src/lib/mongoose')).default;
  const { pendingMarker, embeddedVideoIds, readMarkers } = await import('../src/lib/articleVideos');
  await dbConnect();
  const col = mongoose.connection.db!.collection('articles');
  const list = await col.find({ personRef: { $ne: null }, contentType: 'article', createdAt: { $gte: new Date(Date.now() - DAYS * 864e5) } }).sort({ createdAt: -1 }).project({ title: 1, content: 1, personName: 1 }).toArray();
  const backup: { _id: string; content: string }[] = [];
  for (const a of list) {
    const html = String(a.content);
    if (embeddedVideoIds(html).size || readMarkers(html).length) continue; // has videos or is already marked
    const person = a.personName || '';
    // sections = <h2> ... up to the next <h2>
    const parts = html.split(/(?=<h2[\s>])/);
    const marked: string[] = [];
    const out = parts.map(part => {
      const h = part.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (!h || marked.length >= PER) return part;
      const heading = strip(h[1]);
      // the concrete thing the section is about: the generator puts it in <strong> ("Cannibal! The Musical");
      // without one, the heading
      const strong = (part.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1];
      const topic = strong ? strip(strong) : heading;
      const q = (topic.toLowerCase().includes(person.split(' ').pop()!.toLowerCase()) ? topic : `${person} ${topic}`).trim();
      marked.push(q);
      return part + '\n' + pendingMarker({ q, ctx: strip(part).slice(0, 600), person });
    }).join('');
    console.log(`${a.title.slice(0, 40).padEnd(40)} -> ${marked.length ? marked.map(m => `"${m.slice(0, 40)}"`).join(', ') : '(no <h2> sections)'}`);
    if (APPLY && marked.length) { backup.push({ _id: String(a._id), content: html }); await col.updateOne({ _id: a._id }, { $set: { content: out } }); }
  }
  if (APPLY) {
    const file = `F:/Projekte/_db-backups/article-content-before-videos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    fs.writeFileSync(file, JSON.stringify(backup));
    console.log(`\nmarked ${backup.length} articles - backup: ${file}`);
  } else console.log('\n(dry run)');
  await mongoose.disconnect();
})();
