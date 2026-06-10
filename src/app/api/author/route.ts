import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

/**
 * Public endpoint to fetch author info (display name, bio, avatar, social links).
 * Lookup is done by displayName OR username (since articles store authorName which can be either).
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    // Try matching displayName first, then username (case-insensitive exact match)
    const user = await User.findOne({
      $or: [
        { displayName: name },
        { username: name },
      ],
    })
      .select('username displayName avatar bio socialLinks isAuthor isAdmin')
      .lean<any>();

    if (!user) {
      return NextResponse.json({ success: true, author: null });
    }

    return NextResponse.json({
      success: true,
      author: {
        name: user.displayName || user.username,
        username: user.username,
        avatar: user.avatar || '',
        bio: user.bio || '',
        socialLinks: user.socialLinks || {},
        isAuthor: !!user.isAuthor,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (error: any) {
    console.error('Author lookup error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch author' }, { status: 500 });
  }
}
