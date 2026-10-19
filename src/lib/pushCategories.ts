// Every push message the system sends belongs to one of these categories, and the user can switch
// each one off in the notification settings. ONE list, used by the settings page (what to show),
// by sendPushNotification (what to block) and by the senders (which category a message is).
//
// Dependency-free: client and server import it.
//
// Stored per user as `pushPrefs: { [category]: false }` - SERVER side. Missing = on, only an explicit
// false blocks, so a new category is on for everyone until they switch it off.
//
// `messages` is what the user will actually see in their notification tray - the exact titles
// the senders use. scripts/check-push-prefs.ts scans the code: every sendPushNotification() call
// must name a category from this list, so a message cannot exist that has no switch.

export type PushCategory =
  | 'battleRequest'
  | 'battleResult'
  | 'battleUpdates'
  | 'commentLike'
  | 'dailyResults'
  | 'songRequests'
  | 'newArticle';

export interface PushCategoryInfo {
  key: PushCategory;
  label: string;
  /** One line under the switch */
  description: string;
  /** The message titles in this category, without their emoji (shown in the settings, so nothing is a surprise) */
  messages: string[];
}

export const PUSH_CATEGORIES: PushCategoryInfo[] = [
  {
    key: 'battleRequest',
    label: 'Battle Request',
    description: 'When someone invites you',
    messages: ['Battle Challenge'],
  },
  {
    key: 'battleResult',
    label: 'Battle Result',
    description: 'When a battle is finished',
    messages: ['You Won', 'Battle Lost', 'Battle Tie', 'Battle Won (opponent gave up)'],
  },
  {
    key: 'battleUpdates',
    label: 'Battle Updates',
    description: 'Accepted, declined, cancelled or expired',
    messages: ['Battle Accepted', 'Challenge Declined', 'Battle Cancelled', 'Battle Expired'],
  },
  {
    key: 'commentLike',
    label: 'Comment Like',
    description: 'When someone likes your comment',
    messages: ['Someone liked your comment'],
  },
  {
    key: 'dailyResults',
    label: 'Daily Results',
    description: 'Your rank and points when the day ends',
    messages: ['Ergebnisse sind da'],
  },
  {
    key: 'songRequests',
    label: 'Song Requests',
    description: 'What happened to your song suggestions',
    messages: ['Song added / in progress / not added', 'New Song Request (admins)'],
  },
  {
    key: 'newArticle',
    label: 'New Article',
    description: 'When a new article is published',
    messages: ['New article'],
  },
];

export const PUSH_CATEGORY_KEYS: PushCategory[] = PUSH_CATEGORIES.map(c => c.key);

export const isPushCategory = (k: unknown): k is PushCategory => PUSH_CATEGORY_KEYS.includes(k as PushCategory);

export const pushCategoryLabel = (k: string): string => PUSH_CATEGORIES.find(c => c.key === k)?.label ?? k;

/** A message may be sent unless the user switched ITS category off. Missing prefs / key = allowed. */
export const pushAllowed = (prefs: Record<string, unknown> | null | undefined, category: PushCategory): boolean =>
  !prefs || prefs[category] !== false;

/** The full switch map for the settings page: every category, on unless explicitly off. */
export const resolvePushPrefs = (prefs: Record<string, unknown> | null | undefined): Record<PushCategory, boolean> =>
  Object.fromEntries(PUSH_CATEGORY_KEYS.map(k => [k, pushAllowed(prefs, k)])) as Record<PushCategory, boolean>;
