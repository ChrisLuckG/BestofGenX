import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Category from '@/models/Category';
import { CATEGORIES, slugify, findStaticCategory } from '@/lib/categories';

// Colours auto-assigned to newly created dynamic categories, cycling by
// creation order. The static entries in lib/categories.ts have a hand-picked
// colour per vertical; a typed-in one ("EisHockey") has none, so it takes the
// next colour in rotation rather than all of them sharing one default grey.
const AUTO_COLORS = ['#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706', '#4338ca', '#be123c', '#0d9488'];

/**
 * GET - the merged list: static CATEGORIES first, then any dynamically created
 * ones, deduped by slug.
 *
 * Static comes first on purpose so the broad verticals stay at the top of every
 * dropdown instead of being shuffled in among one-off sports.
 */
export async function GET() {
  try {
    await dbConnect();
    const dynamicCats = await Category.find().sort({ createdAt: 1 }).lean();
    const staticSlugs = new Set(CATEGORIES.map(c => c.slug));
    const merged = [
      ...CATEGORIES.map(c => ({ slug: c.slug, label: c.label, color: c.color })),
      // A dynamic row whose slug collides with a static one is already
      // rejected by POST below, but filter here too - a collision that slipped
      // in by any other route (a manual DB insert, a renamed static entry)
      // would otherwise render a duplicate <option> with the same value.
      ...dynamicCats
        .filter(c => !staticSlugs.has(c.slug))
        .map(c => ({ slug: c.slug, label: c.label, color: c.color })),
    ];
    return NextResponse.json({ success: true, categories: merged });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

/**
 * POST - ensure a category exists for `label`; create it only if it is new.
 *
 * Idempotent by design: this is called on every container rename commit (see
 * ContainerBlock's onCommitName), which happens far more often than an actual
 * new category is typed. Returning the existing row instead of erroring keeps
 * the caller free of "does it already exist" logic.
 */
export async function POST(request: NextRequest) {
  // Parsed OUTSIDE the try so the duplicate-key handler below can reuse the
  // slug. A request body is a one-shot stream - calling request.json() twice
  // throws "Body has already been read", which would turn a harmless race into
  // a 500.
  let slug = '';
  let label = '';
  try {
    const body = await request.json();
    label = (body.label || '').trim();
    // Must be the SAME slugify the container auto-fill uses, or the category
    // and the container that created it resolve to different slugs.
    slug = slugify(label);
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    await dbConnect();
    if (!label) {
      return NextResponse.json({ success: false, error: 'label is required' }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'label did not produce a usable slug' },
        { status: 400 }
      );
    }

    // Matches on slug, slugified label AND aliases - see findStaticCategory for
    // why all three are needed ("Sport" -> static 'sports', not a new 'sport').
    const existingStatic = findStaticCategory(label);
    if (existingStatic) {
      return NextResponse.json({
        success: true,
        created: false,
        category: { slug: existingStatic.slug, label: existingStatic.label, color: existingStatic.color },
      });
    }

    const existing = await Category.findOne({ slug }).lean();
    if (existing) {
      return NextResponse.json({ success: true, created: false, category: existing });
    }

    const count = await Category.countDocuments();
    const color = AUTO_COLORS[count % AUTO_COLORS.length];
    const category = await Category.create({ slug, label, color });
    return NextResponse.json({ success: true, created: true, category });
  } catch (error) {
    // A duplicate-key race (two renames committed at once) is not a failure -
    // the row exists, which is all the caller wanted.
    if ((error as { code?: number }).code === 11000 && slug) {
      const existing = await Category.findOne({ slug }).lean();
      if (existing) return NextResponse.json({ success: true, created: false, category: existing });
    }
    console.error('Error creating category:', error);
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}
