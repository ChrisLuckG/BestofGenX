// Server-only (uses the Battle model). Your record against each of `otherIds`:
// W/L/T plus the last 5 results, newest first. Shared by the invite list, the
// user search and the battle pool so the cards always agree.
import Battle from '@/models/Battle';

export type H2HResult = 'W' | 'L' | 'T';
export interface H2H { wins: number; losses: number; ties: number; last5: H2HResult[] }

export async function headToHead(userId: string, otherIds: string[]): Promise<Map<string, H2H>> {
  const map = new Map<string, H2H>();
  const ids = Array.from(new Set(otherIds.filter(id => id && id !== userId)));
  if (!ids.length) return map;

  const battles = await Battle.find({
    status: 'completed',
    $or: [
      { creator: userId, opponent: { $in: ids } },
      { opponent: userId, creator: { $in: ids } },
    ],
  }).select('creator opponent winner completedAt createdAt').sort({ completedAt: -1, createdAt: -1 }).lean();

  for (const b of battles as any[]) {
    const other = String(b.creator) === userId ? b.opponent && String(b.opponent) : String(b.creator);
    if (!other) continue;
    const rec = map.get(other) || { wins: 0, losses: 0, ties: 0, last5: [] };
    const r: H2HResult = !b.winner ? 'T' : String(b.winner) === userId ? 'W' : 'L';
    if (r === 'W') rec.wins++; else if (r === 'L') rec.losses++; else rec.ties++;
    if (rec.last5.length < 5) rec.last5.push(r);
    map.set(other, rec);
  }
  return map;
}
