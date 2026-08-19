import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import GameResult from '@/models/GameResult';
import Card from '@/models/Card';
import mongoose from 'mongoose';

// GET - Calculate category strengths from quiz/battle results
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Get all game results for this user (excluding battle markers and skipped)
    // Note: Solo trivia uses cardId as the Card ObjectId, battles use 'quizzbattle'
    const gameResults = await GameResult.find({
      userId,
      skipped: { $ne: true },
    }).select('cardId isCorrect').lean();

    console.log(`[category-strengths] userId=${userId}, gameResults.length=${gameResults.length}`);
    if (gameResults.length > 0) {
      console.log(`[category-strengths] Sample cardIds:`, gameResults.slice(0, 5).map(r => r.cardId));
    }

    if (gameResults.length === 0) {
      return NextResponse.json({ success: true, strengths: [] });
    }

    // Get unique cardIds (filter out non-ObjectId cardIds like 'trivia-xxx')
    const cardIds = Array.from(new Set(gameResults.map(r => r.cardId)))
      .filter(id => mongoose.Types.ObjectId.isValid(id));

    // Fetch cards to get their themes
    const cards = await Card.find({ _id: { $in: cardIds } })
      .select('_id theme')
      .lean();

    // Create cardId -> theme map
    const cardThemeMap = new Map<string, string>();
    for (const card of cards) {
      cardThemeMap.set(String(card._id), card.theme || 'general');
    }

    // Aggregate by theme
    const themeStats: Record<string, { correct: number; total: number }> = {};
    for (const result of gameResults) {
      const theme = cardThemeMap.get(result.cardId) || 'general';
      if (!themeStats[theme]) {
        themeStats[theme] = { correct: 0, total: 0 };
      }
      themeStats[theme].total += 1;
      if (result.isCorrect) {
        themeStats[theme].correct += 1;
      }
    }

    // Convert to array and calculate percentages
    const results = Object.entries(themeStats).map(([theme, stats]) => ({
      _id: theme,
      total: stats.total,
      correct: stats.correct,
    }));

    // Convert to percentage and format
    const strengths = results
      .filter(r => r._id && r.total > 0)
      .map(r => ({
        name: formatCategoryName(r._id),
        key: r._id,
        correct: r.correct,
        total: r.total,
        pct: Math.round((r.correct / r.total) * 100),
      }))
      .sort((a, b) => b.pct - a.pct); // Sort by percentage descending

    return NextResponse.json({ success: true, strengths });
  } catch (error: any) {
    console.error('Failed to get category strengths:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Format category key to display name
function formatCategoryName(key: string): string {
  if (!key) return 'Unknown';
  // Capitalize first letter, handle common cases
  const map: Record<string, string> = {
    music: 'Music',
    sport: 'Sport',
    film: 'Film',
    movies: 'Film',
    culture: 'Culture',
    history: 'History',
    tv: 'TV',
    gaming: 'Gaming',
    tech: 'Tech',
    science: 'Science',
    general: 'General',
    mixed: 'Mixed',
  };
  return map[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}
