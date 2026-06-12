import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Poll from '@/models/Poll';
import PollVote from '@/models/PollVote';
import PollReward from '@/models/PollReward';

// DANGEROUS: Reset all voting data - ONLY via POST with confirmation
// GET is disabled to prevent accidental deletion
export async function GET() {
  return NextResponse.json({ 
    success: false, 
    error: 'This endpoint requires POST with confirm=RESET_ALL_VOTES parameter. This action is IRREVERSIBLE!' 
  }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Require explicit confirmation
    if (body.confirm !== 'RESET_ALL_VOTES') {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing confirmation. Send { "confirm": "RESET_ALL_VOTES" } to proceed. WARNING: This deletes ALL votes permanently!' 
      }, { status: 400 });
    }
    
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
