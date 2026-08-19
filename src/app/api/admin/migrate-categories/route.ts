import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

/**
 * Migrate old quiz categories to the 5 official ones:
 * - MUSIC
 * - SPORTS
 * - MOVIES (absorbs TV SHOWS, FILM, CULTURE, FASHION, ART, FOOD, CELEBRITIES)
 * - GAMING (absorbs TECHNOLOGY)
 * - POLITIK
 */

const MIGRATION_MAP: Record<string, string> = {
  // Keep as-is
  'MUSIC': 'MUSIC',
  'SPORTS': 'SPORTS',
  'SPORT': 'SPORTS',
  'MOVIES': 'MOVIES',
  'GAMING': 'GAMING',
  'POLITIK': 'POLITIK',
  'POLITICS': 'POLITIK',
  
  // Merge into MOVIES
  'TV SHOWS': 'MOVIES',
  'TV': 'MOVIES',
  'FILM': 'MOVIES',
  'CULTURE': 'MOVIES',
  'FASHION': 'MOVIES',
  'ART': 'MOVIES',
  'FOOD': 'MOVIES',
  'CELEBRITIES': 'MOVIES',
  'GENERAL': 'MOVIES',
  
  // Merge into GAMING
  'TECHNOLOGY': 'GAMING',
  'TECH': 'GAMING',
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { dryRun = true } = await request.json();
    
    // Get current distribution
    const beforeCounts: Record<string, number> = {};
    const allThemes = await Card.distinct('theme');
    for (const theme of allThemes) {
      beforeCounts[theme] = await Card.countDocuments({ theme });
    }
    
    const migrations: { from: string; to: string; count: number }[] = [];
    let totalMigrated = 0;
    
    for (const [oldTheme, newTheme] of Object.entries(MIGRATION_MAP)) {
      if (oldTheme === newTheme) continue; // Skip if same
      
      const count = await Card.countDocuments({ theme: oldTheme });
      if (count === 0) continue;
      
      migrations.push({ from: oldTheme, to: newTheme, count });
      
      if (!dryRun) {
        await Card.updateMany(
          { theme: oldTheme },
          { $set: { theme: newTheme } }
        );
        totalMigrated += count;
      }
    }
    
    // Delete cards with unknown themes
    const unknownThemes = allThemes.filter(t => !MIGRATION_MAP[t]);
    let deletedUnknown = 0;
    
    if (unknownThemes.length > 0) {
      const unknownCount = await Card.countDocuments({ theme: { $in: unknownThemes } });
      if (!dryRun && unknownCount > 0) {
        const result = await Card.deleteMany({ theme: { $in: unknownThemes } });
        deletedUnknown = result.deletedCount;
      }
    }
    
    // Get new distribution
    const afterCounts: Record<string, number> = {};
    if (!dryRun) {
      const newThemes = await Card.distinct('theme');
      for (const theme of newThemes) {
        afterCounts[theme] = await Card.countDocuments({ theme });
      }
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      beforeCounts,
      migrations,
      unknownThemes,
      totalMigrated: dryRun ? migrations.reduce((a, m) => a + m.count, 0) : totalMigrated,
      deletedUnknown,
      afterCounts: dryRun ? 'Run with dryRun=false to see' : afterCounts,
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    
    const themes = await Card.distinct('theme');
    const counts: Record<string, number> = {};
    
    for (const theme of themes) {
      counts[theme] = await Card.countDocuments({ theme });
    }
    
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    
    return NextResponse.json({
      success: true,
      total,
      themes: counts,
      officialCategories: ['MUSIC', 'SPORTS', 'MOVIES', 'GAMING', 'POLITIK'],
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
