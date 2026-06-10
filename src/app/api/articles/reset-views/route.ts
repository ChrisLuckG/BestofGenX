import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import ArticleView from '@/models/ArticleView';
import User from '@/models/User';

// POST - Reset all article views to 0 (admin only)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Verify admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Reset all views
    const result = await Article.updateMany({}, { $set: { views: 0 } });
    
    // Clear view tracking
    await ArticleView.deleteMany({});

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${result.modifiedCount} articles`,
    });
  } catch (error: unknown) {
    console.error('Failed to reset views:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
