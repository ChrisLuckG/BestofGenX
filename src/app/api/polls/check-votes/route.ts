import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PollVote from '@/models/PollVote';

// GET - Check which polls a user has voted on
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const pollIds = searchParams.get('pollIds');

    if (!userId || !pollIds) {
      return NextResponse.json(
        { success: false, error: 'userId and pollIds required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const pollIdArray = pollIds.split(',').filter(Boolean);
    
    // Find all votes by this user for the given polls
    // Votes are stored with oderId: `user_${userId}`
    const votes = await PollVote.find({
      pollId: { $in: pollIdArray },
      oderId: `user_${userId}`
    }).select('pollId').lean();

    // Count votes per poll (for ranking polls, user can vote on multiple items)
    const voteCountByPoll: Record<string, number> = {};
    votes.forEach((v: any) => {
      const pollId = v.pollId.toString();
      voteCountByPoll[pollId] = (voteCountByPoll[pollId] || 0) + 1;
    });

    // Get unique poll IDs
    const votedPollIds = Object.keys(voteCountByPoll);

    return NextResponse.json({
      success: true,
      votedPollIds,
      voteCountByPoll // { pollId: numberOfVotes }
    });
  } catch (error) {
    console.error('Check votes error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check votes' },
      { status: 500 }
    );
  }
}
