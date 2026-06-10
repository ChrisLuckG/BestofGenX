import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Comment from '@/models/Comment';
import User from '@/models/User';
import { filterContent, hasSuspiciousPatterns } from '@/lib/contentFilter';

// GET - List comments for an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const comments = await Comment.find({ articleId: id })
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({ 
      success: true, 
      comments,
      count: comments.length 
    });
  } catch (error: unknown) {
    console.error('Failed to fetch comments:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { userId, content } = await request.json();
    
    if (!userId || !content?.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing userId or content' 
      }, { status: 400 });
    }

    // Get user info for the comment
    const user = await User.findById(userId).select('username avatar').lean();
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Filter content - flag for admin review but allow all comments through
    const filterResult = filterContent(content.trim());
    const suspiciousCheck = hasSuspiciousPatterns(content.trim());
    
    // Flag for review but don't block
    const shouldFlag = !filterResult.allowed || filterResult.flagged || suspiciousCheck.suspicious;
    const flagReason = filterResult.flagReason || suspiciousCheck.reason;

    const comment = await Comment.create({
      articleId: id,
      userId,
      userName: user.username || 'Anonymous',
      userAvatar: user.avatar || '',
      content: content.trim(),
      flagged: shouldFlag,
      flagReason: flagReason || undefined,
      hidden: false,
    });
    
    return NextResponse.json({ success: true, comment });
  } catch (error: unknown) {
    console.error('Failed to create comment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE - Delete a comment (own comment or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params; // article id (not used for delete, just route param)
    void id;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const userId = searchParams.get('userId');
    
    if (!commentId || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing commentId or userId' 
      }, { status: 400 });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Check ownership or admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (comment.userId.toString() !== userId && !user?.isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 403 });
    }

    await Comment.findByIdAndDelete(commentId);
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to delete comment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH - Update comment (hide/unhide, unflag)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    void id;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const userId = searchParams.get('userId');
    const body = await request.json();
    
    if (!commentId || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing commentId or userId' 
      }, { status: 400 });
    }

    // Check admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin only' 
      }, { status: 403 });
    }

    const updateData: any = {};
    if (typeof body.hidden === 'boolean') updateData.hidden = body.hidden;
    if (typeof body.flagged === 'boolean') updateData.flagged = body.flagged;
    if (body.flagReason !== undefined) updateData.flagReason = body.flagReason;

    await Comment.findByIdAndUpdate(commentId, updateData);
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to update comment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
