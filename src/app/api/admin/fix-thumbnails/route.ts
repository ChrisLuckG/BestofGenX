import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function POST() {
  try {
    const db = await getDatabase();
    
    // Only fetch articles where coverImage starts with 'http' - these are small URL strings, not base64
    // This regex filter runs on MongoDB side, so base64 articles are never transferred
    const urlArticles = await db.collection('articles').find(
      { coverImage: { $regex: /^https?:\/\// } },
      { projection: { _id: 1, title: 1, coverImage: 1 } }
    ).toArray();

    // Bulk update thumbnailUrl for all URL-based articles
    const bulkOps = urlArticles.map(a => ({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { thumbnailUrl: a.coverImage } }
      }
    }));

    let updated = 0;
    if (bulkOps.length > 0) {
      const result = await db.collection('articles').bulkWrite(bulkOps);
      updated = result.modifiedCount;
    }

    return NextResponse.json({ 
      success: true, 
      updated,
      total: urlArticles.length,
      message: `Set thumbnailUrl for ${updated}/${urlArticles.length} articles`
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
