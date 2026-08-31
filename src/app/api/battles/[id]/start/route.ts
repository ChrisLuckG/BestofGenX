import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';

/**
 * POST - Arm a battle for the requesting player.
 *
 * Called when the player presses START on the preparing screen. It only writes a
 * timestamp; the meaning lives in /forfeit, which treats an armed battle as
 * committed and therefore refuses to refund.
 *
 * Marking this server-side (rather than trusting the client at forfeit time) is the
 * point: a player who closes the tab, reloads or calls /forfeit directly must not be
 * able to pretend they never started.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }

    if (battle.status !== 'active' && battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Battle is no longer playable' }, { status: 400 });
    }

    const isCreator = battle.creator.toString() === userId;
    const isOpponent = battle.opponent?.toString() === userId;

    if (!isCreator && !isOpponent) {
      return NextResponse.json({ success: false, error: 'You are not part of this battle' }, { status: 403 });
    }

    // Idempotent: keep the FIRST start time. A reload must not push the timestamp
    // forward, otherwise stale-battle cleanup would never see the real age.
    const field = isCreator ? 'creatorStartedAt' : 'opponentStartedAt';
    if (!battle.get(field)) {
      battle.set(field, new Date());
      await battle.save();
    }

    return NextResponse.json({ success: true, startedAt: battle.get(field) });
  } catch (error: any) {
    console.error('Start battle error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
