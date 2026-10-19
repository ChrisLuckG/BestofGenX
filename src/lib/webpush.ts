import webpush from 'web-push';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import mongoose from 'mongoose';
import { pushAllowed, type PushCategory } from '@/lib/pushCategories';

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@bestofgenx.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('[webpush] VAPID keys not configured - push notifications disabled');
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  type?: 'challenge' | 'ranking' | 'general';
  /**
   * Which switch in the notification settings governs this message (lib/pushCategories.ts). The user's
   * "off" is enforced HERE, for every sender. Leave it out only for a test push: scripts/check-push-prefs.ts
   * fails for any other call that does not name one.
   */
  category?: PushCategory;
}

/** Who gets this push, and what they switched off. Raw collection: see the note in lib/articlePush.ts. */
async function recipientPrefs(subscription: { endpoint?: string }, userId?: string) {
  await dbConnect();
  const filter = userId && mongoose.Types.ObjectId.isValid(userId)
    ? { _id: new mongoose.Types.ObjectId(userId) }
    : subscription?.endpoint ? { 'pushSubscription.endpoint': subscription.endpoint } : null;
  if (!filter) return null;
  return User.collection.findOne(filter, { projection: { username: 1, pushPrefs: 1 } }) as Promise<{ _id: mongoose.Types.ObjectId; username?: string; pushPrefs?: Record<string, unknown> } | null>;
}

/** The notification log: written through the raw collection so `category` is kept even when the dev
 *  server still holds the schema it compiled before that field existed. */
async function logPush(entry: Record<string, unknown>) {
  const now = new Date();
  await mongoose.connection.collection('notificationlogs').insertOne({ ...entry, createdAt: now, updatedAt: now });
}

/**
 * Send push notification. If `userId` is provided, automatically cleans up
 * stale subscriptions (410/404) by removing them from the User document.
 * @param source - Identifier for where this notification was triggered (e.g. 'battle-challenge', 'cron-reminder')
 */
// Auto-detect source from payload content
function detectSource(payload: PushPayload): string {
  const title = (payload.title || '').toLowerCase();
  const body = (payload.body || '').toLowerCase();
  const tag = (payload.tag || '').toLowerCase();
  
  if (tag.includes('battle-challenge') || title.includes('challenge')) return 'battle-challenge';
  if (tag.includes('battle-result') || title.includes('won') || title.includes('lost')) return 'battle-result';
  if (tag.includes('battle-accepted')) return 'battle-accepted';
  if (tag.includes('battle-declined')) return 'battle-declined';
  if (tag.includes('battle-forfeit')) return 'battle-forfeit';
  if (tag.includes('battle-cancelled')) return 'battle-cancelled';
  if (tag.includes('battle-expired')) return 'battle-expired';
  if (tag.includes('song-request')) return 'song-request';
  if (title.includes('prediction')) return 'prediction';
  if (title.includes('game') || title.includes('spiel')) return 'game-notification';
  if (title.includes('reminder') || title.includes('erinnerung')) return 'game-reminder';
  if (payload.type === 'challenge') return 'battle';
  if (payload.type === 'ranking') return 'ranking';
  return 'general';
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
  userId?: string,
  source?: string
): Promise<boolean> {
  const detectedSource = source || detectSource(payload);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[webpush] VAPID keys not configured, skipping');
    return false;
  }

  // The user's switches, for every sender: found by id, or by the subscription when the sender
  // (the daily crons) does not know the id
  let recipient: Awaited<ReturnType<typeof recipientPrefs>> = null;
  try { recipient = await recipientPrefs(subscription as { endpoint?: string }, userId); } catch (e) { console.error('[webpush] recipient lookup failed:', e); }
  const logUserId = userId || (recipient ? String(recipient._id) : undefined);
  if (payload.category && recipient && !pushAllowed(recipient.pushPrefs, payload.category)) {
    try {
      await logPush({ userId: logUserId, username: recipient.username, title: payload.title, body: payload.body, type: payload.type || 'general', source: detectedSource, category: payload.category, tag: payload.tag, url: payload.url, success: false, error: `blocked: "${payload.category}" is switched off` });
    } catch { /* the log is a courtesy */ }
    return false;
  }

  let success = false;
  let errorMsg: string | undefined;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    success = true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string };
    console.error('[webpush] Send error:', err.statusCode, err.body || error);
    errorMsg = `${err.statusCode}: ${err.body || 'Unknown error'}`;
    
    // 410 Gone or 404 Not Found = subscription expired/invalid - clean up
    if ((err.statusCode === 410 || err.statusCode === 404) && userId) {
      try {
        await dbConnect();
        await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } });
        console.log(`[webpush] Cleaned up stale subscription for user ${userId}`);
      } catch (cleanupError) {
        console.error('[webpush] Cleanup error:', cleanupError);
      }
    }
  }

  // Log the notification (async, don't block). Now also for senders that do not pass a userId:
  // the recipient was found by its subscription above.
  if (logUserId) {
    try {
      await logPush({ userId: logUserId, username: recipient?.username, title: payload.title, body: payload.body, type: payload.type || 'general', source: detectedSource, category: payload.category, tag: payload.tag, url: payload.url, success, error: errorMsg });
    } catch (logError) {
      console.error('[webpush] Failed to log notification:', logError);
    }
  }

  return success;
}

export { VAPID_PUBLIC_KEY };
