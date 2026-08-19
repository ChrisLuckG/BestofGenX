import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Prediction from '@/models/Prediction';
import UserPrediction from '@/models/UserPrediction';
import { compareBattleResults } from '@/utils/battleWinner';

// GET - Get notifications for a user (battle results, challenges, etc.)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    // Get user's dismissed and read notifications
    const user = await User.findById(userId).select('dismissedNotifications readNotifications').lean();
    const dismissedIds = new Set(user?.dismissedNotifications || []);
    const readIds = new Set(user?.readNotifications || []);
    
    // Get notifications from Notification collection (test, system, etc.)
    const dbNotifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Convert DB notifications to our format
    const systemNotifications = dbNotifications.map((n: any) => ({
      id: `notif-${n._id}`,
      type: n.type,
      title: n.title,
      message: n.message,
      avatar: n.avatar || '/images/genxlogo1.png',
      createdAt: n.createdAt,
      read: n.read,
      battleId: n.data?.battleId,
      articleId: n.data?.articleId
    }));
    
    // Get completed battles where user was creator or opponent
    const completedBattles = await Battle.find({
      $or: [
        { creator: userId },
        { opponent: userId }
      ],
      status: 'completed'
    })
    .populate('creator', 'username avatar')
    .populate('opponent', 'username avatar')
    .populate('winner', 'username')
    .sort({ completedAt: -1 })
    .limit(20);
    
    // Get active battles where user is creator (waiting for opponent to finish)
    const activeBattles = await Battle.find({
      creator: userId,
      status: 'active'
    })
    .populate('opponent', 'username avatar')
    .sort({ acceptedAt: -1 })
    .limit(10);
    
    // NOTE: We no longer query pendingChallenges here because:
    // - Battle challenges are now created as DB notifications when the creator finishes playing
    // - This prevents duplicate notifications (one from DB, one from pendingChallenges query)
    // - The old approach showed challenges before the creator even played, which was wrong
    
    // Format notifications
    const notifications: any[] = [];
    
    // Add completed battle results
    for (const battle of completedBattles) {
      const creator = battle.creator as any;
      const opponentUser = battle.opponent as any;
      const isCreator = creator?._id?.toString() === userId;
      const opponent = isCreator ? opponentUser : creator;
      // Derive the outcome from the results with the shared rules instead of the
      // stored winner, so older battles decided by the old (buggy) tie-break are
      // shown the same way as the result screen shows them.
      const myResults = (isCreator ? battle.creatorResults : battle.opponentResults) || [];
      const oppResults = (isCreator ? battle.opponentResults : battle.creatorResults) || [];
      const cmp = compareBattleResults(myResults as any, oppResults as any);
      const won = cmp > 0;
      const isTie = cmp === 0;
      
      const opponentName = opponent?.username || 'Opponent';
      const notifId = `battle-result-${battle._id}`;
      notifications.push({
        id: notifId,
        type: 'battle_result',
        title: isTie ? 'It\'s a Tie!' : (won ? 'You Won!' : 'You Lost'),
        message: isTie 
          ? `You and ${opponentName} tied! No coins exchanged.`
          : (won 
            ? `You beat ${opponentName}! +${battle.wager.toFixed(2)} BOGX earned.`
            : `${opponentName} beat you. -${battle.wager.toFixed(2)} BOGX lost.`),
        avatar: opponent?.avatar,
        battleId: battle._id,
        createdAt: battle.completedAt || (battle as any).updatedAt || battle.createdAt || new Date(),
        read: readIds.has(notifId)
      });
    }
    
    // Add active battles (opponent is playing)
    for (const battle of activeBattles) {
      const opponentUser = battle.opponent as any;
      const notifId = `battle-active-${battle._id}`;
      notifications.push({
        id: notifId,
        type: 'battle_accepted',
        title: '⚔️ Battle Accepted!',
        message: `${opponentUser?.username || 'Opponent'} is playing your challenge right now!`,
        avatar: opponentUser?.avatar,
        battleId: battle._id,
        createdAt: battle.acceptedAt || (battle as any).updatedAt || battle.createdAt || new Date(),
        read: readIds.has(notifId)
      });
    }
    
    // NOTE: pendingChallenges loop removed - battle_challenge notifications are now 
    // created in the DB when the creator finishes playing (in submit route)
    // This prevents showing challenges before creator played and duplicate notifications
    
    // Add resolved-prediction results for this user
    const userPicks = await UserPrediction.find({ userId }).sort({ updatedAt: -1 }).limit(30).lean();
    if (userPicks.length > 0) {
      const predictionIds = userPicks.map((up) => up.predictionId);
      const resolvedPredictions = await Prediction.find({
        _id: { $in: predictionIds },
        status: 'resolved',
      }).lean();
      const byId = new Map(resolvedPredictions.map((p) => [String(p._id), p]));
      for (const up of userPicks) {
        const pred = byId.get(String(up.predictionId));
        if (!pred) continue;
        const correctOption = pred.options.find((o) => o.id === pred.correctOptionId);
        const userOption = pred.options.find((o) => o.id === up.optionId);
        const won = up.isCorrect === true;
        const notifId = `prediction-result-${pred._id}`;
        notifications.push({
          id: notifId,
          type: 'prediction_result',
          title: won ? 'Prediction won' : 'Prediction lost',
          message: won
            ? `You called "${pred.question}" right! +${up.pointsAwarded || pred.pointsReward}P earned.`
            : `"${pred.question}" was "${correctOption?.label || 'revealed'}". Better luck next time!`,
          avatar: '/images/genxlogo1.png',
          predictionId: String(pred._id),
          predictionQuestion: pred.question,
          predictionOptions: pred.options,
          predictionCorrectOptionId: pred.correctOptionId,
          userOptionId: up.optionId,
          userOptionLabel: userOption?.label,
          correctOptionLabel: correctOption?.label,
          pointsAwarded: up.pointsAwarded || 0,
          pointsReward: pred.pointsReward,
          resolvedAt: pred.resolvedAt,
          won,
          createdAt: pred.resolvedAt || pred.updatedAt || new Date(),
          read: readIds.has(notifId),
        });
      }
    }

    // Add system notifications from Notification collection
    notifications.push(...systemNotifications);
    
    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Filter out dismissed notifications
    const filteredNotifications = notifications.filter(n => !dismissedIds.has(n.id));
    
    return NextResponse.json({ 
      success: true, 
      notifications: filteredNotifications.slice(0, 20)
    });
  } catch (error: any) {
    console.error('Failed to get notifications:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
