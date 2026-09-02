import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mirrors src/app/api/rankings/snapshot/route.ts
function berlinOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset',
  });
  const part = dtf.formatToParts(date).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  const m = part.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return 60;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

function berlinParts(date: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year), month: Number(map.month),
    day: Number(map.day), hour: Number(map.hour === '24' ? '0' : map.hour),
  };
}

function berlinInstant(year: number, month1to12: number, day: number, hour: number): Date {
  const provisional = new Date(Date.UTC(year, month1to12 - 1, day, hour, 0, 0));
  const offset = berlinOffsetMinutes(provisional);
  return new Date(provisional.getTime() - offset * 60000);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const db = mongoose.connection.db!;

  const now = new Date();
  const cur = berlinParts(now);

  // Day start = most recent 10:00 Berlin
  const todayTen = berlinInstant(cur.year, cur.month, cur.day, 10);
  const dayStart = now.getTime() >= todayTen.getTime()
    ? todayTen
    : new Date(todayTen.getTime() - 24 * 3600 * 1000);
  const monthStart = berlinInstant(cur.year, cur.month, 1, 10);
  const yearStart = berlinInstant(cur.year, 1, 1, 10);

  console.log('Now (Berlin):', now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }));
  console.log('Day   start :', dayStart.toISOString());
  console.log('Month start :', monthStart.toISOString());
  console.log('Year  start :', yearStart.toISOString());
  console.log('');

  const user = await db.collection('users').findOne({ username: /^bacon77$/i });
  if (!user) { console.log('User Bacon77 not found'); await mongoose.disconnect(); return; }
  console.log('User:', user.username, user._id.toString(), 'bogxCoins:', user.bogxCoins);
  console.log('');

  for (const [label, start] of [['DAY', dayStart], ['MONTH', monthStart], ['YEAR', yearStart]] as const) {
    const agg = await db.collection('gameresults').aggregate([
      { $match: { playedAt: { $gte: start } } },
      { $group: { _id: '$userId', points: { $sum: '$pointsChange' }, games: { $sum: 1 } } },
    ]).toArray();

    const mine = agg.find(a => a._id?.toString() === user._id.toString());
    // Replicate the API: only points > 0 are ranked, then top 100
    const active = agg
      .filter(a => Math.round(a.points * 100) / 100 > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 100);
    const rank = active.findIndex(a => a._id?.toString() === user._id.toString()) + 1;

    console.log(`--- ${label} ---`);
    console.log(`  my net points : ${mine ? Math.round(mine.points * 100) / 100 : 'no games'}`);
    console.log(`  my games      : ${mine?.games ?? 0}`);
    console.log(`  total ranked  : ${active.length}`);
    console.log(`  MY RANK       : ${rank > 0 ? '#' + rank : 'NOT RANKED (filtered out: points <= 0 or outside top 100)'}`);
    console.log('');
  }

  // Per ranking-day breakdown for the current month. This is what makes the
  // day-vs-month difference concrete: the month is the SUM of these rows, while
  // the day column only ever shows the last one.
  console.log('--- MY RANKING-DAY BREAKDOWN (current month) ---');
  // NOTE: gameresults.userId is stored as a STRING, not an ObjectId. Querying it
  // with an ObjectId silently returns zero documents.
  const mineThisMonth = await db.collection('gameresults').find({
    userId: user._id.toString(),
    playedAt: { $gte: monthStart },
  }).project({ playedAt: 1, pointsChange: 1 }).toArray();

  const perDay = new Map<string, { points: number; games: number }>();
  for (const r of mineThisMonth) {
    // Bucket by ranking day: anything before 10:00 Berlin belongs to the previous day.
    const p = berlinParts(new Date(r.playedAt));
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    if (p.hour < 10) d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().slice(0, 10);
    const cur = perDay.get(key) || { points: 0, games: 0 };
    cur.points += r.pointsChange;
    cur.games += 1;
    perDay.set(key, cur);
  }

  let running = 0;
  // Array.from, not [...spread]: tsconfig targets ES5 without downlevelIteration,
  // so spreading a Map iterator does not compile.
  for (const key of Array.from(perDay.keys()).sort()) {
    const { points, games } = perDay.get(key)!;
    running += points;
    const pts = (Math.round(points * 100) / 100).toFixed(2).padStart(7);
    const run = (Math.round(running * 100) / 100).toFixed(2).padStart(7);
    console.log(`  ${key} (10:00->10:00)  ${pts}  (${String(games).padStart(3)} games)   month running total: ${run}`);
  }
  console.log('');

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
