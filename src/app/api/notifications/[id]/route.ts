import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';
import User from '@/models/User';
import { WELCOME_NOTIFICATION_ID } from '@/lib/welcomeNotification';

// DELETE - Delete/dismiss a notification permanently
// Supports both DB notifications (notif-xxx) and virtual notifications (battle-result-xxx, prediction-result-xxx)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing notification ID' }, { status: 400 });
    }
    
    console.log('[DELETE NOTIFICATION]', id, 'userId:', userId);
    
    // Check if this is a virtual notification (battle-result, battle-active)
    // These are not stored in Notification collection, they're generated from Battles
    // We need to add them to user's dismissedNotifications array
    const isVirtualNotification = id.startsWith('battle-result-') || 
                                   id.startsWith('battle-active-') || 
                                   id === WELCOME_NOTIFICATION_ID;
    
    if (isVirtualNotification) {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Missing userId for virtual notification' }, { status: 400 });
      }
      
      // Add to user's dismissedNotifications array
      await User.findByIdAndUpdate(userId, {
        $addToSet: { dismissedNotifications: id }
      });
      
      console.log('[DELETE NOTIFICATION] Added virtual notification to dismissedNotifications:', id);
      return NextResponse.json({ success: true, message: 'Notification dismissed' });
    }
    
    // For DB notifications (notif-xxx prefix), delete from Notification collection
    const mongoId = id.startsWith('notif-') ? id.replace('notif-', '') : id;
    const result = await Notification.findByIdAndDelete(mongoId);
    
    console.log('[DELETE NOTIFICATION] result:', result ? 'deleted' : 'not found');
    
    if (!result) {
      // If not found in DB, still try to add to dismissedNotifications as fallback
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          $addToSet: { dismissedNotifications: id }
        });
        return NextResponse.json({ success: true, message: 'Notification dismissed (fallback)' });
      }
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Failed to delete notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
