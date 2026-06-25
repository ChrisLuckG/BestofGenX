import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';
import Comment from '@/models/Comment';
import mongoose from 'mongoose';

// Reaction model (same as in react/route.ts)
const ReactionSchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emojiId: { type: String, required: true },
}, { timestamps: true });
ReactionSchema.index({ articleId: 1, userId: 1 }, { unique: true });
const Reaction = mongoose.models.Reaction || mongoose.model('Reaction', ReactionSchema);

// GET - List articles (public: published only, admin: all)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // draft, published, archived, all
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const trending = searchParams.get('trending');
    const layout = searchParams.get('layout'); // featured, trending, standard
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const adminMode = searchParams.get('admin') === 'true';
    
    // Build query
    const query: Record<string, unknown> = {};
    
    if (adminMode) {
      // Admin can see all statuses
      if (status && status !== 'all') {
        query.status = status;
      }
    } else {
      // Public only sees published
      query.status = 'published';
    }
    
    if (category) query.category = category;
    if (featured === 'true') query.featured = true;
    if (trending === 'true') query.trending = true;
    if (layout) query.layout = layout;
    
    // Special mode: return just personRef mapping for MenschenTab
    if (searchParams.get('personRefs') === 'true') {
      const refs = await Article.find(
        { personRef: { $exists: true, $ne: null } },
        { personRef: 1, title: 1, createdAt: 1 }
      ).lean();
      return NextResponse.json({ success: true, data: refs });
    }

    // Filter by contentType (article, rankroll, shop, arcade)
    const contentType = searchParams.get('contentType');
    if (contentType) query.contentType = contentType;
    
    // Filter by mainCategory (articles, shop, arcade, voting)
    const mainCategory = searchParams.get('mainCategory');
    if (mainCategory) query.mainCategory = mainCategory;
    
    // Filter by linkedContentId (for finding article linked to a poll)
    const linkedContentId = searchParams.get('linkedContentId');
    if (linkedContentId) query.linkedContentId = linkedContentId;
    
    // Filter by author name
    const author = searchParams.get('author');
    if (author) query.authorName = author;
    
    const skip = (page - 1) * limit;
    
    // For listing, exclude heavy fields - content can be huge (base64 images etc.)
    // Use ?includeContent=true only when opening a single article
    const includeContent = searchParams.get('includeContent') === 'true';
    const projection = includeContent ? {} : { content: 0, coverImageBase64: 0 };
    
    // Sort: archived articles go to bottom, then by order, then by date
    // Use aggregation to add a sortPriority field (archived = 1, others = 0)
    const [articles, total] = await Promise.all([
      Article.aggregate([
        { $match: query },
        { 
          $addFields: { 
            sortPriority: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } 
          } 
        },
        { $sort: { sortPriority: 1, order: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        ...(includeContent ? [] : [{ $project: { content: 0, coverImage: 0 } }])
      ]),
      Article.countDocuments(query)
    ]);
    
    // Get comment counts for all articles in one query
    const articleIds = articles.map((a: any) => a._id);
    const commentCounts = await Comment.aggregate([
      { $match: { articleId: { $in: articleIds } } },
      { $group: { _id: '$articleId', count: { $sum: 1 } } }
    ]);
    const commentCountMap = new Map(
      commentCounts.map(c => [c._id.toString(), c.count])
    );

    // Get reaction counts per article (grouped by emojiId)
    const reactionAggregation = await Reaction.aggregate([
      { $match: { articleId: { $in: articleIds } } },
      { $group: { _id: { articleId: '$articleId', emojiId: '$emojiId' }, count: { $sum: 1 } } }
    ]);
    const reactionsMap = new Map<string, Record<string, number>>();
    for (const r of reactionAggregation) {
      const artId = r._id.articleId.toString();
      if (!reactionsMap.has(artId)) {
        reactionsMap.set(artId, {});
      }
      reactionsMap.get(artId)![r._id.emojiId] = r.count;
    }

    // ALWAYS load avatar from User model (ignore stored authorAvatar)
    const authorIds = Array.from(new Set(articles.map((a: any) => a.author?.toString()).filter(Boolean)));
    let avatarMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const users = await User.find({ _id: { $in: authorIds } })
        .select('avatar')
        .lean();
      avatarMap = new Map(users.map((u: any) => [u._id.toString(), u.avatar || '']));
    }

    // Ensure order field exists; use thumbnailUrl for listings (coverImage excluded from query)
    const articlesWithOrder = articles.map((a: any, i: number) => {
      const reactions = reactionsMap.get(a._id.toString()) || {};
      const totalReactions = Object.values(reactions).reduce((sum: number, count) => sum + (count as number), 0);
      return {
        ...a,
        order: a.order ?? i,
        commentsCount: commentCountMap.get(a._id.toString()) || 0,
        authorAvatar: avatarMap.get(a.author?.toString()) || '',
        // thumbnailUrl is always a small URL, safe to use
        coverImage: includeContent ? a.coverImage : (a.thumbnailUrl || undefined),
        // Reaction data
        reactions,
        totalReactions,
      };
    });
    
    return NextResponse.json({
      success: true,
      articles: articlesWithOrder,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: unknown) {
    console.error('Failed to fetch articles:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Create new article (admin only)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { userId, title, subtitle, content, coverImage, category, tags, status, featured, trending } = body;
    
    if (!userId || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Handle 'system' as a special case for auto-generated content
    const isSystemUser = userId === 'system';
    let user: any = null;
    let authorId: string | null = null;
    let authorName = 'BOGX Team';
    let authorAvatar = '';
    
    if (isSystemUser) {
      // System-generated content - no user verification needed
      authorId = null;
      authorName = 'BOGX Team';
      authorAvatar = '';
    } else {
      // Verify user is admin OR author
      user = await User.findById(userId).select('isAdmin isAuthor username displayName avatar').lean<any>();
      if (!user?.isAdmin && !user?.isAuthor) {
        return NextResponse.json({ success: false, error: 'Unauthorized - admin or author role required' }, { status: 403 });
      }
      authorId = userId;
      authorName = user.displayName || user.username || 'BOGX Team';
      authorAvatar = user.avatar || '';
    }
    
    // Auto-set thumbnailUrl if coverImage is a URL (not base64)
    const thumbnailUrl = coverImage?.startsWith('http') ? coverImage : '';

    const article = await Article.create({
      title,
      subtitle: subtitle || '',
      content,
      coverImage: coverImage || '',
      thumbnailUrl,
      category: category || 'culture',
      tags: tags || [],
      author: authorId || undefined,
      authorName,
      authorAvatar,
      status: status || 'draft',
      featured: featured || false,
      trending: trending || false,
      publishedAt: status === 'published' ? new Date() : undefined,
    });
    
    return NextResponse.json({ success: true, article });
  } catch (error: unknown) {
    console.error('Failed to create article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
