import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import ArcadeScore from '@/models/ArcadeScore';
import User from '@/models/User';

// POST - save an arcade game score (for leaderboards)
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { userId, game, score, wave } = body;

    if (!userId || !game || typeof score !== 'number') {
      return NextResponse.json({ error: 'userId, game, and score required' }, { status: 400 });
    }

    const user = await User.findById(userId).select('username avatar');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await ArcadeScore.create({
      userId,
      username: user.username,
      avatar: user.avatar || '/images/default-avatar.png',
      game,
      score,
      wave: wave ?? 1,
    });

    return NextResponse.json({ success: true, id: result._id });
  } catch (error) {
    console.error('Save arcade score error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET - fetch a user's personal best score for a game
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const game = searchParams.get('game') || 'bogx-invaders';

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const best = await ArcadeScore.findOne({ userId, game })
      .sort({ score: -1 })
      .select('score wave')
      .lean() as { score: number; wave: number } | null;

    return NextResponse.json({ highScore: best?.score || 0, wave: best?.wave || 0 });
  } catch (error) {
    console.error('Fetch arcade score error:', error);
    return NextResponse.json({ highScore: 0 });
  }
}
