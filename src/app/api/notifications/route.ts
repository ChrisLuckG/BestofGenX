import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Prediction from '@/models/Prediction';
import UserPrediction from '@/models/UserPrediction';

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
      battleId: n.data?.battleId
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
    
    // Get open challenges where user was challenged (private battles)
    const pendingChallenges = await Battle.find({
      challengedUser: userId,
      status: 'open',
      isPrivate: true
    })
    .populate('creator', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(10);
    
    console.log(`Notifications for user ${userId}: found ${pendingChallenges.length} pending challenges`);
    
    // Also check all private battles to debug
    const allPrivateBattles = await Battle.find({ isPrivate: true, status: 'open' }).select('_id challengedUser creator');
    console.log('All open private battles:', allPrivateBattles.map(b => ({ 
      id: b._id, 
      challengedUser: b.challengedUser?.toString(), 
      creator: b.creator?.toString() 
    })));
    
    // Format notifications
    const notifications: any[] = [];
    
    // Add completed battle results
    for (const battle of completedBattles) {
      const creator = battle.creator as any;
      const opponentUser = battle.opponent as any;
      const winnerUser = battle.winner as any;
      const isCreator = creator?._id?.toString() === userId;
      const opponent = isCreator ? opponentUser : creator;
      const won = winnerUser?._id?.toString() === userId;
      const isTie = !battle.winner;
      
      const opponentName = opponent?.username || 'Opponent';
      const notifId = `battle-result-${battle._id}`;
      notifications.push({
        id: notifId,
        type: 'battle_result',
        title: isTie ? '🤝 It\'s a Tie!' : (won ? '🏆 You Won!' : '😢 You Lost'),
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
    
    // Add pending challenges (someone challenged you!)
    for (const battle of pendingChallenges) {
      const creatorUser = battle.creator as any;
      const notifId = `battle-challenge-${battle._id}`;
      notifications.push({
        id: notifId,
        type: 'battle_challenge',
        title: '⚔️ You\'ve Been Challenged!',
        message: `${creatorUser?.username || 'Someone'} challenges you to a ${battle.topic.toUpperCase()} battle for ${battle.wager.toFixed(2)} BOGX!`,
        avatar: creatorUser?.avatar,
        battleId: battle._id,
        wager: battle.wager,
        topic: battle.topic,
        createdAt: battle.createdAt,
        read: readIds.has(notifId)
      });
    }
    
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
