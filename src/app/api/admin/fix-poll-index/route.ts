import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';
import Poll from '@/models/Poll';
import PollVote from '@/models/PollVote';
import PollReward from '@/models/PollReward';

// Reset all voting data
export async function GET() {
  try {
    await dbConnect();
    
    // Delete all votes
    const deletedVotes = await PollVote.deleteMany({});
    
    // Delete all rewards
    const deletedRewards = await PollReward.deleteMany({});
    
    // Reset all poll vote counts to 0
    await Poll.updateMany(
      { type: 'ranking' },
      { 
        $set: { 
          totalVotes: 0,
          'items.$[].upvotes': 0,
          'items.$[].downvotes': 0,
          'items.$[].score': 0
        } 
      }
    );
    
    // Also reset simple polls
    await Poll.updateMany(
      { type: { $ne: 'ranking' } },
      { 
        $set: { 
          totalVotes: 0,
          'options.$[].votes': 0
        } 
      }
    );
    
    return NextResponse.json({ 
      success: true, 
      deletedVotes: deletedVotes.deletedCount,
      deletedRewards: deletedRewards.deletedCount,
      message: 'All voting data reset to zero'
    });
  } catch (error: any) {
    console.error('Reset error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
