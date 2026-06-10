import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';
import ArticleView from '@/models/ArticleView';
import crypto from 'crypto';

// Helper to parse user agent
function parseUserAgent(ua: string) {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  return { device, browser, os };
}

// GET - Get single article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const incrementViews = searchParams.get('view') === 'true';
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    
    const article = await Article.findById(id).lean();
    
    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
    }
    
    // Award coins and mark as read - based on user.readArticles (not ArticleView)
    let pointsAwarded = 0;
    if (incrementViews && article.status === 'published' && userId) {
      // Check if user has already read this article (in their readArticles array)
      const userDoc = await User.findById(userId).select('readArticles').lean();
      const alreadyInReadArticles = userDoc?.readArticles?.includes(id);
      
      if (!alreadyInReadArticles) {
        // First time reading - award coins!
        pointsAwarded = 5;
        await User.findByIdAndUpdate(userId, { 
          $inc: { points: pointsAwarded, bogxCoins: 0.05 },
          $addToSet: { readArticles: id }
        });
        
        // Credit the author with earnings (0.01 BOGX per read)
        if (article.authorId) {
          await User.findByIdAndUpdate(article.authorId, { 
            $inc: { authorEarnings: 0.01 } 
          });
        }
        
        console.log(`User ${userId} read article ${id} - awarded ${pointsAwarded} points`);
      }
    }
    
    // Track view for ALL users (logged in or anonymous) with analytics
    if (incrementViews && article.status === 'published') {
      try {
        // Get IP and geo data
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        const userAgent = request.headers.get('user-agent') || '';
        const referrer = request.headers.get('referer') || '';
        const { device, browser, os } = parseUserAgent(userAgent);
        
        // Get geo data from IP (using Vercel's geo headers first, then fallback to API)
        let country = 'Unknown', city = 'Unknown', region = 'Unknown';
        
        // Try Vercel's built-in geo headers first (most reliable)
        const vercelCountry = request.headers.get('x-vercel-ip-country');
        const vercelCity = request.headers.get('x-vercel-ip-city');
        const vercelRegion = request.headers.get('x-vercel-ip-country-region');
        
        if (vercelCountry) {
          country = vercelCountry;
          city = vercelCity ? decodeURIComponent(vercelCity) : 'Unknown';
          region = vercelRegion || 'Unknown';
        } else if (ip && ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1') {
          // Fallback to ip-api.com
          try {
            const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName`, { 
              signal: AbortSignal.timeout(2000) 
            });
            if (geoRes.ok) {
              const geo = await geoRes.json();
              country = geo.country || 'Unknown';
              city = geo.city || 'Unknown';
              region = geo.regionName || 'Unknown';
            }
          } catch {
            // Geo lookup failed, continue without it
          }
        }
        
        // Create view record
        const viewSessionId = sessionId || crypto.randomUUID();
        await ArticleView.create({ 
          articleId: id, 
          userId: userId || null,
          ip: ip.substring(0, 45), // Truncate for privacy
          country,
          city,
          region,
          device,
          browser,
          os,
          referrer: referrer.substring(0, 500),
          sessionId: viewSessionId
        });
        await Article.findByIdAndUpdate(id, { $inc: { views: 1 } });
      } catch (e: any) {
        // Duplicate view (same session) is fine
        if (e.code !== 11000) {
          console.error('View tracking error:', e);
        }
      }
    }
    
    return NextResponse.json({ success: true, article, pointsAwarded });
  } catch (error: unknown) {
    console.error('Failed to fetch article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT - Update article (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const body = await request.json();
    const { userId, ...updates } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Verify user is admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    
    // If publishing for first time, set publishedAt
    if (updates.status === 'published') {
      const existing = await Article.findById(id).select('publishedAt').lean();
      if (!existing?.publishedAt) {
        updates.publishedAt = new Date();
      }
    }

    // Auto-set thumbnailUrl if coverImage is a URL (not base64)
    if (updates.coverImage !== undefined) {
      updates.thumbnailUrl = updates.coverImage?.startsWith('http') ? updates.coverImage : '';
      // If coverImage is base64, clear it to save space (thumbnailUrl will be empty, user should re-upload)
      if (updates.coverImage?.startsWith('data:')) {
        console.log('Warning: Article has base64 coverImage, this causes slow loading');
      }
    }
    
    const article = await Article.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();
    
    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, article });
  } catch (error: unknown) {
    console.error('Failed to update article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE - Delete article (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Verify user is admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    
    const article = await Article.findByIdAndDelete(id);
    
    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Article deleted' });
  } catch (error: unknown) {
    console.error('Failed to delete article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
