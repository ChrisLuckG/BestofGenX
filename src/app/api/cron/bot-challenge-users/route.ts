import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import User from '@/models/User';
import Card from '@/models/Card';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';
import { TOPIC_TO_THEME } from '@/lib/battleTopics';

// Users to challenge (by username) and which bot challenges them
const CHALLENGE_TARGETS = [
  { username: 'Bacon77', botUsername: 'ShadowHunter' },
];

// NOTE: culture removed - not enough DB questions for this theme yet
const TOPICS = ['sport', 'music', 'film', 'tv'];
const WAGER = 0.10;
const ROUNDS = 3;

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || 'sporttock-cron-2024';
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const results: any[] = [];

    for (const target of CHALLENGE_TARGETS) {
      try {
        const user = await User.findOne({ username: target.username }).select('_id username pushSubscription bogxCoins');
        if (!user) { results.push({ target: target.username, skipped: 'user not found' }); continue; }

        const bot = await User.findOne({ username: target.botUsername, isBot: true }).select('_id username avatar bogxCoins');
        if (!bot) { results.push({ target: target.username, skipped: 'bot not found' }); continue; }

        // Skip if bot has insufficient funds
        if ((bot.bogxCoins || 0) < WAGER) { results.push({ target: target.username, skipped: 'bot has no funds' }); continue; }

        // Skip if there is already an open challenge from this bot to this user
        const existing = await Battle.findOne({
          creator: bot._id,
          challengedUser: user._id,
          status: 'open',
        });
        if (existing) { results.push({ target: target.username, skipped: 'challenge already open' }); continue; }

        // Pick questions - MUST match the battle topic, otherwise the battle is
        // labelled e.g. FILM but serves SPORTS questions.
        const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        const cards = await Card.aggregate([
          { $match: { active: true, theme: TOPIC_TO_THEME[topic] } },
          { $sample: { size: ROUNDS + 3 } }
        ]);

        const battleQuestions: any[] = [];
        for (const card of cards) {
          if (battleQuestions.length >= ROUNDS) break;
          const q = card.questions?.[1] || card.questions?.[0];
          if (!q?.question || !Array.isArray(q.options) || q.options.length < 2) continue;
          const correctIndex = q.options.indexOf(q.correctAnswer);
          if (correctIndex === -1) continue;
          battleQuestions.push({ question: q.question, answers: q.options, correctIndex, points: 300 });
        }

        if (battleQuestions.length < ROUNDS) { results.push({ target: target.username, skipped: 'not enough questions' }); continue; }

        // Simulate bot creator results
        const botSkill = 0.5 + Math.random() * 0.4;
        const creatorResults = battleQuestions.map((_: any, i: number) => {
          const correct = Math.random() < botSkill;
          const timeMs = 2000 + Math.random() * 6000;
          const pct = Math.max(10000 - timeMs, 0) / 10000;
          return { round: i, correct, timeMs, points: correct ? Math.round(300 * pct) : 0 };
        });
        const creatorTotalPoints = creatorResults.reduce((s: number, r: any) => s + r.points, 0);

        // Deduct wager from bot
        await User.findByIdAndUpdate(bot._id, { $inc: { bogxCoins: -WAGER } });

        // Create the challenge battle
        const battle = await Battle.create({
          creator: bot._id,
          challengedUser: user._id,
          topic,
          wager: WAGER,
          rounds: ROUNDS,
          questions: battleQuestions,
          status: 'open',
          isPrivate: true,
          creatorResults,
          creatorTotalPoints,
        });

        // In-app notification
        await Notification.create({
          userId: user._id,
          type: 'battle_challenge',
          title: '⚔️ Battle Challenge!',
          message: `${bot.username} challenges you to a ${topic.toUpperCase()} battle for ${WAGER.toFixed(2)} BOGX!`,
          avatar: bot.avatar,
          data: { battleId: battle._id.toString(), url: '/battles' }
        });

        // Push notification
        if (user.pushSubscription) {
          await sendPushNotification(user.pushSubscription, {
            title: '⚔️ Battle Challenge!',
            body: `${bot.username} challenges you to a ${topic.toUpperCase()} battle for ${WAGER.toFixed(2)} BOGX!`,
            tag: `battle-challenge-${battle._id}`,
            url: `/mobile?battle=${battle._id.toString()}`,
            type: 'challenge'
          }, user._id.toString());
        }

        results.push({ target: target.username, success: true, battleId: battle._id, topic, pushSent: !!user.pushSubscription });
      } catch (err: any) {
        results.push({ target: target.username, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('bot-challenge-users cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
