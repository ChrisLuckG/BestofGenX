import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';

// GET - Get a single battle by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const battle = await Battle.findById(id)
      .populate('creator', 'username avatar country countryFlag points bogxCoins wins gamesPlayed')
      .populate('opponent', 'username avatar country countryFlag points bogxCoins wins gamesPlayed')
      .populate('winner', 'username');
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    // Rank isn't stored on User - compute it live from wallet balance (same as rankings)
    const battleObj = battle.toObject();
    const creator = battleObj.creator as any;
    const opponent = battleObj.opponent as any;
    if (creator?.bogxCoins != null) {
      creator.rank = (await User.countDocuments({ bogxCoins: { $gt: creator.bogxCoins } })) + 1;
    }
    if (opponent?.bogxCoins != null) {
      opponent.rank = (await User.countDocuments({ bogxCoins: { $gt: opponent.bogxCoins } })) + 1;
    }
    
    return NextResponse.json({ success: true, battle: battleObj });
  } catch (error: any) {
    console.error('Failed to get battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Dismiss a declined battle notice from "My Open Battles"
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'dismiss') {
      const battle = await Battle.findByIdAndUpdate(
        id,
        { dismissedByCreator: true },
        { new: true }
      );
      if (!battle) {
        return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
