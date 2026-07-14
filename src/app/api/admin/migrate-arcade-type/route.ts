import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';

// GET - Diagnostic: breakdown of articles by category + contentType
export async function GET() {
  try {
    await dbConnect();
    const byCategory = await Article.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const byContentType = await Article.aggregate([
      { $group: { _id: '$contentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return NextResponse.json({ success: true, byCategory, byContentType });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Set contentType='arcade' for all Arcade articles. Arcade content is identified
// by the gaming/tech sub-categories (and the legacy 'arcade' main category).
// Idempotent. Mirrors how rankrolls carry contentType='rankroll'.
export async function POST() {
  try {
    await dbConnect();

    const result = await Article.updateMany(
      {
        $or: [
          { category: { $in: ['gaming', 'tech'] } },
          { mainCategory: 'arcade' },
        ],
        contentType: { $nin: ['arcade', 'rankroll', 'tv', 'radio', 'shop', 'music-community', 'banner-page'] },
      },
      { $set: { contentType: 'arcade' } }
    );

    return NextResponse.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
