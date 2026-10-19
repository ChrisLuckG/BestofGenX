import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import PersonVolume from '@/models/PersonVolume';
import User from '@/models/User';
import { awardBogx } from '@/lib/awardBogx';
import { REACTION_REWARD } from '@/config/rewards';
import { isVolume } from '@/lib/personVolume';

// "Goes to 11" - one vote per user and person (lib/personVolume.ts).
//   GET  ?personId=..&userId=..   -> { avg, count, distribution, mine, rewarded }   (distribution[0] = votes for 1 ... [10] = votes for 11)
//   GET  ?ids=a,b,c               -> { byPerson: { id: { avg, count } } }   (feed badges, one request)
//   POST { personId, userId, value 1..11 } -> { avg, count, distribution, mine, coinsEarned }
//        ONE vote per user and person, final: a second POST is refused with 409 (and the current result).
const isId = (s: unknown): s is string => typeof s === 'string' && mongoose.Types.ObjectId.isValid(s);

/** Votes per level: [votes for 1, ..., votes for 11] - the ratio behind the average. */
async function distributionOf(personId: string): Promise<number[]> {
  const rows = await PersonVolume.aggregate([
    { $match: { personId: new mongoose.Types.ObjectId(personId) } },
    { $group: { _id: '$value', n: { $sum: 1 } } },
  ]);
  const d = Array(11).fill(0);
  for (const r of rows) if (isVolume(r._id)) d[r._id - 1] = r.n;
  return d;
}

/** Recompute the person's average from the votes and store it on the Person (raw: a hot-reloaded schema would drop the fields). */
async function refreshAggregate(personId: string) {
  const [agg] = await PersonVolume.aggregate([
    { $match: { personId: new mongoose.Types.ObjectId(personId) } },
    { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
  ]);
  const avg = agg ? Math.round(agg.avg * 100) / 100 : null;
  const count = agg?.count || 0;
  await mongoose.connection.db!.collection('people').updateOne({ _id: new mongoose.Types.ObjectId(personId) }, { $set: { volumeAvg: avg, volumeCount: count } });
  return { avg, count };
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const sp = new URL(request.url).searchParams;
    const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(isId).slice(0, 200);
    if (ids.length) {
      const people = await mongoose.connection.db!.collection('people')
        .find({ _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } }, { projection: { volumeAvg: 1, volumeCount: 1 } }).toArray();
      const byPerson: Record<string, { avg: number | null; count: number }> = {};
      for (const id of ids) byPerson[id] = { avg: null, count: 0 };
      for (const p of people) byPerson[String(p._id)] = { avg: p.volumeAvg ?? null, count: p.volumeCount || 0 };
      return NextResponse.json({ success: true, byPerson });
    }

    const personId = sp.get('personId');
    if (!isId(personId)) return NextResponse.json({ success: false, error: 'personId missing' }, { status: 400 });
    const person = await mongoose.connection.db!.collection('people').findOne({ _id: new mongoose.Types.ObjectId(personId) }, { projection: { volumeAvg: 1, volumeCount: 1 } });
    const userId = sp.get('userId');
    const own = isId(userId) ? await PersonVolume.findOne({ personId, userId }).lean<{ value: number; rewarded?: boolean }>() : null;
    return NextResponse.json({ success: true, avg: person?.volumeAvg ?? null, count: person?.volumeCount || 0, distribution: await distributionOf(personId), mine: own?.value ?? null, rewarded: !!own?.rewarded });
  } catch (e) {
    console.error('[volume] GET', e);
    return NextResponse.json({ success: false, error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { personId, userId, value } = await request.json();
    if (!isId(personId) || !isId(userId)) return NextResponse.json({ success: false, error: 'personId and userId required' }, { status: 400 });
    if (!isVolume(value)) return NextResponse.json({ success: false, error: 'value must be a whole number from 1 to 11' }, { status: 400 });
    if (!(await User.exists({ _id: userId }))) return NextResponse.json({ success: false, error: 'Unknown user' }, { status: 404 });
    if (!(await mongoose.connection.db!.collection('people').findOne({ _id: new mongoose.Types.ObjectId(personId) }, { projection: { _id: 1 } }))) {
      return NextResponse.json({ success: false, error: 'Unknown person' }, { status: 404 });
    }

    // ONE vote per user and person, and it is final (like the mood emojis' reward rule, but for the vote
    // itself). Insert-only: the unique index (personId + userId) makes a second vote - also a double click
    // or two tabs at once - fail atomically, and it is answered with the vote that counts.
    try {
      await PersonVolume.create({ personId, userId, value, rewarded: true });
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
      const own = await PersonVolume.findOne({ personId, userId }).lean<{ value: number }>();
      const person = await mongoose.connection.db!.collection('people').findOne({ _id: new mongoose.Types.ObjectId(personId) }, { projection: { volumeAvg: 1, volumeCount: 1 } });
      return NextResponse.json({
        success: false, alreadyVoted: true, error: 'You have already turned this GenXer up - one vote per person',
        avg: person?.volumeAvg ?? null, count: person?.volumeCount || 0, distribution: await distributionOf(personId), mine: own?.value ?? null,
      }, { status: 409 });
    }

    // The vote is new, so this is the one reward for it
    await awardBogx({ userId, amount: REACTION_REWARD, source: 'person-volume', description: 'Turned up a GenXer (Goes to 11)' });
    const coinsEarned = REACTION_REWARD;

    const { avg, count } = await refreshAggregate(personId);
    return NextResponse.json({ success: true, avg, count, distribution: await distributionOf(personId), mine: value, coinsEarned });
  } catch (e) {
    console.error('[volume] POST', e);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
