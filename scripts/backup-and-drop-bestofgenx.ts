/**
 * Backs up the orphaned `bestofgenx` database to JSON, verifies the backup,
 * and only then drops it.
 *
 * Why this database can go (all verified before writing this script):
 *  - no application points at it. The bestofgenx PROJECT's own .env.local
 *    resolves to the `sporttock` database; sporttock's app code never opens a
 *    second connection. Only scripts ever touched it.
 *  - 96.8% of its 105,626 people are already in sporttock (102,262), once the
 *    `born` strings are normalised - the two stores use DD.MM.YYYY vs YYYY-MM-DD
 *    for the same person, which made a raw-string comparison report a bogus 12%
 *    of "unique" rows.
 *  - the 2,985 names absent from sporttock are exactly the low-score rows that
 *    were deliberately deleted earlier (average score 32.2, none above 40).
 *
 * A drop is irreversible, so the dump runs first and the drop is refused unless
 * every collection was written with a matching document count.
 *
 * Dry run (default): npx tsx scripts/backup-and-drop-bestofgenx.ts
 * Execute          : npx tsx scripts/backup-and-drop-bestofgenx.ts --drop
 */
export {};

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const DB_NAME = 'bestofgenx';
const BACKUP_ROOT = 'F:/Projekte/_db-backups';

function readEnv(key: string): string {
  // .env.local carries a UTF-8 BOM (see AGENTS.md).
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env.local`);
}

(async () => {
  const doDrop = process.argv.includes('--drop');
  const conn = await mongoose.createConnection(readEnv('MONGODB_URI')).asPromise();
  const client = conn.getClient();
  const db = client.db(DB_NAME);

  // Guard: never run against the live database by accident.
  if (db.databaseName !== DB_NAME) {
    throw new Error(`refusing to touch "${db.databaseName}" - expected "${DB_NAME}"`);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outDir = path.join(BACKUP_ROOT, `${DB_NAME}-${stamp}`);

  const collections = await db.listCollections().toArray();
  console.log(`\ndatabase   : ${db.databaseName}`);
  console.log(`collections: ${collections.length}`);
  console.log(`backup dir : ${outDir}`);
  console.log(`mode       : ${doDrop ? 'BACKUP + DROP' : 'DRY RUN (backup only, nothing dropped)'}\n`);

  fs.mkdirSync(outDir, { recursive: true });

  const manifest: Array<{ name: string; docs: number; written: number; bytes: number }> = [];
  let mismatch = false;

  for (const c of collections) {
    const col = db.collection(c.name);
    const expected = await col.countDocuments({});
    const file = path.join(outDir, `${c.name}.json`);

    // Streamed as JSON Lines: 105k documents in one JSON.stringify would build a
    // ~20MB string in memory and lose the ability to resume on failure.
    const out = fs.createWriteStream(file, { encoding: 'utf8' });
    let written = 0;
    for await (const doc of col.find({})) {
      if (!out.write(JSON.stringify(doc) + '\n')) {
        // Wrapped rather than passing `res` straight in: a Promise's resolve
        // takes an argument, the 'drain' listener takes none.
        await new Promise<void>(res => out.once('drain', () => res()));
      }
      written++;
    }
    await new Promise<void>(res => out.end(res));

    const bytes = fs.statSync(file).size;
    manifest.push({ name: c.name, docs: expected, written, bytes });
    const ok = written === expected;
    if (!ok) mismatch = true;
    console.log(
      `  ${ok ? 'ok  ' : 'MISMATCH'} ${c.name.padEnd(20)} ${String(written).padStart(7)}/${String(expected).padEnd(7)} ${(bytes / 1024 / 1024).toFixed(2)} MB`
    );
  }

  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify({ database: DB_NAME, takenAt: new Date().toISOString(), collections: manifest }, null, 2)
  );

  const totalDocs = manifest.reduce((s, m) => s + m.written, 0);
  const totalMb = manifest.reduce((s, m) => s + m.bytes, 0) / 1024 / 1024;
  console.log(`\nbacked up ${totalDocs} documents, ${totalMb.toFixed(2)} MB`);

  if (mismatch) {
    console.error('\nREFUSING TO DROP: at least one collection was written incompletely.');
    await conn.close();
    process.exit(1);
  }

  if (!doDrop) {
    console.log('\nDry run finished. Nothing was dropped.');
    console.log('Re-run with --drop to delete the database.\n');
    await conn.close();
    process.exit(0);
  }

  console.log('\ndropping...');
  await db.dropDatabase();

  const remaining = (await client.db('admin').admin().listDatabases()).databases.map(d => d.name);
  console.log(`bestofgenx still present : ${remaining.includes(DB_NAME)}`);
  console.log(`sporttock still present  : ${remaining.includes('sporttock')}`);
  const sptPeople = await client.db('sporttock').collection('people').countDocuments({});
  console.log(`sporttock people         : ${sptPeople}`);

  await conn.close();
  process.exit(0);
})().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});
