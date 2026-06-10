import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Battle from '@/models/Battle';

// DELETE - Delete a user and their related data
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const userId = params.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Delete user's game results
    await GameResult.deleteMany({ userId });
    
    // Delete user's battles (where they are creator or opponent)
    await Battle.deleteMany({
      $or: [
        { creator: userId },
        { opponent: userId }
      ]
    });
    
    // Delete the user
    const result = await User.findByIdAndDelete(userId);
    
    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User and related data deleted',
      deletedUser: result.username
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
