import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

export async function GET() {
  try {
    await dbConnect();
    
    // Get distinct themes from active cards
    const themes = await Card.distinct('theme', { active: true });
    
    // Count actual questions per theme (each card has multiple question variants)
    const counts = await Card.aggregate([
      { $match: { active: true } },
      { 
        $group: { 
          _id: '$theme', 
          cardCount: { $sum: 1 },
          // Count total questions across all cards (sum of questions array length)
          questionCount: { $sum: { $size: { $ifNull: ['$questions', []] } } }
        } 
      }
    ]);
    
    // Return question counts (not card counts)
    const countMap = new Map(counts.map((c: any) => [c._id, c.questionCount]));
    
    return NextResponse.json({ 
      success: true, 
      themes: themes.filter(Boolean),
      counts: Object.fromEntries(countMap)
    });

  } catch (error: any) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
