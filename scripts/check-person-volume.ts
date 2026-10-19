// Asserts "Goes to 11" (lib/personVolume.ts, /api/people/volume): the helpers, and the API against the
// real database with two throwaway users - every vote, reward ledger row and the person's stored level
// are put back afterwards. Needs the dev server.   npx tsx scripts/check-person-volume.ts
import fs from 'fs';
import mongoose from 'mongoose';

const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
for (const l of env.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { isVolume, formatVolume, volumeLabel, averageVolume, segmentColor } = await import('../src/lib/personVolume');

  // ---------------------------------------------------------------- helpers
  eq('1..11 are votes, 0 / 12 / 5.5 / "7" are not', [1, 11, 0, 12, 5.5, '7', null].map(v => isVolume(v)), [true, true, false, false, false, false, false]);
  eq('format', [formatVolume(8.66, 3), formatVolume(11, 1), formatVolume(7, 2), formatVolume(null, 0), formatVolume(5, 0)], ['8.7', '11', '7', '–', '–']);
  eq('labels', [volumeLabel(2), volumeLabel(5), volumeLabel(8.2), volumeLabel(10), volumeLabel(11), volumeLabel(null)], ['Background noise', 'Easy listening', 'Cranked up', 'Full blast', 'This one goes to 11', 'Not turned up yet']);
  eq('average ignores junk', averageVolume([11, 7, 99, 0]), { avg: 9, count: 2 });
  eq('11 is red, 1 is green', [segmentColor(11), segmentColor(1)], ['#dc2626', '#16a34a']);

  // ---------------------------------------------------------------- the API, real database
  const dbConnect = (await import('../src/lib/mongoose')).default;
  await dbConnect();
  const db = mongoose.connection.db!;
  const people = db.collection('people'), users = db.collection('users'), votes = db.collection('personvolumes'), ledger = db.collection('gameresults');
  const person: any = await people.findOne({ volumeCount: { $in: [null, 0] }, image: { $exists: true, $ne: '' } }, { projection: { firstname: 1, lastname: 1, volumeAvg: 1, volumeCount: 1 } });
  const before = { volumeAvg: person.volumeAvg, volumeCount: person.volumeCount };
  const pid = String(person._id);
  const u1 = await users.insertOne({ username: 'zzvol-1', email: 'zzvol-1@example.invalid', bogxCoins: 0 });
  const u2 = await users.insertOne({ username: 'zzvol-2', email: 'zzvol-2@example.invalid', bogxCoins: 0 });
  const [id1, id2] = [String(u1.insertedId), String(u2.insertedId)];
  const U = 'http://localhost:3000/api/people/volume';
  const post = async (body: any) => { const r = await fetch(U, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
  try {
    console.log(`     (person: ${person.firstname} ${person.lastname})`);
    let r = await post({ personId: pid, userId: id1, value: 11 });
    eq('first vote: saved, avg 11, one vote, reward paid', [r.success, r.avg, r.count, r.mine, r.coinsEarned > 0], [true, 11, 1, 11, true]);
    r = await post({ personId: pid, userId: id1, value: 7 });
    eq('a SECOND vote is refused (409): one vote per person, final - the first one stays, no second reward', [r.status, r.alreadyVoted, r.mine, r.avg, r.count, r.coinsEarned ?? 0], [409, true, 11, 11, 1, 0]);
    const twice = await Promise.all([post({ personId: pid, userId: id2, value: 4 }), post({ personId: pid, userId: id2, value: 9 })]);
    eq('two votes at the same moment (double click, two tabs): exactly one counts', twice.map(x => x.status).sort(), [200, 409]);
    r = await (await fetch(`${U}?personId=${pid}&userId=${id2}`)).json();
    const v2 = r.mine;
    eq('a second user: two votes in total', r.count, 2);
    eq('POST/GET answer with the distribution: one at 11, one at the second user\'s level', r.distribution, Array.from({ length: 11 }, (_, i) => (i === 10 ? 1 : 0) + (i === v2 - 1 ? 1 : 0)));
    eq('12 is refused', (await post({ personId: pid, userId: id1, value: 12 })).status, 400);
    eq('5.5 is refused', (await post({ personId: pid, userId: id1, value: 5.5 })).status, 400);
    eq('an unknown user is refused', (await post({ personId: pid, userId: String(new mongoose.Types.ObjectId()), value: 5 })).status, 404);
    eq('an unknown person is refused', (await post({ personId: String(new mongoose.Types.ObjectId()), userId: id1, value: 5 })).status, 404);
    const g = await (await fetch(`${U}?personId=${pid}&userId=${id1}`)).json();
    const avg2 = (11 + v2) / 2;
    eq('GET: crowd + my own (first and only) vote', [g.avg, g.count, g.mine, g.rewarded], [avg2, 2, 11, true]);
    eq('the distribution adds up to the vote count', g.distribution.reduce((a: number, b: number) => a + b, 0), g.count);
    const b = await (await fetch(`${U}?ids=${pid},${String(new mongoose.Types.ObjectId())}`)).json();
    eq('GET batch (feed badges): known person has the level, unknown is empty', [b.byPerson[pid], Object.values(b.byPerson)[1]], [{ avg: avg2, count: 2 }, { avg: null, count: 0 }]);
    const stored: any = await people.findOne({ _id: person._id }, { projection: { volumeAvg: 1, volumeCount: 1 } });
    eq('the level is stored on the Person', [stored.volumeAvg, stored.volumeCount], [avg2, 2]);
    const paid = await ledger.countDocuments({ userId: { $in: [u1.insertedId, id1] } });
    const wallet: any = await users.findOne({ _id: u1.insertedId });
    eq('user 1 was paid exactly once (wallet + one ledger row)', [Math.round(wallet.bogxCoins * 100) / 100, paid], [0.01, 1]);
    const wallet2: any = await users.findOne({ _id: u2.insertedId });
    eq('user 2 too, despite the double click', [Math.round(wallet2.bogxCoins * 100) / 100, await ledger.countDocuments({ userId: { $in: [u2.insertedId, id2] } })], [0.01, 1]);
  } finally {
    await votes.deleteMany({ userId: { $in: [u1.insertedId, u2.insertedId] } });
    await ledger.deleteMany({ userId: { $in: [u1.insertedId, u2.insertedId, id1, id2] } });
    await users.deleteMany({ _id: { $in: [u1.insertedId, u2.insertedId] } });
    const $set: any = {}, $unset: any = {};
    for (const [k, v] of Object.entries(before)) (v === undefined ? ($unset[k] = 1) : ($set[k] = v));
    await people.updateOne({ _id: person._id }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
    const after: any = await people.findOne({ _id: person._id }, { projection: { volumeAvg: 1, volumeCount: 1 } });
    console.log('cleanup: votes left', await votes.countDocuments({ personId: person._id }), '| test users left', await users.countDocuments({ username: /^zzvol-/ }), '| person level restored', after.volumeAvg === before.volumeAvg && after.volumeCount === before.volumeCount);
    await mongoose.disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
