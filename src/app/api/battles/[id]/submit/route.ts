import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
import { sendEmail, createBaseEmailTemplate } from '@/lib/email';
import { compareBattleResults } from '@/utils/battleWinner';

// Helper: Create battle challenge email - Premium design
function createBattleChallengeEmail(
  challengerName: string, 
  topic: string, 
  wager: number,
  challengerAvatar?: string,
  challengerLevel?: number,
  challengerWins?: number,
  challengerLosses?: number,
  expiresAt?: Date
) {
  // Format expiry time
  const expiryTime = expiresAt 
    ? new Date(expiresAt).toLocaleString('de-DE', { 
        timeZone: 'Europe/Berlin',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '24 hours';

  // Topic icons mapping
  const topicIcons: Record<string, string> = {
    'sport': '⚽',
    'music': '🎵',
    'movies': '🎬',
    'tv': '📺',
    'games': '🎮',
    'celebrities': '⭐',
    'history': '📜',
    'all': '🎯',
  };
  const topicIcon = topicIcons[topic.toLowerCase()] || '🎯';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">

    <!-- Header with Logo -->
    <div style="background-color: #1a1a1a; padding: 24px; text-align: center;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="BOGX" style="height: 40px;" />
    </div>

    <!-- Hero Section - Dark with diagonal accents -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 40px 24px; text-align: center; position: relative;">
      <!-- Title -->
      <h1 style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 42px; color: #ffffff; margin: 0 0 4px 0; letter-spacing: 2px; text-transform: uppercase;">
        A CHALLENGER
      </h1>
      <h2 style="font-family: 'Brush Script MT', cursive; font-size: 36px; color: #D4873A; margin: 0 0 16px 0; font-style: italic;">
        Appears
      </h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">
        ${challengerName} is calling you out.
      </p>

      <!-- Challenger Avatar & Info -->
      <div style="margin-top: 32px;">
        <div style="width: 100px; height: 100px; margin: 0 auto 16px; border-radius: 50%; border: 4px solid #D4873A; overflow: hidden; background: #333;">
          ${challengerAvatar 
            ? `<img src="${challengerAvatar}" alt="${challengerName}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px;">🐼</div>`
          }
        </div>
        ${challengerLevel ? `<div style="background: #D4873A; color: #1a1a1a; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 12px; display: inline-block; margin-bottom: 8px;">${challengerLevel} LEVEL</div>` : ''}
        <p style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 8px 0 4px;">${challengerName}</p>
        <p style="color: #D4873A; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin: 0;">GENX WARRIOR</p>
        
        <!-- Stats -->
        <div style="display: flex; justify-content: center; gap: 32px; margin-top: 16px;">
          <div style="text-align: center;">
            <span style="color: #D4873A; font-size: 10px;">🏆</span>
            <span style="color: #ffffff; font-size: 18px; font-weight: bold; margin-left: 4px;">${challengerWins || 0}</span>
            <span style="color: #888; font-size: 11px; display: block;">WINS</span>
          </div>
          <div style="text-align: center;">
            <span style="color: #888; font-size: 10px;">💔</span>
            <span style="color: #ffffff; font-size: 18px; font-weight: bold; margin-left: 4px;">${challengerLosses || 0}</span>
            <span style="color: #888; font-size: 11px; display: block;">LOSSES</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Battle Details Card -->
    <div style="background: #F5F0E8; margin: 0; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="color: #D4873A; font-size: 12px; font-weight: bold; letter-spacing: 2px;">⚔️ BATTLE DETAILS ⚔️</span>
      </div>

      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <!-- Topic -->
        <div style="flex: 1; background: #ffffff; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #E8E4DC;">
          <p style="color: #888; font-size: 10px; letter-spacing: 1px; margin: 0 0 8px;">TOPIC</p>
          <p style="font-size: 28px; margin: 0 0 8px;">${topicIcon}</p>
          <p style="color: #1a1a1a; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">${topic}</p>
          <p style="color: #888; font-size: 10px; margin: 8px 0 0;">
            <span style="margin-right: 8px;">❓ 10 QUESTIONS</span>
          </p>
          <p style="color: #888; font-size: 10px; margin: 4px 0 0;">
            <span>⏱️ 90 SECONDS</span>
          </p>
        </div>

        <!-- Pot -->
        <div style="flex: 1; background: #ffffff; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #E8E4DC;">
          <p style="color: #888; font-size: 10px; letter-spacing: 1px; margin: 0 0 8px;">POT</p>
          <img src="https://bestofgenx.com/images/bogx-coins.png" alt="BOGX" style="width: 48px; height: 48px; margin: 0 auto 8px;" onerror="this.style.display='none'" />
          <p style="color: #D4873A; font-size: 24px; font-weight: bold; margin: 0;">${(wager * 2).toFixed(2)} BOGX</p>
          <p style="color: #888; font-size: 10px; margin: 8px 0 0;">WINNER TAKES ALL</p>
        </div>

        <!-- Expires -->
        <div style="flex: 1; background: #ffffff; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #E8E4DC;">
          <p style="color: #888; font-size: 10px; letter-spacing: 1px; margin: 0 0 8px;">CHALLENGE EXPIRES</p>
          <p style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 8px 0;">${expiryTime}</p>
          <p style="color: #888; font-size: 10px; margin: 0;">CET</p>
        </div>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="background: #F5F0E8; padding: 0 24px 32px; text-align: center;">
      <a href="https://bestofgenx.com/mobile?tab=notifications" style="display: inline-block; background: linear-gradient(135deg, #A855F7 0%, #7C3AED 100%); color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 18px 64px; border-radius: 16px; letter-spacing: 2px; text-transform: uppercase;">
        ⚡ ENTER BATTLE ⚡
      </a>
    </div>

    <!-- Tagline -->
    <div style="background: #F5F0E8; padding: 0 24px 32px; text-align: center;">
      <p style="color: #1a1a1a; font-size: 14px; margin: 0; font-weight: 500;">
        ONLY ONE OF YOU REMEMBERS THE 90S BETTER.
      </p>
      <p style="color: #D4873A; font-size: 14px; margin: 4px 0 0; font-weight: bold;">
        LET'S SETTLE THIS.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #1a1a1a; padding: 24px; text-align: center;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="BOGX" style="height: 24px; margin-bottom: 12px;" />
      <p style="color: #888; font-size: 11px; margin: 0; letter-spacing: 1px;">KNOWLEDGE. COMPETITION. REWARDS.</p>
      <div style="margin-top: 16px;">
        <a href="https://twitter.com/bestofgenx" style="color: #888; text-decoration: none; margin: 0 8px;">𝕏</a>
        <a href="https://instagram.com/bestofgenx" style="color: #888; text-decoration: none; margin: 0 8px;">📷</a>
        <a href="https://discord.gg/bestofgenx" style="color: #888; text-decoration: none; margin: 0 8px;">💬</a>
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

// Helper: save battle result for ranking system
async function saveBattleGameResult(userId: string, opponentName: string, pointsChange: number, won: boolean) {
  try {
    const user = await User.findById(userId).select('username bogxCoins');
    if (!user) return;
    const today = new Date().toLocaleString('en-CA', { 
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).split(',')[0];
    await GameResult.create({
      userId,
      username: user.username,
      cardId: 'quizzbattle',
      question: `QuizzBattle vs ${opponentName}`,
      userAnswer: null,
      correctAnswer: '-',
      isCorrect: won,
      pointsChange,
      pointsBefore: (user.bogxCoins || 0) - pointsChange,
      pointsAfter: user.bogxCoins || 0,
      timeUsed: 0,
      difficulty: 1,
      skipped: false,
      timedOut: false,
      gameDate: today,
    });
  } catch (e) {
    console.error('Failed to save battle GameResult:', e);
  }
}

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
            title: '🏆 You Won!',
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
            title: isTie ? '🤝 Battle Tie!' : (creatorWon ? '🏆 You Won the Battle!' : '😔 You Lost the Battle'),
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
          
          // 1. Create In-App Notification (ALWAYS)
          await Notification.create({
            userId: battle.challengedUser,
            type: 'battle_challenge',
            title: '⚔️ Battle Challenge!',
            message: `${creatorName} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager} BOGX!`,
            avatar: creator?.avatar,
            data: { battleId: battle._id.toString(), url: '/battles' }
          });
          console.log(`Challenge in-app notification created for ${challengedUser?.username}`);
          
          // 2. Send Push Notification (if subscribed)
          if (challengedUser?.pushSubscription) {
            await sendPushNotification(challengedUser.pushSubscription, {
              title: '⚔️ Battle Challenge!',
              body: `${creatorName} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager} coins!`,
              tag: `battle-challenge-${battle._id}`,
              // Deep-link straight to the battle so the opponent can start it immediately
              url: `/mobile?battle=${battle._id.toString()}`,
              icon: 'https://bestofgenx.com/images/genxlogo1.png',
              badge: 'https://bestofgenx.com/images/bogxcoin.png',
              type: 'challenge'
            });
            console.log(`Challenge push sent to ${challengedUser.username}`);
          }
          
          // 3. Send Email (if user has email and hasn't disabled battle notifications)
          if (challengedUser?.email && challengedUser?.notifyBattleChallenge !== false) {
            // Calculate expiry time (24 hours from now)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            // Calculate wins/losses from user stats
            const creatorWins = creator?.battleWins || creator?.wins || 0;
            const creatorLosses = (creator?.gamesPlayed || 0) - creatorWins;
            
            const emailHtml = createBattleChallengeEmail(
              creatorName, 
              battle.topic, 
              battle.wager,
              creator?.avatar,
              creator?.level,
              creatorWins,
              creatorLosses,
              expiresAt
            );
            await sendEmail(
              challengedUser.email,
              `⚔️ ${creatorName} challenged you to a QuizzBattle!`,
              emailHtml
            );
            console.log(`Challenge email sent to ${challengedUser.email}`);
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
            title: creatorWon ? '🏆 You Won the Battle!' : '😢 You Lost the Battle',
            body: creatorWon 
              ? `You beat ${opponent?.username}! +${wager.toFixed(2)} BOGX earned.`
              : `${opponent?.username} beat you. -${wager.toFixed(2)} BOGX lost.`,
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
