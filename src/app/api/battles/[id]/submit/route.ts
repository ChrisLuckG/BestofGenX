import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
// Email imports removed - only push/in-app notifications for battles
import { compareBattleResults } from '@/utils/battleWinner';
import { saveBattleGameResult } from '@/lib/battleLedger';

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
      isCreator,
      botResults  // Optional: simulated bot (creator) results when opponent plays vs a bot
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

      // Check if opponent is a bot — if so, simulate bot play and complete immediately
      const opponentUser = await User.findById(battle.opponent).select('username avatar isBot bogxCoins');
      if (opponentUser?.isBot) {
        // Simulate bot results: randomly correct 40-70% of rounds
        const botResults = battle.questions.map((_: any, i: number) => {
          const correct = Math.random() < 0.55;
          const timeMs = 2000 + Math.floor(Math.random() * 6000);
          const points = correct ? Math.round((0.10 + Math.random() * 0.20) * 100) / 100 : 0;
          return { round: i, correct, timeMs, points, answerIndex: correct ? 0 : 1 };
        });
        const botTotal = botResults.reduce((s: number, r: any) => s + r.points, 0);
        battle.opponentResults = botResults;
        battle.opponentTotalPoints = botTotal;
        battle.status = 'completed';
        battle.completedAt = new Date();

        const cmp = compareBattleResults(results, botResults);
        const creatorWon = cmp > 0;
        const isTie = cmp === 0;
        battle.winner = isTie ? undefined : (creatorWon ? battle.creator : battle.opponent);
        await battle.save();

        const wager = battle.wager;
        const creator = await User.findById(battle.creator).select('username avatar bogxCoins pushSubscription notifyBattleResult');

        if (isTie) {
          await User.findByIdAndUpdate(battle.creator, { $inc: { bogxCoins: wager, gamesPlayed: 1 } });
          await User.findByIdAndUpdate(battle.opponent, { $inc: { bogxCoins: wager, gamesPlayed: 1 } });
          await saveBattleGameResult(battle.creator.toString(), opponentUser.username || 'bot', 0, false);
          if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'creator', 0, false);
          await Notification.create({
            userId: battle.creator,
            type: 'battle_result',
            title: '🤝 Battle Tie!',
            message: `You and ${opponentUser.username} tied! Wager returned.`,
            avatar: opponentUser.avatar,
            data: { battleId: battle._id.toString(), url: '/battles' }
          });
        } else if (creatorWon) {
          await User.findByIdAndUpdate(battle.creator, { $inc: { bogxCoins: wager * 2, wins: 1, gamesPlayed: 1 } });
          await User.findByIdAndUpdate(battle.opponent, { $inc: { gamesPlayed: 1 } });
          await saveBattleGameResult(battle.creator.toString(), opponentUser.username || 'bot', wager, true);
          if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'creator', -wager, false);
          await Notification.create({
            userId: battle.creator,
            type: 'battle_result',
            title: 'You Won!',
            message: `You beat ${opponentUser.username}! +${(wager * 2).toFixed(2)} BOGX`,
            avatar: opponentUser.avatar,
            data: { battleId: battle._id.toString(), url: '/battles' }
          });
        } else {
          await User.findByIdAndUpdate(battle.opponent, { $inc: { bogxCoins: wager * 2, wins: 1, gamesPlayed: 1 } });
          await User.findByIdAndUpdate(battle.creator, { $inc: { gamesPlayed: 1 } });
          await saveBattleGameResult(battle.creator.toString(), opponentUser.username || 'bot', -wager, false);
          if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), creator?.username || 'creator', wager, true);
          await Notification.create({
            userId: battle.creator,
            type: 'battle_result',
            title: '😔 Battle Lost',
            message: `${opponentUser.username} won this round. Try again!`,
            avatar: opponentUser.avatar,
            data: { battleId: battle._id.toString(), url: '/battles' }
          });
        }

        if (creator?.pushSubscription && creator?.notifyBattleResult !== false) {
          sendPushNotification(creator.pushSubscription, {
            title: isTie ? 'Battle Tie!' : (creatorWon ? 'You Won the Battle!' : 'You Lost the Battle'),
            body: isTie
              ? `You and ${opponentUser.username} tied! Wager returned.`
              : creatorWon
                ? `You beat ${opponentUser.username}! +${wager.toFixed(2)} BOGX earned.`
                : `${opponentUser.username} beat you. -${wager.toFixed(2)} BOGX lost.`,
            tag: `battle-result-${battle._id}`,
            url: '/notifications',
            type: 'challenge'
          }).catch(console.error);
        }

        await battle.populate('creator', 'username avatar country countryFlag points');
        await battle.populate('opponent', 'username avatar country countryFlag points');
        return NextResponse.json({ success: true, message: 'Battle completed!', battle });
      }

      // Battle stays active until human opponent plays
      await battle.save();
      
      // Send notifications to challenged user NOW (after creator finished playing)
      if (battle.challengedUser) {
        try {
          const challengedUser = await User.findById(battle.challengedUser);
          const creator = await User.findById(battle.creator);
          const creatorName = creator?.username || 'Someone';
          
          // Check if notification already exists for this battle (prevent duplicates)
          const existingNotification = await Notification.findOne({
            userId: battle.challengedUser,
            type: 'battle_challenge',
            'data.battleId': battle._id.toString()
          });
          
          if (!existingNotification) {
            // 1. Create In-App Notification (ALWAYS)
            await Notification.create({
              userId: battle.challengedUser,
              type: 'battle_challenge',
              title: '⚔️ Battle Challenge!',
              message: `${creatorName} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager.toFixed(2)} BOGX!`,
              avatar: creator?.avatar,
              data: { battleId: battle._id.toString(), url: '/battles' }
            });
            console.log(`Challenge in-app notification created for ${challengedUser?.username}`);
          
            // 2. Send Push Notification (if subscribed)
            if (challengedUser?.pushSubscription) {
              await sendPushNotification(challengedUser.pushSubscription, {
                title: '⚔️ Battle Challenge!',
                body: `${creatorName} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager.toFixed(2)} BOGX!`,
                tag: `battle-challenge-${battle._id}`,
                // Deep-link straight to the battle so the opponent can start it immediately
                url: `/mobile?battle=${battle._id.toString()}`,
                icon: 'https://bestofgenx.com/images/genxlogo1.png',
                badge: 'https://bestofgenx.com/images/bogxcoin.png',
                type: 'challenge'
              });
              console.log(`Challenge push sent to ${challengedUser.username}`);
            }
          
            // Email notifications disabled - only push/in-app notifications
            // (Emails are only sent for login/verification)
          } else {
            console.log(`Challenge notification already exists for battle ${battle._id}, skipping`);
          }
        } catch (notifyError: any) {
          console.error('Challenge notification failed:', notifyError.message);
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
      
      // If playing against a bot, the bot (creator) never played on the server.
      // Save the simulated bot results sent by the client so winner is correct.
      if (botResults && Array.isArray(botResults) && (!battle.creatorResults || battle.creatorResults.length === 0)) {
        battle.creatorResults = botResults;
        battle.creatorTotalPoints = botResults.reduce((sum: number, r: any) => sum + (r.correct ? r.points : 0), 0);
      }
      
      // Determine winner: most correct answers wins; tie-break by fastest total time.
      const cmp = compareBattleResults(battle.creatorResults || [], battle.opponentResults || []);
      if (cmp > 0) {
        battle.winner = battle.creator;
      } else if (cmp < 0) {
        battle.winner = battle.opponent;
      }
      // If tie (equal correct AND equal time), no winner set
      
      await battle.save();
      
      // The challenge invite is stale now - the result notification replaces it
      await Notification.deleteMany({
        type: 'battle_challenge',
        'data.battleId': battle._id.toString()
      });
      
      // Update points - wagers were already deducted when creating/accepting
      const wager = battle.wager;
      if (battle.winner) {
        // Winner gets both wagers back (their own + opponent's)
        const winnerId = battle.winner.toString();
        const loserId = winnerId === battle.creator.toString() ? battle.opponent?.toString() : battle.creator.toString();
        await User.findByIdAndUpdate(winnerId, { $inc: { bogxCoins: wager * 2 } });
        // Loser already lost their wager when they joined, nothing more to deduct
        
        // Track for ranking (winner: +wager net, loser: -wager)
        const winnerUser = await User.findById(winnerId).select('username');
        const loserUser = loserId ? await User.findById(loserId).select('username') : null;
        await saveBattleGameResult(winnerId, loserUser?.username || 'opponent', wager, true);
        if (loserId) await saveBattleGameResult(loserId, winnerUser?.username || 'opponent', -wager, false);
      } else {
        // Tie - both get their wager back
        await User.findByIdAndUpdate(battle.creator, { $inc: { bogxCoins: wager } });
        await User.findByIdAndUpdate(battle.opponent, { $inc: { bogxCoins: wager } });
        
        // Track for ranking (net change = 0, wager returned)
        await saveBattleGameResult(battle.creator.toString(), 'opponent', 0, false);
        if (battle.opponent) await saveBattleGameResult(battle.opponent.toString(), 'opponent', 0, false);
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
            title: creatorWon ? 'You Won the Battle!' : 'You Lost the Battle',
            body: creatorWon 
              ? `You beat ${opponent?.username}! +${wager.toFixed(2)} BOGX earned.`
              : `${opponent?.username} beat you. -${wager.toFixed(2)} BOGX lost.`,
            tag: `battle-result-${battle._id}`,
            url: '/notifications',
            type: 'challenge'
          }).catch(console.error);
        }
      }
      
      // Get the opponent's (current player's) new balance to update UI immediately
      const currentPlayer = await User.findById(playerId).select('bogxCoins').lean();
      const newBalance = currentPlayer?.bogxCoins || 0;
      
      return NextResponse.json({ 
        success: true, 
        message: 'Battle completed!',
        battle,
        newBalance // Return new balance so UI can update immediately
      });
    }
  } catch (error: any) {
    console.error('Failed to submit battle results:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
