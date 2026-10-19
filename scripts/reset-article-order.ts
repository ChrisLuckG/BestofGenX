// Reset the manual article position (`order`) to 0 for every article, so the Post Manager
// and the feed sort by date again. A drag in the Post Manager rewrites `order` for the
// whole list (/api/articles/reorder), which freezes the order until something resets it.
//
// The previous values are written to a JSON file OUTSIDE the repo first, so the reset can
// be undone with --restore=<file>.
//   npx tsx scripts/reset-article-order.ts                 (dry run: count + backup path)
//   npx tsx scripts/reset-article-order.ts --apply         (backup, then reset)
//   npx tsx scripts/reset-article-order.ts --restore=F:/Projekte/_db-backups/<file>.json
import fs from 'fs';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

(async () => {
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const col = mongoose.connection.db!.collection('articles');
  const apply = process.argv.includes('--apply');
  const restore = process.argv.find(a => a.startsWith('--restore='))?.slice('--restore='.length);

  if (restore) {
    const rows: { _id: string; order: number | null }[] = JSON.parse(fs.readFileSync(restore, 'utf8'));
    let n = 0;
    for (const r of rows) n += (await col.updateOne({ _id: new mongoose.Types.ObjectId(r._id) }, { $set: { order: r.order ?? 0 } })).modifiedCount;
    console.log(`restored ${rows.length} rows from ${restore} (${n} changed)`);
  } else {
    const rows = await col.find({}, { projection: { order: 1 } }).toArray();
    const pinned = rows.filter(r => (r.order ?? 0) !== 0);
    const file = `F:/Projekte/_db-backups/article-order-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    console.log(`articles: ${rows.length} | with a non-zero order: ${pinned.length}`);
    if (!apply) { console.log(`dry run - would back up to ${file} and reset ${pinned.length}`); }
    else {
      fs.writeFileSync(file, JSON.stringify(rows.map(r => ({ _id: String(r._id), order: r.order ?? null }))));
      const back = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (back.length !== rows.length) throw new Error('backup is incomplete - aborting before any write');
      const res = await col.updateMany({ order: { $ne: 0 } }, { $set: { order: 0 } });
      console.log(`backup: ${file} (${back.length} rows)`);
      console.log(`reset: ${res.modifiedCount} articles -> order 0`);
      console.log('still non-zero:', await col.countDocuments({ order: { $ne: 0 } }));
    }
  }
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
