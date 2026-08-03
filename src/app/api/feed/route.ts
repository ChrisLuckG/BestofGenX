import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import Poll from '@/models/Poll';
import TVVideo from '@/models/TVVideo';

interface FeedItem {
  _id: string;
  type: 'article' | 'rankroll' | 'tv' | 'radio' | 'arcade' | 'shop';
  linkedContentId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  imagePosX?: number;
  imagePosY?: number;
  createdAt: Date;
  order: number;
  category?: string;
  totalVotes?: number;
  itemCount?: number;
  duration?: string;
  youtubeId?: string;
  price?: number;
  playlistId?: string;
}

export async function GET() {
  try {
    await dbConnect();

    // Fetch all published articles (includes all content types now)
    const articles = await Article.find({ status: 'published' })
      .sort({ order: 1, publishedAt: -1 })
      .limit(50)
      .lean();

    const feedItems: FeedItem[] = [];

    for (const article of articles) {
      const contentType = (article.contentType as string) || 'article';
      const mainCategory = (article.mainCategory as string) || 'articles';
      
      // Determine feed type based on mainCategory first, then contentType
      let feedType: FeedItem['type'] = 'article';
      if (mainCategory === 'shop') {
        feedType = 'shop';
      } else if (mainCategory === 'arcade') {
        feedType = 'arcade';
      } else if (mainCategory === 'voting' || contentType === 'rankroll') {
        feedType = 'rankroll';
      } else if (contentType === 'tv') {
        feedType = 'tv';
      }
      
      // Base feed item from article
      const feedItem: FeedItem = {
        _id: String(article._id),
        type: feedType,
        linkedContentId: article.linkedContentId,
        title: article.title,
        subtitle: article.subtitle,
        image: article.coverImage,
        imagePosX: article.imagePosX,
        imagePosY: article.imagePosY,
        createdAt: article.publishedAt || article.createdAt || new Date(),
        order: article.order || 0,
        category: article.category,
      };

      // Enrich with linked content data
      if (contentType === 'rankroll' && article.linkedContentId) {
        const poll = await Poll.findById(article.linkedContentId).lean();
        if (poll) {
          feedItem.totalVotes = poll.totalVotes || 0;
          feedItem.itemCount = poll.items?.length || 0;
          feedItem.description = poll.description;
          // Image comes from article.coverImage (already set above)
        }
      } else if (contentType === 'tv' && article.linkedContentId) {
        const video = await TVVideo.findById(article.linkedContentId).lean();
        if (video) {
          feedItem.duration = video.duration;
          feedItem.youtubeId = video.youtubeId;
          if (!feedItem.image && video.youtubeId) {
            feedItem.image = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
          }
        }
      }

      feedItems.push(feedItem);
    }

    return NextResponse.json({
      success: true,
      items: feedItems,
    });
  } catch (error: any) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
