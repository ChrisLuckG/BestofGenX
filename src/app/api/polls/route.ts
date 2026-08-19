import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Poll from '@/models/Poll';
import Article from '@/models/Article';
import { cache, CACHE_TTL } from '@/lib/cache';

// GET - List all polls
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const articleId = searchParams.get('articleId');
    const featured = searchParams.get('featured');
    const type = searchParams.get('type'); // 'simple', 'quiz', 'ranking'
    
    // Create cache key based on query params
    const cacheKey = `polls:${status}:${type || 'all'}:${articleId || 'none'}:${featured || 'none'}`;
    
    // Try cache first for simple queries (no articleId filter)
    if (!articleId) {
      const cached = cache.get<any[]>(cacheKey);
      if (cached) {
        return NextResponse.json({ success: true, polls: cached, cached: true });
      }
    }
    
    await dbConnect();
    
    const query: any = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (articleId) {
      query.linkedArticleId = articleId;
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    const polls = await Poll.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    // Batch fetch all related articles in ONE query instead of N queries
    const pollIds = polls.map((p: any) => p._id.toString());
    const linkedArticleIds = polls.map((p: any) => p.linkedArticleId).filter(Boolean);
    
    // Fetch articles that link TO polls OR are linked FROM polls
    const articles = await Article.find({
      $or: [
        { linkedContentId: { $in: pollIds } },
        { _id: { $in: linkedArticleIds } }
      ]
    }).select('_id linkedContentId coverImage').lean();
    
    // Create lookup maps for O(1) access
    const articleByContentId = new Map<string, string>();
    const articleById = new Map<string, string>();
    articles.forEach((a: any) => {
      if (a.linkedContentId && a.coverImage) {
        articleByContentId.set(a.linkedContentId, a.coverImage);
      }
      if (a._id && a.coverImage) {
        articleById.set(a._id.toString(), a.coverImage);
      }
    });
    
    // Enrich polls with article images (no DB calls, just map lookups)
    const enrichedPolls = polls.map((poll: any) => {
      const pollIdStr = poll._id.toString();
      // Try article that links TO this poll first
      if (articleByContentId.has(pollIdStr)) {
        return { ...poll, articleImage: articleByContentId.get(pollIdStr) };
      }
      // Fallback: poll links to article
      if (poll.linkedArticleId && articleById.has(poll.linkedArticleId)) {
        return { ...poll, articleImage: articleById.get(poll.linkedArticleId) };
      }
      return poll;
    });
    
    // Cache the result (2 minutes for polls)
    if (!articleId) {
      cache.set(cacheKey, enrichedPolls, CACHE_TTL.MEDIUM);
    }
    
    return NextResponse.json({ success: true, polls: enrichedPolls });
  } catch (error: any) {
    console.error('Failed to get polls:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new poll
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { title, subtitle, description, image, options, questions, resultTypes, items, type, linkedArticleId, category, status, featured, closesAt } = body;
    
    // For quiz/personality test, we need questions and resultTypes
    if (type === 'quiz') {
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Title required' },
          { status: 400 }
        );
      }
      
      const poll = await Poll.create({
        title,
        subtitle,
        description,
        image,
        type: 'quiz',
        questions: questions || [],
        resultTypes: resultTypes || [],
        totalVotes: 0,
        linkedArticleId: linkedArticleId || undefined,
        category: category || 'personality',
        status: status || 'active',
        featured: featured || false,
        closesAt: closesAt ? new Date(closesAt) : undefined,
      });
      
      return NextResponse.json({ success: true, poll });
    }
    
    // For ranking lists
    if (type === 'ranking') {
      if (!title || !items || items.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Title and at least 2 items required' },
          { status: 400 }
        );
      }
      
      // Process items with IDs
      const processedItems = items.map((item: any, i: number) => ({
        id: item.id || `item_${i}`,
        title: item.title,
        description: item.description || '',
        image: item.image || '',
        upvotes: item.upvotes || 0,
        downvotes: item.downvotes || 0,
        score: (item.upvotes || 0) - (item.downvotes || 0),
      }));
      
      const poll = await Poll.create({
        title,
        subtitle,
        description,
        image,
        type: 'ranking',
        items: processedItems,
        totalVotes: 0,
        linkedArticleId: linkedArticleId || undefined,
        category: category || 'ranking',
        status: status || 'active',
        featured: featured || false,
        closesAt: closesAt ? new Date(closesAt) : undefined,
      });

      // NOTE: Poll and Article are independent entities. Creating a ranking poll
      // does NOT auto-create or link an article. If an article is wanted alongside
      // a poll (e.g. in a campaign), it is created separately with its own ID.

      return NextResponse.json({ success: true, poll });
    }
    
    // Simple poll - needs options
    if (!title || !options || options.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Title and at least 2 options required' },
        { status: 400 }
      );
    }
    
    // Generate IDs for options if not provided
    const processedOptions = options.map((opt: any, i: number) => ({
      id: opt.id || `option_${i}`,
      label: opt.label,
      emoji: opt.emoji,
      votes: 0,
    }));
    
    const poll = await Poll.create({
      title,
      subtitle,
      description,
      image,
      type: 'simple',
      options: processedOptions,
      totalVotes: 0,
      linkedArticleId: linkedArticleId || undefined,
      category: category || 'general',
      status: status || 'active',
      featured: featured || false,
      closesAt: closesAt ? new Date(closesAt) : undefined,
    });
    
    return NextResponse.json({ success: true, poll });
  } catch (error: any) {
    console.error('Failed to create poll:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
