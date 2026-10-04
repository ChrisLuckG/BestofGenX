// Measures which of the five "AI Generation" controls in the Menschen article
// modal actually change the produced article.
//
// Four of them are injected into the USER message as bare `Key: value` lines by
// /api/almanac/article; only `tone` and `language` have a matching rule in the
// SYSTEM prompt. A line the system prompt never mentions is not automatically
// inert - the model may still obey it - so this calls the real model and
// compares, one option at a time, instead of reasoning about the prompt text.
//
// Reads the key straight out of .env.local: that file carries a UTF-8 BOM, which
// makes dotenv name the first key "\uFEFFMONGODB_URI" (see AGENTS.md).
//
// Costs a handful of gpt-4o-mini calls. Run with:
//   npx tsx scripts/check-article-options.ts

import fs from 'fs';
import OpenAI from 'openai';

function readEnv(key: string): string {
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env.local`);
}

// Trimmed to the parts that bear on length/language/focus. The full prompt adds
// video and chronology rules which do not interact with the options under test,
// but the "3-5 sections" line is kept verbatim because it is the suspected
// competitor to `Length`.
const SYSTEM = `You are a GenX culture expert writing about GenX icons and cultural moments.

IMPORTANT: Return a JSON object with this EXACT structure:
{
  "title": "Catchy article title",
  "subtitle": "Engaging subtitle",
  "sections": [
    {"heading": null, "year": null, "text": "<p>Opening paragraph.</p>"},
    {"heading": "Section Title", "year": 1996, "text": "<p>Content...</p>"}
  ]
}

RULES:
- Write 3-5 sections with engaging content
- First section has NO heading (null) and "year": null - it's the intro.
- Use HTML formatting: <p>, <strong>, <em>, <ul>, <li>
- Write in the requested language`;

const PERSON = {
  firstname: 'Vicky',
  lastname: 'Bullett',
  profession: 'Sport',
  born: '1967-10-04',
  countryBorn: 'USA',
  knownfor: 'basketball',
};

type Options = {
  language?: string;
  length?: string;
  timeframe?: string;
  topic?: string;
  extra?: string;
};

// Mirrors the non-isItem branch of the real route verbatim.
function userMessage(o: Options): string {
  return `Write an article about ${PERSON.firstname} ${PERSON.lastname}.
Profession: ${PERSON.profession}
Born: ${PERSON.born}
Country: ${PERSON.countryBorn}
Known for: ${PERSON.knownfor}
Still alive
Language: ${o.language || 'English'}
Length: ${o.length || 'medium'}
Timeframe: ${o.timeframe || 'alltime'}
${o.topic ? `Focus: ${o.topic}` : ''}
${o.extra ? `Extra instructions: ${o.extra}` : ''}`;
}

function textOf(parsed: any): string {
  const secs = parsed.sections || [];
  return secs.map((s: any) => `${s.heading || ''} ${s.text || ''}`).join(' ');
}

function words(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
}

async function run(openai: OpenAI, label: string, o: Options) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMessage(o) },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const body = textOf(parsed);
  return {
    label,
    words: words(body),
    sections: (parsed.sections || []).length,
    title: parsed.title || '',
    body,
  };
}

// Crude German detector: these function words are unambiguous enough and cannot
// appear in an English article.
function looksGerman(s: string): boolean {
  return /\b(und|der|die|das|wurde|Jahr|nicht|sie)\b/.test(s);
}

(async () => {
  const openai = new OpenAI({ apiKey: readEnv('OPENAI_API_KEY') });

  console.log('Calling gpt-4o-mini, one option varied at a time...\n');

  const [short, long, german, focus, extra, tfWeek] = await Promise.all([
    run(openai, 'length=short (~150 words)', { length: 'short (~150 words)' }),
    run(openai, 'length=long (~600 words)', { length: 'long (~600 words)' }),
    run(openai, 'language=Deutsch', { language: 'Deutsch' }),
    run(openai, 'topic=Olympics 1988', { topic: 'her Olympic career, nothing else' }),
    run(openai, 'extra=one sentence only', { extra: 'Write every section as exactly one sentence.' }),
    run(openai, 'timeframe=week', { timeframe: 'week' }),
  ]);

  const line = (r: { label: string; words: number; sections: number }) =>
    `  ${r.label.padEnd(30)} ${String(r.words).padStart(4)} words  ${r.sections} sections`;

  console.log('LENGTH');
  console.log(line(short));
  console.log(line(long));
  const ratio = long.words / short.words;
  console.log(`  -> long/short ratio ${ratio.toFixed(2)}x (asked for 4x: 150 -> 600)`);
  console.log(`  ${ratio > 1.6 ? 'WORKS' : 'WEAK - the "3-5 sections" rule dominates'}\n`);

  console.log('LANGUAGE');
  console.log(line(german));
  console.log(`  german function words present: ${looksGerman(german.body)}`);
  console.log(`  ${looksGerman(german.body) ? 'WORKS' : 'BROKEN'}\n`);

  console.log('FOCUS (topic)');
  console.log(line(focus));
  const olympicHits = (focus.body.match(/olympic/gi) || []).length;
  console.log(`  "olympic" occurrences: ${olympicHits}`);
  console.log(`  ${olympicHits >= 2 ? 'WORKS' : 'NO EFFECT'}\n`);

  console.log('EXTRA INSTRUCTIONS');
  console.log(line(extra));
  const sentencesPerSection = extra.words / Math.max(extra.sections, 1);
  console.log(`  ~${sentencesPerSection.toFixed(0)} words per section`);
  console.log(`  ${sentencesPerSection < 45 ? 'WORKS - sections collapsed to one sentence' : 'NO EFFECT'}\n`);

  console.log('TIMEFRAME');
  console.log(line(tfWeek));
  // A person born 1967 cannot have a "last week" biography; if the option meant
  // anything the model would have to refuse or produce something degenerate.
  const stillFullLife = tfWeek.sections >= 3 && /19[6-9]\d/.test(tfWeek.body);
  console.log(`  still a full life story with 1900s years: ${stillFullLife}`);
  console.log(`  ${stillFullLife ? 'NO EFFECT - ignored, and meaningless for a biography' : 'has some effect'}\n`);
})();
