import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Map article category → keywords to match against container NAME (primary) or theme (fallback)
// Container names like "HISTORY", "SPORTS", "RIP" are the primary identifier
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  sports:       ['sport'],
  music:        ['music'],
  'movies-tv':  ['movie', 'cinema', 'tv', 'film'],
  gaming:       ['gaming', 'arcade', 'game'],
  rip:          ['rip', 'memorial', 'obituary'],
  lifestyle:    ['lifestyle', 'living'],
  culture:      ['culture'],
  history:      ['history', 'historical'],
  tech:         ['tech', 'technolog', 'digital'],
  news:         ['news', 'aktuell'],
  'genx-icons': ['icon', 'genx-icon', 'legend'],
};

// Containers that the chief editor curates manually — never auto-place into these
const CHIEF_EDITOR_CONTAINERS = ['article', 'featured', 'top', 'editorial', 'main', 'home'];

function isChiefEditorContainer(item: any): boolean {
  const name = (item.containerName || '').toLowerCase();
  return CHIEF_EDITOR_CONTAINERS.some(k => name.startsWith(k) || name === k);
}

function containerMatchesCategory(item: any, category: string): boolean {
  if (isChiefEditorContainer(item)) return false;
  const keywords = CATEGORY_KEYWORDS[category] || [category.toLowerCase()];
  const name = (item.containerName || '').toLowerCase();
  const theme = (item.containerTheme || '').toLowerCase();
  // Name match is primary (stronger signal)
  if (keywords.some(k => name.includes(k))) return true;
  // Theme match as fallback
  if (keywords.some(k => theme.includes(k))) return true;
  return false;
}

// Titles that suggest repetitive/auto-generated daily content — skip auto-placement
const SKIP_TITLE_PATTERNS = [/daily winner/i, /winner of the day/i, /bogx.*winner/i, /tages.*gewinner/i];

function isRepetitiveArticle(title: string): boolean {
  return SKIP_TITLE_PATTERNS.some(p => p.test(title));
}

// POST - Auto-place a published article into the right template container
// Body: { articleId, category, title?, featured?: boolean }
// featured=true → place in FIRST container (chief editor top slot)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, category, title, featured } = body;

    if (!articleId || !category) {
      return NextResponse.json({ success: false, error: 'Missing articleId or category' }, { status: 400 });
    }

    // Skip repetitive auto-generated content (daily winner etc.)
    if (title && isRepetitiveArticle(title) && !featured) {
      return NextResponse.json({ success: true, placed: false, reason: 'Repetitive content — skipped' });
    }

    const client = await clientPromise;
    const db = client.db('sporttock');

    const templateDoc = await db.collection('settings').findOne({ key: 'articleTemplate' });
    const items: any[] = templateDoc?.items ? JSON.parse(JSON.stringify(templateDoc.items)) : [];

    if (!items.length) {
      return NextResponse.json({ success: true, placed: false, reason: 'Template empty' });
    }

    let placed = false;
    let placedIn = '';

    if (featured) {
      // Place in the FIRST container's first MAIN block (chief editor feature)
      const firstContainer = items.find(i => i.size === 12 && (i.containerBlocks || []).length > 0);
      if (firstContainer) {
        const mainBlock = firstContainer.containerBlocks.find((b: any) => b.type === 'MAIN');
        if (mainBlock) {
          mainBlock.articleId = articleId;
          placed = true;
          placedIn = `featured: ${firstContainer.containerName}`;
        }
      }
    } else {
      // Find matching container by category
      const container = items.find(i => i.size === 12 && containerMatchesCategory(i, category));
      if (container) {
        const mainBlock = container.containerBlocks?.find((b: any) => b.type === 'MAIN');
        if (mainBlock) {
          mainBlock.articleId = articleId;
          placed = true;
          placedIn = container.containerName;
        } else {
          // No MAIN block — prepend to VERTICAL if exists
          const vertBlock = container.containerBlocks?.find((b: any) => b.type === 'VERTICAL' && !b.autoFillCategory);
          if (vertBlock) {
            vertBlock.articles = [articleId, ...(vertBlock.articles || []).filter((id: string) => id !== articleId)].slice(0, 10);
            placed = true;
            placedIn = `${container.containerName} (vertical)`;
          }
        }
      }
    }

    if (placed) {
      await db.collection('settings').updateOne(
        { key: 'articleTemplate' },
        { $set: { items, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true, placed, placedIn });
  } catch (error) {
    console.error('auto-place error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
