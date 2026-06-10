import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import { sendPushNotification } from '@/lib/webpush';

// POST - Submit results for a battle round or complete game
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const { 
      playerId, 
      results,  // Array of { round, correct, timeMs, points }
      isCreator 
    } = await request.json();
    
    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    // Calculate total points
    const totalPoints = results.reduce((sum: number, r: any) => sum + (r.correct ? r.points : 0), 0);
    
    if (isCreator) {
      // Creator submitting their results
      battle.creatorResults = results;
      battle.creatorTotalPoints = totalPoints;
      
      // Battle stays 'open' until opponent joins and plays
      await battle.save();
      
      // Send push notification to challenged user NOW (after creator finished playing)
      if (battle.challengedUser) {
        try {
          const challengedUser = await User.findById(battle.challengedUser);
          const creator = await User.findById(battle.creator);
          
          if (challengedUser?.pushSubscription) {
            await sendPushNotification(challengedUser.pushSubscription, {
              title: '⚔️ Battle Challenge!',
              body: `${creator?.username || 'Someone'} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager} coins!`,
              tag: `battle-challenge-${battle._id}`,
              url: '/mobile?tab=notifications',
              type: 'challenge'
            });
            console.log(`Challenge push sent to ${challengedUser.username}`);
          }
        } catch (pushError: any) {
          console.error('Challenge push failed:', pushError.message);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Creator results saved. Waiting for opponent.',
        battle 
      });
    } else {
      // Opponent submitting their results
      battle.opponentResults = results;
      battle.opponentTotalPoints = totalPoints;
      battle.status = 'completed';
      battle.completedAt = new Date();
      
      // Determine winner
      if (battle.creatorTotalPoints > battle.opponentTotalPoints) {
        battle.winner = battle.creator;
      } else if (battle.opponentTotalPoints > battle.creatorTotalPoints) {
        battle.winner = battle.opponent;
      }
      // If tie, no winner set
      
      await battle.save();
      
      // Update points - wagers were already deducted when creating/accepting
      const wager = battle.wager;
      if (battle.winner) {
        // Winner gets both wagers back (their own + opponent's)
        const winnerId = battle.winner.toString();
        await User.findByIdAndUpdate(winnerId, { $inc: { points: wager * 2 } });
        // Loser already lost their wager when they joined, nothing more to deduct
      } else {
        // Tie - both get their wager back
        await User.findByIdAndUpdate(battle.creator, { $inc: { points: wager } });
        await User.findByIdAndUpdate(battle.opponent, { $inc: { points: wager } });
      }
      
      // Populate for response
      await battle.populate('creator', 'username avatar country countryFlag points');
      await battle.populate('opponent', 'username avatar country countryFlag points');
      
      // Send push notification ONLY to the creator (who is waiting for results)
      // The opponent just finished playing and sees the result immediately - no need to notify them
      const creator = await User.findById(battle.creator._id || battle.creator);
      const opponent = await User.findById(battle.opponent);
      
      const isTie = !battle.winner;
      const creatorWon = battle.winner?.toString() === creator?._id.toString();
      
      // Only notify the CREATOR - they are the one waiting for the result
      if (creator?.pushSubscription && creator?.notifyBattleResults !== false) {
        if (isTie) {
          sendPushNotification(creator.pushSubscription, {
            title: '🤝 Battle Ended in a Tie!',
            body: `Your battle with ${opponent?.username} was a tie! Wager returned.`,
            tag: `battle-result-${battle._id}`,
            url: '/notifications',
            type: 'challenge'
          }).catch(console.error);
        } else {
          sendPushNotification(creator.pushSubscription, {
            title: creatorWon ? '🏆 You Won the Battle!' : '😢 You Lost the Battle',
            body: creatorWon 
              ? `You beat ${opponent?.username}! +${(wager / 100).toFixed(2)} BOGX earned.`
              : `${opponent?.username} beat you. -${(wager / 100).toFixed(2)} BOGX lost.`,
            tag: `battle-result-${battle._id}`,
            url: '/notifications',
            type: 'challenge'
          }).catch(console.error);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Battle completed!',
        battle 
      });
    }
  } catch (error: any) {
    console.error('Failed to submit battle results:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
