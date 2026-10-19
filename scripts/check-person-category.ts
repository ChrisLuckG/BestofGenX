// Asserts which category an article about a person gets - always a canonical slug that the
// category dropdown knows, never an alias like 'culture' / 'genx-icons' (those showed "-").
//   npx tsx scripts/check-person-category.ts
import { articleCategoryFor } from '../src/lib/personCategory';
import { CATEGORIES } from '../src/lib/categories';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`); };

// the reported case: Natasha Rothwell, Comedy, model suggested "culture"
eq('Comedy -> movies-tv (the reported article)', articleCategoryFor({ profession: 'Comedy' }, 'culture'), 'movies-tv');
eq('Music', articleCategoryFor({ profession: 'Music' }, 'culture'), 'music');
eq('Actor', articleCategoryFor({ profession: 'Actor' }), 'movies-tv');
eq('Politik -> news', articleCategoryFor({ profession: 'Politik' }), 'news');
eq('Tech -> gaming', articleCategoryFor({ profession: 'Tech' }), 'gaming');
eq('Art -> lifestyle', articleCategoryFor({ profession: 'Art' }), 'lifestyle');
eq('Sport', articleCategoryFor({ profession: 'Sport' }), 'sports');
eq('imported sport names ("football") -> sports', articleCategoryFor({ profession: 'football' }, 'lifestyle'), 'sports');
eq('person.category wins over profession and model', articleCategoryFor({ category: 'music', profession: 'Actor' }, 'sports'), 'music');
eq('person.category politics -> news', articleCategoryFor({ category: 'politics' }), 'news');
eq('person.category culture is an alias -> lifestyle', articleCategoryFor({ category: 'culture' }), 'lifestyle');
// Natasha Rothwell's real data: profession Comedy, person.category "culture" (the import default)
eq('catch-all "culture" does NOT beat a specific profession (Natasha: Comedy)', articleCategoryFor({ category: 'culture', profession: 'Comedy' }, 'culture'), 'movies-tv');
eq('catch-all "lifestyle" does not beat Music either', articleCategoryFor({ category: 'lifestyle', profession: 'Music' }), 'music');
eq('catch-all with profession Other -> lifestyle', articleCategoryFor({ category: 'culture', profession: 'Other' }), 'lifestyle');
eq('catch-all "authors" with nothing else -> lifestyle', articleCategoryFor({ category: 'authors' }), 'lifestyle');

// data silent -> the model's suggestion, canonicalised
eq('Other + model "culture" -> lifestyle', articleCategoryFor({ profession: 'Other' }, 'culture'), 'lifestyle');
eq('Other + model "movies" -> movies-tv', articleCategoryFor({ profession: 'Other' }, 'movies'), 'movies-tv');
eq('Other + model "tech" -> gaming', articleCategoryFor({ profession: 'Other' }, 'tech'), 'gaming');
eq('"genx-icons" carries no information -> fallback', articleCategoryFor({ profession: 'Other' }, 'genx-icons'), 'lifestyle');
eq('category unknown + model "music"', articleCategoryFor({ category: 'unknown', profession: 'Other' }, 'music'), 'music');
eq('nothing at all -> lifestyle', articleCategoryFor(undefined), 'lifestyle');
eq('garbage suggestion -> lifestyle', articleCategoryFor({ profession: 'Other' }, 'banana'), 'lifestyle');

// rip only for someone who died; history/eastercorn never
eq('a LIVING person is never filed under rip', articleCategoryFor({ profession: 'Other' }, 'rip'), 'lifestyle');
eq('a person who died may be', articleCategoryFor({ profession: 'Other', died: '2020-01-01' }, 'obituary'), 'rip');
eq('history is never chosen for a person', articleCategoryFor({ profession: 'Other' }, 'history'), 'lifestyle');
eq('eastercorn is never chosen for a person', articleCategoryFor({ profession: 'Other' }, 'eastercorn'), 'lifestyle');

// whatever comes out, the dropdown must know it
const canonical = new Set(CATEGORIES.map(c => c.slug));
const samples = ['Music', 'Actor', 'Comedy', 'Sport', 'Politik', 'Art', 'Tech', 'Model', 'Other', 'football', 'tennis', ''];
const sugg = ['culture', 'genx-icons', 'movies', 'tech', 'rip', 'news', 'lifestyle', 'sports', 'people', 'x', ''];
const all = samples.flatMap(p => sugg.map(s => articleCategoryFor({ profession: p }, s)));
eq('every result is a canonical slug', all.every(c => canonical.has(c)), true);
eq('and never an alias', all.some(c => ['culture', 'genx-icons', 'tech'].includes(c)), false);

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
