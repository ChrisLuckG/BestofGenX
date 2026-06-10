import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const { userId, articleId } = await request.json();
    
    if (!userId || !articleId) {
      return NextResponse.json({ error: 'userId and articleId required' }, { status: 400 });
    }

    await dbConnect();

    // Add article to readArticles array (only if not already there)
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { readArticles: articleId } }
    );

    return NextResponse.json({ success: true });
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
