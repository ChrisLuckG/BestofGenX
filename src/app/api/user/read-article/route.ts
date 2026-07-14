import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { DEFAULT_CURRENCY_CONFIG } from '@/models/CurrencyConfig';
import { awardBogx } from '@/lib/awardBogx';

const READ_ARTICLE_REWARD = DEFAULT_CURRENCY_CONFIG.readArticle; // 0.05 BOGX

export async function POST(request: NextRequest) {
  try {
    const { userId, articleId } = await request.json();
    
    if (!userId || !articleId) {
      return NextResponse.json({ error: 'userId and articleId required' }, { status: 400 });
    }

    await dbConnect();

    // Check if user already read this article
    const user = await User.findById(userId).select('readArticles');
    const alreadyRead = user?.readArticles?.includes(articleId);
    
    if (alreadyRead) {
      // Already read - no reward
      return NextResponse.json({ success: true, rewarded: false, alreadyRead: true });
    }

    // Mark article as read
    await User.findByIdAndUpdate(userId, { $addToSet: { readArticles: articleId } });

    // Award BOGX via the central helper: credits the wallet AND creates a
    // GameResult entry so this counts in the day/month/year rankings.
    await awardBogx({ userId, amount: READ_ARTICLE_REWARD, source: 'article', description: 'Read article' });

    return NextResponse.json({ 
      success: true, 
      rewarded: true, 
      amount: READ_ARTICLE_REWARD 
    });
  } catch (error) {
    console.error('Error saving read article:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ readArticles: [] });
    }

    await dbConnect();

    const user = await User.findById(userId).select('readArticles');
    
    return NextResponse.json({ 
      readArticles: user?.readArticles || [] 
    });
  } catch (error) {
    console.error('Error fetching read articles:', error);
    return NextResponse.json({ readArticles: [] });
  }
}
