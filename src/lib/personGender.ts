// A person's gender for the voice choice (lib/personVoice.ts). Asked from Wikidata once (by the Wikidata id, or by
// name + exact birthday) and stored on the Person as `gender`; when Wikidata does not know, the description decides
// (guessGenderFromText). Server-only.
import mongoose from 'mongoose';
import { guessGenderFromText, type Gender } from '@/lib/personVoice';
import { parseDateShape } from '@/lib/dateShapes';

const UA = { 'User-Agent': 'BestOfGenX/1.0 (https://bestofgenx.com)', Accept: 'application/sparql-results+json' };
// male, female, trans man, trans woman
const MAP: Record<string, Gender> = { Q6581097: 'male', Q6581072: 'female', Q2449503: 'male', Q1052281: 'female' };

async function askWikidata(query: string): Promise<Gender> {
  try {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const rows: any[] = ((await r.json()) as any).results.bindings;
    for (const row of rows) { const g = MAP[String(row.g?.value || '').split('/').pop() || '']; if (g) return g; }
  } catch { /* no answer - the description decides */ }
  return null;
}

export async function resolvePersonGender(person: any): Promise<Gender> {
  if (person.gender === 'male' || person.gender === 'female') return person.gender;
  let g: Gender = null;
  if (person.wikidataId) g = await askWikidata(`SELECT ?g WHERE { wd:${person.wikidataId} wdt:P21 ?g }`);
  if (!g) {
    const d = parseDateShape(person.born);
    const name = `${person.firstname || ''} ${person.lastname || ''}`.trim().replace(/"/g, '');
    if (d && name) g = await askWikidata(`SELECT ?g WHERE { VALUES ?b { "${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T00:00:00Z"^^xsd:dateTime } ?p wdt:P569 ?b; rdfs:label "${name}"@en; wdt:P21 ?g } LIMIT 3`);
  }
  if (!g) g = guessGenderFromText(person);
  if (g && person._id) {
    await mongoose.connection.db!.collection('people').updateOne({ _id: new mongoose.Types.ObjectId(String(person._id)) }, { $set: { gender: g } }).catch(() => {});
  }
  return g;
}
