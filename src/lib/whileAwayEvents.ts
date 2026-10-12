// Server-only (uses models). Builds the "While you were away" list for the
// welcome-back modal from what actually happened between players: yesterday's
// day ranking, overtakes, your battles, new humans. The old list was mostly
// filler (rank, total, level) because its GameResult queries matched on a
// `createdAt` field the model does not have.
import User from '@/models/User';
import GameResult from '@/models/GameResult';
import Battle from '@/models/Battle';

export interface AwayEvent {
  type: 'winner' | 'yourDay' | 'overtook' | 'passed' | 'battle' | 'battles' | 'topBattler' | 'newPlayers';
  avatar?: string;
  text: string;
  highlight?: string;
}

const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2);
const DAY = 24 * 60 * 60 * 1000;
const VISIBLE = { isDeleted: { $ne: true }, isReporter: { $ne: true }, isAIReporter: { $ne: true } };

export async function buildWhileAwayEvents(opts: {
  userId: string; username: string; coins: number; since: Date; todayStart: Date; yesterdayStart: Date;
}): Promise<AwayEvent[]> {
  const { userId, coins, todayStart, yesterdayStart } = opts;
  // "Away" covers at least yesterday's ranking day - the welcome screen is shown
  // often, and a window of a few minutes would always be empty. Capped at a week.
  const since = new Date(Math.max(Math.min(opts.since.getTime(), yesterdayStart.getTime()), Date.now() - 7 * DAY));
  const events: AwayEvent[] = [];

  const [yesterday, deltas, myBattles, topBattler, newHumans] = await Promise.all([
    GameResult.aggregate([
      { $match: { playedAt: { $gte: yesterdayStart, $lt: todayStart } } },
      { $group: { _id: '$userId', points: { $sum: '$pointsChange' } } },
      { $sort: { points: -1 } },
    ]),
    GameResult.aggregate([
      { $match: { playedAt: { $gte: since } } },
      { $group: { _id: '$userId', delta: { $sum: '$pointsChange' } } },
    ]),
    Battle.find({ status: 'completed', completedAt: { $gte: since }, $or: [{ creator: userId }, { opponent: userId }] })
      .select('creator opponent winner wager completedAt')
      .populate('creator', 'username avatar').populate('opponent', 'username avatar')
      .sort({ completedAt: -1 }).limit(30).lean(),
    Battle.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: yesterdayStart, $lt: todayStart }, winner: { $ne: null } } },
      { $group: { _id: '$winner', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 1 },
    ]),
    User.find({ ...VISIBLE, isBot: { $ne: true }, createdAt: { $gte: since }, _id: { $ne: userId } })
      .select('username avatar').sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  // 1. Yesterday's day ranking (same rule as the scoreboard: only a positive net ranks)
  const visibleIds = new Set(
    (await User.find({ ...VISIBLE, _id: { $in: yesterday.slice(0, 200).map((r: any) => r._id) } }).select('_id').lean())
      .map((u: any) => String(u._id))
  );
  const ranked = yesterday.filter((r: any) => r.points > 0 && visibleIds.has(String(r._id)));
  if (ranked.length) {
    const top = ranked[0];
    if (String(top._id) === userId) {
      events.push({ type: 'winner', text: 'You won yesterday!', highlight: `${fmt(top.points)} BOGX` });
    } else {
      const w: any = await User.findById(top._id).select('username avatar').lean();
      if (w) events.push({ type: 'winner', avatar: w.avatar, text: `${w.username} won yesterday`, highlight: `${fmt(top.points)} BOGX` });
    }
  }
  const myIdx = ranked.findIndex((r: any) => String(r._id) === userId);
  const myYesterday = yesterday.find((r: any) => String(r._id) === userId);
  if (myIdx > 0) {
    events.push({ type: 'yourDay', text: `You finished #${myIdx + 1} yesterday`, highlight: `${fmt(ranked[myIdx].points)} BOGX` });
  } else if (myIdx < 0 && myYesterday) {
    events.push({ type: 'yourDay', text: 'Yesterday ended in the red', highlight: `${fmt(myYesterday.points)} BOGX, no rank` });
  }

  // 2. Overtakes on the overall (wallet) ranking. Balances before the window are
  // reconstructed from the ledger: before = now - net change since.
  const deltaOf = new Map<string, number>(deltas.map((d: any) => [String(d._id), d.delta]));
  const myBefore = coins - (deltaOf.get(userId) || 0);
  if (Math.abs(coins - myBefore) > 0.001 || deltaOf.size) {
    const lo = Math.min(coins, myBefore), hi = Math.max(coins, myBefore);
    const activeIds = Array.from(deltaOf.keys()).filter(id => id !== userId);
    const candidates: any[] = await User.find({
      ...VISIBLE, _id: { $ne: userId },
      $or: [{ _id: { $in: activeIds } }, { bogxCoins: { $gt: lo, $lte: hi } }],
    }).select('username avatar bogxCoins').lean();

    const overtookYou: any[] = [], youPassed: any[] = [];
    for (const u of candidates) {
      const now = u.bogxCoins || 0;
      const before = now - (deltaOf.get(String(u._id)) || 0);
      if (before <= myBefore && now > coins) overtookYou.push(u);
      else if (before > myBefore && now < coins) youPassed.push(u);
    }
    overtookYou.sort((a, b) => b.bogxCoins - a.bogxCoins);
    youPassed.sort((a, b) => b.bogxCoins - a.bogxCoins);
    for (const u of overtookYou.slice(0, 2)) {
      const rank = (await User.countDocuments({ bogxCoins: { $gt: u.bogxCoins || 0 } })) + 1;
      events.push({ type: 'overtook', avatar: u.avatar, text: `${u.username} overtook you`, highlight: `now #${rank}` });
    }
    if (overtookYou.length > 2) events.push({ type: 'overtook', text: `+${overtookYou.length - 2} more passed you`, highlight: '' });
    if (youPassed.length) {
      const names = youPassed.slice(0, 2).map(u => u.username).join(' & ');
      const more = youPassed.length > 2 ? ` +${youPassed.length - 2}` : '';
      events.push({ type: 'passed', avatar: youPassed[0].avatar, text: `You passed ${names}${more}`, highlight: '' });
    }
  }

  // 3. Your battles in the window
  if (myBattles.length) {
    let w = 0, l = 0, t = 0, net = 0;
    for (const b of myBattles as any[]) {
      if (!b.winner) { t++; continue; }
      if (String(b.winner) === userId) { w++; net += b.wager || 0; } else { l++; net -= b.wager || 0; }
    }
    events.push({ type: 'battles', text: `Your battles: ${w}W ${l}L${t ? ` ${t}T` : ''}`, highlight: `${fmt(net)} BOGX` });
    for (const b of (myBattles as any[]).slice(0, 2)) {
      const meCreator = String(b.creator?._id) === userId;
      const other = meCreator ? b.opponent : b.creator;
      if (!other) continue;
      const res = !b.winner ? 'T' : String(b.winner) === userId ? 'W' : 'L';
      events.push({
        type: 'battle', avatar: other.avatar,
        text: res === 'W' ? `You beat ${other.username}` : res === 'L' ? `${other.username} beat you` : `Draw with ${other.username}`,
        highlight: res === 'T' ? '±0' : `${res === 'W' ? '+' : '-'}${(b.wager || 0).toFixed(2)}`,
      });
    }
  }

  // 4. Yesterday's top battler
  if (topBattler[0]?.wins >= 2 && String(topBattler[0]._id) !== userId) {
    const tb: any = await User.findById(topBattler[0]._id).select('username avatar').lean();
    if (tb) events.push({ type: 'topBattler', avatar: tb.avatar, text: `${tb.username} ruled the battles yesterday`, highlight: `${topBattler[0].wins} wins` });
  }

  // 5. New humans
  if (newHumans.length) {
    events.push({
      type: 'newPlayers', avatar: (newHumans[0] as any).avatar,
      text: `${(newHumans as any[]).map(u => u.username).join(', ')} joined`,
      highlight: 'new humans',
    });
  }

  return events;
}
