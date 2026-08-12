import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import GameResult from '@/models/GameResult';
import User from '@/models/User';

// Breakdown of how a user earned (and spent) their BOGX, derived from the
// GameResult ledger - the single source of truth for the wallet.
//
// `cardId` carries the source. Fixed marker strings identify a specific action;
// anything else is a Card ObjectId, i.e. a solo trivia question.

type Bucket = {
  key: string;
  label: string;
  icon: string;
  count: number;
  earned: number;  // sum of positive pointsChange
  lost: number;    // sum of negative pointsChange, as a positive number
  total: number;   // earned - lost
};

// Marker cardId -> display bucket. Order matters twice: it decides which rule wins
// (first match) AND the display order. The exact 'article-reaction'/'article-video'
// rules MUST stay above the 'article-' prefix rule for read articles.
const SOURCE_LABELS: { key: string; label: string; icon: string; match: (cardId: string) => boolean }[] = [
  { key: 'article-reaction', label: 'Likes', icon: '♥', match: id => id === 'article-reaction' },
  { key: 'article-video', label: 'Videos Watched', icon: '▶', match: id => id === 'article-video' },
  // Read articles: newer rows use 'article', older ones 'article-<articleId>'.
  { key: 'article', label: 'Articles Read', icon: '◉', match: id => id === 'article' || id.startsWith('article-') },
  { key: 'vote', label: 'Rankroll Votes', icon: '✓', match: id => id === 'vote' },
  // A bare 24-char hex cardId is a Card reference, i.e. a solo trivia question.
  // 'trivia-<timestamp>' is the fallback SoloTriviaGame uses when a card has no id.
  { key: 'trivia', label: 'Trivia Questions', icon: '?', match: id => /^[a-f\d]{24}$/i.test(id) || id.startsWith('trivia-') },
  { key: 'quizzbattle', label: 'Battles', icon: '⚔', match: id => id === 'quizzbattle' || id === 'quizzbattle-bot' },
  // Legacy: BOGX Invaders used to pay out per kill.
  { key: 'arcade', label: 'Arcade Games', icon: '■', match: id => id.startsWith('bogx-invaders') },
  { key: 'song-request', label: 'Song Requests', icon: '♪', match: id => id === 'song-request' },
  { key: 'referral', label: 'Referrals', icon: '+', match: id => id === 'referral' },
  { key: 'welcome-bonus', label: 'Welcome Bonus', icon: '★', match: id => id === 'welcome-bonus' },
  { key: 'shop', label: 'Shop & Rewards', icon: '●', match: id => id === 'shop-checkout' || id === 'reward-redeem' },
  { key: 'admin', label: 'Adjustments', icon: '⚙', match: id => id === 'admin-adjustment' || id === 'reconcile-adjustment' },
];

type BucketDef = Pick<Bucket, 'key' | 'label' | 'icon'>;

const OTHER: BucketDef = { key: 'other', label: 'Other', icon: '○' };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // userId is stored as a STRING on GameResult - do not cast to ObjectId.
    // Gains and losses are summed separately so a bucket's net figure can't hide
    // that e.g. battles both won and lost a lot.
    const rows = await GameResult.aggregate([
      { $match: { userId: String(userId) } },
      {
        $group: {
          _id: '$cardId',
          earned: { $sum: { $cond: [{ $gt: ['$pointsChange', 0] }, '$pointsChange', 0] } },
          lost: { $sum: { $cond: [{ $lt: ['$pointsChange', 0] }, { $abs: '$pointsChange' }, 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const buckets = new Map<string, Bucket>();
    const addTo = (def: BucketDef, count: number, earned: number, lost: number) => {
      const existing = buckets.get(def.key);
      if (existing) {
        existing.count += count;
        existing.earned += earned;
        existing.lost += lost;
      } else {
        buckets.set(def.key, { ...def, count, earned, lost, total: 0 });
      }
    };

    let totalEarned = 0;
    let totalLost = 0;

    for (const row of rows) {
      const cardId = String(row._id ?? '');
      const earned = row.earned || 0;
      const lost = row.lost || 0;
      const count = row.count || 0;

      // Totals cover EVERY ledger row, including unmapped ones, so the
      // reconciliation against the wallet below stays exact.
      totalEarned += earned;
      totalLost += lost;

      // Bot simulation rows are noise and never belong to a real user anyway.
      if (cardId.startsWith('bot-card-')) continue;

      const def = SOURCE_LABELS.find(s => s.match(cardId)) ?? OTHER;
      addTo(def, count, earned, lost);
    }

    // Keep the configured order, drop empty buckets, round away float artefacts.
    const order = [...SOURCE_LABELS.map(s => s.key), OTHER.key];
    const breakdown = order
      .map(key => buckets.get(key))
      .filter((b): b is Bucket => !!b && b.count > 0)
      .map(b => ({
        ...b,
        earned: round2(b.earned),
        lost: round2(b.lost),
        total: round2(b.earned - b.lost),
      }));

    // Reconciliation: the wallet must equal the ledger. Any difference means some
    // code path changed bogxCoins without writing a GameResult - surfacing it here
    // keeps it from silently drifting out of the rankings.
    const userDoc = await User.findById(userId).select('bogxCoins').lean();
    const wallet = round2((userDoc as any)?.bogxCoins || 0);
    const ledgerNet = round2(totalEarned - totalLost);

    return NextResponse.json({
      success: true,
      breakdown,
      totalEarned: round2(totalEarned),
      totalSpent: round2(totalLost),
      ledgerNet,
      wallet,
      drift: round2(wallet - ledgerNet),
    });
  } catch (error) {
    console.error('Earnings breakdown error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load breakdown' }, { status: 500 });
  }
}
