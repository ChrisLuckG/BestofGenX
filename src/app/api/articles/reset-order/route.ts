import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST { userId } - drop every manual article position (order -> 0) so the Post Manager
// and the feed sort by date again. Counterpart of /api/articles/reorder, which pins the
// whole list at its current positions after a drag.
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { userId } = await request.json().catch(() => ({}));
    if (!userId) return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });

    const user = await User.findById(userId).select('isAdmin').lean<{ isAdmin?: boolean }>();
    if (!user?.isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    // Direct collection write, like /reorder: bypasses the Mongoose schema cache
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ success: false, error: 'No DB connection' }, { status: 500 });
    const result = await db.collection('articles').updateMany({ order: { $ne: 0 } }, { $set: { order: 0 } });
    return NextResponse.json({ success: true, reset: result.modifiedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to reset article order:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
