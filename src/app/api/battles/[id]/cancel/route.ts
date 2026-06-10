import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';

// POST - Cancel an open battle (refund wager)
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
    
    // Find the battle
    const battle = await Battle.findById(id);
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    // Check if user is the creator
    if (battle.creator.toString() !== userId) {
      return NextResponse.json({ success: false, error: 'Only the creator can cancel this battle' }, { status: 403 });
    }
    
    // Check if battle is still open (no opponent yet)
    if (battle.status !== 'open') {
      return NextResponse.json({ success: false, error: 'Cannot cancel a battle that has already started' }, { status: 400 });
    }
    
    // Refund the wager to creator
    await User.findByIdAndUpdate(userId, {
      $inc: { points: battle.wager }
    });
    
    // Update battle status to cancelled
    battle.status = 'cancelled';
    await battle.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Battle cancelled and wager refunded',
      refunded: battle.wager
    });
    
  } catch (error: any) {
    console.error('Cancel battle error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
