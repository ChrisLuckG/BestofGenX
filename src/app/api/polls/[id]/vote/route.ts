import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Poll from '@/models/Poll';
import PollVote from '@/models/PollVote';
import PollReward from '@/models/PollReward';
import User from '@/models/User';
import { awardBogx } from '@/lib/awardBogx';

// POST - Vote on a poll
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id: pollId } = await params;
    const body = await request.json();
    const { optionId, userId, visitorId, voteType } = body;
    
    console.log('Vote request:', { pollId, optionId, userId, visitorId, voteType });
    
    if (!optionId) {
      return NextResponse.json(
        { success: false, error: 'Option ID required' },
        { status: 400 }
      );
    }
    
    // Require login for ranking votes - no anonymous voting
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Login required to vote', requiresLogin: true },
        { status: 401 }
      );
    }
    
    const poll = await Poll.findById(pollId);
    
    if (!poll) {
      return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
    }
    
    if (poll.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Poll is closed' }, { status: 400 });
    }
    
    // Handle ranking list votes (up/down)
    if (poll.type === 'ranking') {
      if (!voteType || !['up', 'down'].includes(voteType)) {
        return NextResponse.json(
          { success: false, error: 'Vote type (up/down) required for ranking lists' },
          { status: 400 }
        );
      }
      
      // Check if item exists
      const itemIds = poll.items?.map((item: any) => item.id);
      console.log('Poll items:', itemIds, 'Looking for:', optionId);
      const itemExists = poll.items?.some((item: any) => item.id === optionId);
      if (!itemExists) {
        return NextResponse.json({ success: false, error: 'Invalid item', availableItems: itemIds }, { status: 400 });
      }
      
      // Check if already voted on this item
      const existingVote = await PollVote.findOne({
        pollId: pollId,
        optionId,
        oderId: `user_${userId}`,
      });
      
      let coinsAwarded = 0;
      let action = 'added';
      
      if (existingVote) {
        // Already voted - check if changing vote direction
        if (existingVote.voteType === voteType) {
          // Same vote type - no change needed
          const currentPoll = await Poll.findById(pollId);
          return NextResponse.json({ 
            success: true, 
            poll: currentPoll, 
            action: 'no_change',
            message: 'Vote unchanged'
          });
        }
        
        // Changing vote direction (up -> down or down -> up)
        // Remove old vote count, add new vote count
        const oldField = existingVote.voteType === 'up' ? 'upvotes' : 'downvotes';
        const newField = voteType === 'up' ? 'upvotes' : 'downvotes';
        
        await Poll.findByIdAndUpdate(pollId, {
          $inc: {
            [`items.$[item].${oldField}`]: -1,  // Remove old vote
            [`items.$[item].${newField}`]: 1,   // Add new vote
            [`items.$[item].score`]: voteType === 'up' ? 2 : -2,  // Swing from -1 to +1 or vice versa
          },
        }, {
          arrayFilters: [{ 'item.id': optionId }],
        });
        
        // Update the vote record
        existingVote.voteType = voteType;
        await existingVote.save();
        
        action = 'changed';
        // No coins for changing vote - only first vote gets coins
        
      } else {
        // First vote on this item - check if user has ANY votes on this poll already
        const userHasAnyVote = await PollVote.findOne({
          pollId: pollId,
          oderId: `user_${userId}`,
        });
        const isFirstVoteOnPoll = !userHasAnyVote;
        
        // Create the vote record
        await PollVote.create({
          pollId: pollId,
          oderId: `user_${userId}`,
          optionId,
          voteType,
        });
        
        // Update item counts - only increment totalVotes if this is user's FIRST vote on this poll
        const updateField = voteType === 'up' ? 'upvotes' : 'downvotes';
        await Poll.findByIdAndUpdate(pollId, {
          $inc: {
            totalVotes: isFirstVoteOnPoll ? 1 : 0, // Only count once per user
            [`items.$[item].${updateField}`]: 1,
            [`items.$[item].score`]: voteType === 'up' ? 1 : -1,
          },
        }, {
          arrayFilters: [{ 'item.id': optionId }],
        });
        
        // Award 0.05 BOGX per vote (only for FIRST vote on this item)
        // awardBogx also creates a GameResult so it counts in the rankings
        if (userId) {
          await awardBogx({ userId, amount: 0.05, source: 'vote', description: 'Voted on ranking' });
          coinsAwarded = 0.05;
        }
      }
      
      const updatedPoll = await Poll.findById(pollId);
      return NextResponse.json({ success: true, poll: updatedPoll, action, coinsAwarded });
    }
    
    // Handle simple poll votes
    // Check if option exists
    const optionExists = poll.options.some((opt: any) => opt.id === optionId);
    if (!optionExists) {
      return NextResponse.json({ success: false, error: 'Invalid option' }, { status: 400 });
    }
    
    // Check if already voted
    const existingVote = await PollVote.findOne({
      pollId: pollId,
      oderId: `user_${userId}`,
    });
    
    if (existingVote) {
      return NextResponse.json(
        { success: false, error: 'Already voted', alreadyVoted: true },
        { status: 400 }
      );
    }
    
    // Create vote
    await PollVote.create({
      pollId: pollId,
      oderId: `user_${userId}`,
      optionId,
    });
    
    // Update poll counts
    await Poll.findByIdAndUpdate(pollId, {
      $inc: {
        totalVotes: 1,
        [`options.$[opt].votes`]: 1,
      },
    }, {
      arrayFilters: [{ 'opt.id': optionId }],
    });
    
    // Get updated poll
    const updatedPoll = await Poll.findById(pollId);
    
    return NextResponse.json({ success: true, poll: updatedPoll });
  } catch (error: any) {
    console.error('Vote error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Check if user has voted
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id: pollId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const visitorId = searchParams.get('visitorId');
    
    if (!userId && !visitorId) {
      return NextResponse.json({ success: true, hasVoted: false });
    }
    
    // Get the poll to check type
    const poll = await Poll.findById(pollId);
    
    if (!poll) {
      return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
    }
    
    // For ranking lists, return all votes for this user
    if (poll.type === 'ranking') {
      const oderId = userId ? `user_${userId}` : null;
      if (!oderId) {
        return NextResponse.json({ success: true, votes: {} });
      }
      const votes = await PollVote.find({
        pollId: pollId,
        oderId,
      });
      
      // Create a map of itemId -> voteType
      const votesMap: Record<string, 'up' | 'down'> = {};
      votes.forEach((v: any) => {
        votesMap[v.optionId] = v.voteType;
      });
      
      return NextResponse.json({
        success: true,
        votes: votesMap,
      });
    }
    
    // For simple polls
    const simpleOderId = userId ? `user_${userId}` : null;
    if (!simpleOderId) {
      return NextResponse.json({ success: true, hasVoted: false });
    }
    const existingVote = await PollVote.findOne({
      pollId: pollId,
      oderId: simpleOderId,
    });
    
    return NextResponse.json({
      success: true,
      hasVoted: !!existingVote,
      votedOption: existingVote?.optionId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
