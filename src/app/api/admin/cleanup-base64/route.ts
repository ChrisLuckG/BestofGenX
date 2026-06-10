import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// POST - Remove base64 images from articles (they cause slow loading)
export async function POST() {
  try {
    const db = await getDatabase();
    
    // Find all articles with base64 coverImage (starts with "data:")
    const base64Articles = await db.collection('articles').find(
      { coverImage: { $regex: /^data:/ } },
      { projection: { _id: 1, title: 1 } }
    ).toArray();

    if (base64Articles.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No base64 images found - all articles are clean!',
        cleaned: 0
      });
    }

    // Clear the base64 coverImage field for these articles
    const result = await db.collection('articles').updateMany(
      { coverImage: { $regex: /^data:/ } },
      { $set: { coverImage: '', thumbnailUrl: '' } }
    );

    const titles = base64Articles.map(a => a.title).join(', ');

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned ${result.modifiedCount} articles with base64 images. You need to re-upload images for: ${titles}`,
      cleaned: result.modifiedCount,
      articles: base64Articles.map(a => a.title)
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET - Just check how many base64 images exist
export async function GET() {
  try {
    const db = await getDatabase();
    
    const base64Articles = await db.collection('articles').find(
      { coverImage: { $regex: /^data:/ } },
      { projection: { _id: 1, title: 1 } }
    ).toArray();

    return NextResponse.json({ 
      success: true,
      count: base64Articles.length,
      articles: base64Articles.map(a => ({ id: a._id, title: a.title }))
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
