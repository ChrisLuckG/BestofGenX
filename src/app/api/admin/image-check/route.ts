import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDatabase();
    
    const articles = await db.collection('articles').find({}, {
      projection: {
        title: 1,
        status: 1,
        thumbnailUrl: 1,
        // Only first 50 chars of coverImage to detect type
        coverImage: { $substr: ['$coverImage', 0, 80] }
      }
    }).toArray();

    const result = articles.map(a => ({
      id: a._id,
      title: a.title?.substring(0, 30),
      status: a.status,
      thumbnailUrl: a.thumbnailUrl || null,
      coverImageType: !a.coverImage ? 'empty'
        : a.coverImage.startsWith('data:') ? 'base64'
        : a.coverImage.startsWith('http') ? 'url'
        : 'other',
      coverImagePreview: a.coverImage?.substring(0, 80)
    }));

    return NextResponse.json({ articles: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
