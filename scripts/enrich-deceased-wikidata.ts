/**
 * Fill photo / description / birthplace / Wikipedia link for DECEASED people who miss something.
 *
 * Why: the RIP article needs a photo and score 70+. Of 3,583 deceased people only 12% qualified,
 * and the reason is the PHOTO (87% have none) - not a lack of people. With a photo for everybody,
 * 64% would qualify.
 *
 * Why not scripts/enrich-people-wikidata.ts: it only looks at people whose birth date is in the
 * "YYYY-..." shape (the other import stores "18.10.1969" and was never touched), it skips sports,
 * and it does not check the death date.
 *
 * Matching is strict - a namesake's photo on an OBITUARY would be unforgivable:
 *  - exact English label + birth YEAR in the query
 *  - the Wikidata person must have DIED too, on the same day (a Jan-1 date is Wikidata's
 *    "year only" placeholder: then the year decides)
 *  - several Wikidata people with that name and birth year -> the exact birth day must pick one,
 *    otherwise skipped; two of OUR people with the same name and year -> skipped
 *  - a birth day of ours that is a real day (not 01-01) must match too
 * Only EMPTY fields are written, and only if the person then reaches the threshold (70), so nobody
 * is left half-filled. Dates are never touched. Everything written is saved to a backup file first
 * (F:/Projekte/_db-backups/) and can be undone: --revert=<file>.
 *
 * Usage: npx tsx scripts/enrich-deceased-wikidata.ts [--start=1965] [--end=1980] [--dry] [--revert=<file>]
 */
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { interestScore } from '../src/lib/personScore';
import { parseDateShape } from '../src/lib/dateShapes';
import { resolveCommonsThumbs } from '../src/lib/wikimediaImage';
dotenv.config({ path: '.env.local' });

const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH = 40;
const MIN_SCORE = 70;
const BACKUP_DIR = 'F:/Projekte/_db-backups';

type Doc = Record<string, any> & { _id: mongoose.Types.ObjectId; firstname: string; lastname: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const lit = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (p: { year: number; month: number; day: number }) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;

async function sparql(query: string): Promise<any[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'BestOfGenX/1.0 (https://bestofgenx.com)', Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(10000 * (attempt + 1)); continue; }
      if (!res.ok) return null;
      return (await res.json()).results?.bindings || [];
    } catch {
      await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}

const lookupQuery = (names: string[], year: number) => `SELECT ?p ?name ?b ?dd ?img ?desc ?cityLabel ?article WHERE {
  VALUES ?name { ${names.map(lit).join(' ')} }
  ?p rdfs:label ?name; wdt:P31 wd:Q5; wdt:P569 ?b; wdt:P570 ?dd .
  FILTER(?b >= "${year}-01-01T00:00:00Z"^^xsd:dateTime && ?b < "${year + 1}-01-01T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?p schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?p wdt:P19 ?city . ?city rdfs:label ?cityLabel FILTER(LANG(?cityLabel) = "en") }
  OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
}`;

/** Does Wikidata's death date agree with ours? Same year always; the day too unless either is a Jan-1 placeholder. */
export function deathAgrees(ours: string, theirs: string): boolean {
  const o = parseDateShape(ours), t = parseDateShape(theirs);
  if (!o || !t || o.year !== t.year) return false;
  const placeholder = (p: { month: number; day: number }) => p.month === 1 && p.day === 1;
  return placeholder(o) || placeholder(t) || (o.month === t.month && o.day === t.day);
}

type Plan = { id: string; name: string; set: Record<string, string> };

async function revert(file: string) {
  const plans: Plan[] = JSON.parse(fs.readFileSync(file, 'utf8')).plans;
  await mongoose.connect(process.env.MONGODB_URI || '');
  const people = mongoose.connection.db!.collection('people');
  let undone = 0, kept = 0;
  for (const p of plans) {
    const cur: any = await people.findOne({ _id: new mongoose.Types.ObjectId(p.id) });
    if (!cur) continue;
    // only what is still exactly what this script wrote - a value somebody edited since stays
    const $unset: Record<string, 1> = {};
    for (const [k, v] of Object.entries(p.set)) if (cur[k] === v) $unset[k] = 1; else kept++;
    if (Object.keys($unset).length) { await people.updateOne({ _id: cur._id }, { $unset }); undone++; }
  }
  console.log(`reverted ${undone} people from ${file} (${kept} field(s) left alone because they were edited since)`);
  await mongoose.disconnect();
}

async function main() {
  const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] || d;
  const revertFile = process.argv.find(a => a.startsWith('--revert='))?.slice('--revert='.length);
  if (revertFile) return revert(revertFile);

  const dry = process.argv.includes('--dry');
  const start = parseInt(arg('start', '1965')), end = parseInt(arg('end', '1980'));

  await mongoose.connect(process.env.MONGODB_URI || '');
  const people = mongoose.connection.db!.collection<Doc>('people');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `${BACKUP_DIR}/enrich-deceased-${stamp}.json`;
  console.log(`Enrich DECEASED people born ${start}-${end}${dry ? ' (DRY RUN - nothing is written)' : ''}\n`);

  const all = (await people.find({ died: { $exists: true, $nin: [null, ''] }, isRejected: { $ne: true } }).toArray())
    .filter(d => parseDateShape(d.died) && parseDateShape(d.born) && interestScore(d as any) < MIN_SCORE);
  const total = { candidates: 0, found: 0, enriched: 0, stillBelow: 0, ambiguous: 0, deathMismatch: 0, birthMismatch: 0, failed: 0, photos: 0 };
  const plans: Plan[] = [];

  for (let year = start; year <= end; year++) {
    const docs = all.filter(d => parseDateShape(d.born)!.year === year);
    const t = { candidates: docs.length, found: 0, enriched: 0, stillBelow: 0, ambiguous: 0, deathMismatch: 0, birthMismatch: 0, failed: 0, photos: 0 };
    const samples: string[] = [];
    console.log(`${year}: ${docs.length} deceased below ${MIN_SCORE}`);

    const byName = new Map<string, Doc[]>();
    for (const d of docs) {
      const n = `${d.firstname} ${d.lastname}`.trim();
      byName.set(n, [...(byName.get(n) || []), d]);
    }
    const names = Array.from(byName.keys());
    const yearPlans: { plan: Plan; image?: string }[] = [];

    for (let i = 0; i < names.length; i += BATCH) {
      const batch = names.slice(i, i + BATCH);
      const rows = await sparql(lookupQuery(batch, year));
      if (!rows) { t.failed += batch.length; console.log(`  batch at ${i} failed`); continue; }

      const hits = new Map<string, Map<string, any>>();
      for (const r of rows) {
        const name = r.name.value, id = r.p.value;
        if (!hits.has(name)) hits.set(name, new Map());
        const m = hits.get(name)!;
        const e = m.get(id) || { born: r.b.value.slice(0, 10), died: r.dd.value.slice(0, 10) };
        e.image ||= r.img?.value?.replace(/^http:/, 'https:');
        e.desc ||= r.desc?.value;
        e.city ||= r.cityLabel?.value;
        e.wiki ||= r.article?.value;
        m.set(id, e);
      }

      for (const name of batch) {
        const ours = byName.get(name)!;
        let cands = Array.from(hits.get(name)?.values() || []);
        if (!cands.length) continue;
        if (ours.length > 1) { t.ambiguous += ours.length; continue; }
        const d = ours[0];
        const myBorn = parseDateShape(d.born)!;
        const dayKnown = !(myBorn.month === 1 && myBorn.day === 1);

        // the death date must agree - the safeguard an obituary needs
        const dead = cands.filter(c => deathAgrees(String(d.died), c.died));
        if (!dead.length) { t.deathMismatch++; continue; }
        cands = dead;

        let match = cands.length === 1 ? cands[0] : undefined;
        if (cands.length > 1) {
          const sameDay = cands.filter(c => c.born === iso(myBorn));
          if (dayKnown && sameDay.length === 1) match = sameDay[0]; else { t.ambiguous++; continue; }
        }
        if (!match) continue;
        if (dayKnown && match.born !== iso(myBorn) && !match.born.endsWith('-01-01')) { t.birthMismatch++; continue; }
        t.found++;

        const set: Record<string, string> = {};
        if (!d.image && match.image) set.image = match.image; // resolved to a CDN thumbnail below
        if (!d.knownfor && match.desc) set.knownfor = match.desc;
        if (!d.description && match.desc) set.description = match.desc;
        if (!d.subcat && match.desc) set.subcat = match.desc;
        if (!d.cityBorn && match.city) set.cityBorn = match.city;
        if (!d.wikiUrl && match.wiki) set.wikiUrl = match.wiki;

        // Only people who GET A PHOTO are written: a RIP article cannot exist without one (it is the
        // cover), so filling texts for someone who still has no photo changes nothing for RIP - the
        // dry run counted 2,438 "would enrich", of which only 231 gained a photo.
        if (!set.image) { t.stillBelow++; continue; }
        if (interestScore({ ...d, ...set } as any) < MIN_SCORE) { t.stillBelow++; continue; }
        if (!Object.keys(set).length) continue;
        if (samples.length < 6) samples.push(`${name} (${match.born} - ${match.died}) - ${match.desc || '?'}${set.image ? ' [photo]' : ''}`);
        yearPlans.push({ plan: { id: String(d._id), name, set }, image: set.image });
        t.enriched++;
        if (set.image) t.photos++;
      }
      await sleep(1000);
    }

    // photos: Special:FilePath -> a CDN thumbnail (the same step the other enrichment script takes)
    if (!dry && yearPlans.length) {
      const urls = yearPlans.map(p => p.image).filter((u): u is string => !!u);
      const thumbs = await resolveCommonsThumbs(urls);
      for (const p of yearPlans) if (p.image) { const th = thumbs.get(p.image); if (th) p.plan.set.image = th; }
      plans.push(...yearPlans.map(p => p.plan));
      // the backup is on disk BEFORE this year's writes
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(backupFile, JSON.stringify({ note: 'fields written by scripts/enrich-deceased-wikidata.ts; undo with --revert=<this file>', plans }, null, 1));
      for (const p of yearPlans) await people.updateOne({ _id: new mongoose.Types.ObjectId(p.plan.id), } as any, { $set: p.plan.set });
    }

    console.log(`  found ${t.found}, ${dry ? 'would enrich' : 'enriched'} ${t.enriched} (${t.photos} with a photo), still < ${MIN_SCORE}: ${t.stillBelow}, ambiguous ${t.ambiguous}, death date differs ${t.deathMismatch}, birth day differs ${t.birthMismatch}, failed ${t.failed}`);
    for (const s of samples) console.log(`    e.g. ${s}`);
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += t[k];
  }

  console.log(`\nTOTAL ${dry ? 'would enrich' : 'enriched'} ${total.enriched} of ${total.candidates}`, JSON.stringify(total));
  if (!dry && plans.length) console.log('backup (undo with --revert):', backupFile);
  await mongoose.disconnect();
}

if (require.main === module || process.argv[1]?.endsWith('enrich-deceased-wikidata.ts')) main();
