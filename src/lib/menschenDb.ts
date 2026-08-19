/**
 * Single entry point for writing newsroom findings into the Person database (Almanac).
 *
 * Two jobs:
 *  1. Every verified GenX person the reporters discover is persisted immediately,
 *     so the same date never needs an external lookup again.
 *  2. Once an article exists for a person that is recorded on them, so next
 *     year's conference skips them instead of repeating the same birthday piece.
 *
 * NOTE: This now uses the unified Person model from Almanac instead of the old
 * Menschen model. The MenschenTab in admin panel reads from Person via /api/almanac.
 */

import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';
import Article from '@/models/Article';
import { countryNameToCode } from '@/lib/countryFlags';

/** Categories the schema accepts. */
export type MenschCategory =
  | 'sports' | 'music' | 'movies-tv' | 'politics' | 'gaming'
  | 'lifestyle' | 'culture' | 'authors' | 'unknown';

export interface MenschEntry {
  name: string;
  /** DD.MM.YYYY — the format the admin UI expects. */
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

/** Derive a category from a free-text profession/description. */
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
 * Convert DD.MM.YYYY to YYYY-MM-DD format for Person schema.
 */
function convertDateFormat(ddmmyyyy: string): string {
  const match = ddmmyyyy.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return ddmmyyyy;
}

/**
 * Map category to Person profession enum.
 */
function categoryToProfession(category: MenschCategory): string {
  const map: Record<string, string> = {
    'music': 'Music',
    'sports': 'Sport',
    'movies-tv': 'Actor',
    'politics': 'Politik',
    'gaming': 'Other',
    'lifestyle': 'Other',
    'culture': 'Art',
    'authors': 'Other',
    'unknown': 'Other',
  };
  return map[category] || 'Other';
}

/**
 * Idempotent bulk insert. Existing records are never overwritten — the unique
 * (firstname, lastname) index plus `$setOnInsert` guarantees curated data survives.
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
        const firstname = parts[0] || '';
        const lastname = parts.slice(1).join(' ') || '';
        
        if (!firstname || !lastname) return; // Need both names
        
        const country = normaliseCountry(e.country);
        const description = e.description || e.profession || '';
        const category = e.category && VALID_CATEGORIES.includes(e.category)
          ? e.category
          : textToCategory(description);
        
        // Convert date format from DD.MM.YYYY to YYYY-MM-DD
        const born = convertDateFormat(e.birthday);
        const birthYear = e.birthYear || (born ? parseInt(born.substring(0, 4)) : undefined);
        const isGenX = birthYear ? (birthYear >= 1965 && birthYear <= 1980) : true;

        await Person.findOneAndUpdate(
          { 
            firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
            lastname: { $regex: new RegExp(`^${lastname}$`, 'i') }
          },
          {
            $setOnInsert: {
              firstname,
              lastname,
              born,
              birthYear,
              isGenX,
              countryBorn: country || 'Unknown',
              nationality: country || '',
              countryCode: country ? (countryNameToCode(country) || '') : '',
              category,
              profession: categoryToProfession(category),
              subcat: e.profession || '',
              knownfor: description,
              description,
              wikiUrl: e.wikiUrl,
              discoveredBy: e.discoveredBy || 'system',
              discoveredByName: e.discoveredByName || 'Wikidata Import',
              discoveredFor: e.discoveredFor || 'birthday',
              discoveredAt: new Date(),
              isVerified: true,
              hasArticle: false,
            },
          },
          { upsert: true, new: true }
        );
        imported++;
      } catch (err: any) {
        // 11000 = duplicate, which is the expected no-op path.
        if (err?.code !== 11000) console.error('[Almanac] save failed:', e.name, err?.message);
      }
    }));

    console.log(`[Almanac] Persisted ${imported}/${entries.length} findings`);
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

    // Build query for each name (firstname + lastname)
    const orConditions = names.map(name => {
      const parts = name.trim().split(/\s+/);
      const firstname = parts[0] || '';
      const lastname = parts.slice(1).join(' ') || '';
      return {
        firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
        lastname: { $regex: new RegExp(`^${lastname}$`, 'i') },
      };
    });

    const docs = await Person.find({
      $or: orConditions,
      hasArticle: true,
      articleId: { $exists: true, $ne: null },
    }).select('firstname lastname articleId articleCreatedAt').lean();

    if (!docs.length) return result;

    // Resolve headlines in one query so the prompt can name the existing piece.
    const articleIds = docs.map((d: any) => d.articleId).filter(Boolean);
    const articles = await Article.find({ _id: { $in: articleIds } })
      .select('_id title').lean();
    const titleById = new Map(articles.map((a: any) => [String(a._id), a.title]));

    for (const d of docs as any[]) {
      const fullName = `${d.firstname} ${d.lastname}`;
      result.set(fullName, {
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

    let person: any = null;

    if (opts.personName) {
      const parts = opts.personName.trim().split(/\s+/);
      const firstname = parts[0] || '';
      const lastname = parts.slice(1).join(' ') || '';
      
      person = await Person.findOne({ 
        firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
        lastname: { $regex: new RegExp(`^${lastname}$`, 'i') }
      });
    }

    // Fallback: scan candidates whose stored name occurs in the headline.
    if (!person && opts.title) {
      const lowerTitle = opts.title.toLowerCase();
      // Capitalised word sequences in the headline are the plausible names.
      const words = opts.title.match(/[A-ZÀ-Ž][\wÀ-ž''-]+/g) || [];
      if (words.length >= 2) {
        const candidates = await Person.find({
          lastname: { $in: words.map(w => new RegExp(`^${w}$`, 'i')) },
        }).select('firstname lastname hasArticle').limit(50).lean();

        const hit = (candidates as any[]).find(c => {
          const fullName = `${c.firstname} ${c.lastname}`.toLowerCase();
          return lowerTitle.includes(fullName);
        });
        if (hit) person = await Person.findById(hit._id);
      }
    }

    if (!person) return false;

    // Already linked to this article — nothing to do.
    if (person.hasArticle && String(person.articleId) === opts.articleId) return true;

    person.hasArticle = true;
    person.articleId = opts.articleId as any;
    person.articleCreatedAt = new Date();
    if (opts.userId) person.articleCreatedBy = opts.userId;
    await person.save();

    console.log(`[Almanac] Coverage recorded: ${person.firstname} ${person.lastname} → "${opts.title || opts.articleId}"`);
    return true;
  } catch (err) {
    console.error('[Almanac] markMenschCovered failed:', err);
    return false;
  }
}
