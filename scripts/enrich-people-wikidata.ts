/**
 * Fill in image / description / Wikipedia link for existing NON-sport people that
 * sit below score 70 (the admin "Score 70+" filter hides them).
 *
 * ~27k such entries came from older imports that only stored name, birth date,
 * profession and birthplace. Wikidata usually has the rest.
 *
 * Matching is strict, because a wrong match puts a namesake's photo on someone:
 * - exact English label + birth YEAR in the query
 * - several Wikidata people with that name -> the exact birth date must decide,
 *   otherwise the entry is skipped
 * - a DB entry with a real day (not YYYY-01-01) must match that day exactly
 * Only fields that are empty are written, and only if the entry then reaches
 * the score threshold. Nobody is filtered out by occupation.
 *
 * Usage: npx tsx scripts/enrich-people-wikidata.ts --start=1980 --end=1965 [--dry]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH = 40;
const MIN_SCORE = 70;

type Doc = {
  _id: mongoose.Types.ObjectId; firstname: string; lastname: string; born?: string;
  profession?: string; subcat?: string; knownfor?: string; description?: string;
  image?: string; cityBorn?: string; wikiUrl?: string; died?: string; causeOfDeath?: string;
  nationality?: string; countryBorn?: string; countryDied?: string; cityDied?: string;
};

// Same formula as interestScore() in src/components/admin/MenschenTab.tsx
function score(p: Doc): number {
  let s = 0;
  if (p.knownfor) s += 25;
  if (p.subcat) s += 10;
  if (p.profession && p.profession !== 'Other') s += 10;
  if (p.nationality && p.nationality !== p.countryBorn) s += 5;
  if (p.image) s += 15;
  if (p.born) s += 15;
  if (p.cityBorn) s += 10;
  if (p.died) {
    s += 5;
    if (p.causeOfDeath) s += 5;
    if (p.countryDied) s += 5;
    if (p.cityDied) s += 5;
  }
  return Math.min(100, s);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const lit = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`;

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

function lookupQuery(names: string[], year: number) {
  return `SELECT ?p ?name ?b ?img ?desc ?cityLabel ?article WHERE {
    VALUES ?name { ${names.map(lit).join(' ')} }
    ?p rdfs:label ?name; wdt:P31 wd:Q5; wdt:P569 ?b .
    FILTER(?b >= "${year}-01-01T00:00:00Z"^^xsd:dateTime && ?b < "${year + 1}-01-01T00:00:00Z"^^xsd:dateTime)
    OPTIONAL { ?p wdt:P18 ?img }
    OPTIONAL { ?p schema:description ?desc FILTER(LANG(?desc) = "en") }
    OPTIONAL { ?p wdt:P19 ?city . ?city rdfs:label ?cityLabel FILTER(LANG(?cityLabel) = "en") }
    OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
  }`;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] || d;
  const start = parseInt(arg('start', '1980'));
  const end = parseInt(arg('end', '1965'));
  const step = start > end ? -1 : 1;

  await mongoose.connect(process.env.MONGODB_URI || '');
  const people = mongoose.connection.db!.collection<Doc>('people');
  console.log(`Enrich non-sport people ${start} -> ${end}${dry ? ' (DRY RUN)' : ''}\n`);

  const total = { candidates: 0, found: 0, enriched: 0, noImage: 0, ambiguous: 0, dateMismatch: 0, failed: 0 };

  for (let year = start; step > 0 ? year <= end : year >= end; year += step) {
    const docs = (await people.find({
      category: { $ne: 'sports' },
      isRejected: { $ne: true },
      born: { $regex: `^${year}-` },
    }).toArray()).filter(d => score(d) < MIN_SCORE);

    const t = { candidates: docs.length, found: 0, enriched: 0, noImage: 0, ambiguous: 0, dateMismatch: 0, failed: 0 };
    const samples: string[] = [];
    console.log(`${year}: ${docs.length} below ${MIN_SCORE}`);

    // Names that occur twice in the same year in our own DB cannot be told apart either
    const byName = new Map<string, Doc[]>();
    for (const d of docs) {
      const n = `${d.firstname} ${d.lastname}`.trim();
      byName.set(n, [...(byName.get(n) || []), d]);
    }
    const names = Array.from(byName.keys());

    for (let i = 0; i < names.length; i += BATCH) {
      const batch = names.slice(i, i + BATCH);
      const rows = await sparql(lookupQuery(batch, year));
      if (!rows) { t.failed += batch.length; console.log(`  batch at ${i} failed`); continue; }

      // Collapse OPTIONAL fan-out to one record per Wikidata entity
      const hits = new Map<string, Map<string, any>>();
      for (const r of rows) {
        const name = r.name.value, id = r.p.value;
        if (!hits.has(name)) hits.set(name, new Map());
        const m = hits.get(name)!;
        const e = m.get(id) || { born: r.b.value.slice(0, 10) };
        e.image ||= r.img?.value?.replace(/^http:/, 'https:');
        e.desc ||= r.desc?.value;
        e.city ||= r.cityLabel?.value;
        e.wiki ||= r.article?.value;
        m.set(id, e);
      }

      for (const name of batch) {
        const ours = byName.get(name)!;
        const cands = Array.from(hits.get(name)?.values() || []);
        if (!cands.length) continue;
        if (ours.length > 1) { t.ambiguous += ours.length; continue; }
        const d = ours[0];
        const dayKnown = !!d.born && !d.born.endsWith('-01-01');

        let match = cands.length === 1 ? cands[0] : undefined;
        if (cands.length > 1) {
          const sameDay = cands.filter(c => c.born === d.born);
          if (dayKnown && sameDay.length === 1) match = sameDay[0];
          else { t.ambiguous++; continue; }
        }
        if (!match) continue;
        if (dayKnown && match.born !== d.born && !match.born.endsWith('-01-01')) { t.dateMismatch++; continue; }
        t.found++;

        const set: Partial<Doc> = {};
        if (!d.image && match.image) set.image = match.image;
        if (!d.knownfor && match.desc) set.knownfor = match.desc;
        if (!d.description && match.desc) set.description = match.desc;
        if (!d.subcat && match.desc) set.subcat = match.desc;
        if (!d.cityBorn && match.city) set.cityBorn = match.city;
        if (!d.wikiUrl && match.wiki) set.wikiUrl = match.wiki;
        // Our "-01-01" is often a year-only placeholder - take the real day
        if (!dayKnown && !match.born.endsWith('-01-01')) set.born = match.born;

        if (score({ ...d, ...set }) < MIN_SCORE) { t.noImage++; continue; }
        if (samples.length < 6) samples.push(`${name} (${set.born || d.born}) - ${set.knownfor || d.knownfor}`);
        if (!dry) await people.updateOne({ _id: d._id }, { $set: set });
        t.enriched++;
      }
      if ((i / BATCH) % 25 === 24) console.log(`  ${i + BATCH}/${names.length} names, ${t.enriched} enriched so far`);
      await sleep(1000);
    }

    console.log(`  found ${t.found}, enriched ${t.enriched}, still < ${MIN_SCORE} ${t.noImage}, ambiguous ${t.ambiguous}, date mismatch ${t.dateMismatch}, query failed ${t.failed}`);
    for (const s of samples) console.log(`    e.g. ${s}`);
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += t[k];
  }

  console.log(`\nTOTAL ${dry ? 'would enrich' : 'enriched'} ${total.enriched} of ${total.candidates}`, total);
  await mongoose.disconnect();
}

main();
