import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';

export async function POST() {
  try {
    await dbConnect();

    // Find all articles where coverImage is a URL (starts with http)
    const articles = await Article.find({
      coverImage: { $regex: /^https?:\/\// }
    }).select('_id coverImage thumbnailUrl');

    console.log(`Found ${articles.length} articles with URL-based coverImages`);

    let updated = 0;
    for (const article of articles) {
      if (!article.thumbnailUrl && article.coverImage?.startsWith('http')) {
        await Article.updateOne(
          { _id: article._id },
          { $set: { thumbnailUrl: article.coverImage } }
        );
        updated++;
      }
    }

    // Also count articles with base64 images
    const base64Count = await Article.countDocuments({
      coverImage: { $regex: /^data:/ }
    });

    return NextResponse.json({
      success: true,
      message: `Migrated ${updated} articles. ${base64Count} articles still have base64 images.`,
      urlCount: articles.length,
      base64Count,
      updated
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
