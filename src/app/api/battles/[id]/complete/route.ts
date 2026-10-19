import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
import { compareBattleResults } from '@/utils/battleWinner';
import { saveBattleGameResult } from '@/lib/battleLedger';

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
    
    // Determine winner: most correct answers wins; tie-break by fastest total time.
    // IMPORTANT: on a true tie (equal correct AND equal time), winner stays null!
    const cmp = compareBattleResults(battle.creatorResults || [], battle.opponentResults || []);
    const isTie = cmp === 0;
    const opponentWon = cmp < 0;
    battle.winner = isTie ? undefined : (opponentWon ? battle.opponent : battle.creator);
    battle.status = 'completed';
    battle.completedAt = new Date();
    
    await battle.save();
    
    // The challenge invite is stale now - the result notification replaces it
    await Notification.deleteMany({
      type: 'battle_challenge',
      'data.battleId': battle._id.toString()
    });
    
    // Update user points
    const wager = battle.wager;
    
    // Both players already paid their wager when creating/accepting
    // Winner gets BOTH wagers back (their own + opponent's = 2x wager)
    // Loser gets nothing (already lost their wager)
    // Tie: both get their wager back
    
    // Get both users for push notifications
    const creator = await User.findById(battle.creator);
    const opponent = await User.findById(battle.opponent);
    
    if (isTie) {
      // Tie - both get their wager back
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { bogxCoins: wager, gamesPlayed: 1 } 
      });
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { bogxCoins: wager, gamesPlayed: 1 } 
      });
      
      // Track for ranking (net change = 0, wager returned)
      if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'opponent', 0, false);
      await saveBattleGameResult(battle.creator.toString(), opponent?.username || 'opponent', 0, false);
      
      // Create In-App notifications for BOTH (always, regardless of push settings)
      await Notification.create({
        userId: battle.creator,
        type: 'battle_result',
        title: '🤝 Battle Tie!',
        message: `You and ${opponent?.username || 'opponent'} tied! Wager returned.`,
        avatar: opponent?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      await Notification.create({
        userId: battle.opponent,
        type: 'battle_result',
        title: '🤝 Battle Tie!',
        message: `You and ${creator?.username || 'opponent'} tied! Wager returned.`,
        avatar: creator?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      
      // Send push notifications (only if enabled)
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: '🤝 Battle Tie!',
          category: 'battleResult',
          body: `You and ${opponent?.username || 'opponent'} tied! Wager returned.`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: '🤝 Battle Tie!',
          category: 'battleResult',
          body: `You and ${creator?.username || 'opponent'} tied! Wager returned.`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
          type: 'challenge'
        }).catch(console.error);
      }
    } else if (opponentWon) {
      // Opponent (the user who accepted) won - gets both wagers
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { bogxCoins: wager * 2, wins: 1, gamesPlayed: 1, battlesWon: 1 } 
      });
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { gamesPlayed: 1, battlesLost: 1 } // Loser already lost wager, no more deduction
      });
      
      // Track for ranking (winner: +wager net, loser: -wager)
      if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'opponent', wager, true);
      await saveBattleGameResult(battle.creator.toString(), opponent?.username || 'opponent', -wager, false);
      
      // Create In-App notifications for BOTH (always, regardless of push settings)
      await Notification.create({
        userId: battle.opponent,
        type: 'battle_result',
        title: 'You Won!',
        message: `You beat ${creator?.username || 'opponent'}! +${(wager * 2).toFixed(2)} BOGX`,
        avatar: creator?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      await Notification.create({
        userId: battle.creator,
        type: 'battle_result',
        title: '😔 Battle Lost',
        message: `${opponent?.username || 'Opponent'} won this round. Try again!`,
        avatar: opponent?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      
      // Send push notifications (only if enabled)
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: 'You Won!',
          category: 'battleResult',
          body: `You beat ${creator?.username || 'opponent'}! +${(wager * 2).toFixed(2)} BOGX`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: '😔 Battle Lost',
          category: 'battleResult',
          body: `${opponent?.username || 'Opponent'} won this round. Try again!`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
          type: 'challenge'
        }).catch(console.error);
      }
    } else {
      // Creator won - gets both wagers
      await User.findByIdAndUpdate(battle.creator, { 
        $inc: { bogxCoins: wager * 2, wins: 1, gamesPlayed: 1, battlesWon: 1 } 
      });
      await User.findByIdAndUpdate(battle.opponent, { 
        $inc: { gamesPlayed: 1, battlesLost: 1 } // Loser already lost wager, no more deduction
      });
      
      // Track for ranking (winner: +wager net, loser: -wager)
      await saveBattleGameResult(battle.creator.toString(), opponent?.username || 'opponent', wager, true);
      if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'opponent', -wager, false);
      
      // Create In-App notifications for BOTH (always, regardless of push settings)
      await Notification.create({
        userId: battle.creator,
        type: 'battle_result',
        title: 'You Won!',
        message: `You beat ${opponent?.username || 'opponent'}! +${(wager * 2).toFixed(2)} BOGX`,
        avatar: opponent?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      await Notification.create({
        userId: battle.opponent,
        type: 'battle_result',
        title: '😔 Battle Lost',
        message: `${creator?.username || 'Opponent'} won this round. Try again!`,
        avatar: creator?.avatar,
        data: { battleId: battle._id.toString(), url: '/?tab=battles' }
      });
      
      // Send push notifications (only if enabled)
      if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
        sendPushNotification(creator.pushSubscription, {
          title: 'You Won!',
          category: 'battleResult',
          body: `You beat ${opponent?.username || 'opponent'}! +${(wager * 2).toFixed(2)} BOGX`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
          type: 'challenge'
        }).catch(console.error);
      }
      if (opponent?.pushSubscription && opponent?.notifyBattleResult !== false) {
        sendPushNotification(opponent.pushSubscription, {
          title: '😔 Battle Lost',
          category: 'battleResult',
          body: `${creator?.username || 'Opponent'} won this round. Try again!`,
          tag: `battle-result-${battle._id}`,
          url: '/?tab=battles',
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
