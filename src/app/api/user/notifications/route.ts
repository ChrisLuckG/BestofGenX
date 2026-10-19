import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { PUSH_CATEGORY_KEYS, isPushCategory, pushCategoryLabel, resolvePushPrefs } from '@/lib/pushCategories';

// Push switches live on the SERVER (`User.pushPrefs`, see lib/pushCategories.ts) because the senders
// - crons and battle routes - have to know who switched what off. They are read and written through
// the raw collection: a dev server still holding the schema it compiled earlier silently strips an
// unknown field from a $set, and a switch that was turned OFF must never be dropped that way.

// GET ?userId=            -> the settings, `push` = every category on/off
// GET ?userId=&log=1      -> plus `recent`: the last push messages sent to this user (and blocked ones)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const user = await User.findById(userId).select('notifyBattleResults notifyBattleAccepted notifyRanking');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const raw = await User.collection.findOne({ _id: user._id }, { projection: { pushPrefs: 1, pushSubscription: 1 } });

    let recent: unknown[] | undefined;
    if (searchParams.get('log')) {
      const rows = await mongoose.connection.collection('notificationlogs')
        .find({ userId: String(user._id) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      recent = rows.map(r => ({
        id: String(r._id),
        title: r.title,
        body: r.body,
        category: r.category || null,
        categoryLabel: r.category ? pushCategoryLabel(r.category) : null,
        // "blocked" = the user's own switch stopped it; "failed" = the push service refused it
        status: r.success ? 'sent' : String(r.error || '').startsWith('blocked') ? 'blocked' : 'failed',
        at: r.createdAt,
      }));
    }

    return NextResponse.json({
      success: true,
      settings: {
        battleResults: user.notifyBattleResults !== false,
        battleAccepted: user.notifyBattleAccepted !== false,
        ranking: user.notifyRanking !== false,
      },
      push: resolvePushPrefs(raw?.pushPrefs),
      ...(recent ? { recent } : {}),
    });
  } catch (error: any) {
    console.error('Failed to get notification settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST { userId, push: { battleResult: false, ... } } -> switch categories on/off (booleans only)
// POST { userId, settings: { battleResults, battleAccepted, ranking } } -> the older flags
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { userId, settings, push } = await request.json();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof settings?.battleResults === 'boolean') {
      updateData.notifyBattleResults = settings.battleResults;
    }
    if (typeof settings?.battleAccepted === 'boolean') {
      updateData.notifyBattleAccepted = settings.battleAccepted;
    }
    if (typeof settings?.ranking === 'boolean') {
      updateData.notifyRanking = settings.ranking;
    }
    if (Object.keys(updateData).length) await User.findByIdAndUpdate(userId, updateData);

    const ignored: string[] = [];
    if (push && typeof push === 'object') {
      const $set: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(push)) {
        if (isPushCategory(key) && typeof value === 'boolean') $set[`pushPrefs.${key}`] = value;
        else ignored.push(key);
      }
      if (Object.keys($set).length) {
        const res = await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set });
        if (!res.acknowledged || res.matchedCount !== 1) {
          return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Settings updated', ...(ignored.length ? { ignored } : {}), categories: PUSH_CATEGORY_KEYS });
  } catch (error: any) {
    console.error('Failed to update notification settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
