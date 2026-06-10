import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendNotificationEmails } from '@/lib/email';

// POST: Send notification emails to all subscribed users
export async function POST(request: Request) {
  try {
    const { type, secret } = await request.json();
    
    // Simple secret check for cron job security
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!['new_match', '1h_reminder', 'results'].includes(type)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }
    
    await dbConnect();
    
    // Find users with email notifications enabled
    const users = await User.find({
      notifyEmail: true,
      email: { $exists: true, $ne: '' },
      isBot: { $ne: true }
    }).select('email username').lean();
    
    if (users.length === 0) {
      return NextResponse.json({ message: 'No users to notify', count: 0 });
    }
    
    // Send emails
    const results = await sendNotificationEmails(
      type,
      users.map(u => ({ email: u.email, username: u.username }))
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      message: `Sent ${successful} emails, ${failed} failed`,
      successful,
      failed,
      total: users.length
    });
  } catch (error) {
    console.error('Send notification emails error:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
