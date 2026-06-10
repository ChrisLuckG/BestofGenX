import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Poll from '@/models/Poll';
import Article from '@/models/Article';

// GET - List all polls
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const articleId = searchParams.get('articleId');
    const featured = searchParams.get('featured');
    
    const query: any = {};
    
    if (status !== 'all') {
      query.status = status;
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
    
    // Enrich polls with article images
    const enrichedPolls = await Promise.all(polls.map(async (poll: any) => {
      // Try to find article that links TO this poll (article.linkedContentId = poll._id)
      const articleByContent = await Article.findOne({ linkedContentId: poll._id.toString() }).select('coverImage').lean();
      if (articleByContent?.coverImage) {
        return { ...poll, articleImage: articleByContent.coverImage };
      }
      
      // Fallback: try poll.linkedArticleId (if poll links to article)
      if (poll.linkedArticleId) {
        const article = await Article.findById(poll.linkedArticleId).select('coverImage').lean();
        if (article?.coverImage) {
          return { ...poll, articleImage: article.coverImage };
        }
      }
      return poll;
    }));
    
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
      
      // Auto-create Article entry for this ranking poll
      await Article.create({
        title,
        subtitle: subtitle || description || `Vote for your favorites`,
        content: `<p>${description || 'Cast your vote and see where the community stands.'}</p>`,
        coverImage: image || '',
        contentType: 'rankroll',
        linkedContentId: poll._id.toString(),
        mainCategory: 'voting',
        category: 'culture',
        author: body.authorId || '000000000000000000000000', // System author
        authorName: 'BOGX Team',
        status: 'draft', // Start as draft so admin can position it
        layout: 'standard',
        order: 0,
        featured: false,
        trending: false,
        readTime: 1,
        views: 0,
        likes: 0,
      });
      
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
