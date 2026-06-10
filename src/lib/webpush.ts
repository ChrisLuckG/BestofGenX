import webpush from 'web-push';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

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
}

/**
 * Send push notification. If `userId` is provided, automatically cleans up
 * stale subscriptions (410/404) by removing them from the User document.
 */
export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
  userId?: string
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[webpush] VAPID keys not configured, skipping');
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string };
    console.error('[webpush] Send error:', err.statusCode, err.body || error);
    
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
    
    return false;
  }
}

export { VAPID_PUBLIC_KEY };
