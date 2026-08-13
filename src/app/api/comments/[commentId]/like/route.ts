import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Comment from '@/models/Comment';
import CommentLike from '@/models/CommentLike';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';

// POST - Toggle like on comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await dbConnect();
    
    const { commentId } = await params;
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await CommentLike.findOne({ commentId, userId });
    
    if (existingLike) {
      // Unlike
      await CommentLike.deleteOne({ _id: existingLike._id });
      const updated = await Comment.findByIdAndUpdate(
        commentId,
        { $inc: { likes: -1 } },
        { new: true }
      );
      return NextResponse.json({ 
        success: true, 
        liked: false, 
        likes: Math.max(0, updated?.likes || 0) 
      });
    } else {
      // Like
      await CommentLike.create({ commentId, userId });
      const updated = await Comment.findByIdAndUpdate(
        commentId,
        { $inc: { likes: 1 } },
        { new: true }
      );
      
      // Send notification to comment author (if not liking own comment)
      if (comment.userId.toString() !== userId) {
        const liker = await User.findById(userId).select('username avatar').lean();
        const commentAuthor = await User.findById(comment.userId).select('pushSubscription').lean();
        
        // Create in-app notification
        await Notification.create({
          userId: comment.userId,
          type: 'comment_like',
          title: '👍 Someone liked your comment!',
          message: `${liker?.username || 'Someone'} liked your comment: "${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}"`,
          avatar: liker?.avatar,
        });
        
        // Send push notification
        if (commentAuthor?.pushSubscription) {
          try {
            await sendPushNotification(commentAuthor.pushSubscription, {
              title: '👍 Someone liked your comment!',
              body: `${liker?.username || 'Someone'} liked your comment`,
              icon: '/images/genxlogo1.png',
              badge: '/images/genxlogo1.png',
            });
          } catch (e) {
            console.error('Failed to send comment like push:', e);
          }
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        liked: true, 
        likes: updated?.likes || 1 
      });
    }
  } catch (error: unknown) {
    console.error('Failed to toggle comment like:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET - Check if user liked the comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await dbConnect();
    
    const { commentId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: true, liked: false });
    }

    const like = await CommentLike.findOne({ commentId, userId });
    return NextResponse.json({ success: true, liked: !!like });
  } catch (error: unknown) {
    console.error('Failed to check comment like:', error);
    return NextResponse.json({ success: false, liked: false });
  }
}
