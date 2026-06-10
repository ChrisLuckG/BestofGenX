import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';
import Article from '@/models/Article';
import Poll from '@/models/Poll';
import User from '@/models/User';

/**
 * Internal app usage stats - what your app actually generated.
 * Quiz cards, articles, images, polls, users.
 */
export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Run all counts in parallel
    const [
      totalCards,
      cardsThisMonth,
      cardsLast30,
      cardsLast7,
      totalArticles,
      articlesPublished,
      articlesThisMonth,
      articlesWithCover,
      articlesWithAiCover,
      totalPolls,
      pollsThisMonth,
      totalUsers,
      newUsersThisMonth,
    ] = await Promise.all([
      Card.countDocuments({}),
      Card.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Card.countDocuments({ createdAt: { $gte: last30 } }),
      Card.countDocuments({ createdAt: { $gte: last7 } }),
      Article.countDocuments({}),
      Article.countDocuments({ status: 'published' }),
      Article.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Article.countDocuments({ coverImage: { $exists: true, $ne: '' } }),
      Article.countDocuments({ coverImage: { $regex: 'blob\\.vercel-storage' } }),
      Poll.countDocuments({}),
      Poll.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ isBot: { $ne: true } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth }, isBot: { $ne: true } }),
    ]);

    // Count total quiz questions across all cards
    const questionCountAgg = await Card.aggregate([
      { $project: { questionCount: { $size: { $ifNull: ['$questions', []] } } } },
      { $group: { _id: null, total: { $sum: '$questionCount' } } },
    ]);
    const totalQuestions = questionCountAgg[0]?.total || 0;

    // Count card images (preview + player) — only those with non-empty URLs
    const cardImagesAgg = await Card.aggregate([
      {
        $project: {
          previewImage: { $cond: [{ $and: [{ $ne: ['$previewImage', ''] }, { $ne: ['$previewImage', null] }] }, 1, 0] },
          playerImage: { $cond: [{ $and: [{ $ne: ['$playerImage', ''] }, { $ne: ['$playerImage', null] }] }, 1, 0] },
        },
      },
      {
        $group: {
          _id: null,
          previewImages: { $sum: '$previewImage' },
          playerImages: { $sum: '$playerImage' },
        },
      },
    ]);
    const previewImages = cardImagesAgg[0]?.previewImages || 0;
    const playerImages = cardImagesAgg[0]?.playerImages || 0;
    const totalCardImages = previewImages + playerImages;
    const totalImages = totalCardImages + articlesWithCover;

    return NextResponse.json({
      success: true,
      generated: 'now',
      stats: {
        cards: {
          total: totalCards,
          thisMonth: cardsThisMonth,
          last30Days: cardsLast30,
          last7Days: cardsLast7,
          totalQuestions,
        },
        articles: {
          total: totalArticles,
          published: articlesPublished,
          thisMonth: articlesThisMonth,
          withCover: articlesWithCover,
          aiGeneratedCovers: articlesWithAiCover,
        },
        images: {
          total: totalImages,
          cardPreview: previewImages,
          cardPlayer: playerImages,
          articleCover: articlesWithCover,
        },
        polls: {
          total: totalPolls,
          thisMonth: pollsThisMonth,
        },
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
        },
      },
    });
  } catch (error: any) {
    console.error('App usage stats error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch app usage stats',
    }, { status: 500 });
  }
}
