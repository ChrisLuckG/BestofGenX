import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { getMasterEnabled, getRuns, getSlots, rerunSlot, runSlotNow, setMasterEnabled, setSlotKind, setSlotsEnabled } from '@/lib/dailyAuto';
import { ALL_KINDS, KIND_META, berlinCalendarDay, displayStatus, formatRange, kindProblem, type SlotKind } from '@/lib/dailyAutoSchedule';

// "Run now" can take minutes (cover image + rankroll).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function requireAdmin(userId: string | null | undefined) {
  if (!userId) return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
  await dbConnect();
  const user = await User.findById(userId).select('isAdmin').lean<{ isAdmin?: boolean }>();
  if (!user?.isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  return null;
}

async function snapshot() {
  const now = new Date();
  const dayKey = berlinCalendarDay(now);
  const [slots, runs, masterEnabled] = await Promise.all([getSlots(), getRuns(dayKey), getMasterEnabled()]);
  return {
    dayKey,
    masterEnabled,
    slots: slots.map(s => {
      const run = runs.get(s.id) || null;
      return {
        id: s.id, kind: s.kind, label: KIND_META[s.kind].label, range: formatRange(s), start: s.start, enabled: s.enabled,
        // The types this slot may switch to, with the reason for each one that is closed
        kinds: ALL_KINDS.map(k => ({ kind: k, label: KIND_META[k].label, problem: k === s.kind ? null : kindProblem(slots, s.id, k) })),
        // With the master switch off nothing moves, whatever the slot's own switch says
        status: masterEnabled ? displayStatus(s, run, now, dayKey) : (run?.phase === 'published' ? (run.articleId ? 'live' : 'skipped') : 'off'),
        articleId: run?.articleId || null, personName: run?.personName || null, message: run?.message || null,
      };
    }),
  };
}

// GET ?userId= -> schedule + today's state per slot
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(new URL(request.url).searchParams.get('userId'));
  if (denied) return denied;
  return NextResponse.json({ success: true, ...(await snapshot()) });
}

// PUT { userId, slotId, kind } -> what this slot makes (refused with the reason if it cannot go there)
// PUT { userId, master } -> the master switch for the whole automation
// PUT { userId, slotId | 'all', enabled } -> switch one slot (or all) on/off
export async function PUT(request: NextRequest) {
  const { userId, slotId, enabled, master, kind } = await request.json().catch(() => ({}));
  const denied = await requireAdmin(userId);
  if (denied) return denied;
  if (typeof kind === 'string' && slotId) {
    try {
      await setSlotKind(slotId, kind as SlotKind);
      return NextResponse.json({ success: true, ...(await snapshot()) });
    } catch (e) {
      return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Could not change the type' }, { status: 400 });
    }
  }
  if (typeof master === 'boolean') {
    await setMasterEnabled(master);
    return NextResponse.json({ success: true, ...(await snapshot()) });
  }
  if (typeof enabled !== 'boolean' || !slotId) return NextResponse.json({ success: false, error: 'slotId and enabled required' }, { status: 400 });
  await setSlotsEnabled(slotId === 'all' ? 'all' : [slotId], enabled);
  return NextResponse.json({ success: true, ...(await snapshot()) });
}

// POST { userId, slotId } -> generate and publish this slot right now
// POST { userId, slotId, rerun: true } -> replace this slot's article of today with a new one
export async function POST(request: NextRequest) {
  const { userId, slotId, rerun } = await request.json().catch(() => ({}));
  const denied = await requireAdmin(userId);
  if (denied) return denied;
  if (!slotId) return NextResponse.json({ success: false, error: 'slotId required' }, { status: 400 });
  try {
    const origin = new URL(request.url).origin;
    const result = rerun ? await rerunSlot(slotId, origin) : await runSlotNow(slotId, origin);
    return NextResponse.json({ success: !result.startsWith('error:'), result, ...(await snapshot()) });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Run failed' }, { status: 500 });
  }
}
