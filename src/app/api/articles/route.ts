import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import clientPromise from '@/lib/mongodb';
import Article from '@/models/Article';
import User from '@/models/User';
import Comment from '@/models/Comment';
import Reaction from '@/models/Reaction';
import Menschen from '@/models/Menschen';
import { markMenschCovered } from '@/lib/menschenDb';
import { getAutoFillSlugs } from '@/lib/categories';
import { countryNameToCode } from '@/lib/countryFlags';
import mongoose from 'mongoose';

// Build a map of category-slug -> FIXED-block bannerImage from the saved template, so that
// dedicated banner-pages can display their banner image as a fallback thumbnail/cover.
async function getBannerImageByCategory(): Promise<Record<string, string>> {
  try {
    const client = await clientPromise;
    const db = client.db('sporttock');
    const tmpl = await db.collection('settings').findOne({ key: 'articleTemplate' });
    const items: any[] = tmpl?.items || [];
    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.size !== 12 || !Array.isArray(item.containerBlocks)) continue;
      const fixed = item.containerBlocks.find((b: any) => b.type === 'FIXED' && b.bannerImage);
      if (!fixed?.bannerImage) continue;
      getAutoFillSlugs(item.containerName, item.containerTheme).forEach((c: string) => {
        if (!map[c.toLowerCase()]) map[c.toLowerCase()] = fixed.bannerImage;
      });
    }
    return map;
  } catch {
    return {};
  }
}

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
    
    // MongoDB Free Tier has 32MB sort limit - use index-backed sort on createdAt only
    // Exclude heavy fields first, then sort
    const projection = includeContent ? {} : { content: 0, coverImage: 0, coverImageBase64: 0 };
    const [articles, total] = await Promise.all([
      Article.find(query, projection)
        .sort({ createdAt: -1 })  // Uses _id index implicitly
        .skip(skip)
        .limit(limit)
        .lean(),
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
    // emojiId: null means the user removed their reaction - those documents are
    // kept (to persist the `rewarded` flag) but must not be counted.
    const reactionAggregation = await Reaction.aggregate([
      { $match: { articleId: { $in: articleIds }, emojiId: { $ne: null } } },
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

    // Banner-pages and the Community-Sound page with no own image inherit the FIXED block's
    // banner image (fallback).
    const BANNER_FALLBACK_TYPES = new Set(['banner-page', 'music-community']);
    const hasBannerPage = articles.some((a: any) => BANNER_FALLBACK_TYPES.has(a.contentType));
    const bannerImageByCat = hasBannerPage ? await getBannerImageByCategory() : {};

    // Ensure order field exists; use thumbnailUrl for listings (coverImage excluded from query)
    const articlesWithOrder = articles.map((a: any, i: number) => {
      const reactions = reactionsMap.get(a._id.toString()) || {};
      const totalReactions = Object.values(reactions).reduce((sum: number, count) => sum + (count as number), 0);
      const ownCover = includeContent ? a.coverImage : a.thumbnailUrl;
      const cover = ownCover || (BANNER_FALLBACK_TYPES.has(a.contentType) ? bannerImageByCat[(a.category || '').toLowerCase()] : undefined) || undefined;
      return {
        ...a,
        order: a.order ?? i,
        commentsCount: commentCountMap.get(a._id.toString()) || 0,
        authorAvatar: avatarMap.get(a.author?.toString()) || '',
        // thumbnailUrl is always a small URL, safe to use; banner-pages fall back to banner image
        coverImage: cover,
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
    const { userId, title, subtitle, content, coverImage, category, tags, status, featured, trending, mainCategory } = body;
    let { contentType } = body;

    // Arcade content = gaming/tech sub-categories. Auto-tag them as 'arcade' (like rankrolls
    // carry 'rankroll'), unless an explicit non-article contentType was provided.
    const ARCADE_CATEGORIES = ['gaming', 'tech'];
    const resolvedCategory = category || 'culture';
    if ((!contentType || contentType === 'article') && ARCADE_CATEGORIES.includes(resolvedCategory)) {
      contentType = 'arcade';
    }

    if (!userId || !title || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Handle 'system' as a special case for auto-generated content
    const isSystemUser = userId === 'system';
    let user: any = null;
    let authorId: string | null = null;
    let authorName = 'BOGX Team';
    let authorAvatar = '';
    
    // Check if a specific author is provided (for bot-generated articles)
    // Support both 'authorId' and 'author' for backwards compatibility
    const specificAuthorId = body.authorId || body.author;
    
    if (isSystemUser) {
      // System-generated content - no user verification needed
      authorId = null;
      authorName = 'BOGX Team';
      authorAvatar = '';
    } else if (specificAuthorId) {
      // Specific author provided (e.g., AI reporter) - verify caller is admin
      const caller = await User.findById(userId).select('isAdmin').lean<any>();
      if (!caller?.isAdmin) {
        return NextResponse.json({ success: false, error: 'Unauthorized - admin required to set custom author' }, { status: 403 });
      }
      // Load the specific author's info
      const authorUser = await User.findById(specificAuthorId).select('username displayName avatar').lean<any>();
      if (authorUser) {
        authorId = specificAuthorId;
        authorName = authorUser.displayName || authorUser.username || 'BOGX Team';
        authorAvatar = authorUser.avatar || '';
      } else {
        authorId = specificAuthorId;
        authorName = body.authorName || 'BOGX Team';
        authorAvatar = body.authorAvatar || '';
      }
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

    const personCountryRaw = body.personCountry;
    const personCountryCode = countryNameToCode(personCountryRaw);
    
    // Extract person data for Menschen database
    const { personName, personBirthday, personDeathday, personCauseOfDeath, isRIP } = body;

    const article = await Article.create({
      title,
      subtitle: subtitle || '',
      content,
      coverImage: coverImage || '',
      thumbnailUrl,
      category: resolvedCategory,
      contentType: contentType || 'article',
      mainCategory: mainCategory || 'articles',
      tags: tags || [],
      author: authorId || undefined,
      authorName,
      authorAvatar,
      status: status || 'draft',
      featured: featured || false,
      trending: trending || false,
      publishedAt: status === 'published' ? new Date() : undefined,
      // Person data - stored in article for reference
      personName: personName || undefined,
      personBirthday: personBirthday || undefined,
      personDeathday: personDeathday || undefined,
      personCountry: personCountryRaw || undefined,
      personCountryCode: personCountryCode || undefined,
    });
    
    // Auto-create Menschen entry if person data is provided
    const personCountry = personCountryRaw;
    let menschCreated = false;
    
    if (personName && personBirthday) {
      try {
        // Check if person already exists (by name + birthday)
        const existing = await Menschen.findOne({ name: personName, birthday: personBirthday });
        
        if (existing) {
          // Update existing entry with article link
          await Menschen.findByIdAndUpdate(existing._id, {
            hasArticle: true,
            articleId: article._id,
            articleCreatedAt: new Date(),
            articleCreatedBy: userId,
            // Update deathday if this is a RIP article and we have new info
            ...(isRIP && personDeathday && !existing.deathday ? { deathday: personDeathday, causeOfDeath: personCauseOfDeath } : {}),
          });
          menschCreated = true;
        } else {
          // Create new Menschen entry
          await Menschen.create({
            name: personName,
            birthday: personBirthday,
            deathday: personDeathday || undefined,
            causeOfDeath: personCauseOfDeath || undefined,
            country: personCountry || 'Unknown',
            category: resolvedCategory === 'rip' ? 'unknown' : resolvedCategory,
            profession: '', // Could be extracted from article content later
            isGenX: true,
            description: subtitle || title,
            imageUrl: coverImage || '',
            discoveredBy: authorId || 'system',
            discoveredByName: authorName,
            discoveredAt: new Date(),
            discoveredFor: isRIP ? 'rip' : 'birthday',
            hasArticle: true,
            articleId: article._id,
            articleCreatedAt: new Date(),
            articleCreatedBy: userId,
            isVerified: false,
            isRejected: false,
          });
          menschCreated = true;
        }
      } catch (menschErr: any) {
        // Don't fail article creation if Menschen creation fails (e.g., duplicate key)
        console.error('Menschen creation failed (non-fatal):', menschErr.message);
      }
    }

    // Fallback coverage flag: the block above only runs when BOTH personName and
    // personBirthday are supplied and matches on that exact pair. Newsroom articles
    // built from the Wikidata pool often carry no birthday, so we additionally match
    // by name (or by the name appearing in the headline) and set hasArticle there.
    // This is what stops the same person being proposed again next year.
    if (!menschCreated) {
      menschCreated = await markMenschCovered({
        articleId: article._id.toString(),
        title,
        personName,
        userId,
      });
    }

    return NextResponse.json({ success: true, article, menschCreated });
  } catch (error: unknown) {
    console.error('Failed to create article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
