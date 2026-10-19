// Fills the people database with WELL-KNOWN Gen X people (born 1965-1980) who reach our score 70 right away.
//
// Why: the old imports had hard caps (">30 language versions", "2,000 per occupation for all 16 years"),
// which left the middle years thin and missed well-known people with few language versions (Olli Schulz: 5).
// This goes day by day over the calendar - one Wikidata lookup per day by exact birth dates (an index lookup,
// a few seconds) - so there is no cap per occupation or year.
//
// Taken: a human, born 1965-1980, with a photo, a birthplace, an occupation and at least --min-sitelinks
// Wikipedia language versions (= how well known). That gives score 75 (knownfor 25 + photo 15 + born 15 +
// profession 10 + birthplace 10). Not limited to English Wikipedia; knownfor is Wikidata's English description.
// Already in the database (same name + birthday, either date shape): not added again - only missing fields
// (photo, birthplace, death data) are filled in.
//
//   npx tsx scripts/import-famous-genx.ts --month=10                       dry run, October, statistics
//   npx tsx scripts/import-famous-genx.ts --month=10 --min-sitelinks=8 --apply
//   npx tsx scripts/import-famous-genx.ts --all --min-sitelinks=8 --apply  the whole year (~366 lookups)
// Every applied run writes F:/Projekte/_db-backups/famous-import-<time>.jsonl as it goes (inserted ids + the old values
// of filled fields) for undo. --from=MM-DD resumes an interrupted run. Only birthdays known to the day are used.
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const MONTH = Number(arg('month') || 0);
const MIN_SL = Number(arg('min-sitelinks') || 5);
/** resume: --from=MM-DD skips the days before */
const FROM = (arg('from') || '01-01').split('-').map(Number) as [number, number];
const THRESHOLDS = [5, 8, 10, 15, 20, 30];
if (!ALL && !(MONTH >= 1 && MONTH <= 12)) { console.error('give --month=1..12 or --all'); process.exit(1); }

const UA = { 'User-Agent': 'BestOfGenX/1.0 (https://bestofgenx.com; people import)', Accept: 'application/sparql-results+json' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');

/** Wikimedia thumbnail URL (330px), the same form most of our photos already have */
function commonsThumb(fileUrl: string): string {
  const file = decodeURIComponent(fileUrl.split('/Special:FilePath/')[1] || '').replace(/ /g, '_');
  if (!file) return fileUrl;
  const md5 = crypto.createHash('md5').update(file).digest('hex');
  const enc = encodeURIComponent(file);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/330px-${enc}${/\.(svg|tiff?)$/i.test(file) ? '.png' : ''}`;
}

const SPORTS: [RegExp, string][] = [
  [/association football|footballer|soccer/i, 'football'], [/american football/i, 'american-football'], [/ice hockey/i, 'ice-hockey'],
  [/basketball/i, 'basketball'], [/baseball/i, 'baseball'], [/tennis/i, 'tennis'], [/boxer|boxing/i, 'boxing'], [/golf/i, 'golf'],
  [/racing driver|formula/i, 'motorsport'], [/cyclist/i, 'cycling'], [/athlet|sprinter|runner|hurdler|jumper|thrower/i, 'athletics'],
  [/swimmer/i, 'swimming'], [/skier|ski /i, 'skiing'], [/wrestler/i, 'wrestling'], [/rugby/i, 'rugby'], [/cricket/i, 'cricket'],
  [/volleyball/i, 'volleyball'], [/handball/i, 'handball'], [/mixed martial|martial art|judoka|karateka/i, 'martial-arts'],
];
const ROLES: [RegExp, string][] = [
  ...SPORTS,
  [/comedian/i, 'Comedy'],
  [/\bactor|actress/i, 'Actor'],
  [/singer|musician|rapper|composer|guitarist|drummer|bassist|\bdj\b|disc jockey|record producer|pianist|songwriter|band/i, 'Music'],
  [/politician|diplomat|head of state|minister|governor|senator|mayor/i, 'Politik'],
  [/painter|sculptor|photographer|artist|writer|novelist|poet|author|designer|architect|film director|screenwriter|journalist/i, 'Art'],
  [/engineer|computer|entrepreneur|business|programmer|scientist|inventor|game designer/i, 'Tech'],
];
/**
 * Our profession values (the ones the database already uses). The DESCRIPTION decides first, by what it names first
 * ("German singer-songwriter and entertainer" -> Music, although Wikidata also lists actor); then the occupations.
 */
export function professionOf(occ: string[], desc = ''): string {
  let best: [number, string] | null = null;
  for (const [re, p] of ROLES) { const m = desc.match(re); if (m && m.index !== undefined && (!best || m.index < best[0])) best = [m.index, p]; }
  if (best) return best[1];
  const all = occ.join(' | ');
  for (const [re, p] of ROLES) if (re.test(all)) return p;
  return 'others';
}
/** Not for Best of GenX: adult performers, terrorists, criminals (Wikidata occupations or description) */
const EXCLUDE = /pornograph|adult (film|model)|erotic|terroris|jihad|islamic state|militant|murderer|serial killer|criminal|mobster|gangster|drug (lord|traffick)|cartel/i;

const country = (c?: string) => !c ? '' : c === 'United States of America' ? 'USA' : c === 'United Kingdom' ? 'UK' : c;

type Row = Record<string, { value: string } | undefined>;
async function lookupDay(m: number, d: number): Promise<Row[]> {
  const years = Array.from({ length: 16 }, (_, i) => 1965 + i);
  const all = await lookupDates(m, d, years);
  if (all) return all;
  // too much for one go (01.01. holds every "only the year is known" date): year by year
  const rows: Row[] = [];
  for (const y of years) { const r = await lookupDates(m, d, [y]); if (r) rows.push(...r); else console.warn(`  ${pad(d)}.${pad(m)}.${y}: skipped (no answer)`); }
  return rows;
}

/** null = no answer after retries */
async function lookupDates(m: number, d: number, years: number[]): Promise<Row[] | null> {
  const dates = years.map(y => `"${y}-${pad(m)}-${pad(d)}T00:00:00Z"^^xsd:dateTime`).join(' ');
  const q = `SELECT ?p (SAMPLE(?sl) AS ?sl) (SAMPLE(?b) AS ?b) (SAMPLE(?img) AS ?img) (SAMPLE(?lab) AS ?lab) (SAMPLE(?desc) AS ?desc)
    (SAMPLE(?bpL) AS ?bpL) (SAMPLE(?bpCL) AS ?bpCL) (SAMPLE(?natL) AS ?natL) (SAMPLE(?dd) AS ?dd) (SAMPLE(?dpL) AS ?dpL) (SAMPLE(?dpCL) AS ?dpCL)
    (SAMPLE(?codL) AS ?codL) (GROUP_CONCAT(DISTINCT ?occL; separator="|") AS ?occ) WHERE {
    VALUES ?b { ${dates} }
    ?p wdt:P569 ?b; wdt:P31 wd:Q5; wikibase:sitelinks ?sl; wdt:P18 ?img; wdt:P19 ?bp; wdt:P106 ?o .
    # only birthdays known to the DAY - Wikidata stores "only the year known" as 1 January and "only the month" as the 1st
    ?p p:P569/psv:P569 [ wikibase:timeValue ?b; wikibase:timePrecision 11 ] .
    FILTER(?sl >= ${Math.min(...THRESHOLDS, MIN_SL)})
    ?o rdfs:label ?occL FILTER(LANG(?occL) = "en")
    ?bp rdfs:label ?bpL FILTER(LANG(?bpL) = "en")
    OPTIONAL { ?bp wdt:P17 ?bpC . ?bpC rdfs:label ?bpCL FILTER(LANG(?bpCL) = "en") }
    OPTIONAL { ?p rdfs:label ?lab FILTER(LANG(?lab) IN ("en", "mul")) }
    OPTIONAL { ?p schema:description ?desc FILTER(LANG(?desc) = "en") }
    OPTIONAL { ?p wdt:P27 ?nat . ?nat rdfs:label ?natL FILTER(LANG(?natL) = "en") }
    OPTIONAL { ?p wdt:P570 ?dd }
    OPTIONAL { ?p wdt:P20 ?dp . ?dp rdfs:label ?dpL FILTER(LANG(?dpL) = "en") OPTIONAL { ?dp wdt:P17 ?dpC . ?dpC rdfs:label ?dpCL FILTER(LANG(?dpCL) = "en") } }
    OPTIONAL { ?p wdt:P509 ?cod . ?cod rdfs:label ?codL FILTER(LANG(?codL) = "en") }
  } GROUP BY ?p`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(60000) });
      if (r.ok) return ((await r.json()) as any).results.bindings;
      console.warn(`\n  ${pad(d)}.${pad(m)} (${years.length} years): HTTP ${r.status}, retry ${attempt}`);
    } catch (e) { console.warn(`\n  ${pad(d)}.${pad(m)} (${years.length} years): ${e instanceof Error ? e.message : e}, retry ${attempt}`); }
    await sleep(5000 * attempt);
  }
  return null;
}

(async () => {
  const dbConnect = (await import('../src/lib/mongoose')).default;
  const { interestScore } = await import('../src/lib/personScore');
  await dbConnect();
  const people = mongoose.connection.db!.collection('people');

  const months = ALL ? Array.from({ length: 12 }, (_, i) => i + 1) : [MONTH];
  const stats = { found: 0, already: 0, byThreshold: Object.fromEntries(THRESHOLDS.map(t => [t, { new: 0, already: 0 }])) as Record<number, { new: number; already: number }>, inserted: 0, enriched: 0, under70: 0 };
  const log: { inserted: string[]; enriched: { _id: string; set: Record<string, unknown>; before: Record<string, unknown> }[] } = { inserted: [], enriched: [] };
  // undo list, one JSON line per change, written immediately - survives a crash
  const undoFile = `F:/Projekte/_db-backups/famous-import-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`;
  const undo = (entry: object) => { if (APPLY) fs.appendFileSync(undoFile, JSON.stringify(entry) + '\n'); };
  let nameTaken = 0;
  const samples: string[] = [];

  for (const m of months) {
    const daysIn = new Date(2024, m, 0).getDate();
    for (let d = 1; d <= daysIn; d++) {
      if (m < FROM[0] || (m === FROM[0] && d < FROM[1])) continue;
      const rows = await lookupDay(m, d);
      // who we already have on this day (both date shapes)
      const ours: any[] = await people.find({ born: { $in: Array.from({ length: 16 }, (_, i) => [`${1965 + i}-${pad(m)}-${pad(d)}`, `${pad(d)}.${pad(m)}.${1965 + i}`, `${d}.${m}.${1965 + i}`]).flat() } })
        .project({ firstname: 1, lastname: 1, born: 1, image: 1, cityBorn: 1, countryBorn: 1, died: 1, cityDied: 1, countryDied: 1, causeOfDeath: 1, knownfor: 1, profession: 1, nationality: 1, wikidataId: 1 }).toArray();
      const key = (name: string, year: string) => `${fold(name)}|${year}`;
      const yearOf = (born: string) => (born.match(/(19[6-8]\d)/) || [])[1] || '';
      const index = new Map(ours.map(o => [key(`${o.firstname} ${o.lastname || ''}`, yearOf(o.born || '')), o]));
      const qids = new Map(ours.filter(o => o.wikidataId).map(o => [o.wikidataId, o]));

      for (const r of rows) {
        const name = r.lab?.value; const occ = (r.occ?.value || '').split('|').filter(Boolean);
        if (!name || /^Q\d+$/.test(name) || !occ.length) continue;
        if (EXCLUDE.test(occ.join(' ')) || EXCLUDE.test(r.desc?.value || '')) continue;
        const sl = Number(r.sl?.value || 0);
        const born = (r.b?.value || '').slice(0, 10);
        const qid = r.p!.value.split('/').pop()!;
        const mine = qids.get(qid) || index.get(key(name, born.slice(0, 4)));
        stats.found++;
        for (const t of THRESHOLDS) if (sl >= t) stats.byThreshold[t][mine ? 'already' : 'new']++;
        if (sl < MIN_SL) continue;

        const [firstname, ...rest] = name.trim().split(/\s+/);
        const desc = r.desc?.value || `${r.natL?.value ? r.natL.value + ' ' : ''}${occ[0]}`;
        const doc: Record<string, unknown> = {
          firstname, lastname: rest.join(' '), born,
          died: r.dd?.value ? r.dd.value.slice(0, 10) : null,
          causeOfDeath: r.codL?.value || null,
          profession: professionOf(occ, r.desc?.value || ''),
          subcat: desc,
          knownfor: desc,
          countryBorn: country(r.bpCL?.value),
          cityBorn: r.bpL?.value || '',
          nationality: r.natL?.value || '',
          cityDied: r.dpL?.value || null,
          countryDied: country(r.dpCL?.value) || null,
          image: commonsThumb(r.img!.value),
          isGenX: true, birthYear: Number(born.slice(0, 4)), isVerified: true, isRejected: false, hasArticle: false,
          wikidataId: qid, sitelinks: sl,
          discoveredBy: 'system', discoveredByName: 'Wikidata famous import', discoveredAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
        };

        if (mine) {
          // already there: only fill what is missing (never overwrite)
          stats.already++;
          const set: Record<string, unknown> = {}; const before: Record<string, unknown> = {};
          for (const f of ['image', 'cityBorn', 'countryBorn', 'nationality', 'knownfor', 'died', 'causeOfDeath', 'cityDied', 'countryDied']) {
            if (!String(mine[f] ?? '').trim() && doc[f]) { set[f] = doc[f]; before[f] = mine[f] ?? null; }
          }
          if (!mine.wikidataId) { set.wikidataId = qid; set.sitelinks = sl; before.wikidataId = null; }
          if (Object.keys(set).length) {
            stats.enriched++;
            if (APPLY) { await people.updateOne({ _id: mine._id }, { $set: set }); log.enriched.push({ _id: String(mine._id), set, before }); undo({ enriched: String(mine._id), before }); }
          }
          continue;
        }
        if (interestScore(doc as any) < 70) { stats.under70++; continue; }
        if (samples.length < 25) samples.push(`  ${String(sl).padStart(3)} ${firstname} ${rest.join(' ')} (${born}) - ${doc.profession} - ${desc}`.slice(0, 120));
        if (APPLY) {
          try {
            const res = await people.insertOne(doc);
            log.inserted.push(String(res.insertedId)); undo({ inserted: String(res.insertedId) });
          } catch (e: any) {
            // the database allows each first + last name once: a namesake with another birthday is skipped
            if (e?.code === 11000) { nameTaken++; continue; }
            throw e;
          }
        }
        stats.inserted++;
      }
      process.stdout.write(`\r  ${pad(d)}.${pad(m)}: ${rows.length} on Wikidata | so far new ${stats.inserted}, already there ${stats.already}   `);
      await sleep(800);
    }
  }
  console.log('\n');
  console.log(`Wikidata (photo + birthplace + occupation, >= ${Math.min(...THRESHOLDS)} language versions): ${stats.found}`);
  console.log('by fame (language versions):   new / already in our database');
  for (const t of THRESHOLDS) console.log(`  >= ${String(t).padStart(2)}: ${String(stats.byThreshold[t].new).padStart(6)} / ${stats.byThreshold[t].already}`);
  console.log(`\nwith --min-sitelinks=${MIN_SL}: ${stats.inserted} new (score >= 70), ${stats.enriched} existing get missing fields, ${stats.under70} skipped (score < 70), ${nameTaken} skipped (name already taken by a namesake)`);
  console.log('\nexamples of new people:\n' + samples.join('\n'));
  if (APPLY) console.log(`\nAPPLIED - inserted ${log.inserted.length}, enriched ${log.enriched.length}. Undo list (JSON lines): ${undoFile}`); else console.log('\n(dry run - nothing written)');
  await mongoose.disconnect();
})();
