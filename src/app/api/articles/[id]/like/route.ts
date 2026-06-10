import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import ArticleLike from '@/models/ArticleLike';

// POST - Toggle like on article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Check if already liked
    const existingLike = await ArticleLike.findOne({ articleId: id, userId });
    
    if (existingLike) {
      // Unlike
      await ArticleLike.deleteOne({ _id: existingLike._id });
      const article = await Article.findByIdAndUpdate(
        id,
        { $inc: { likes: -1 } },
        { new: true }
      );
      return NextResponse.json({ 
        success: true, 
        liked: false, 
        likes: Math.max(0, article?.likes || 0) 
      });
    } else {
      // Like
      await ArticleLike.create({ articleId: id, userId });
      const article = await Article.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true }
      );
      return NextResponse.json({ 
        success: true, 
        liked: true, 
        likes: article?.likes || 1 
      });
    }
  } catch (error: unknown) {
    console.error('Failed to toggle like:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET - Check if user liked the article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: true, liked: false });
    }

    const like = await ArticleLike.findOne({ articleId: id, userId });
    return NextResponse.json({ success: true, liked: !!like });
  } catch (error: unknown) {
    console.error('Failed to check like:', error);
    return NextResponse.json({ success: false, liked: false });
  }
}
