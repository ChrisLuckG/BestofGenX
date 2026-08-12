import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';

export async function POST() {
  try {
    await dbConnect();

    // Find all articles with "Unknown" or empty authorName that have an author ID
    const articles = await Article.find({
      $or: [
        { authorName: 'Unknown' },
        { authorName: { $exists: false } },
        { authorName: '' },
      ],
      author: { $exists: true, $ne: null },
    }).select('_id title author authorName');

    const results = [];
    for (const article of articles) {
      const user = await User.findById(article.author).select('displayName username').lean();
      if (user) {
        const newName = (user as any).displayName || (user as any).username || 'BOGX Team';
        await Article.updateOne(
          { _id: article._id },
          { $set: { authorName: newName } }
        );
        results.push({
          title: article.title,
          oldName: article.authorName,
          newName,
        });
      }
    }

    return NextResponse.json({
      success: true,
      fixed: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
