// Asserts the rule "a changed person picture in Menschen reaches that person's articles and
// rankrolls". Needs the dev server running. It writes THROWAWAY docs (ZZTest / ZZTEST) into the
// real database through the real PUT route and deletes them again in a finally block.
//   npx tsx scripts/check-person-image-sync.ts
import fs from 'fs';
import mongoose from 'mongoose';
const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`); };
(async () => {
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const { Person } = await import('../src/models/Almanac');
  const Article = (await import('../src/models/Article')).default;
  const Poll = (await import('../src/models/Poll')).default;
  const OLD = 'https://example.test/old.jpg', NEW = 'https://example.test/new.jpg', OTHER = 'https://example.test/other.jpg';
  const person: any = await Person.create({ firstname: 'ZZTest', lastname: 'ImageSync', profession: 'Other', image: OLD, born: '1970-01-01' });
  const bystander: any = await Person.create({ firstname: 'ZZTest', lastname: 'Bystander', profession: 'Other', image: OLD, born: '1970-01-02' });
  const art: any = await Article.create({ title: 'ZZTEST article', content: '<p>x</p>', coverImage: OLD, thumbnailUrl: OLD, imagePosX: 10, imagePosY: 90, personRef: person._id, status: 'draft' });
  const artOther: any = await Article.create({ title: 'ZZTEST bystander article', content: '<p>x</p>', coverImage: OLD, thumbnailUrl: OLD, personRef: bystander._id, status: 'draft' });
  const poll: any = await Poll.create({ title: 'ZZTEST poll', type: 'ranking', items: [{ id: 'a', title: 'a' }, { id: 'b', title: 'b' }], image: OLD, personRef: person._id, status: 'draft', category: 'ranking' });
  const put = async (body: any) => (await fetch('http://localhost:3000/api/almanac', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'people', ...body }) })).json();
  try {
    let r = await put({ id: String(person._id), firstname: 'ZZTest', image: OLD });
    eq('re-sending the SAME image does not sync', r.synced, undefined);
    eq('article untouched', (await Article.findById(art._id).lean<any>()).coverImage, OLD);

    r = await put({ id: String(person._id), image: NEW });
    eq('a CHANGED image reports what it synced', r.synced, { articles: 1, polls: 1 });
    const a: any = await Article.findById(art._id).lean();
    eq('article cover follows', a.coverImage, NEW);
    eq('article thumbnail follows', a.thumbnailUrl, NEW);
    eq('focal point resets to centre', [a.imagePosX, a.imagePosY], [50, 50]);
    eq('rankroll cover follows', (await Poll.findById(poll._id).lean<any>()).image, NEW);
    eq('another person\'s article is untouched', (await Article.findById(artOther._id).lean<any>()).coverImage, OLD);

    r = await put({ id: String(person._id), cityBorn: 'Somewhere' });
    eq('an edit without an image does not sync', r.synced, undefined);
    r = await put({ id: String(person._id), image: '' });
    eq('clearing the image does not blank the covers', (await Article.findById(art._id).lean<any>()).coverImage, NEW);
    r = await put({ id: String(person._id), image: OTHER });
    eq('a second change follows too', (await Poll.findById(poll._id).lean<any>()).image, OTHER);
  } finally {
    await Article.deleteMany({ title: /^ZZTEST/ }); await Poll.deleteMany({ title: /^ZZTEST/ }); await Person.deleteMany({ firstname: 'ZZTest' });
    console.log('cleanup: leftovers =', await Article.countDocuments({ title: /^ZZTEST/ }) + await Poll.countDocuments({ title: /^ZZTEST/ }) + await Person.countDocuments({ firstname: 'ZZTest' }));
    await mongoose.disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
