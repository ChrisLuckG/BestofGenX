/**
 * Single entry point for writing newsroom findings into the Menschen database.
 *
 * Two jobs:
 *  1. Every verified GenX person the reporters discover is persisted immediately,
 *     so the same date never needs an external lookup again.
 *  2. Once an article exists for a person that is recorded on them, so next
 *     year's conference skips them instead of repeating the same birthday piece.
 *
 * The Menschen model already carries `hasArticle` / `articleId` / `articleCreatedAt`,
 * which is exactly the coverage flag we need.
 */

import dbConnect from '@/lib/mongoose';
import Menschen from '@/models/Menschen';
import Article from '@/models/Article';
import { countryNameToCode } from '@/lib/countryFlags';

/** Categories the Menschen schema accepts. */
export type MenschCategory =
  | 'sports' | 'music' | 'movies-tv' | 'politics' | 'gaming'
  | 'lifestyle' | 'culture' | 'authors' | 'unknown';

export interface MenschEntry {
  name: string;
  /** DD.MM.YYYY — the format the Menschen schema and admin UI expect. */
  birthday: string;
  birthYear?: number;
  country?: string;
  category?: MenschCategory;
  profession?: string;
  description?: string;
  wikiUrl?: string;
  discoveredBy?: string;
  discoveredByName?: string;
  discoveredFor?: 'birthday' | 'rip';
}

export interface CoverageInfo {
  articleId: string;
  title?: string;
  coveredAt?: Date;
}

const VALID_CATEGORIES: MenschCategory[] = [
  'sports', 'music', 'movies-tv', 'politics', 'gaming',
  'lifestyle', 'culture', 'authors', 'unknown',
];

/** Derive a Menschen category from a free-text profession/description. */
export function textToCategory(text: string): MenschCategory {
  const patterns: [MenschCategory, RegExp][] = [
    ['sports', /\b(football|basketball|baseball|hockey|soccer|tennis|golf|boxer|wrestler|athlete|swimmer|cyclist|racer|player|coach|gymnast|skier|snowboarder|surfer|skater|martial artist|MMA|UFC)\b/i],
    ['music', /\b(singer|musician|rapper|DJ|guitarist|drummer|bassist|songwriter|composer|band|pianist|violinist|cellist|conductor)\b/i],
    ['movies-tv', /\b(actor|actress|director|producer|screenwriter|filmmaker|television|TV|comedian|host|presenter|model)\b/i],
    ['politics', /\b(politician|senator|governor|president|minister|mayor|diplomat|activist|political)\b/i],
    ['gaming', /\b(game designer|video game|esports|streamer)\b/i],
    ['authors', /\b(author|writer|novelist|poet|journalist|blogger)\b/i],
  ];
  for (const [cat, re] of patterns) if (re.test(text || '')) return cat;
  return 'culture';
}

/** Wikidata returns official long names; normalise the common ones. */
function normaliseCountry(country?: string): string {
  if (!country) return '';
  const map: Record<string, string> = {
    'united states of america': 'USA',
    'united states': 'USA',
    'united kingdom': 'UK',
    'kingdom of the netherlands': 'Netherlands',
    "people's republic of china": 'China',
    'republic of korea': 'South Korea',
    'russian federation': 'Russia',
    'czechia': 'Czech Republic',
  };
  return map[country.toLowerCase()] || country;
}

/**
 * Idempotent bulk insert. Existing records are never overwritten — the unique
 * (name, birthday) index plus `$setOnInsert` guarantees curated data survives.
 * Returns the number of records touched.
 */
export async function saveMenschen(entries: MenschEntry[]): Promise<number> {
  let imported = 0;
  try {
    await dbConnect();

    await Promise.all(entries.map(async (e) => {
      try {
        const name = (e.name || '').trim();
        if (!name || name.length < 2 || !e.birthday) return;

        const parts = name.split(/\s+/);
        const country = normaliseCountry(e.country);
        const description = e.description || e.profession || '';
        const category = e.category && VALID_CATEGORIES.includes(e.category)
          ? e.category
          : textToCategory(description);

        await Menschen.findOneAndUpdate(
          { name, birthday: e.birthday },
          {
            $setOnInsert: {
              firstName: parts[0],
              lastName: parts.slice(1).join(' '),
              name,
              birthday: e.birthday,
              birthYear: e.birthYear,
              country: country || 'Unknown',
              countryCode: country ? (countryNameToCode(country) || '') : '',
              category,
              profession: e.profession || '',
              description,
              wikiUrl: e.wikiUrl,
              isGenX: true,
              discoveredBy: e.discoveredBy || 'system',
              discoveredByName: e.discoveredByName || 'Wikidata Import',
              discoveredFor: e.discoveredFor || 'birthday',
              isVerified: true,
              hasArticle: false,
            },
          },
          { upsert: true, new: true }
        );
        imported++;
      } catch (err: any) {
        // 11000 = duplicate, which is the expected no-op path.
        if (err?.code !== 11000) console.error('[Menschen] save failed:', e.name, err?.message);
      }
    }));

    console.log(`[Menschen] Persisted ${imported}/${entries.length} findings`);
  } catch { /* DB unavailable — non-fatal, the conference still works */ }
  return imported;
}

/**
 * For the given names, returns those that already have an article, including the
 * headline so the prompt can show what we published.
 */
export async function getMenschenCoverage(names: string[]): Promise<Map<string, CoverageInfo>> {
  const result = new Map<string, CoverageInfo>();
  if (!names.length) return result;

  try {
    await dbConnect();

    const docs = await Menschen.find({
      name: { $in: names },
      hasArticle: true,
      articleId: { $exists: true, $ne: null },
    }).select('name articleId articleCreatedAt').lean();

    if (!docs.length) return result;

    // Resolve headlines in one query so the prompt can name the existing piece.
    const articleIds = docs.map((d: any) => d.articleId).filter(Boolean);
    const articles = await Article.find({ _id: { $in: articleIds } })
      .select('_id title').lean();
    const titleById = new Map(articles.map((a: any) => [String(a._id), a.title]));

    for (const d of docs as any[]) {
      result.set(d.name, {
        articleId: String(d.articleId),
        title: titleById.get(String(d.articleId)),
        coveredAt: d.articleCreatedAt,
      });
    }
  } catch { /* non-fatal — worst case a person gets proposed twice */ }

  return result;
}

/**
 * Flags a person as covered. Called right after an article is created. The
 * person is matched by explicit name when available, otherwise by their full
 * name appearing in the headline (reliable for birthday/RIP pieces).
 */
export async function markMenschCovered(opts: {
  articleId: string;
  title?: string;
  personName?: string;
  userId?: string;
}): Promise<boolean> {
  try {
    await dbConnect();

    let mensch: any = null;

    if (opts.personName) {
      mensch = await Menschen.findOne({ name: opts.personName.trim() });
    }

    // Fallback: scan candidates whose stored name occurs in the headline.
    if (!mensch && opts.title) {
      const lowerTitle = opts.title.toLowerCase();
      // Capitalised word sequences in the headline are the plausible names.
      const words = opts.title.match(/[A-ZÀ-Ž][\wÀ-ž'’-]+/g) || [];
      if (words.length >= 2) {
        const candidates = await Menschen.find({
          lastName: { $in: words },
        }).select('name hasArticle').limit(50).lean();

        const hit = (candidates as any[]).find(c => lowerTitle.includes((c.name || '').toLowerCase()));
        if (hit) mensch = await Menschen.findById(hit._id);
      }
    }

    if (!mensch) return false;

    // Already linked to this article — nothing to do.
    if (mensch.hasArticle && String(mensch.articleId) === opts.articleId) return true;

    mensch.hasArticle = true;
    mensch.articleId = opts.articleId as any;
    mensch.articleCreatedAt = new Date();
    if (opts.userId) mensch.articleCreatedBy = opts.userId;
    await mensch.save();

    console.log(`[Menschen] Coverage recorded: ${mensch.name} → "${opts.title || opts.articleId}"`);
    return true;
  } catch (err) {
    console.error('[Menschen] markMenschCovered failed:', err);
    return false;
  }
}
