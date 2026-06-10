import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

interface RoundResult {
  round: number;
  correct: boolean;
  timeMs: number;
  points: number;
}

// POST - Complete a battle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { 
      odponentId,
      opponentResults,
      opponentTotalPoints,
      creatorResults,
      creatorTotalPoints
    } = await request.json();
    
    const battleId = params.id;
    
    // Find battle
    const battle = await Battle.findById(battleId);
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    if (battle.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Battle is not active' }, { status: 400 });
    }
    
    // Save results
    battle.opponentResults = opponentResults.map((r: RoundResult, i: number) => ({
      round: i + 1,
      correct: r.correct,
      timeMs: r.timeMs,
      points: r.points
    }));
    battle.opponentTotalPoints = opponentTotalPoints;
    
    battle.creatorResults = creatorResults.map((r: RoundResult, i: number) => ({
      round: i + 1,
      correct: r.correct,
      timeMs: r.timeMs,
      points: r.points
    }));
    battle.creatorTotalPoints = creatorTotalPoints;
    
    // Determine winner
    const opponentWon = opponentTotalPoints > creatorTotalPoints;
    battle.winner = opponentWon ? battle.opponent : battle.creator;
    battle.status = 'completed';
    battle.completedAt = new Date();
    
    await battle.save();
    
    // Update user points
    const wager = battle.wager;
    
    // Both players already paid their wager when creating/accepting
    // Winner gets BOTH wagers back (their own + opponent's = 2x wager)
    // Loser gets nothing (already lost their wager)
    // Tie: both get their wager back
    const isTie = opponentTotalPoints === creatorTotalPoints;
    
    // Get both users for push notifications
    const creator = await User.findById(battle.creator);
    const opponent = await User.findById(battle.opponent);
    
    if (isTie) {
      // Tie - both get their wager back
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { points: wager, gamesPlayed: 1 } 
      });
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { points: wager, gamesPlayed: 1 } 
      });
      
      // Send tie notifications to both
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: '🤝 Battle Tie!',
          body: `You and ${opponent?.username || 'opponent'} tied! Wager returned.`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: '🤝 Battle Tie!',
          body: `You and ${creator?.username || 'opponent'} tied! Wager returned.`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
    } else if (opponentWon) {
      // Opponent (the user who accepted) won - gets both wagers
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { points: wager * 2, wins: 1, gamesPlayed: 1 } 
      });
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { gamesPlayed: 1 } // Loser already lost wager, no more deduction
      });
      
      // Send win/lose notifications
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: '🏆 You Won!',
          body: `You beat ${creator?.username || 'opponent'}! +${(wager * 2 / 100).toFixed(2)} BOGX`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: '😔 Battle Lost',
          body: `${opponent?.username || 'Opponent'} won this round. Try again!`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
    } else {
      // Creator won - gets both wagers
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { points: wager * 2, wins: 1, gamesPlayed: 1 } 
      });
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { gamesPlayed: 1 } // Loser already lost wager, no more deduction
      });
      
      // Send win/lose notifications
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: '🏆 You Won!',
          body: `You beat ${opponent?.username || 'opponent'}! +${(wager * 2 / 100).toFixed(2)} BOGX`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: '😔 Battle Lost',
          body: `${creator?.username || 'Opponent'} won this round. Try again!`,
          tag: `battle-result-${battle._id}`,
          url: '/battles',
          type: 'challenge'
        }).catch(console.error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      battle,
      winner: opponentWon ? 'opponent' : 'creator'
    });
  } catch (error: any) {
    console.error('Failed to complete battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
