// The author of the automatic PERSON articles (Bogx, Bogx + Rankroll, RIP): Eastercorn - the same account
// the earlier automatic person articles carried (Daily Auto had made them "BOGX Team"). History and the
// Daily Champions (Trivia Winner) stay "BOGX Team". Server-only.
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export const HOUSE_AUTHOR_USERNAME = 'Eastercorn';

export type HouseAuthor = { id: string; name: string; avatar: string };
let cached: { at: number; value: HouseAuthor | null } | null = null;

/** The Eastercorn account (an admin), or null if it does not exist - callers then fall back to "BOGX Team". */
export async function houseAuthor(): Promise<HouseAuthor | null> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value;
  await dbConnect();
  const u = await User.findOne({ username: HOUSE_AUTHOR_USERNAME, isAdmin: true }).select('_id username displayName avatar').lean<{ _id: any; username: string; displayName?: string; avatar?: string }>();
  const value = u ? { id: String(u._id), name: u.displayName || u.username, avatar: u.avatar || '' } : null;
  cached = { at: Date.now(), value };
  return value;
}
