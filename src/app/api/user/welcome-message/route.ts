import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Personalized welcome data for the welcome-back screen.
// Returns the current ranking position and how it changed since the user
// last saw this screen (so we can say "you fell from X to Y").
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const user = await User.findById(userId).select(
      'points lastSeenRank lastSeenRankAt pushSubscription notifyEmail notifySms'
    );

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Current rank = number of users with strictly more points + 1
    const higherRanked = await User.countDocuments({ points: { $gt: user.points } });
    const currentRank = higherRanked + 1;

    const previousRank: number | null =
      typeof user.lastSeenRank === 'number' ? user.lastSeenRank : null;

    // Determine direction of change
    let rankChange: { from: number; to: number; direction: 'up' | 'down' | 'same' } | null = null;
    if (previousRank !== null && previousRank !== currentRank) {
      rankChange = {
        from: previousRank,
        to: currentRank,
        // Lower rank number is better, so a HIGHER number means we dropped
        direction: currentRank > previousRank ? 'down' : 'up',
      };
    }

    const notificationsEnabled = Boolean(user.pushSubscription) || user.notifyEmail === true || user.notifySms === true;

    // Persist the rank the user just saw so next time we can compare again
    user.lastSeenRank = currentRank;
    user.lastSeenRankAt = new Date();
    await user.save();

    return NextResponse.json({
      success: true,
      showWelcome: true,
      title: null, // Frontend provides personalized fallback
      message: null,
      currentRank,
      previousRank,
      rankChange,
      notificationsEnabled,
    });
  } catch (error: any) {
    console.error('Failed to get welcome message:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
